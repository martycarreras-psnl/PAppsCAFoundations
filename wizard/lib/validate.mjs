// wizard/lib/validate.mjs — Shared validation helpers

export function isValidPrefix(v) {
  return /^[a-z]{2,8}$/.test(v);
}

export function isValidUUID(v) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

export function isValidDataverseUrl(v) {
  return /^https:\/\/.*\.crm[0-9]*\.dynamics\.com\/?$/.test(v);
}

export function isValidChoicePrefix(v) {
  return /^[0-9]{4,6}$/.test(v);
}

/**
 * Normalize a Power Platform environment URL.
 * Accepts copies from PPAC (which may omit "https://") and trailing slashes.
 * Returns a canonical "https://<host>" string, or the trimmed input unchanged
 * when no host is recognized (so downstream validators can flag it).
 */
export function normalizeDataverseUrl(v) {
  if (!v) return '';
  let s = String(v).trim();
  if (!s) return '';
  // Strip any leading scheme the user pasted (http://, HTTPS://, etc.)
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//, '');
  // Strip leading slashes ("/org.crm.dynamics.com")
  s = s.replace(/^\/+/, '');
  // Strip trailing slashes and any path/query/fragment after the host
  s = s.split(/[\/?#]/, 1)[0];
  if (!s) return '';
  return `https://${s}`;
}

/**
 * Extract a connection-ID GUID from either a raw GUID or a full Maker Portal
 * connection URL such as:
 *   https://make.powerapps.com/environments/<env>/connections/shared_xxx/<GUID>/details
 *   /providers/Microsoft.PowerApps/apis/shared_xxx/connections/<GUID>
 * Returns the GUID (lowercased), or '' if nothing GUID-shaped is present.
 */
export function extractConnectionId(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (!s) return '';
  const GUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
  const matches = s.match(GUID_RE);
  if (!matches || matches.length === 0) return '';
  // When pasted from a connection-details URL the GUID we want is the LAST
  // GUID before /details (env-id appears earlier in the path). Take the last
  // GUID-shaped token to handle both URL and raw-GUID input.
  return matches[matches.length - 1].toLowerCase();
}

