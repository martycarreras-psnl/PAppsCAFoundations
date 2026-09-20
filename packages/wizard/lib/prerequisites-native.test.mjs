import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertSupportedNode, checkNode, resolvePython, pythonInvocation, checkPythonSdk } from './prerequisites.mjs';

test('the actual Node 25 process is rejected without a supplied version override', {
  skip: process.env.PACAF_TEST_REJECT_NODE25 !== '1',
}, () => {
  assert.equal(process.versions.node.split('.')[0], '25', 'CI must really launch Node 25');
  assert.equal(checkNode().ok, false);
  assert.throws(() => assertSupportedNode(), (error) => {
    assert.ok(error.message.includes(`Running v${process.versions.node}`));
    assert.match(error.message, /restart the wizard/);
    return true;
  });
});

test('native Windows resolves installed Python and a recorded virtualenv with spaces without conflating SDK absence', {
  skip: process.platform !== 'win32',
}, (t) => {
  assertSupportedNode();
  const python = resolvePython();
  assert.ok(python.command, JSON.stringify(python.attempts));
  assert.equal(python.sdkCompatible, true);
  assert.doesNotMatch(python.command, /WindowsApps/i);
  assert.equal(resolvePython(python.command).command, python.command);

  const directory = mkdtempSync(join(tmpdir(), 'pacaf python native '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const venv = join(directory, 'isolated environment');
  const invocation = pythonInvocation(python.command);
  const created = spawnSync(invocation.file, [...invocation.args, '-m', 'venv', '--without-pip', venv], {
    encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  assert.equal(created.status, 0, created.error?.message || created.stderr);

  const recorded = join(venv, 'Scripts', 'python.exe');
  const isolated = resolvePython(recorded);
  assert.equal(isolated.command, recorded);
  assert.equal(isolated.sdkCompatible, true);
  const sdk = checkPythonSdk(isolated);
  assert.equal(sdk.status, 'missing', sdk.diagnostic);
  assert.match(sdk.diagnostic, /ModuleNotFoundError.*pandas/);
  assert.equal(resolvePython(recorded).version, isolated.version);
});
