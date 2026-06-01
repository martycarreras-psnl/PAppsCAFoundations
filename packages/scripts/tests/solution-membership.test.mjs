// Unit tests for the shared solution-membership read + repair.
//
// These lock the core logic that decides whether a Code App is actually a
// component of its solution (issue #81 orphaned-app bug) and repairs it when it
// is not. Membership is read via `pac org fetch` (auth-agnostic — works for
// user AND SPN profiles) on the solutioncomponent table, and repaired via
// `pac solution add-solution-component` because the appId in power.config.json
// IS the canvasapp record GUID (verified). Both reads and the repair run under
// the active auth profile, so no client secret is required.

import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, '..', '..', 'wizard', 'lib', 'solution-membership.mjs');
const {
  buildMembershipFetchXml,
  checkAppInSolution,
  addAppToSolution,
  ensureAppInSolution,
  manualSolutionAddSteps,
} = await import(pathToFileURL(LIB).href);

const APP_ID = 'dcdbb905-5068-4d40-9212-7f89a17460c3';
const SOLUTION = 'MySolution';

// pac org fetch prints the selected attributes; a returned solutioncomponentid
// GUID means the app IS a component of the queried solution.
const FETCH_MEMBER = `Connected to... carrema Code Apps\nsolutioncomponentid\n11112222-3333-4444-5555-666677778888\n`;
const FETCH_ABSENT = `Connected to... carrema Code Apps\nsolutioncomponentid\n(no rows)\n`;

// ─────────── buildMembershipFetchXml ───────────

test('buildMembershipFetchXml scopes the query to the appId, type 300, and solution', () => {
  const xml = buildMembershipFetchXml(APP_ID, SOLUTION);
  assert.match(xml, /entity name="solutioncomponent"/);
  assert.match(xml, new RegExp(`objectid"\\s+operator="eq"\\s+value="${APP_ID}"`));
  assert.match(xml, /componenttype"\s+operator="eq"\s+value="300"/);
  assert.match(xml, /link-entity name="solution"/);
  assert.match(xml, new RegExp(`uniquename"\\s+operator="eq"\\s+value="${SOLUTION}"`));
});

test('buildMembershipFetchXml escapes XML-special characters in values', () => {
  const xml = buildMembershipFetchXml(APP_ID, 'A & B "quoted" <tag>');
  assert.match(xml, /A &amp; B &quot;quoted&quot; &lt;tag&gt;/);
});

// ─────────── checkAppInSolution ───────────

test('checkAppInSolution => member when pac org fetch returns a GUID row', async () => {
  const res = await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: () => ({ ok: true, stdout: FETCH_MEMBER, stderr: '' }),
  });
  assert.equal(res.status, 'member');
});

test('checkAppInSolution => absent when pac org fetch returns no GUID row', async () => {
  const res = await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: () => ({ ok: true, stdout: FETCH_ABSENT, stderr: '' }),
  });
  assert.equal(res.status, 'absent');
});

test('checkAppInSolution => unknown when the fetch command fails', async () => {
  const res = await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: () => ({ ok: false, stdout: '', stderr: 'no active auth profile' }),
  });
  assert.equal(res.status, 'unknown');
});

test('checkAppInSolution => unknown when appId is missing (app not pushed yet)', async () => {
  const res = await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: '',
    solutionUniqueName: SOLUTION,
    runCapture: () => { throw new Error('should not run'); },
  });
  assert.equal(res.status, 'unknown');
});

test('checkAppInSolution => unknown when the solution unique name is missing', async () => {
  const res = await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: '',
    runCapture: () => { throw new Error('should not run'); },
  });
  assert.equal(res.status, 'unknown');
});

test('checkAppInSolution writes FetchXML to a temp file and calls `org fetch --xmlFile`', async () => {
  const calls = [];
  await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: (_file, args) => { calls.push(args); return { ok: true, stdout: FETCH_MEMBER, stderr: '' }; },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 3), ['org', 'fetch', '--xmlFile']);
  assert.ok(calls[0][3] && calls[0][3].length > 0, 'expected a temp file path argument');
});

// ─────────── addAppToSolution ───────────

test('addAppToSolution issues add-solution-component with the appId and type 300', async () => {
  const calls = [];
  const res = await addAppToSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: (_file, args) => { calls.push(args); return { ok: true, stdout: 'added', stderr: '' }; },
  });
  assert.equal(res.ok, true);
  assert.deepEqual(calls[0], [
    'solution', 'add-solution-component',
    '--solutionUniqueName', SOLUTION,
    '--component', APP_ID,
    '--componentType', '300',
  ]);
});

test('addAppToSolution fails cleanly when appId is missing', async () => {
  const res = await addAppToSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: '',
    solutionUniqueName: SOLUTION,
    runCapture: () => { throw new Error('should not run'); },
  });
  assert.equal(res.ok, false);
});

// ─────────── ensureAppInSolution ───────────

test('ensureAppInSolution: member => no repair attempted', async () => {
  let addCalled = false;
  const res = await ensureAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: (_file, args) => {
      if (args[0] === 'solution' && args[1] === 'add-solution-component') { addCalled = true; return { ok: true, stdout: '', stderr: '' }; }
      return { ok: true, stdout: FETCH_MEMBER, stderr: '' };
    },
  });
  assert.equal(res.status, 'member');
  assert.equal(res.repaired, false);
  assert.equal(addCalled, false);
});

test('ensureAppInSolution: absent => adds the app, then confirms membership (repaired)', async () => {
  let added = false;
  const res = await ensureAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: (_file, args) => {
      if (args[0] === 'solution' && args[1] === 'add-solution-component') { added = true; return { ok: true, stdout: 'added', stderr: '' }; }
      // First fetch (pre-add) absent; after add, fetch reports member.
      return { ok: true, stdout: added ? FETCH_MEMBER : FETCH_ABSENT, stderr: '' };
    },
  });
  assert.equal(added, true);
  assert.equal(res.status, 'member');
  assert.equal(res.repaired, true);
});

test('ensureAppInSolution: absent but add fails => not repaired', async () => {
  const res = await ensureAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: (_file, args) => {
      if (args[0] === 'solution' && args[1] === 'add-solution-component') return { ok: false, stdout: '', stderr: 'privilege error' };
      return { ok: true, stdout: FETCH_ABSENT, stderr: '' };
    },
  });
  assert.equal(res.repaired, false);
});

test('ensureAppInSolution: unknown read => skips repair, never throws', async () => {
  let addCalled = false;
  const res = await ensureAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    appId: APP_ID,
    solutionUniqueName: SOLUTION,
    runCapture: (_file, args) => {
      if (args[0] === 'solution' && args[1] === 'add-solution-component') { addCalled = true; return { ok: true, stdout: '', stderr: '' }; }
      return { ok: false, stdout: '', stderr: 'no active auth profile' };
    },
  });
  assert.equal(res.status, 'unknown');
  assert.equal(res.repaired, false);
  assert.equal(addCalled, false);
});

// ─────────── manualSolutionAddSteps ───────────

test('manualSolutionAddSteps guides an Add-existing flow (never delete/recreate)', () => {
  const steps = manualSolutionAddSteps(SOLUTION, 'My App').join('\n');
  assert.match(steps, /MySolution/);
  assert.match(steps, /My App/);
  assert.match(steps, /Add existing/i);
  // It must reassure the user NOT to delete the app (the old #81 dead-end).
  assert.match(steps, /do NOT delete/i);
});

test('manualSolutionAddSteps fills in the real appId and warns about single-line paste', () => {
  const appId = '9e92e698-df56-4a43-8bf1-02d5adc5b827';
  const steps = manualSolutionAddSteps(SOLUTION, 'My App', appId).join('\n');
  // The command must carry the real appId, not a <appId> placeholder.
  assert.match(steps, new RegExp(`--component ${appId} --componentType 300`));
  assert.doesNotMatch(steps, /<appId>/);
  // It must warn the command has to be a single line (the zsh line-wrap trap).
  assert.match(steps, /SINGLE line/i);
});

test('manualSolutionAddSteps falls back to <appId> when no appId is given', () => {
  const steps = manualSolutionAddSteps(SOLUTION, 'My App').join('\n');
  assert.match(steps, /--component <appId> --componentType 300/);
});
