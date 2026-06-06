import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAuthListOutput,
  selectDuplicateProfiles,
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
