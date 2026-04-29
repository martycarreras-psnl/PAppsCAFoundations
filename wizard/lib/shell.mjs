// wizard/lib/shell.mjs — Cross-platform command execution
import { execSync, execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform, tmpdir } from 'node:os';

const IS_WIN = platform() === 'win32';

function isWindowsCommandShim(file) {
  return /\.(cmd|bat)$/i.test(String(file || ''));
}

export function resolveWindowsCommandShim(file, { isWindows = IS_WIN, existsImpl = existsSync } = {}) {
  const path = String(file || '').trim();
  if (!isWindows || !isWindowsCommandShim(path)) return path;

  const exePath = path.replace(/\.(cmd|bat)$/i, '.exe');
  return existsImpl(exePath) ? exePath : path;
}

function quoteWindowsCmdArgument(value) {
  const arg = String(value ?? '');
  if (arg.length === 0) return '""';

  const escaped = arg
    .replace(/\^/g, '^^')
    .replace(/%/g, '%%')
    .replace(/&/g, '^&')
    .replace(/\|/g, '^|')
    .replace(/</g, '^<')
    .replace(/>/g, '^>')
    .replace(/"/g, '""');

  return `"${escaped}"`;
}

export function quoteWindowsCmdCommand(file, args = []) {
  return ['call', quoteWindowsCmdArgument(file), ...args.map(quoteWindowsCmdArgument)].join(' ');
}

function createWindowsCommandScript(commandLine) {
  const scriptDir = mkdtempSync(join(tmpdir(), 'papps-shell-'));
  const scriptPath = join(scriptDir, 'run.cmd');
  writeFileSync(scriptPath, `@echo off\r\n${commandLine}\r\nexit /b %ERRORLEVEL%\r\n`, 'utf-8');

  return {
    scriptPath,
    cleanup: () => rmSync(scriptDir, { recursive: true, force: true }),
  };
}

function prepareCommandForExecution(command) {
  if (!command.windowsCommandScript) return { command, cleanup: () => {} };

  const { scriptPath, cleanup } = createWindowsCommandScript(command.windowsCommandScript);
  return {
    command: {
      ...command,
      args: [...command.args, scriptPath],
      windowsCommandScript: undefined,
    },
    cleanup,
  };
}

export function formatCommandForLog(file, args = []) {
  const quoteForLog = (value) => {
    const arg = String(value ?? '');
    if (arg.length === 0) return '""';
    return /\s/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
  };

  return [quoteForLog(file), ...args.map(quoteForLog)].join(' ');
}

export function prepareFileCommand(file, args = [], { isWindows = IS_WIN, comspec = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe' } = {}) {
  const resolvedFile = resolveWindowsCommandShim(file, { isWindows });
  if (!isWindows || !isWindowsCommandShim(resolvedFile)) return { file: resolvedFile, args, shellShim: false };

  return {
    file: comspec,
    args: ['/d', '/q', '/c'],
    shellShim: true,
    windowsCommandScript: quoteWindowsCmdCommand(resolvedFile, args),
  };
}

export function firstCommandPath(output = '') {
  return String(output || '')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean) || '';
}

/** Resolve the PAC CLI path, preferring the dotnet-tools install. */
export function pacPath() {
  const ext = IS_WIN ? '.exe' : '';
  const dotnetToolPath = join(homedir(), '.dotnet', 'tools', `pac${ext}`);
  if (existsSync(dotnetToolPath)) return dotnetToolPath;
  // Fall back to PATH (shell-safe: execFileSync with array args)
  try {
    const cmd = IS_WIN ? 'where' : 'which';
    const path = firstCommandPath(execFileSync(cmd, ['pac'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }));
    return resolveWindowsCommandShim(path);
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
  let cleanup = () => {};
  try {
    const prepared = prepareFileCommand(file, args);
    const executable = prepareCommandForExecution(prepared);
    const command = executable.command;
    cleanup = executable.cleanup;
    return execFileSync(command.file, command.args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], shell: command.shell, ...opts }).trim();
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

/** Run a command array and stream output. Returns true on success. */
export function runSafeLive(file, args, opts = {}) {
  let cleanup = () => {};
  try {
    const prepared = prepareFileCommand(file, args);
    const executable = prepareCommandForExecution(prepared);
    const command = executable.command;
    cleanup = executable.cleanup;
    execFileSync(command.file, command.args, { stdio: 'inherit', shell: command.shell, ...opts });
    return true;
  } catch {
    return false;
  } finally {
    cleanup();
  }
}

/** Spawn a command array, routing Windows .cmd/.bat shims through cmd.exe. */
export function spawnSafe(file, args, opts = {}) {
  const prepared = prepareFileCommand(file, args);
  const executable = prepareCommandForExecution(prepared);
  const child = spawn(executable.command.file, executable.command.args, { shell: executable.command.shell, ...opts });
  child.once('close', executable.cleanup);
  child.once('error', executable.cleanup);
  return child;
}

/**
 * Run a command array, stream stdout to console, and capture stderr.
 * Returns { ok: boolean, stderr: string }.
 */
export function runSafeCapture(file, args, opts = {}) {
  let cleanup = () => {};
  try {
    const prepared = prepareFileCommand(file, args);
    const executable = prepareCommandForExecution(prepared);
    const command = executable.command;
    cleanup = executable.cleanup;
    const stdout = execFileSync(command.file, command.args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], shell: command.shell, ...opts });
    return { ok: true, stdout: stdout || '', stderr: '' };
  } catch (err) {
    return { ok: false, stdout: err.stdout || '', stderr: err.stderr || err.message || '' };
  } finally {
    cleanup();
  }
}

export { IS_WIN };
