import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import Fastify from 'fastify';
import stepsRoutes from '../routes/steps.mjs';
import { getStep } from '../steps/index.mjs';
import { getRun } from './process-runner.mjs';
import { readState } from './state-bridge.mjs';

async function setup(t) {
  const rootDir = mkdtempSync(join(tmpdir(), 'pacaf-prereq-'));
  const app = Fastify();
  await app.register(stepsRoutes, { prefix: '/steps', rootDir });
  t.after(async () => { await app.close(); rmSync(rootDir, { recursive: true, force: true }); });
  return { app, rootDir };
}

async function apply(app) {
  const response = await app.inject({ method: 'POST', url: '/steps/1/apply', payload: { answers: {} } });
  assert.equal(response.statusCode, 200);
  const run = getRun(response.json().runId);
  if (run.status === 'running' || run.status === 'pending') await once(run, 'end');
  return run;
}

test('failed prerequisite checks do not report completion; successful retry gets a fresh log', async (t) => {
  const { app, rootDir } = await setup(t);
  let ok = false;
  t.mock.method(getStep(1), 'apply', async (_answers, _state, log) => {
    if (ok) log.ok('Required checks passed');
    else log.fail('Unsupported Node');
    return { stateUpdate: { PYTHON_CMD: 'py -3' }, result: { allOk: ok }, completedStep: ok ? 1 : null };
  });
  const failed = await apply(app);
  assert.equal(failed.status, 'error');
  assert.match(failed.error, /Prerequisites blocked/);
  assert.equal(readState(rootDir).COMPLETED_STEP, undefined);
  assert.equal(readState(rootDir).PYTHON_CMD, 'py -3');
  ok = true;
  const passed = await apply(app);
  assert.equal(passed.status, 'done');
  assert.equal(passed.error, null);
  assert.notEqual(passed.id, failed.id);
  assert.ok(passed.lines.every((line) => line.level === 'info'));
  assert.equal(readState(rootDir).COMPLETED_STEP, 1);
});

test('unsupported running Node blocks direct scaffold URL and apply before mutations', async (t) => {
  const { app, rootDir } = await setup(t);
  const descriptor = Object.getOwnPropertyDescriptor(process.versions, 'node');
  t.after(() => Object.defineProperty(process.versions, 'node', descriptor));
  Object.defineProperty(process.versions, 'node', { value: '25.7.0', configurable: true });
  const response = await app.inject({ method: 'POST', url: '/steps/8/apply', payload: { answers: {} } });
  assert.equal(response.statusCode, 409);
  assert.match(response.json().error, /supported LTS Node/);
  assert.match(response.json().error, /25.7.0/);
  assert.deepEqual(readState(rootDir), {});
  await assert.rejects(() => getStep(8).apply({}, {}, {}), /restart the wizard/);
});

test('resumed deployment is blocked by persisted smoke failure before any build or cloud command', async () => {
  await assert.rejects(
    () => getStep(9).apply({ PUSH_TO_POWER_PLATFORM: true }, { SMOKE_TEST_STATUS: 'failed' }, {}),
    /re-run Step 8.*passing result/,
  );
});
