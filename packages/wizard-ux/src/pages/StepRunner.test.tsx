import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StepRunner } from './StepRunner';
import { api } from '../services/api';
import { Summary } from './Summary';

const saved = vi.hoisted(() => ({ state: {} as Record<string, unknown>, completed: 10, totalSteps: 10, next: 10 }));

vi.mock('../services/api', () => ({ api: { apply: vi.fn(), saveState: vi.fn() } }));
vi.mock('../hooks/useWizardData', () => ({
  useStepQuestions: () => ({ data: { meta: { number: 8, title: 'Scaffold', canRunInBrowser: true, noAutoAdvance: true }, questions: [] } }),
  useSteps: () => ({ data: { totalSteps: 11, steps: [{ number: 8, title: 'Scaffold', status: 'done' }] } }),
  useWizardState: () => ({ data: saved }),
}));
vi.mock('../components/StepNav', () => ({ StepNav: () => null }));
vi.mock('../components/HeroBackground', () => ({ HeroBackground: () => null }));

class Source {
  static instances: Source[] = [];
  listeners = new Map<string, (event: MessageEvent) => void>();
  onerror: (() => void) | null = null;
  constructor() { Source.instances.push(this); }
  addEventListener(type: string, listener: (event: MessageEvent) => void) { this.listeners.set(type, listener); }
  close() {}
  emit(type: string, data: unknown) {
    act(() => this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(data) })));
  }
}
beforeEach(() => {
  Source.instances = [];
  saved.state = {};
  vi.stubGlobal('EventSource', Source);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.mocked(api.apply).mockResolvedValueOnce({ runId: 'failed' });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/step/8']}>
        <Routes><Route path="/step/:n" element={<StepRunner />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('replaces a failed run banner immediately on retry and stays clean after success', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Re-run' }));
  await waitFor(() => expect(Source.instances).toHaveLength(1));
  Source.instances[0].emit('line', { text: 'old failure output', stream: 'stderr', level: 'error', ts: 1 });
  Source.instances[0].emit('end', { status: 'error', error: 'Old verification error', exitCode: 1 });
  expect(screen.getByText('Old verification error')).toBeTruthy();

  let resolveApply!: (value: { runId: string }) => void;
  vi.mocked(api.apply).mockReturnValueOnce(new Promise((resolve) => { resolveApply = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Re-run' }));
  expect(screen.queryByText('Old verification error')).toBeNull();
  expect(screen.queryByText('old failure output')).toBeNull();
  await act(async () => resolveApply({ runId: 'passed' }));
  await waitFor(() => expect(Source.instances).toHaveLength(2));
  Source.instances[1].emit('line', { text: 'pnpm deferred optional build scripts', stream: 'stderr', level: 'info', ts: 2 });
  Source.instances[1].emit('end', { status: 'done', error: null, exitCode: 0 });
  expect(screen.getByText('Step complete')).toBeTruthy();
  expect(screen.queryByText(/finished with warnings/)).toBeNull();
  expect(screen.queryByText('Old verification error')).toBeNull();
});

it('allows retry from warning completion and preserves new legitimate warnings', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Re-run' }));
  await waitFor(() => expect(Source.instances).toHaveLength(1));
  Source.instances[0].emit('line', { text: 'Smoke verification failed', stream: 'stderr', level: 'warn', ts: 1 });
  Source.instances[0].emit('end', { status: 'done', error: null, exitCode: 0 });
  expect(screen.getByText(/finished with warnings/)).toBeTruthy();
  vi.mocked(api.apply).mockResolvedValueOnce({ runId: 'retry' });
  fireEvent.click(screen.getByRole('button', { name: 'Re-run' }));
  await waitFor(() => expect(Source.instances).toHaveLength(2));
  expect(screen.queryByText(/finished with warnings/)).toBeNull();
  Source.instances[1].emit('line', { text: 'Registration skipped', stream: 'stderr', level: 'warn', ts: 2 });
  Source.instances[1].emit('end', { status: 'done', error: null, exitCode: 0 });
  expect(screen.getByText(/finished with warnings/)).toBeTruthy();
});

it('shows persisted smoke failure on resume, then replaces it after passing verification', async () => {
  saved.state = { SMOKE_TEST_STATUS: 'failed' };
  // Remount exactly as a browser reload would, with state from the server.
  cleanup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/step/8']}>
        <Routes><Route path="/step/:n" element={<StepRunner />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByText(/last smoke verification failed/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
  await waitFor(() => expect(Source.instances).toHaveLength(1));
  Source.instances[0].emit('line', { text: 'Smoke tests passed', stream: 'stdout', level: 'info', ts: 1 });
  saved.state = { SMOKE_TEST_STATUS: 'passed' };
  Source.instances[0].emit('end', { status: 'done', error: null, exitCode: 0 });
  expect(screen.getByText('Step complete')).toBeTruthy();
  expect(screen.queryByText(/last smoke verification failed/)).toBeNull();
});

it('summary never claims readiness when recorded smoke verification failed', () => {
  saved.state = { SMOKE_TEST_STATUS: 'failed' };
  cleanup();
  render(<MemoryRouter><Summary /></MemoryRouter>);
  expect(screen.getByText(/smoke verification failed/)).toBeTruthy();
  expect(screen.queryByText('Setup complete')).toBeNull();
  expect(screen.queryByText('You did it. Your app is ready to launch.')).toBeNull();
  for (const link of screen.getAllByRole('link', { name: 'Continue setup' })) {
    expect(link.getAttribute('href')).toBe('/step/8');
  }
});
