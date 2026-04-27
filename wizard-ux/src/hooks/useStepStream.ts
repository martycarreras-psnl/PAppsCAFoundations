import { useEffect, useState } from 'react';
import { LogLine } from '../types/schema';

export interface StreamState {
  lines: LogLine[];
  status: 'idle' | 'running' | 'done' | 'error';
  error: string | null;
  exitCode: number | null;
}

export function useStepStream(stepNumber: number | null, runId: string | null): StreamState {
  const [state, setState] = useState<StreamState>({ lines: [], status: 'idle', error: null, exitCode: null });

  useEffect(() => {
    if (!runId || !stepNumber) {
      setState({ lines: [], status: 'idle', error: null, exitCode: null });
      return;
    }
    setState({ lines: [], status: 'running', error: null, exitCode: null });

    const url = `/api/steps/${stepNumber}/stream?runId=${encodeURIComponent(runId)}`;
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener('line', (e) => {
      try {
        const line = JSON.parse((e as MessageEvent).data) as LogLine;
        setState((s) => ({ ...s, lines: [...s.lines, line] }));
      } catch { /* noop */ }
    });

    es.addEventListener('end', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { status: 'done' | 'error'; exitCode: number | null; error: string | null };
        setState((s) => ({ ...s, status: data.status, exitCode: data.exitCode, error: data.error }));
      } catch { /* noop */ }
      es.close();
    });

    es.onerror = () => {
      setState((s) => ({ ...s, status: s.status === 'running' ? 'error' : s.status, error: 'Stream connection lost' }));
      es.close();
    };

    return () => es.close();
  }, [stepNumber, runId]);

  return state;
}
