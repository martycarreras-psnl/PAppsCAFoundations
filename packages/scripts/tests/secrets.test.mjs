import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getSecretCachePath,
  persistSecretToCache,
  clearSecretCache,
  setSecret,
  clearSecret,
  recoverSecret,
} from '../../wizard/lib/secrets.mjs';
import { encrypt, isEncrypted } from '../../wizard/lib/crypto.mjs';
import { getRootDir } from '../../wizard/lib/state.mjs';

test('persistSecretToCache writes outside the project root', () => {
  const root = mkdtempSync(join(tmpdir(), 'pacaf-test-secrets-'));
  try {
    persistSecretToCache('cached-secret-xyz', root);
    const cachePath = getSecretCachePath(root);
    assert.ok(!cachePath.startsWith(root), `cache path must NOT be inside project root (got ${cachePath})`);
    assert.ok(existsSync(cachePath), 'cache file must exist after persistSecretToCache');
    const blob = readFileSync(cachePath, 'utf-8').trim();
    assert.ok(isEncrypted(blob), 'cache file contents must be encrypted (ENC: prefix)');
    clearSecretCache(root);
    assert.ok(!existsSync(cachePath), 'clearSecretCache must remove the file');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('cache path is stable per (rootDir, host, user) combo', () => {
  const a = getSecretCachePath('/a/b/c');
  const b = getSecretCachePath('/a/b/c');
  const c = getSecretCachePath('/x/y/z');
  assert.equal(a, b, 'same input must produce same path');
  assert.notEqual(a, c, 'different rootDir must produce different path');
});

// recoverSecret() reads from getRootDir() — a fixed module-init path. We exercise
// it by writing .env.local to that path and cleaning up after, so we can verify
// the plaintext-rejection and encrypted-acceptance branches end-to-end.
test('recoverSecret refuses plaintext PP_CLIENT_SECRET in .env.local', () => {
  const root = getRootDir();
  const envLocalPath = join(root, '.env.local');
  const hadExisting = existsSync(envLocalPath);
  const backup = hadExisting ? readFileSync(envLocalPath, 'utf-8') : null;
  try {
    clearSecret();
    clearSecretCache(root);
    writeFileSync(envLocalPath, 'PP_CLIENT_SECRET=plain-text-secret-123\n', 'utf-8');
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (msg) => warnings.push(String(msg));
    const result = recoverSecret();
    console.warn = origWarn;
    assert.equal(result, '', 'plaintext must NOT be returned');
    assert.ok(warnings.some((w) => w.includes('not encrypted')), 'should warn about plaintext');
  } finally {
    if (hadExisting) writeFileSync(envLocalPath, backup, 'utf-8');
    else { try { rmSync(envLocalPath); } catch { /* ignore */ } }
    clearSecret();
  }
});

test('recoverSecret accepts encrypted PP_CLIENT_SECRET', () => {
  const root = getRootDir();
  const envLocalPath = join(root, '.env.local');
  const hadExisting = existsSync(envLocalPath);
  const backup = hadExisting ? readFileSync(envLocalPath, 'utf-8') : null;
  try {
    clearSecret();
    clearSecretCache(root);
    const enc = encrypt('real-secret-value');
    writeFileSync(envLocalPath, `PP_CLIENT_SECRET=${enc}\n`, 'utf-8');
    const result = recoverSecret();
    assert.equal(result, 'real-secret-value');
  } finally {
    if (hadExisting) writeFileSync(envLocalPath, backup, 'utf-8');
    else { try { rmSync(envLocalPath); } catch { /* ignore */ } }
    clearSecret();
  }
});

test('recoverSecret reads from out-of-tree cache (preferred over .env.local)', () => {
  const root = getRootDir();
  try {
    clearSecret();
    persistSecretToCache('round-trip-secret', root);
    const result = recoverSecret();
    assert.equal(result, 'round-trip-secret');
  } finally {
    clearSecretCache(root);
    clearSecret();
  }
});

test('setSecret/getSecret round-trip via in-memory store', () => {
  setSecret('mem-secret');
  assert.equal(recoverSecret(), 'mem-secret');
  clearSecret();
});
