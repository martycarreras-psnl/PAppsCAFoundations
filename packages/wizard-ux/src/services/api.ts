import {
  ApplyResponse,
  QuestionsResponse,
  StateSnapshot,
  StepsList,
  SystemInfo,
} from '../types/schema';

let csrfToken: string | null = null;

export async function ensureToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch('/api/handshake', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Handshake failed');
  const data = await res.json();
  csrfToken = data.csrfToken as string;
  return csrfToken;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-Wizard-Token'] = await ensureToken();
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    let payload: unknown = null;
    try { payload = await res.json(); } catch { /* noop */ }
    const msg = (payload as { error?: string } | null)?.error || `${method} ${path} failed (${res.status})`;
    const err = new Error(msg) as Error & { payload?: unknown; status?: number };
    err.payload = payload;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export type ConfigSeedKeyType = 'string' | 'string[]' | 'stringMap';
export interface ConfigSeedKeySpec {
  key: string;
  type: ConfigSeedKeyType;
  label: string;
}
export interface ConfigSeed {
  $schema?: string;
  version: number;
  exportedAt?: string;
  values: Record<string, unknown>;
}
export type ConfigSeedImportMode = 'merge' | 'replace-allowlisted';
export interface ConfigSeedImportResult {
  mode: ConfigSeedImportMode;
  written: { key: string }[];
  preserved: { key: string; reason: string }[];
  skipped: { key: string; reason: string }[];
}

export const api = {
  state: () => req<StateSnapshot>('GET', '/api/state'),
  saveState: (partial: Record<string, unknown>) =>
    req<{ state: Record<string, unknown> }>('PUT', '/api/state', partial),
  resetState: () => req<{ ok: true }>('POST', '/api/state/reset', {}),
  jumpTo: (step: number) => req<{ state: Record<string, unknown> }>('POST', '/api/state/jump', { step }),
  system: () => req<SystemInfo>('GET', '/api/system'),
  steps: () => req<StepsList>('GET', '/api/steps'),
  questions: (n: number) => req<QuestionsResponse>('GET', `/api/steps/${n}/questions`),
  apply: (n: number, answers: Record<string, unknown>) =>
    req<ApplyResponse>('POST', `/api/steps/${n}/apply`, { answers }),

  configSeedKeys: () =>
    req<{ version: number; keys: ConfigSeedKeySpec[] }>('GET', '/api/config-seed/keys'),
  exportConfigSeed: async (): Promise<{ blob: Blob; filename: string }> => {
    const res = await fetch('/api/config-seed/export', { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="([^"]+)"/i.exec(disposition);
    const filename = match?.[1] || `pacaf-wizard-config-${new Date().toISOString().slice(0, 10)}.json`;
    return { blob: await res.blob(), filename };
  },
  importConfigSeed: (seed: ConfigSeed, mode: ConfigSeedImportMode = 'merge') =>
    req<ConfigSeedImportResult>('POST', '/api/config-seed/import', { seed, mode }),
};
