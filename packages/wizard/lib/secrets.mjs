// wizard/lib/secrets.mjs — In-memory client secret store with recovery
import { readFileSync, writeFileSync, existsSync, chmodSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, platform, hostname, userInfo } from 'node:os';
import { createHash } from 'node:crypto';
import { getRootDir, stateGet } from './state.mjs';
import { runSafe } from './shell.mjs';
import { decrypt, encrypt, isEncrypted } from './crypto.mjs';

let _secret = '';

export function getSecret() { return _secret; }
export function setSecret(s) { _secret = s; }
export function clearSecret() { _secret = ''; }

/**
 * Path to the per-project encrypted secret cache that lives OUTSIDE the
 * project root (so it never lands in cloud-sync folders or the repo).
 * Bound to project root + machine identity so it can't be moved between machines.
 */
export function getSecretCachePath(rootDir = getRootDir()) {
  const id = createHash('sha256')
    .update(`${rootDir}\u0000${hostname()}\u0000${userInfo().username}`)
    .digest('hex')
    .slice(0, 16);
  return join(tmpdir(), `pacaf-wizard-secret-${id}.enc`);
}

/**
 * Persist the in-memory secret to an encrypted, machine-bound cache file
 * outside the project root so a wizard restart doesn't force the user to
 * re-enter the secret — without ever placing the value inside a folder
 * that may be cloud-synced.
 */
export function persistSecretToCache(secret, rootDir = getRootDir()) {
  const value = String(secret || '');
  if (!value) return;
  const path = getSecretCachePath(rootDir);
  writeFileSync(path, encrypt(value), 'utf-8');
  if (platform() !== 'win32') {
    try { chmodSync(path, 0o600); } catch { /* best-effort */ }
  }
}

/** Remove the encrypted secret cache file. */
export function clearSecretCache(rootDir = getRootDir()) {
  const path = getSecretCachePath(rootDir);
  try { if (existsSync(path)) unlinkSync(path); } catch { /* best-effort */ }
}

/**
 * Try to recover the client secret from the out-of-tree encrypted cache,
 * .env.local (encrypted only — plaintext is REFUSED), or 1Password.
 */
export function recoverSecret() {
  if (_secret) return _secret;

  // 1. Encrypted cache outside the project root (preferred — never in cloud sync).
  try {
    const cachePath = getSecretCachePath();
    if (existsSync(cachePath)) {
      const blob = readFileSync(cachePath, 'utf-8').trim();
      if (isEncrypted(blob)) {
        try { _secret = decrypt(blob); if (_secret) return _secret; } catch { /* fall through */ }
      }
    }
  } catch { /* fall through */ }

  // 2. .env.local — accept ONLY encrypted values. Plaintext is rejected so an
  //    accidental edit/paste doesn't get silently trusted.
  const envLocal = join(getRootDir(), '.env.local');
  if (existsSync(envLocal)) {
    const content = readFileSync(envLocal, 'utf-8');
    const match = content.match(/^PP_CLIENT_SECRET=(.+)$/m);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value.startsWith('op://')) {
        // op:// reference — handled by the 1Password branch below.
      } else if (isEncrypted(value)) {
        try { _secret = decrypt(value); if (_secret) return _secret; } catch { /* fall through */ }
      } else {
        try {
          // eslint-disable-next-line no-console
          console.warn(
            '⚠  PP_CLIENT_SECRET in .env.local is not encrypted (no ENC: prefix and not op://).\n' +
            '   Refusing to load. Re-enter the secret so the wizard can encrypt it.',
          );
        } catch { /* no console — silent */ }
      }
    }
  }

  // 3. 1Password CLI
  const vault = stateGet('OP_VAULT');
  const item = stateGet('OP_ITEM');
  if (vault && item) {
    const result = runSafe('op', ['read', `op://${vault}/${item}/client-secret`]);
    if (result) {
      _secret = result.trim();
      return _secret;
    }
  }

  return '';
}
