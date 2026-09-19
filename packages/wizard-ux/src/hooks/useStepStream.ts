import { useEffect, useState } from 'react';
import { DeviceCode, LogLine } from '../types/schema';

export interface StreamState {
  lines: LogLine[];
  status: 'idle' | 'running' | 'done' | 'error';
  error: string | null;
  exitCode: number | null;
  deviceCode: DeviceCode | null;
}

export function useStepStream(stepNumber: number | null, runId: string | null): StreamState {
  const key = `${stepNumber}:${runId}`;
  const empty: StreamState = { lines: [], status: runId && stepNumber ? 'running' : 'idle', error: null, exitCode: null, deviceCode: null };
  const [state, setState] = useState<StreamState & { key: string }>({ ...empty, key });

  useEffect(() => {
    let active = true;
    if (!runId || !stepNumber) {
      setState({ lines: [], status: 'idle', error: null, exitCode: null, deviceCode: null, key });
      return;
    }
    setState({ lines: [], status: 'running', error: null, exitCode: null, deviceCode: null, key });

    const url = `/api/steps/${stepNumber}/stream?runId=${encodeURIComponent(runId)}`;
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener('line', (e) => {
      if (!active) return;
      try {
        const line = JSON.parse((e as MessageEvent).data) as LogLine;
        setState((s) => ({ ...s, lines: [...s.lines, line] }));
      } catch { /* noop */ }
    });

    es.addEventListener('deviceCode', (e) => {
      if (!active) return;
      try {
        const dc = JSON.parse((e as MessageEvent).data) as DeviceCode;
        setState((s) => ({ ...s, deviceCode: dc }));
      } catch { /* noop */ }
    });

    es.addEventListener('end', (e) => {
      if (!active) return;
      try {
        const data = JSON.parse((e as MessageEvent).data) as { status: 'done' | 'error'; exitCode: number | null; error: string | null };
        setState((s) => ({ ...s, status: data.status, exitCode: data.exitCode, error: data.error }));
      } catch { /* noop */ }
      active = false;
      es.close();
    });

    es.onerror = () => {
      if (!active) return;
      setState((s) => ({ ...s, status: s.status === 'running' ? 'error' : s.status, error: 'Stream connection lost' }));
      active = false;
      es.close();
    };

    return () => { active = false; es.close(); };
  }, [stepNumber, runId, key]);

  // Hide the previous run synchronously, before the subscription effect runs.
  return state.key === key ? state : empty;
}
