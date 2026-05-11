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

/**
 * Extract a connector apiId (e.g. "shared_office365users") from either a raw
 * apiId or a Maker Portal URL containing it. Returns '' if no apiId-shaped
 * token is present.
 *
 * Recognizes both "/connections/shared_xxx/" and "/apis/shared_xxx" path
 * segments, and accepts a bare "shared_xxx" string as input.
 */
export function extractConnectorApiId(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (!s) return '';
  // Path-based: /connections/<apiId>/  OR  /apis/<apiId>(/|$)
  const pathMatch = s.match(/\/(?:connections|apis)\/(shared_[a-z0-9_-]+)/i);
  if (pathMatch) return pathMatch[1].toLowerCase();
  // Bare apiId
  const bareMatch = s.match(/^(shared_[a-z0-9_-]+)$/i);
  if (bareMatch) return bareMatch[1].toLowerCase();
  return '';
}

/**
 * Parse a Power Apps Maker Portal connection URL (or a bare apiId / GUID) and
 * return whatever pieces we can recognize:
 *   { apiId: 'shared_xxx' | '', connectionId: '<guid>' | '' }
 *
 * Useful when the user pastes the entire connection-details URL — we can
 * derive both the connector and the connection ID in one shot.
 */
export function parseConnectionUrl(v) {
  return {
    apiId: extractConnectorApiId(v),
    connectionId: extractConnectionId(v),
  };
}

/**
 * Human-friendly display name from a connector apiId.
 *   "shared_office365users" -> "Office 365 Users"
 *   "shared_sharepointonline" -> "Sharepointonline"
 *   "shared_sql" -> "Sql"
 * Best-effort only; the user can override at prompt time.
 */
export function humanizeConnectorApiId(apiId) {
  if (!apiId) return '';
  const slug = String(apiId).replace(/^shared_/i, '');
  if (!slug) return apiId;
  const KNOWN = {
    office365users: 'Office 365 Users',
    office365: 'Office 365 Outlook',
    sharepointonline: 'SharePoint',
    commondataserviceforapps: 'Dataverse',
    sql: 'SQL Server',
    teams: 'Microsoft Teams',
    azureblob: 'Azure Blob Storage',
    webcontents: 'HTTP with Entra ID',
  };
  if (KNOWN[slug.toLowerCase()]) return KNOWN[slug.toLowerCase()];
  // Fallback: capitalize first letter
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}


