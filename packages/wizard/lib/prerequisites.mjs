import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Reviewed against https://github.com/nodejs/Release/blob/main/schedule.json.
// Deliberately do not admit an untested future even-numbered release.
export const NODE_LTS_LINES = [
  { major: 22, lts: '2024-10-29', end: '2027-04-30' },
  { major: 24, lts: '2025-10-28', end: '2028-04-30' },
];

export function checkNode(version = process.versions.node, now = new Date()) {
  const major = Number(version.replace(/^v/, '').split('.')[0]);
  const supported = NODE_LTS_LINES.filter((line) => now >= new Date(line.lts) && now < new Date(line.end));
  const ok = supported.some((line) => line.major === major);
  const message = `PACAF requires a supported LTS Node (${supported.map((line) => line.major).join(' or ') || 'see https://nodejs.org/'}). Running v${version.replace(/^v/, '')}.`;
  const remediation = [
    'Switch Node yourself, then restart the wizard (re-running a step cannot change the running Node process).',
    'Choose ONE method for your setup; the wizard never installs or switches global Node:',
    'Official installer (all platforms): https://nodejs.org/ — choose supported LTS (24 recommended).',
    'nvm (macOS/Linux): nvm install 24 && nvm use 24',
    'nvm-windows: nvm install 24 && nvm use 24',
    'fnm: fnm install 24 && fnm use 24',
    'Volta: volta install node@24',
    'Homebrew (macOS only): brew install node@24 && brew link --overwrite --force node@24',
    'winget (Windows only): winget install OpenJS.NodeJS.LTS',
  ].join('\n');
  return { ok, version, message, remediation };
}

export function assertSupportedNode(version, now) {
  const check = checkNode(version, now);
  if (!check.ok) throw new Error(`${check.message}\n${check.remediation}`);
}

export function pythonInvocation(command) {
  // Legacy wizard state stored "py" without the Python-major selector.
  return command === 'py' || command === 'py -3'
    ? { file: 'py', args: ['-3'] }
    : { file: command, args: /(?:^|[/\\])py\.exe$/i.test(command) ? ['-3'] : [] };
}

export function pythonDisplayCommand(command, platform = process.platform) {
  if (command === 'py' || command === 'py -3') return 'py -3';
  const display = platform === 'win32' ? `& '${command.replaceAll("'", "''")}'` : `'${command.replaceAll("'", "'\\''")}'`;
  return `${display}${pythonInvocation(command).args.length ? ' -3' : ''}`;
}

function execute(command, args, run) {
  const invocation = pythonInvocation(command);
  const result = run(invocation.file, [...invocation.args, ...args], {
    encoding: 'utf8', timeout: 15000, windowsHide: true,
  });
  return {
    ok: !result.error && result.status === 0,
    stdout: String(result.stdout || '').trim(),
    diagnostic: String(result.stderr || result.error?.message || result.stdout || `Exited ${result.status}`).trim(),
  };
}

export function resolvePython(recorded, { platform = process.platform, env = process.env, home = homedir(), run = spawnSync } = {}) {
  const candidates = platform === 'win32'
    ? ['py -3', 'python', join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'Programs', 'Python', 'Launcher', 'py.exe'), join(env.WINDIR || 'C:\\Windows', 'py.exe')]
    : ['python3', '/opt/homebrew/bin/python3', '/usr/local/bin/python3', '/usr/bin/python3'];
  if (recorded === 'py') recorded = 'py -3';
  const allowed = (cmd) => typeof cmd === 'string' && cmd.length > 0 &&
    (platform === 'win32' ? !/WindowsApps|(?:^|[/\\])python3(?:\.exe)?$/i.test(cmd) : cmd !== 'python');
  const attempts = [];
  for (let command of [...new Set([...(allowed(recorded) ? [recorded] : []), ...candidates])]) {
    if (platform === 'win32' && command === 'python') {
      const located = run('where.exe', ['python'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
      const realPath = String(located.stdout || '').split(/\r?\n/).find((path) => path.trim() && !/WindowsApps/i.test(path));
      if (!realPath) {
        attempts.push({ command, diagnostic: String(located.stderr || 'No non-Store Python executable on PATH.').trim() });
        continue;
      }
      command = realPath.trim();
    }
    const probe = execute(command, ['--version'], run);
    const match = (probe.stdout || probe.diagnostic).match(/^Python (3\.(\d+)\.\d+)\s*$/);
    if (probe.ok && match) {
      return { command, version: match[1], sdkCompatible: Number(match[2]) >= 10, attempts };
    }
    attempts.push({ command, diagnostic: probe.diagnostic });
  }
  return { command: null, version: null, sdkCompatible: false, attempts };
}

export function checkPythonSdk(python, { run = spawnSync } = {}) {
  if (!python.command) return { ok: false, status: 'not-checked', diagnostic: 'SDK not checked: resolve Python first.' };
  if (!python.sdkCompatible) return { ok: false, status: 'incompatible', diagnostic: `Python ${python.version} is installed; the Dataverse SDK requires Python 3.10+. Select a compatible interpreter, not a reinstall of the existing one.` };
  for (const module of ['pandas', 'PowerPlatform.Dataverse.client']) {
    const probe = execute(python.command, ['-c', `import ${module}`], run);
    if (!probe.ok) {
      const missing = probe.diagnostic.match(/ModuleNotFoundError: No module named ['"]([^'"]+)['"]/);
      const status = missing && (module === missing[1] || module.startsWith(`${missing[1]}.`)) ? 'missing' : 'error';
      return { ok: false, status, diagnostic: probe.diagnostic };
    }
  }
  return { ok: true, status: 'available', diagnostic: '' };
}
