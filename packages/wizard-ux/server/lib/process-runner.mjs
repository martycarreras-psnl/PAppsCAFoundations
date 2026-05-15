// wizard-ux/server/lib/process-runner.mjs
// Wraps child_process.spawn and emits stdout/stderr lines on an EventEmitter so SSE
// routes can subscribe. Holds at most the last 1000 lines per run for late joiners.
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRUB = await import(pathToFileURL(resolve(__dirname, '..', '..', '..', 'wizard', 'lib', 'scrub.mjs')).href);

const runs = new Map(); // runId -> Run

class Run extends EventEmitter {
  constructor(id) {
    super();
    this.id = id;
    this.lines = []; // { stream: 'stdout'|'stderr', text, ts }
    this.status = 'pending'; // pending | running | done | error
    this.exitCode = null;
    this.error = null;
    this.startedAt = null;
    this.endedAt = null;
    this.child = null;
  }

  push(stream, text) {
    // Defense-in-depth: scrub any secret-shaped values from text before it
    // hits the SSE log buffer. The buffer is streamed to the browser and
    // rendered in the UI; never let a real secret land there.
    const safe = SCRUB.scrubSecrets(text);
    const evt = { stream, text: safe, ts: Date.now() };
    this.lines.push(evt);
    if (this.lines.length > 1000) this.lines.shift();
    this.emit('line', evt);
    // Detect device code prompts from pac auth create
    const codeMatch = safe.match(/enter the code\s+([A-Z0-9]{6,12})/i);
    const urlMatch = safe.match(/(https:\/\/microsoft\.com\/devicelogin)/i);
    if (codeMatch) {
      this.deviceCode = { code: codeMatch[1], url: 'https://microsoft.com/devicelogin', ts: Date.now() };
      this.emit('deviceCode', this.deviceCode);
    } else if (urlMatch && !this.deviceCode) {
      this.deviceCode = { code: null, url: urlMatch[1], ts: Date.now() };
      this.emit('deviceCode', this.deviceCode);
    }
  }

  cancel() {
    if (this.child && !this.child.killed) {
      try { this.child.kill('SIGINT'); } catch { /* best-effort */ }
    }
  }
}

export function newRun() {
  const id = randomBytes(8).toString('hex');
  const run = new Run(id);
  runs.set(id, run);
  // GC: clean up runs older than 30 minutes
  setTimeout(() => runs.delete(id), 30 * 60 * 1000).unref?.();
  return run;
}

export function getRun(id) {
  return runs.get(id);
}

export function spawnInRun(run, file, args, opts = {}) {
  return new Promise((resolveP) => {
    run.status = 'running';
    run.startedAt = Date.now();
    // Display args with sensitive flag values redacted (e.g. --clientSecret ****)
    const displayArgs = SCRUB.scrubArgs(args);
    run.push('stdout', `$ ${file} ${displayArgs.join(' ')}\n`);
    const child = spawn(file, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    run.child = child;
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => run.push('stdout', chunk));
    child.stderr.on('data', (chunk) => run.push('stderr', chunk));
    child.on('error', (err) => {
      run.status = 'error';
      run.error = err.message;
      run.endedAt = Date.now();
      run.emit('end');
      resolveP({ ok: false, code: -1, error: err.message });
    });
    child.on('close', (code) => {
      run.exitCode = code;
      run.status = code === 0 ? 'done' : 'error';
      run.endedAt = Date.now();
      run.emit('end');
      resolveP({ ok: code === 0, code });
    });
  });
}

/**
 * Run an async function with a "logger" that pushes lines into the run.
 * Use for steps that don't shell out — e.g. Dataverse API calls, file writes.
 */
export async function runInline(run, fn) {
  run.status = 'running';
  run.startedAt = Date.now();
  const log = {
    info: (msg) => run.push('stdout', `${msg}\n`),
    ok: (msg) => run.push('stdout', `✓ ${msg}\n`),
    warn: (msg) => run.push('stderr', `⚠ ${msg}\n`),
    fail: (msg) => run.push('stderr', `✗ ${msg}\n`),
  };
  try {
    const result = await fn(log);
    run.status = 'done';
    run.exitCode = 0;
    run.endedAt = Date.now();
    run.emit('end');
    return { ok: true, result };
  } catch (err) {
    run.status = 'error';
    run.error = err.message;
    run.exitCode = -1;
    run.endedAt = Date.now();
    log.fail(err.message);
    run.emit('end');
    return { ok: false, error: err.message };
  }
}
