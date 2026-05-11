// wizard/lib/dataverse.mjs — Dataverse Web API helper (token + REST)
import { stateGet } from './state.mjs';
import { getSecret } from './secrets.mjs';

let _token = null;
let _tokenExpiry = 0;

/** Get an OAuth2 access token using SPN client credentials. */
async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const tenantId = stateGet('PP_TENANT_ID');
  const clientId = stateGet('PP_APP_ID');
  const envUrl = stateGet('PP_ENV_DEV').replace(/\/$/, '');
  const secret = getSecret();

  if (!tenantId || !clientId || !envUrl || !secret) {
    throw new Error('Missing credentials — complete auth setup first.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    scope: `${envUrl}/.default`,
    grant_type: 'client_credentials',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

/** GET from Dataverse Web API. Returns parsed JSON. */
export async function dvGet(path) {
  const envUrl = stateGet('PP_ENV_DEV').replace(/\/$/, '');
  const token = await getToken();

  const res = await fetch(`${envUrl}/api/data/v9.2/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dataverse GET failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** POST to Dataverse Web API. Returns created entity (Prefer: return=representation). */
export async function dvPost(path, body, { solutionName } = {}) {
  const envUrl = stateGet('PP_ENV_DEV').replace(/\/$/, '');
  const token = await getToken();

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    Prefer: 'return=representation',
  };
  if (solutionName) headers['MSCRM.SolutionUniqueName'] = solutionName;

  const res = await fetch(`${envUrl}/api/data/v9.2/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dataverse POST failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Clear cached token. */
export function clearTokenCache() {
  _token = null;
  _tokenExpiry = 0;
}
