---
paths:
  - "tests/**"
  - "src/**/*.test.tsx"
  - "src/**/*.test.ts"
  - "playwright.config.ts"
  - "vitest.config.ts"
---
<!-- Generated from .github/instructions/05-testing.instructions.md — do not edit directly -->
# Testing Patterns

Key rules:
- Use Vitest for unit/integration tests, Playwright for E2E
- Smoke tests must pass from the first scaffold — they are a deployment gate
- Mock connectors with MSW (Mock Service Worker) or provider-pattern mock implementations
- Test the provider contract, not the generated service internals
- Every hook gets a test; every page gets at least a render test
- Use `vi.mock()` for generated services; never call real connectors in unit tests
- Run `npm run test` before committing; CI blocks merge on failure

Full details: `.github/instructions/05-testing.instructions.md`
