// wizard/lib/secrets.mjs — In-memory client secret store with recovery
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getRootDir, stateGet } from './state.mjs';
import { runSafe } from './shell.mjs';
import { decrypt, isEncrypted } from './crypto.mjs';

let _secret = '';

export function getSecret() { return _secret; }
export function setSecret(s) { _secret = s; }
export function clearSecret() { _secret = ''; }

/**
 * Try to recover the client secret from .env.local or 1Password.
 * Used when resuming the wizard after the secret was collected in a previous session.
 */
export function recoverSecret() {
  if (_secret) return _secret;

  // Try .env.local (plain text)
  const envLocal = join(getRootDir(), '.env.local');
  if (existsSync(envLocal)) {
    const content = readFileSync(envLocal, 'utf-8');
    const match = content.match(/^PP_CLIENT_SECRET=(.+)$/m);
    if (match && match[1] && !match[1].startsWith('op://')) {
      let value = match[1].trim();
      if (isEncrypted(value)) {
        try { value = decrypt(value); } catch { return ''; }
      }
      _secret = value;
      return _secret;
    }
  }

  // Try 1Password CLI
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
