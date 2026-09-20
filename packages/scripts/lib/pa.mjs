import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';

export const PA_VERSION = '1.0.2';
export const SDK_VERSION = '1.4.0';
export const TARGETS_FILE = '.power-apps-targets.json';

export function toolName(file) {
  const { bin } = readJson(new URL('../package.json', import.meta.url));
  const name = Object.entries(bin).find(([, entry]) => entry.replace(/^\.\//, '') === file)?.[0];
  if (!name) throw new Error(`Missing CLI registration for ${file}.`);
  return name;
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read valid JSON from ${path}: ${error.message}`);
  }
}

export function projectPath(root, value, label) {
  if (typeof value !== 'string' || !value || isAbsolute(value)) {
    throw new Error(`${label} must be a project-relative path.`);
  }
  const path = resolve(root, value);
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error(`${label} must stay inside the project.`);
  }
  if (existsSync(path)) {
    const realRel = relative(realpathSync(root), realpathSync(path));
    if (isAbsolute(realRel) || realRel === '..' || realRel.startsWith('../') || realRel.startsWith('..\\')) {
      throw new Error(`${label} must not resolve outside the project.`);
    }
  }
  return path;
}

export function resolveLocalPa(root = process.cwd()) {
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error(`Power Apps CLI ${PA_VERSION} requires Node.js 22 or newer. Use a supported LTS release before running Code App commands.`);
  }
  const pkg = readJson(join(root, 'package.json'));
  if (pkg.devDependencies?.['@microsoft/power-apps-cli'] !== PA_VERSION) {
    throw new Error(`Pin @microsoft/power-apps-cli to "${PA_VERSION}" in devDependencies, then install with your project's package manager.`);
  }
  const directory = join(root, 'node_modules', '@microsoft', 'power-apps-cli');
  if (!existsSync(join(directory, 'package.json'))) {
    throw new Error(`Missing project-local @microsoft/power-apps-cli ${PA_VERSION}. Restore dependencies from your project's lockfile (npm ci or pnpm install --frozen-lockfile); no executable will be downloaded automatically.`);
  }
  const installed = readJson(join(directory, 'package.json'));
  if (installed.name !== '@microsoft/power-apps-cli' || installed.version !== PA_VERSION || installed.bin?.pa !== './dist/Bin.js') {
    throw new Error(`Installed Power Apps CLI does not match the supported ${PA_VERSION} package. Restore the project lockfile installation.`);
  }
  const entry = join(directory, 'dist', 'Bin.js');
  if (!existsSync(entry)) throw new Error('Project-local Power Apps CLI is incomplete. Restore dependencies from the lockfile.');
  return { command: process.execPath, args: [entry] };
}

export function runProcess(command, args, { root, env = process.env, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root, env, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    // Never echo captured auth output: third-party errors can include credentials.
    const error = new Error(`${command === process.execPath ? 'Local CLI' : command} failed${result.error ? ` (${result.error.code})` : ` (exit ${result.status ?? result.signal})`}.`);
    error.exitCode = result.status || 1;
    throw error;
  }
  return result.stdout || '';
}

export function runPa(args, { root = process.cwd(), env = process.env, capture = false, execute = runProcess } = {}) {
  const local = resolveLocalPa(root);
  return execute(local.command, [...local.args, ...args], { root, env, capture });
}

export function packageManager(root) {
  const pkg = readJson(join(root, 'package.json'));
  const declared = pkg.packageManager?.split('@')[0];
  const locks = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb'].filter(file => existsSync(join(root, file)));
  if (locks.length > 1) throw new Error('Multiple package manager lockfiles found; resolve the ambiguity before deploying.');
  const inferred = locks[0] === 'pnpm-lock.yaml' ? 'pnpm' : locks[0] === 'package-lock.json' ? 'npm' : undefined;
  if (declared && !['pnpm', 'npm'].includes(declared)) throw new Error('Only npm and pnpm are supported by the guarded deployment helper.');
  if (locks.length && !inferred) throw new Error('Unsupported lockfile; use a reviewed npm or pnpm migration.');
  if (declared && inferred && declared !== inferred) throw new Error('packageManager conflicts with the project lockfile.');
  return declared || inferred || 'npm';
}

export function runBuild(root, env, execute = runProcess) {
  const manager = packageManager(root);
  if (!readJson(join(root, 'package.json')).scripts?.build) throw new Error('Missing package.json build script.');
  // npm_execpath is provided by npm/pnpm scripts, avoiding .cmd shell quoting.
  const execPath = process.env.npm_execpath;
  if (execPath && existsSync(execPath) && /(?:pnpm[^/\\]*\.(?:c?js)|npm-cli\.js)$/i.test(execPath)) {
    execute(process.execPath, [execPath, 'run', 'build'], { root, env });
  } else if (process.platform === 'win32') {
    throw new Error('On Windows invoke deployment from an npm/pnpm script so the package manager can be resolved without a shell.');
  } else {
    execute(manager, ['run', 'build'], { root, env });
  }
}
