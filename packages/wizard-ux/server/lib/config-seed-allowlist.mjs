// wizard-ux/server/lib/config-seed-allowlist.mjs
// Single source of truth for which wizard-state keys are portable across projects.
// Anything not in this list is excluded from export and rejected on import.
// New state keys added in future steps are excluded by default — opt in explicitly.

export const SEED_VERSION = 1;

/** @typedef {'string'|'string[]'|'stringMap'} SeedType */
/** @typedef {{ key: string, type: SeedType, label: string }} SeedKeySpec */

/** @type {SeedKeySpec[]} */
export const CONFIG_SEED_KEYS = [
  // Publisher (org-level)
  { key: 'PUBLISHER_PREFIX',       type: 'string', label: 'Publisher prefix' },
  { key: 'PUBLISHER_ID',           type: 'string', label: 'Publisher ID' },
  { key: 'PUBLISHER_NAME',         type: 'string', label: 'Publisher name' },
  { key: 'PUBLISHER_DISPLAY_NAME', type: 'string', label: 'Publisher display name' },
  { key: 'CHOICE_VALUE_PREFIX',    type: 'string', label: 'Choice value prefix' },

  // Environments
  { key: 'PP_ENV_DEV',  type: 'string', label: 'Dev environment URL' },
  { key: 'PP_ENV_TEST', type: 'string', label: 'Test environment URL' },
  { key: 'PP_ENV_PROD', type: 'string', label: 'Prod environment URL' },

  // Auth profile references (NOT the secrets themselves)
  { key: 'AUTH_PROFILE_TYPE', type: 'string', label: 'Auth profile type' },
  { key: 'OP_VAULT',          type: 'string', label: '1Password vault' },
  { key: 'OP_ITEM',           type: 'string', label: '1Password item' },

  // Agent preference
  { key: 'CODING_AGENT', type: 'string', label: 'Coding agent' },

  // Connectors
  { key: 'CONNECTOR_API_IDS',        type: 'string[]',  label: 'Selected connector apiIds' },
  { key: 'CONNECTOR_CONNECTION_IDS', type: 'stringMap', label: 'Connection IDs by apiId' },
  { key: 'CUSTOM_CONNECTORS',        type: 'string[]',  label: 'Custom connector entries' },
];

const KEY_BY_NAME = new Map(CONFIG_SEED_KEYS.map((s) => [s.key, s]));

// Second-line defense: even if someone adds a key to the allow-list by mistake,
// reject any key name that looks like a secret.
const SECRET_KEY_PATTERN = /secret|token|password|client_id|client_secret|private_key|api[_-]?key/i;

/** Filter a state object down to the allow-listed keys. Drops empty / undefined values. */
export function filterToSeed(state) {
  const out = {};
  for (const spec of CONFIG_SEED_KEYS) {
    const raw = state?.[spec.key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (spec.type === 'string[]' && Array.isArray(raw) && raw.length === 0) continue;
    if (spec.type === 'stringMap' && typeof raw === 'object' && Object.keys(raw).length === 0) continue;
    out[spec.key] = raw;
  }
  return out;
}

/**
 * Validate an inbound payload (the `values` object from an uploaded seed file).
 * Returns { applied: {key,value}[], skipped: {key,reason}[] }.
 * Never throws on per-key issues — collects them as skips so the UI can show them.
 */
export function validateSeed(values) {
  const applied = [];
  const skipped = [];

  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return { applied: [], skipped: [{ key: '<root>', reason: 'Payload must be a JSON object.' }] };
  }

  for (const [key, value] of Object.entries(values)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      skipped.push({ key, reason: 'Key name looks like a secret; refusing to import.' });
      continue;
    }
    const spec = KEY_BY_NAME.get(key);
    if (!spec) {
      skipped.push({ key, reason: 'Key is not in the allow-list.' });
      continue;
    }
    const checked = checkType(spec, value);
    if (checked.ok) {
      applied.push({ key, value: checked.value });
    } else {
      skipped.push({ key, reason: checked.reason });
    }
  }

  return { applied, skipped };
}

function checkType(spec, value) {
  if (spec.type === 'string') {
    if (typeof value !== 'string') return { ok: false, reason: `Expected string, got ${typeOf(value)}.` };
    if (value.length > 2048) return { ok: false, reason: 'String value exceeds 2048 chars.' };
    return { ok: true, value };
  }
  if (spec.type === 'string[]') {
    if (!Array.isArray(value)) return { ok: false, reason: `Expected array of strings, got ${typeOf(value)}.` };
    if (value.length > 256) return { ok: false, reason: 'Array exceeds 256 entries.' };
    for (const item of value) {
      if (typeof item !== 'string') return { ok: false, reason: 'Array contains non-string entry.' };
    }
    return { ok: true, value };
  }
  if (spec.type === 'stringMap') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, reason: `Expected object of string-to-string, got ${typeOf(value)}.` };
    }
    const keys = Object.keys(value);
    if (keys.length > 256) return { ok: false, reason: 'Object exceeds 256 entries.' };
    for (const k of keys) {
      if (SECRET_KEY_PATTERN.test(k)) return { ok: false, reason: `Inner key ${k} looks like a secret.` };
      if (typeof value[k] !== 'string') return { ok: false, reason: `Value at ${k} is not a string.` };
    }
    return { ok: true, value };
  }
  return { ok: false, reason: `Unknown allow-list type: ${spec.type}` };
}

function typeOf(v) {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  return typeof v;
}
