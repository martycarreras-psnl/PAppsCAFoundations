import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createMinimalProject, dependencyInstallPasses, dependencyLockfileArgs, packageSpecs, restoreDependencySpecs, writeConfig, writeStarterFiles } from '../lib/scaffold-foundations.mjs';
import { spawnSafe } from '../lib/shell.mjs';
import { resolveLocalPa } from '@pacaf/scripts/lib/pa.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function command(args, cwd, manager = 'npm') {
  const executable = process.platform === 'win32' ? `${manager}.cmd` : manager;
  // The fixture is deliberately inside the repo, but must behave like an
  // independent consumer, not install into the ancestor pnpm workspace.
  const actualArgs = manager === 'pnpm' ? ['--ignore-workspace', ...args] : args;
  try {
    return execFileSync(executable, actualArgs, {
      cwd, encoding: 'utf8', timeout: 300_000, maxBuffer: 20 * 1024 * 1024,
      shell: process.platform === 'win32',
      env: { ...process.env, CI: 'true', npm_config_audit: 'false', npm_config_fund: 'false' },
    });
  } catch (error) {
    throw new Error(`${manager} ${args.join(' ')} failed:\n${error.stdout || ''}\n${error.stderr || error.message}`);
  }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

for (const manager of ['npm', 'pnpm']) {
test(`${manager}: actual three-pass installation retains exact pins, frozen build succeeds, and concurrently stops its companion`, {
  skip: process.env.PACAF_CONSUMER_TEST !== '1',
  timeout: 900_000,
}, async (t) => {
  const projectDir = join(root, `.wizard-consumer-${randomUUID()}`);
  mkdirSync(projectDir);
  let child;
  let companionPid;
  t.after(() => {
    if (!companionPid && existsSync(join(projectDir, 'companion.pid'))) companionPid = Number(readFileSync(join(projectDir, 'companion.pid')));
    if (companionPid && alive(companionPid)) process.kill(companionPid, 'SIGKILL');
    if (child && child.exitCode === null && alive(child.pid)) child.kill('SIGKILL');
    rmSync(projectDir, { recursive: true, force: true });
  });
  createMinimalProject(projectDir, 'CLI Migration Verification');
  writeConfig(projectDir);
  writeStarterFiles(projectDir, 'CLI Migration Verification');
  const packagePath = join(projectDir, 'package.json');
  let pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  for (const name of ['scripts', 'agent-instructions']) {
    const packed = JSON.parse(command(['pack', '--ignore-scripts', '--json', '--pack-destination', projectDir], join(root, 'packages', name)))[0];
    pkg.devDependencies[`@pacaf/${name}`] = `file:./${packed.filename}`;
  }
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
  // Match the real wizard's base/runtime/dev sequence, not just its initial
  // package.json. Native install scripts are deliberately not approved here;
  // these tests do not claim interactive authentication coverage.
  command(['install', '--ignore-scripts'], projectDir, manager);
  for (const args of dependencyInstallPasses({ pnpm: manager === 'pnpm', packages: packageSpecs(pkg.dependencies) })) command([...args, '--ignore-scripts'], projectDir, manager);
  restoreDependencySpecs(projectDir, packageSpecs(pkg.dependencies));
  command([...dependencyLockfileArgs(manager === 'pnpm'), '--ignore-scripts'], projectDir, manager);
  for (const args of dependencyInstallPasses({ pnpm: manager === 'pnpm', dev: true, packages: packageSpecs(pkg.devDependencies) })) command([...args, '--ignore-scripts'], projectDir, manager);
  restoreDependencySpecs(projectDir, packageSpecs(pkg.devDependencies), { dev: true });
  command([...dependencyLockfileArgs(manager === 'pnpm'), '--ignore-scripts'], projectDir, manager);
  pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  assert.equal(pkg.devDependencies['@microsoft/power-apps-cli'], '1.0.2');
  assert.equal(pkg.dependencies['@microsoft/power-apps'], '1.4.0');
  assert.equal(pkg.dependencies.react, '^18.3.1');
  assert.equal(pkg.dependencies['@fluentui/react-components'], '^9.56.0');
  if (manager === 'npm') {
    const lock = JSON.parse(readFileSync(join(projectDir, 'package-lock.json'), 'utf8'));
    assert.equal(lock.packages[''].devDependencies['@microsoft/power-apps-cli'], '1.0.2');
    assert.equal(lock.packages[''].dependencies['@microsoft/power-apps'], '1.4.0');
    assert.equal(lock.packages['node_modules/@microsoft/power-apps-cli'].version, '1.0.2');
    assert.equal(lock.packages['node_modules/@microsoft/power-apps'].version, '1.4.0');
    command(['ci', '--offline', '--ignore-scripts'], projectDir, manager);
  } else {
    assert.ok(existsSync(join(projectDir, 'pnpm-lock.yaml')));
    command(['install', '--frozen-lockfile', '--offline', '--ignore-scripts'], projectDir, manager);
  }
  assert.equal(resolveLocalPa(projectDir).command, process.execPath);
  assert.match(command(['run', 'pa', '--', '--version'], projectDir), /1\.0\.2/);
  command(['run', 'test:smoke'], projectDir);
  command(['run', 'build'], projectDir);
  assert.ok(existsSync(join(projectDir, 'dist', 'index.html')));
  assert.match(readFileSync(join(projectDir, 'dist', 'index.html'), 'utf8'), /(?:src|href)="\.\/assets\//);

  // Run the generated topology using real concurrently, replacing only the two
  // platform executables with controlled children. No sign-in or cloud calls.
  writeFileSync(join(projectDir, 'companion.cjs'), `const fs = require('node:fs');
fs.writeFileSync('companion.pid', String(process.pid));
setInterval(() => {}, 1000);
`);
  writeFileSync(join(projectDir, 'failure.cjs'), `const fs = require('node:fs');
fs.writeFileSync('failure-args.json', JSON.stringify(process.argv.slice(2)));
const timer = setInterval(() => { if (fs.existsSync('companion.pid')) { clearInterval(timer); process.exit(7); } }, 20);
setTimeout(() => process.exit(8), 5000);
`);
  assert.match(pkg.scripts.dev, /^concurrently --kill-others-on-fail /);
  pkg.scripts['test:topology'] = pkg.scripts.dev
    .replace('"vite ', '"node companion.cjs ')
    .replace('"pacaf-pa ', '"node failure.cjs ');
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
  child = spawnSafe(npm, ['run', 'test:topology'], { cwd: projectDir, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exitCode = await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`concurrently did not exit:\n${output}`)), 15_000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => { clearTimeout(timer); resolvePromise(code); });
  });
  assert.notEqual(exitCode, 0, output);
  companionPid = Number(readFileSync(join(projectDir, 'companion.pid'), 'utf8'));
  for (let attempt = 0; attempt < 50 && alive(companionPid); attempt++) await delay(100);
  assert.equal(alive(companionPid), false, `Companion ${companionPid} survived failure:\n${output}`);
  assert.deepEqual(JSON.parse(readFileSync(join(projectDir, 'failure-args.json'), 'utf8')), [
    'app', 'run', '--config-only', '--port', '8080', '--local-app-url', 'http://localhost:3000',
  ]);
});
}
