#!/usr/bin/env node
// scripts/decrypt-secret.mjs — CLI helper for decrypting ENC: values from bash
// Usage: node scripts/decrypt-secret.mjs "ENC:iv:tag:ciphertext"
import { decrypt, isEncrypted } from '../wizard/lib/crypto.mjs';

const input = process.argv[2];
if (!input) { process.exit(1); }
if (isEncrypted(input)) {
  process.stdout.write(decrypt(input));
} else {
  process.stdout.write(input);
}
