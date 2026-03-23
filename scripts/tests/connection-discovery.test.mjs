import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterConnectionsByApiId,
  parsePacConnectionLine,
  parsePacConnectionList,
} from '../../wizard/lib/connection-discovery.mjs';

test('parsePacConnectionLine extracts connection id, api id, and display name', () => {
  const entry = parsePacConnectionLine('160ffdfd-aff5-4740-86a8-47209c1c608c Office 365 Users Prod shared_office365users');
  assert.deepEqual(entry, {
    connectionId: '160ffdfd-aff5-4740-86a8-47209c1c608c',
    apiId: 'shared_office365users',
    displayName: 'Office 365 Users Prod',
    rawLine: '160ffdfd-aff5-4740-86a8-47209c1c608c Office 365 Users Prod shared_office365users',
  });
});

test('parsePacConnectionList ignores headers and deduplicates rows', () => {
  const output = `ConnectionId Name ApiId\n160ffdfd-aff5-4740-86a8-47209c1c608c Office 365 Users Prod shared_office365users\n160ffdfd-aff5-4740-86a8-47209c1c608c Office 365 Users Prod shared_office365users\n3f834c0d-7447-4ef9-b945-5c642e18418d Teams Sandbox shared_teams`;
  const entries = parsePacConnectionList(output);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].connectionId, '160ffdfd-aff5-4740-86a8-47209c1c608c');
  assert.equal(entries[1].apiId, 'shared_teams');
});

test('filterConnectionsByApiId returns only matching connector connections', () => {
  const output = `160ffdfd-aff5-4740-86a8-47209c1c608c Office 365 Users Prod shared_office365users\n3f834c0d-7447-4ef9-b945-5c642e18418d Teams Sandbox shared_teams\n40b0a1a4-87c4-4090-b2d2-80ebd7dfd7c4 Office 365 Users Test shared_office365users`;
  const entries = filterConnectionsByApiId(output, 'shared_office365users');
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.connectionId), [
    '160ffdfd-aff5-4740-86a8-47209c1c608c',
    '40b0a1a4-87c4-4090-b2d2-80ebd7dfd7c4',
  ]);
});