// wizard/lib/crypto.mjs — AES-256-GCM encryption for local secret storage
// Adapted from dataverse-visualizer pattern. Uses only built-in Node.js modules.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { hostname, userInfo } from 'node:os';

const ALGORITHM = 'aes-256-gcm';
const SALT = 'papps-code-apps-v1';

/** Derive a machine-specific encryption key from hostname + OS username + salt. */
function deriveKey() {
  const machineId = `${hostname()}:${userInfo().username}:${SALT}`;
  return scryptSync(machineId, SALT, 32);
}

/**
 * Encrypt a plaintext string. Returns "ENC:" prefixed value:
 *   ENC:iv_hex:authTag_hex:ciphertext_hex
 */
export function encrypt(plaintext) {
  const key = deriveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `ENC:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an encrypted string. Accepts with or without "ENC:" prefix.
 */
export function decrypt(encryptedStr) {
  try {
    const raw = encryptedStr.startsWith('ENC:') ? encryptedStr.slice(4) : encryptedStr;
    const [ivHex, authTagHex, dataHex] = raw.split(':');
    if (!ivHex || !authTagHex || !dataHex) {
      throw new Error('malformed');
    }
    const key = deriveKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
  } catch {
    throw new Error('Decryption failed — value is corrupted or was encrypted on a different machine.');
  }
}

/** Check if a value is encrypted (has ENC: prefix with hex payload). */
export function isEncrypted(value) {
  return /^ENC:[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/.test(value);
}
