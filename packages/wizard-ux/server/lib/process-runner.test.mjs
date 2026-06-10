import test from 'node:test';
import assert from 'node:assert/strict';
import { newRun, runInline } from './process-runner.mjs';

// The UI decides whether to show the "review items" / agent-triage banner from
// each log line's `level`, NOT its OS pipe. Raw subprocess stderr (git, npm,
// vitest, pac all write normal progress to stderr) must stay 'info', or every
// successful step falsely looks like it finished with warnings.

test('raw stderr lines are tagged info, not warn', () => {
  const run = newRun();
  run.push('stderr', 'Cloning into ...\n'); // typical git/npm stderr chatter
  const line = run.lines.at(-1);
  assert.equal(line.stream, 'stderr');
  assert.equal(line.level, 'info');
});

test('raw stdout lines are tagged info', () => {
  const run = newRun();
  run.push('stdout', 'hello\n');
  assert.equal(run.lines.at(-1).level, 'info');
});

test('log.warn raises level to warn; log.fail to error; log.ok/info stay info', async () => {
  const run = newRun();
  await runInline(run, async (log) => {
    log.ok('all good');
    log.info('fyi');
    log.warn('optional thing missing');
    log.fail('something broke');
  });
  const byText = (needle) => run.lines.find((l) => l.text.includes(needle));
  assert.equal(byText('all good').level, 'info');
  assert.equal(byText('fyi').level, 'info');
  assert.equal(byText('optional thing missing').level, 'warn');
  assert.equal(byText('something broke').level, 'error');
});

test('only warn/error lines would trigger the warning banner', async () => {
  const run = newRun();
  // Simulate a successful step that shelled out (stderr chatter) and logged ok.
  run.push('stderr', 'npm notice ...\n');
  await runInline(run, async (log) => { log.ok('done'); });
  const hasWarnings = run.lines.some((l) => l.level === 'warn' || l.level === 'error');
  assert.equal(hasWarnings, false);
});
