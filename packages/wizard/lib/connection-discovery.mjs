import { runSafe } from './shell.mjs';

const GUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const API_ID_RE = /shared_[a-z0-9]+/ig;

export function parsePacConnectionLine(line) {
  const connectionIdMatch = line.match(GUID_RE);
  if (!connectionIdMatch) return null;

  const connectionId = connectionIdMatch[0];
  const apiMatches = Array.from(line.matchAll(API_ID_RE));
  const apiId = apiMatches.length > 0 ? apiMatches[apiMatches.length - 1][0] : '';

  const displayName = line
    .replace(connectionId, '')
    .replace(apiId, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    connectionId,
    apiId,
    displayName: displayName || connectionId,
    rawLine: line,
  };
}

export function parsePacConnectionList(output) {
  const seen = new Set();
  const parsed = [];

  for (const line of String(output || '').split(/\r?\n/)) {
    const entry = parsePacConnectionLine(line.trim());
    if (!entry || seen.has(entry.connectionId)) continue;
    seen.add(entry.connectionId);
    parsed.push(entry);
  }

  return parsed;
}

export function filterConnectionsByApiId(output, apiId) {
  return parsePacConnectionList(output).filter((entry) => entry.apiId === apiId);
}

export function discoverConnectionsForApiId(pac, apiId) {
  const output = runSafe(pac, ['connection', 'list']);
  if (output === null) return [];
  return filterConnectionsByApiId(output, apiId);
}