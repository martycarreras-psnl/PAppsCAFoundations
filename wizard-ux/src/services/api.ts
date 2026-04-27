import {
  ApplyResponse,
  QuestionsResponse,
  StateSnapshot,
  StepsList,
  SystemInfo,
} from '../types/schema';

let csrfToken: string | null = null;

async function ensureToken(): Promise<string> {
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

export const api = {
  state: () => req<StateSnapshot>('GET', '/api/state'),
  resetState: () => req<{ ok: true }>('POST', '/api/state/reset'),
  jumpTo: (step: number) => req<{ state: Record<string, unknown> }>('POST', '/api/state/jump', { step }),
  system: () => req<SystemInfo>('GET', '/api/system'),
  steps: () => req<StepsList>('GET', '/api/steps'),
  questions: (n: number) => req<QuestionsResponse>('GET', `/api/steps/${n}/questions`),
  apply: (n: number, answers: Record<string, unknown>) =>
    req<ApplyResponse>('POST', `/api/steps/${n}/apply`, { answers }),
};
