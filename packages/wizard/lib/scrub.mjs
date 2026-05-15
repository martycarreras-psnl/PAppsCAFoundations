// wizard/lib/scrub.mjs — Defense-in-depth secret scrubbing for log/error output.
//
// Used by process-runner SSE log lines and PAC error formatters so a secret
// (or an encrypted blob shaped like a secret) never lands in a captured log
// stream, an error message, or anything written to disk by accident.
//
// This is NOT a substitute for not-logging-secrets in the first place. It's a
// safety net for arg arrays, stderr text, and stdout text that may contain
// values we cannot fully control.

import { getSecret } from './secrets.mjs';

const REDACTED = '****';

const FLAG_PATTERNS = [
  // PAC CLI and similar
  /(--clientSecret|--client-secret|--password|--token|--secret|--apiKey|--api-key)(\s+|=)(\S+)/gi,
];

const VALUE_PATTERNS = [
  // Encrypted blob shape from crypto.mjs (ENC:iv_hex:tag_hex:ciphertext_hex)
  /ENC:[0-9a-fA-F]+:[0-9a-fA-F]+:[0-9a-fA-F]+/g,
];

/**
 * Replace any known secret-shaped substring in `text` with REDACTED.
 * Also redacts the current in-memory secret if one is set.
 *
 * @param {string|Buffer|null|undefined} text
 * @returns {string}
 */
export function scrubSecrets(text) {
  if (text == null) return '';
  let out = String(text);

  for (const re of FLAG_PATTERNS) {
    out = out.replace(re, (_m, flag, sep, _value) => `${flag}${sep}${REDACTED}`);
  }

  for (const re of VALUE_PATTERNS) {
    out = out.replace(re, REDACTED);
  }

  // Best-effort: redact the in-memory client secret if we know it. Avoids
  // accidentally leaking the literal value if PAC echoes it on error.
  let liveSecret = '';
  try { liveSecret = getSecret() || ''; } catch { /* secrets module not loadable here */ }
  if (liveSecret && liveSecret.length >= 8) {
    // Escape regex metacharacters in the secret value
    const escaped = liveSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), REDACTED);
  }

  return out;
}

/**
 * Same as scrubSecrets but operates on an args array intended for shell display.
 * Redacts the value following any sensitive flag.
 *
 * @param {string[]} args
 * @returns {string[]}
 */
export function scrubArgs(args) {
  if (!Array.isArray(args)) return [];
  const sensitiveFlags = new Set([
    '--clientsecret', '--client-secret', '--password', '--token', '--secret', '--apikey', '--api-key',
  ]);
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const arg = String(args[i] ?? '');
    out.push(arg);
    if (sensitiveFlags.has(arg.toLowerCase()) && i + 1 < args.length) {
      out.push(REDACTED);
      i += 1; // skip the actual value
    }
  }
  return out;
}
