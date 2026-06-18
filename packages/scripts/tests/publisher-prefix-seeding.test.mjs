import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizePublisherPrefix,
  upsertEnvVar,
} from '../../wizard/lib/scaffold-foundations.mjs';

// These cover the fix for the schema agent missing the wizard's publisher
// prefix: the prefix must be normalized exactly like the wizard validates it,
// and persisted into .env as PP_PUBLISHER_PREFIX so a later plan-mode schema
// agent has a concrete source of truth instead of the `yourprefix` placeholder.

test('normalizePublisherPrefix accepts valid prefixes and lowercases them', () => {
  assert.equal(normalizePublisherPrefix('csoeng'), 'csoeng');
  assert.equal(normalizePublisherPrefix('  HITLS  '), 'hitls');
  assert.equal(normalizePublisherPrefix('ab'), 'ab');
  assert.equal(normalizePublisherPrefix('abcd1234'), 'abcd1234'); // 8 chars, digits after first letter
});

test('normalizePublisherPrefix rejects missing, placeholder, and invalid values', () => {
  assert.equal(normalizePublisherPrefix(''), '');
  assert.equal(normalizePublisherPrefix(undefined), '');
  assert.equal(normalizePublisherPrefix(null), '');
  assert.equal(normalizePublisherPrefix('yourprefix'), '');   // the placeholder
  assert.equal(normalizePublisherPrefix('a'), '');            // too short
  assert.equal(normalizePublisherPrefix('toolongprefix'), ''); // > 8 chars
  assert.equal(normalizePublisherPrefix('1abc'), '');         // must start with a letter
  assert.equal(normalizePublisherPrefix('ab-cd'), '');        // no hyphens
  assert.equal(normalizePublisherPrefix('ab_cd'), '');        // no underscores
});

test('upsertEnvVar creates the file when absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prefix-env-'));
  try {
    const envPath = join(dir, '.env');
    upsertEnvVar(envPath, 'PP_PUBLISHER_PREFIX', 'csoeng');
    assert.equal(readFileSync(envPath, 'utf-8'), 'PP_PUBLISHER_PREFIX=csoeng\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('upsertEnvVar appends without clobbering existing lines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prefix-env-'));
  try {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PP_ENV_DEV=https://contoso-dev.crm.dynamics.com\n');
    upsertEnvVar(envPath, 'PP_PUBLISHER_PREFIX', 'csoeng');
    const out = readFileSync(envPath, 'utf-8');
    assert.match(out, /^PP_ENV_DEV=https:\/\/contoso-dev\.crm\.dynamics\.com$/m);
    assert.match(out, /^PP_PUBLISHER_PREFIX=csoeng$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('upsertEnvVar updates an existing key in place', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prefix-env-'));
  try {
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'PP_PUBLISHER_PREFIX=oldval\nPP_ENV_DEV=x\n');
    upsertEnvVar(envPath, 'PP_PUBLISHER_PREFIX', 'csoeng');
    const out = readFileSync(envPath, 'utf-8');
    assert.match(out, /^PP_PUBLISHER_PREFIX=csoeng$/m);
    assert.doesNotMatch(out, /oldval/);
    assert.match(out, /^PP_ENV_DEV=x$/m); // untouched
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the seeded planning-payload substitution replaces every yourprefix token', () => {
  // Mirrors the .split('yourprefix').join(prefix) substitution applied to the
  // schema-plan example when seeding dataverse/planning-payload.json.
  const example = '{"schemaName":"yourprefix_ProjectRequest","logicalName":"yourprefix_requeststatus"}';
  const prefix = normalizePublisherPrefix('csoeng');
  const seeded = example.split('yourprefix').join(prefix);
  assert.doesNotMatch(seeded, /yourprefix/);
  assert.match(seeded, /csoeng_ProjectRequest/);
  assert.match(seeded, /csoeng_requeststatus/);
});
