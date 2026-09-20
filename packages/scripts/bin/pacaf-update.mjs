#!/usr/bin/env node
// Update only installed packages; never download an unrelated CLI with npx.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

function detectPM(cwd) {
  if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export async function updateFoundations({ cwd = process.cwd(), args = [], spawn = spawnSync, log = console.log } = {}) {
  if (args.includes('--help') || args.includes('-h')) {
    log('Usage: pacaf-update [--check]\nUpdate installed Foundations packages and sync guidance. --check exits 0 when current, 2 for drift, 1 on errors. Explicit .pacaf/policy-overlays.json policies survive sync; unregistered edits cause a refusal.');
    return 0;
  }
  if (args.some((arg) => arg !== '--check')) throw new Error('Unknown arguments. Use pacaf-update --help.');
  const checkOnly = args.includes('--check');
  function run(command, commandArgs, capture = false) {
    log(`> ${command} ${commandArgs.join(' ')}`);
    const result = spawn(command, commandArgs, {
      cwd, shell: process.platform === 'win32', ...(capture ? { encoding: 'utf8' } : { stdio: 'inherit' }),
    });
    if (result.error) log(`Command failed: ${result.error.message}`);
    return result;
  }
  function instructionCli() {
    const file = path.join(cwd, 'node_modules/@pacaf/agent-instructions/bin/pacaf-instructions.mjs');
    if (!existsSync(file)) throw new Error('@pacaf/agent-instructions is not installed locally. Install project dependencies first.');
    return file;
  }
  instructionCli();
  if (checkOnly) {
    const guidance = run(process.execPath, [instructionCli(), 'check', '--target', cwd]);
    let status = guidance.status === 0 ? 0 : guidance.status === 2 ? 2 : 1;
    for (const name of ['@pacaf/scripts', '@pacaf/agent-instructions']) {
      const file = path.join(cwd, 'node_modules', name, 'package.json');
      if (!existsSync(file)) { log(`${name} is not installed locally.`); return 1; }
      const installed = JSON.parse(readFileSync(file, 'utf8')).version;
      const latest = run('npm', ['view', name, 'version'], true);
      if (latest.status !== 0 || !latest.stdout?.trim()) {
        log(`${name}: unable to determine latest version.`);
        return 1;
      }
      if (installed !== latest.stdout.trim()) {
        log(`${name}: drift — installed ${installed}, latest ${latest.stdout.trim()}.`);
        if (status === 0) status = 2;
      } else log(`${name}: up to date (${installed}).`);
    }
    return status;
  }
  const pm = detectPM(cwd);
  const command = pm === 'pnpm' ? 'up' : pm === 'yarn' ? 'upgrade' : 'update';
  const updated = run(pm, [command, '@pacaf/scripts', '@pacaf/agent-instructions']);
  if (updated.status !== 0) { log('Package update failed; instruction sync was not attempted.'); return 1; }
  const packageRoot = path.dirname(path.dirname(instructionCli()));
  const safeSync = path.join(packageRoot, 'bin/guidance-files.mjs');
  if (!existsSync(safeSync)) {
    throw new Error('Installed agent-instructions lacks local-edit protection. Upgrade its package.json version range before syncing; no guidance was overwritten.');
  }
  const { inspectGuidance, assertNoLocalEdits } = await import(pathToFileURL(safeSync).href);
  const { overlays, conflicts } = inspectGuidance({ target: cwd, packageRoot });
  assertNoLocalEdits(conflicts);
  let synced;
  try {
    synced = run(process.execPath, [instructionCli(), 'sync', '--target', cwd]);
  } finally {
    // Keep project policy intact even if the instruction subprocess only partially succeeds.
    for (const [relative, content] of overlays) {
      const destination = path.join(cwd, relative);
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, content);
    }
  }
  if (synced.status !== 0) { log('Instruction sync failed. Review the error and local guidance; the update is incomplete.'); return 1; }
  log('Done. Review changes with: git diff');
  return 0;
}

if (process.argv[1] && existsSync(process.argv[1])
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { process.exitCode = await updateFoundations({ args: process.argv.slice(2) }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
