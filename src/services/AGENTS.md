<!-- Generated from .github/instructions/ — do not edit directly. See docs/agent-support.md -->
# Services — Codex Scoped Guidance

- Provider pattern: domain contract → mock provider → real provider (adapter over generated service)
- Never edit `src/generated/**` — wrap in adapters here
- Mock providers satisfy the same contracts real providers will
- Use `VITE_USE_MOCK` toggle to switch between mock and real implementations
- Connection IDs are environment-specific — use deployment settings files for promotion

Full details: `.github/instructions/02-connectors.instructions.md`
