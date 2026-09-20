import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNode, assertSupportedNode, resolvePython, checkPythonSdk, pythonInvocation, pythonDisplayCommand } from './prerequisites.mjs';

const now = new Date('2026-09-19');
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const missing = () => ({ status: null, error: { message: 'spawn ENOENT' } });

test('only supported LTS lines pass, not old LTS, odd, future, or invalid versions', () => {
  for (const version of ['22.0.0', 'v22.19.0', '24.19.0']) assert.equal(checkNode(version, now).ok, true);
  for (const version of ['18.20.0', '20.19.0', '23.0.0', '25.7.0', '26.0.0', 'garbage']) {
    assert.equal(checkNode(version, now).ok, false);
    assert.throws(() => assertSupportedNode(version, now), /restart the wizard/);
  }
  assert.equal(checkNode('24.0.0', new Date('2025-09-01')).ok, false);
  assert.equal(checkNode('22.0.0', new Date('2027-04-30')).ok, false);
  assert.equal(checkNode().version, process.versions.node);
});

test('macOS never probes bare python and missing SDK never changes interpreter detection', () => {
  const calls = [];
  const run = (file, args) => {
    calls.push([file, args]);
    if (args[0] === '--version') return ok('Python 3.12.1');
    if (args[1] === 'import pandas') return ok();
    return { status: 1, stderr: "ModuleNotFoundError: No module named 'PowerPlatform'" };
  };
  const python = resolvePython('python', { platform: 'darwin', run });
  assert.equal(python.command, 'python3');
  assert.equal(checkPythonSdk(python, { run }).status, 'missing');
  assert.equal(python.version, '3.12.1');
  assert.ok(calls.every(([file]) => file === 'python3'));
  assert.ok(calls.some(([, args]) => args[1] === 'import PowerPlatform.Dataverse.client'));
});

test('recorded interpreter with spaces is reused with argv, not a shell', () => {
  const command = '/Users/test/Python Env/bin/python3';
  const calls = [];
  const run = (file, args) => { calls.push([file, args]); return ok(args[0] === '--version' ? 'Python 3.12.1' : ''); };
  const python = resolvePython(command, { platform: 'darwin', run });
  assert.equal(checkPythonSdk(python, { run }).ok, true);
  assert.ok(calls.every(([file]) => file === command));
  assert.equal(pythonDisplayCommand(command, 'darwin'), `'${command}'`);
});

test('Windows prefers py -3, migrates legacy recorded py, and pairs imports with launcher', () => {
  const calls = [];
  const run = (file, args) => { calls.push([file, args]); return ok(args.includes('--version') ? 'Python 3.12.1' : ''); };
  for (const recorded of [undefined, 'py']) {
    const python = resolvePython(recorded, { platform: 'win32', run });
    assert.equal(python.command, 'py -3');
    assert.equal(checkPythonSdk(python, { run }).ok, true);
  }
  assert.ok(calls.every(([file, args]) => file === 'py' && args[0] === '-3'));
  assert.deepEqual(pythonInvocation('C:\\Windows\\py.exe'), { file: 'C:\\Windows\\py.exe', args: ['-3'] });
});

test('Windows skips Store aliases and falls back to real python.exe', () => {
  const calls = [];
  const realPath = 'C:\\Program Files\\Python\\python.exe';
  const run = (file, args) => {
    calls.push([file, args]);
    if (file === 'where.exe') return ok(`C:\\Users\\test\\Microsoft\\WindowsApps\\python.exe\r\n${realPath}`);
    if (file === realPath) return ok('Python 3.11.8');
    return missing();
  };
  const python = resolvePython('python3', { platform: 'win32', run });
  assert.equal(python.command, realPath);
  assert.ok(calls.every(([file]) => !/WindowsApps|python3/.test(file)));
});

test('canonical paths recover a missing POSIX PATH entry', () => {
  const python = resolvePython('/stale/python3', { platform: 'darwin', run: (file) => file === '/opt/homebrew/bin/python3' ? ok('Python 3.14.0') : missing() });
  assert.equal(python.command, '/opt/homebrew/bin/python3');
  assert.ok(python.attempts.some((attempt) => attempt.command === '/stale/python3'));
});

test('Python 3.9 is installed but incompatible; SDK check does not attempt pip/imports', () => {
  const python = resolvePython(null, { platform: 'darwin', run: () => ok('Python 3.9.6') });
  assert.equal(python.command, 'python3');
  const sdk = checkPythonSdk(python, { run: () => assert.fail('must not import') });
  assert.equal(sdk.status, 'incompatible');
  assert.match(sdk.diagnostic, /installed.*3.10/);
});

test('no interpreter, wrong major, and Store stub are not SDK failures', () => {
  for (const response of [missing(), ok('Python 2.7.18'), { status: 9009, stderr: 'Python was not found; Microsoft Store' }]) {
    const python = resolvePython(null, { platform: 'darwin', run: () => response });
    assert.equal(python.command, null);
    assert.equal(checkPythonSdk(python).status, 'not-checked');
    assert.ok(python.attempts.length);
  }
});

test('broken imports and missing transitive dependencies retain stderr without claiming absent SDK', () => {
  const python = { command: 'python3', version: '3.12.1', sdkCompatible: true };
  for (const diagnostic of ["ModuleNotFoundError: No module named 'numpy'", 'ImportError: incompatible binary', 'Permission denied']) {
    const sdk = checkPythonSdk(python, { run: () => ({ status: 1, stderr: diagnostic }) });
    assert.equal(sdk.status, 'error');
    assert.equal(sdk.diagnostic, diagnostic);
  }
});
