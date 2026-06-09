import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAuthListOutput,
  selectDuplicateProfiles,
  selectProfilesToPrune,
  extractPacError,
  isDuplicateAuthStoreError,
} from './05-environments.mjs';

// Reproduces the corrupted store from issue #102: two profiles flagged active
// (`*`) that are duplicates of the same user + environment.
const DUAL_ACTIVE_OUTPUT = `
Index Active Kind      Name                     User
[1]          UNIVERSAL pp-papps4ff-d-s-6ae3eeaf 00000000-0000-0000-0000-000000000000 Application
[2]   *      UNIVERSAL pp-check6f6-d-u-6ae3eeaf user@contoso.com User
[3]   *      UNIVERSAL pacaf-discovery          user@contoso.com User
`;

test('parseAuthListOutput parses index, active flag, kind, name, and user', () => {
  const rows = parseAuthListOutput(DUAL_ACTIVE_OUTPUT);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { index: 1, active: false, kind: 'UNIVERSAL', name: 'pp-papps4ff-d-s-6ae3eeaf', user: '00000000-0000-0000-0000-000000000000' });
  assert.deepEqual(rows[1], { index: 2, active: true, kind: 'UNIVERSAL', name: 'pp-check6f6-d-u-6ae3eeaf', user: 'user@contoso.com' });
  assert.deepEqual(rows[2], { index: 3, active: true, kind: 'UNIVERSAL', name: 'pacaf-discovery', user: 'user@contoso.com' });
});

test('parseAuthListOutput ignores the header and blank lines', () => {
  assert.deepEqual(parseAuthListOutput(''), []);
  assert.deepEqual(parseAuthListOutput('Index Active Kind Name User'), []);
});

test('selectDuplicateProfiles returns same-user/kind profiles other than the kept one', () => {
  const profiles = parseAuthListOutput(DUAL_ACTIVE_OUTPUT);
  const dupes = selectDuplicateProfiles(profiles, 'pacaf-discovery');
  assert.deepEqual(dupes.map((p) => p.name), ['pp-check6f6-d-u-6ae3eeaf']);
});

test('selectDuplicateProfiles leaves a different user untouched', () => {
  const output = `
[1]   *      UNIVERSAL pacaf-discovery   me@contoso.com User
[2]          UNIVERSAL pp-other-d-u-1234 someone@else.com User
`;
  const dupes = selectDuplicateProfiles(parseAuthListOutput(output), 'pacaf-discovery');
  assert.equal(dupes.length, 0);
});

test('selectDuplicateProfiles returns nothing when the kept profile is absent', () => {
  const dupes = selectDuplicateProfiles(parseAuthListOutput(DUAL_ACTIVE_OUTPUT), 'nonexistent');
  assert.deepEqual(dupes, []);
});

test('isDuplicateAuthStoreError matches the known pac crash signatures', () => {
  assert.equal(isDuplicateAuthStoreError('FTL | Sequence contains more than one matching element'), true);
  assert.equal(isDuplicateAuthStoreError('Sorry, the app encountered a non-recoverable error'), true);
  assert.equal(isDuplicateAuthStoreError('System.InvalidOperationException: ...'), true);
  assert.equal(isDuplicateAuthStoreError('Error: environment not found'), false);
  assert.equal(isDuplicateAuthStoreError(''), false);
});

// Reproduces the exact log from the recurring failure: a leftover env-scoped
// user profile from a prior run already holds the target name. Same user as
// discovery so it is also a same-user duplicate.
const TARGET_COLLISION_OUTPUT = `
Index Active Kind      Name                     User
[1]   *      UNIVERSAL pp-prosp8dc-d-u-6ae3eeaf user@contoso.com User
[2]          UNIVERSAL pacaf-discovery          user@contoso.com User
`;

test('selectProfilesToPrune removes a profile already holding the target name', () => {
  const profiles = parseAuthListOutput(TARGET_COLLISION_OUTPUT);
  const prune = selectProfilesToPrune(profiles, 'pacaf-discovery', 'pp-prosp8dc-d-u-6ae3eeaf');
  assert.deepEqual(prune.map((p) => p.name), ['pp-prosp8dc-d-u-6ae3eeaf']);
});

test('selectProfilesToPrune removes same-user/kind dupes plus a distinct target collision', () => {
  const output = `
[1]   *      UNIVERSAL pacaf-discovery   me@contoso.com User
[2]          UNIVERSAL pp-dup-d-u-aaaa   me@contoso.com User
[3]          UNIVERSAL pp-target-d-u-bb  someone@else.com User
`;
  const prune = selectProfilesToPrune(parseAuthListOutput(output), 'pacaf-discovery', 'pp-target-d-u-bb');
  assert.deepEqual(prune.map((p) => p.name).sort(), ['pp-dup-d-u-aaaa', 'pp-target-d-u-bb']);
});

test('selectProfilesToPrune does not double-list a profile that is both dup and target', () => {
  const profiles = parseAuthListOutput(TARGET_COLLISION_OUTPUT);
  const prune = selectProfilesToPrune(profiles, 'pacaf-discovery', 'pp-prosp8dc-d-u-6ae3eeaf');
  assert.equal(prune.length, 1);
});

test('selectProfilesToPrune never returns the kept profile', () => {
  const profiles = parseAuthListOutput(TARGET_COLLISION_OUTPUT);
  const prune = selectProfilesToPrune(profiles, 'pacaf-discovery', 'pacaf-discovery');
  assert.equal(prune.find((p) => p.name === 'pacaf-discovery'), undefined);
});

test('extractPacError prefers the pac Error: line from stdout over the generic stderr', () => {
  // pac writes the real reason to stdout; runSafeCapture puts "Command failed"
  // into stderr. Reading stderr-first (the old bug) would shadow the real error.
  const result = {
    ok: false,
    stdout: 'Index Active Kind ...\n\nError: The value 2 of --index is not valid. It must be between 1 and 1.\n',
    stderr: 'Command failed: pac auth name --index 2 --name foo',
  };
  assert.equal(extractPacError(result), 'Error: The value 2 of --index is not valid. It must be between 1 and 1.');
});

test('extractPacError falls back to stderr when stdout is empty', () => {
  assert.equal(extractPacError({ ok: false, stdout: '', stderr: 'boom' }), 'boom');
  assert.equal(extractPacError({}), '');
});
