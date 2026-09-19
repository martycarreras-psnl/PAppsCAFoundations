import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useStepStream } from './useStepStream';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, (event: MessageEvent) => void>();
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  addEventListener(type: string, listener: (event: MessageEvent) => void) { this.listeners.set(type, listener); }
  close() { this.closed = true; }
  emit(type: string, data: unknown) {
    act(() => this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(data) })));
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('clears failures, warnings and device codes when retry begins, ignoring late old events', () => {
  const { result, rerender } = renderHook(({ runId }) => useStepStream(8, runId), { initialProps: { runId: 'first' as string | null } });
  const first = FakeEventSource.instances[0];
  first.emit('line', { text: 'Verification failed', level: 'warn', stream: 'stderr', ts: 1 });
  first.emit('deviceCode', { code: 'ABC123' });
  first.emit('end', { status: 'error', error: 'Old failure', exitCode: 1 });
  expect(result.current.status).toBe('error');
  rerender({ runId: null });
  expect(result.current).toMatchObject({ status: 'idle', lines: [], error: null, deviceCode: null });
  rerender({ runId: 'second' });
  const second = FakeEventSource.instances[1];
  first.emit('line', { text: 'late warning', level: 'warn' });
  act(() => first.onerror?.());
  second.emit('line', { text: 'Smoke tests passed', level: 'info', stream: 'stderr', ts: 2 });
  second.emit('end', { status: 'done', error: null, exitCode: 0 });
  act(() => second.onerror?.());
  expect(result.current.status).toBe('done');
  expect(result.current.error).toBeNull();
  expect(result.current.lines.map((line) => line.text)).toEqual(['Smoke tests passed']);
  expect(first.closed).toBe(true);
});

it('preserves legitimate warnings in the new run and clears logs on navigation', () => {
  const { result, rerender } = renderHook(({ step }) => useStepStream(step, 'run'), { initialProps: { step: 8 } });
  const source = FakeEventSource.instances[0];
  source.emit('line', { text: 'Registration skipped', level: 'warn', stream: 'stderr', ts: 1 });
  source.emit('end', { status: 'done', error: null, exitCode: 0 });
  expect(result.current.lines[0].level).toBe('warn');
  rerender({ step: 9 });
  expect(result.current.lines).toEqual([]);
  expect(result.current.status).toBe('running');
});
