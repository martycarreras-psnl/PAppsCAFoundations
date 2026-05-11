---
applyTo: "tests/**,src/**/*.test.tsx,src/**/*.test.ts,playwright.config.ts"
---

# Power Apps Code Apps — Testing Patterns

This instruction file defines how Code Apps are tested — from unit tests through end-to-end tests. Every Code App ships with tests. Untested code does not merge.

## Built-in Smoke Tests — Working Out of the Gate

Every scaffolded Code App includes smoke tests that pass immediately after setup. The wizard runs these automatically during Step 7 (Scaffold) before declaring success.

**What ships out of the box:**
- `vitest.config.ts` — Vitest configured with jsdom, jest-dom matchers, path aliases, and coverage thresholds
- `tests/setup/setup.ts` — Vitest setup file that loads `@testing-library/jest-dom/vitest` matchers
- `tests/setup/test-utils.tsx` — Custom render wrapper with all providers (QueryClient, FluentProvider, MemoryRouter)
- `src/App.test.tsx` — Three smoke tests: renders without crashing, displays title, shows mode badge

**Run smoke tests anytime:**
```bash
npm run test:smoke    # Fast targeted smoke run (verbose output)
npm run test          # Full Vitest run (includes smoke tests)
```

**Rule: Smoke tests must always pass.** If you change `App.tsx` or add providers, update the smoke tests and `test-utils.tsx` wrapper to match. A failing smoke test means the scaffold is broken — fix it before continuing.

When adding new features or pages, follow the smoke test pattern: write a basic "renders without crashing" test for every new component before moving on. The smoke test acts as a canary — if it breaks, something fundamental changed.

## Phase Contract — Testing Gate Before Deploy

Testing is a hard gate between implementation and deployment.

**Inputs required:**
- Feature implementation is complete enough to exercise the core user flow
- The app builds and runs locally
- Required schema and generated services exist for the feature under test

**Mandatory outputs:**
- Unit test evidence for component / hook logic where applicable
- End-to-end coverage of the primary user workflow
- A short record of what was tested, what passed, and what failed

**Stop conditions:**
- If the app does not build, stop and fix build errors before continuing to E2E
- If the required connector or schema pieces are missing, stop and complete those phases first
- If test evidence is missing, deployment is blocked

## Production Validation vs Mocked Local Testing

Foundations supports two complementary test modes:

1. **Mocked local validation** — Vite + Vitest + Playwright against local mocks for fast, deterministic feedback
2. **Code App production-path validation** — validate the real Power Apps experience using the local-play URL exposed by the Code Apps runtime

Use mocked tests for repeatable CI checks. Use the Power Apps local-play flow before deployment when the feature depends on real runtime behavior, connector wiring, or Power Platform authentication.

When the app is following the prototype-first workflow, make the prototype and tests share the same domain contracts and mock seed data where practical. Do not let prototype data and test fixtures drift into different shapes unless there is a deliberate reason.

### Power Apps local-play rule

When validating the real Code App experience:
- Start with `npm run dev`
- Use the **Power Apps local-play URL** emitted by the runtime, not bare `http://localhost:*`
- If Microsoft login is required, stop and ask the user to complete sign-in manually before proceeding

## Testing Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit Tests | Vitest + React Testing Library | Component logic, hooks, utils |
| E2E Tests | Playwright | Full user flows, connector integration |
| Mocking | MSW (Mock Service Worker) | Intercept connector calls in tests |
| Coverage | Vitest built-in (`v8` provider) | Track coverage metrics |

## Test Organization

```
tests/
├── e2e/
│   ├── dashboard.spec.ts       # Page-level E2E tests
│   ├── project-crud.spec.ts    # Feature flow tests
│   └── auth.setup.ts           # Authentication setup for E2E
├── setup/
│   ├── test-utils.tsx          # Custom render with providers
│   ├── handlers.ts             # MSW request handlers (mock connectors)
│   └── server.ts               # MSW server configuration
└── fixtures/
    ├── projects.json            # Test data matching generated model shapes
    └── users.json
```

Component-level tests live next to their components:

```
src/components/ProjectCard/
├── ProjectCard.tsx
├── ProjectCard.test.tsx         # Unit tests
└── index.ts
```

## Test Configuration

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/server.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/generated/**', 'src/mockData/**', 'src/**/*.test.*'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});
```

### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_MOCK: 'true' },
  },
});
```

## Custom Test Renderer

Wrap components in all required providers during tests:

```tsx
// tests/setup/test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { MemoryRouter } from 'react-router-dom';
import { PowerProvider } from '@/PowerProvider';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

function customRender(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { initialRoute = '/', ...renderOptions } = options;
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <PowerProvider>
        <QueryClientProvider client={queryClient}>
          <FluentProvider theme={webLightTheme}>
            <MemoryRouter initialEntries={[initialRoute]}>
              {children}
            </MemoryRouter>
          </FluentProvider>
        </QueryClientProvider>
      </PowerProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

// Re-export everything from Testing Library plus our custom render
export * from '@testing-library/react';
export { customRender as render };
```

## Mocking Connectors with MSW

Mock Service Worker intercepts network requests at the service worker level, so your components behave exactly as they would with real connectors:

```typescript
// tests/setup/handlers.ts
import { http, HttpResponse } from 'msw';
import projectsFixture from '../fixtures/projects.json';
import usersFixture from '../fixtures/users.json';

export const handlers = [
  // Mock SQL connector — projects endpoint
  http.get('*/api/sql/projects', ({ request }) => {
    const url = new URL(request.url);
    const top = parseInt(url.searchParams.get('$top') || '25');
    const skip = parseInt(url.searchParams.get('$skip') || '0');
    const items = projectsFixture.slice(skip, skip + top);

    return HttpResponse.json({
      items,
      hasMore: skip + top < projectsFixture.length,
      totalCount: projectsFixture.length,
    });
  }),

  // Mock Office 365 Users — current user
  http.get('*/api/office365users/me', () => {
    return HttpResponse.json(usersFixture[0]);
  }),

  // Mock create project
  http.post('*/api/sql/projects', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 'new-project-id', ...body, createdAt: new Date().toISOString() },
      { status: 201 }
    );
  }),

  // Mock error scenario — useful for testing error boundaries
  http.get('*/api/sql/failing-endpoint', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error', message: 'Database connection failed' },
      { status: 500 }
    );
  }),
];
```

```typescript
// tests/setup/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Unit Test Patterns

### Testing a Component

```tsx
// src/components/ProjectCard/ProjectCard.test.tsx
import { render, screen } from '../../../tests/setup/test-utils';
import { ProjectCard } from './ProjectCard';

const mockProject = {
  id: '1',
  name: 'Test Project',
  status: 'Active',
  owner: 'Jane Smith',
  dueDate: '2026-06-15',
};

describe('ProjectCard', () => {
  it('displays the project name and owner', () => {
    render(<ProjectCard project={mockProject} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows overdue badge when project is past due', () => {
    const overdueProject = { ...mockProject, dueDate: '2020-01-01' };
    render(<ProjectCard project={overdueProject} />);

    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('calls onSelect when card is clicked', async () => {
    const onSelect = vi.fn();
    const { user } = render(<ProjectCard project={mockProject} onSelect={onSelect} />);

    await user.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });
});
```

### Testing a Hook

```tsx
// src/hooks/useProjects.test.ts
import { renderHook, waitFor } from '../tests/setup/test-utils';
import { useProjects } from './useProjects';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('useProjects', () => {
  it('fetches and returns projects', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(10); // matches fixture data
    expect(result.current.data?.[0]).toHaveProperty('name');
  });

  it('handles server errors gracefully', async () => {
    // Override handler for this test
    server.use(
      http.get('*/api/sql/projects', () => {
        return HttpResponse.json({ error: 'Server Error' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
```

### Testing Utilities

```typescript
// src/utils/formatDate.test.ts
import { formatDate, isOverdue, daysRemaining } from './formatDate';

describe('formatDate', () => {
  it('formats ISO dates to human-readable strings', () => {
    expect(formatDate('2026-06-15')).toBe('Jun 15, 2026');
  });

  it('returns "N/A" for null or undefined dates', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate(undefined)).toBe('N/A');
  });
});

describe('isOverdue', () => {
  it('returns true for past dates', () => {
    expect(isOverdue('2020-01-01')).toBe(true);
  });

  it('returns false for future dates', () => {
    expect(isOverdue('2030-01-01')).toBe(false);
  });
});
```

## E2E Test Patterns

### Required CRUD Coverage

For primary business entities, test the full CRUD cycle unless the feature is intentionally read-only:

- **Create** — submit the form and verify the new row appears
- **Read** — open the detail view or row presentation and verify key fields
- **Update** — edit a field and verify the change persists
- **Delete** — remove the row and verify it disappears

Also cover navigation, empty-state behavior, and the most important filter/status transitions for the feature.

### Page Navigation

```typescript
// tests/e2e/navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('navigates between pages using sidebar', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL('/settings');
  });
});
```

### Data Operations

```typescript
// tests/e2e/project-crud.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test('creates a new project', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'New Project' }).click();

    // Fill form
    await page.getByLabel('Project Name').fill('E2E Test Project');
    await page.getByLabel('Status').selectOption('Active');
    await page.getByLabel('Owner').fill('Test User');

    await page.getByRole('button', { name: 'Save' }).click();

    // Verify project appears in the list
    await expect(page.getByText('E2E Test Project')).toBeVisible();
  });

  test('paginates through projects', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify first page
    await expect(page.getByText('Page 1')).toBeVisible();

    // Navigate to next page
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2')).toBeVisible();
  });

  test('shows error state when connector fails', async ({ page }) => {
    // This test relies on mock data being configured to return errors for certain routes
    await page.goto('/dashboard?simulate-error=true');

    await expect(page.getByText('Error loading data')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
```

### Responsive Testing

```typescript
// tests/e2e/responsive.spec.ts
import { test, expect, devices } from '@playwright/test';

test.describe('Responsive Layout', () => {
  test('shows mobile navigation on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Sidebar should be hidden; hamburger menu visible
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    await expect(page.getByRole('navigation')).toBeHidden();
  });

  test('shows sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await expect(page.getByRole('navigation')).toBeVisible();
  });
});
```

## What to Test (and What Not To)

### Always test:
- Component rendering with different props and states (loading, error, empty, data)
- User interactions (clicks, form submissions, navigation)
- Custom hooks that wrap connector calls
- Utility functions with business logic
- Error boundaries and fallback states
- Accessibility basics (correct roles, labels, keyboard navigation)

### Do not test:
- Generated files (`src/generated/`) — these are produced by PAC CLI and are the CLI's responsibility
- Fluent UI component internals — trust the library
- Simple pass-through components with no logic
- TypeScript types (the compiler already validates these)

## CI Integration

Tests run automatically on every PR. The CI pipeline fails if:
- Any unit test fails
- Any E2E test fails
- Coverage drops below thresholds (70% branches/functions/lines/statements)
- TypeScript compilation fails
- ESLint reports errors

Tests in CI use mock data (`VITE_USE_MOCK=true`) so they don't require real Power Platform connections.

## Test Evidence Template

At the end of testing, record:

```text
Test scope:
- Feature / page:
- Environment / mode: mocked local | Power Apps local-play | CI

Results:
- Unit tests:
- CRUD flow:
- Navigation / filters:
- Edge cases / authorization:

Failures / follow-up:
-
```
