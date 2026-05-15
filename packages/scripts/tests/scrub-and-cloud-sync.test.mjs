import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubSecrets, scrubArgs } from '../../wizard/lib/scrub.mjs';
import { detectCloudSync } from '../../wizard/lib/cloud-sync-detect.mjs';

test('scrubSecrets redacts --clientSecret <value>', () => {
  const input = 'pac auth create --name foo --clientSecret topSecretValue123 --tenant abc';
  const out = scrubSecrets(input);
  assert.match(out, /--clientSecret \*\*\*\*/);
  assert.doesNotMatch(out, /topSecretValue123/);
});

test('scrubSecrets redacts --client-secret=value form', () => {
  const out = scrubSecrets('--client-secret=hunter2hunter2');
  assert.match(out, /--client-secret=\*\*\*\*/);
  assert.doesNotMatch(out, /hunter2/);
});

test('scrubSecrets redacts --password and --token', () => {
  const out = scrubSecrets('cmd --password p4ssw0rdLong --token bearerXYZLong');
  assert.doesNotMatch(out, /p4ssw0rdLong/);
  assert.doesNotMatch(out, /bearerXYZLong/);
});

test('scrubSecrets redacts ENC: blobs', () => {
  const blob = 'ENC:0123456789abcdef:0123456789abcdef:0123456789abcdef';
  const out = scrubSecrets(`PP_CLIENT_SECRET=${blob}`);
  assert.equal(out, 'PP_CLIENT_SECRET=****');
});

test('scrubSecrets handles null/undefined safely', () => {
  assert.equal(scrubSecrets(null), '');
  assert.equal(scrubSecrets(undefined), '');
});

test('scrubArgs redacts value following sensitive flag', () => {
  const out = scrubArgs(['auth', 'create', '--clientSecret', 'realSecretValue', '--tenant', 'abc']);
  assert.deepEqual(out, ['auth', 'create', '--clientSecret', '****', '--tenant', 'abc']);
});

test('scrubArgs leaves non-sensitive args unchanged', () => {
  const out = scrubArgs(['org', 'who']);
  assert.deepEqual(out, ['org', 'who']);
});

test('detectCloudSync flags OneDrive on macOS', () => {
  const result = detectCloudSync('/Users/x/Library/CloudStorage/OneDrive-Microsoft/VibeCode/MyApp');
  assert.equal(result?.detected, true);
  assert.equal(result?.provider, 'OneDrive');
});

test('detectCloudSync flags Dropbox', () => {
  const result = detectCloudSync('/Users/x/Dropbox/Projects/MyApp');
  assert.equal(result?.detected, true);
  assert.equal(result?.provider, 'Dropbox');
});

test('detectCloudSync flags iCloud Drive', () => {
  const result = detectCloudSync('/Users/x/Library/Mobile Documents/com~apple~CloudDocs/MyApp');
  assert.equal(result?.detected, true);
  assert.equal(result?.provider, 'iCloud Drive');
});

test('detectCloudSync returns null for safe paths', () => {
  assert.equal(detectCloudSync('/Users/x/Code/MyApp'), null);
  assert.equal(detectCloudSync('/home/x/projects/MyApp'), null);
  assert.equal(detectCloudSync(''), null);
  assert.equal(detectCloudSync(null), null);
});

test('detectCloudSync flags OneDrive on Windows path', () => {
  const result = detectCloudSync('C:\\Users\\x\\OneDrive - Contoso\\Code\\MyApp');
  assert.equal(result?.detected, true);
  assert.equal(result?.provider, 'OneDrive');
});
