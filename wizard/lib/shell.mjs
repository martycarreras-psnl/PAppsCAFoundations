// wizard/lib/shell.mjs — Cross-platform command execution
import { execSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';

const IS_WIN = platform() === 'win32';

/** Resolve the PAC CLI path, preferring the dotnet-tools install. */
export function pacPath() {
  const ext = IS_WIN ? '.exe' : '';
  const dotnetToolPath = join(homedir(), '.dotnet', 'tools', `pac${ext}`);
  if (existsSync(dotnetToolPath)) return dotnetToolPath;
  // Fall back to PATH (shell-safe: execFileSync with array args)
  try {
    const cmd = IS_WIN ? 'where' : 'which';
    return execFileSync(cmd, ['pac'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim().split('\n')[0];
  } catch {
    return null;
  }
}

/** Check whether a command is available on PATH. */
export function hasCommand(name) {
  try {
    const cmd = IS_WIN ? 'where' : 'which';
    execFileSync(cmd, [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Get stdout of a command, or null on failure. */
export function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
  } catch {
    return null;
  }
}

/** Run a command and stream output to the console. Returns true on success. */
export function runLive(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
    return true;
  } catch {
    return false;
  }
}

/** Run a command array (no shell injection). Returns stdout or null. */
export function runSafe(file, args, opts = {}) {
  try {
    return execFileSync(file, args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
  } catch {
    return null;
  }
}

/** Run a command array and stream output. Returns true on success. */
export function runSafeLive(file, args, opts = {}) {
  try {
    execFileSync(file, args, { stdio: 'inherit', ...opts });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a command array, stream stdout to console, and capture stderr.
 * Returns { ok: boolean, stderr: string }.
 */
export function runSafeCapture(file, args, opts = {}) {
  try {
    const stdout = execFileSync(file, args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
    return { ok: true, stdout: stdout || '', stderr: '' };
  } catch (err) {
    return { ok: false, stdout: err.stdout || '', stderr: err.stderr || err.message || '' };
  }
}

export { IS_WIN };
