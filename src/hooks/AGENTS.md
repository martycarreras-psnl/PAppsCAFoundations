<!-- Generated from .github/instructions/ — do not edit directly. See docs/agent-support.md -->
# Hooks — Codex Scoped Guidance

- Hooks orchestrate between components and services/providers
- Use TanStack Query for server state management
- Every hook gets a test
- Never call `src/generated/` services directly from hooks — go through provider adapters in `src/services/`
- Use React context for UI-only state

Full details: `.github/instructions/02-connectors.instructions.md`
