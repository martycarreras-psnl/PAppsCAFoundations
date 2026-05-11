---
paths:
  - "src/**"
  - "src/hooks/**"
  - "src/components/**"
  - "src/services/**"
---
<!-- Generated from .github/instructions/08-copilot-studio.instructions.md — do not edit directly -->
# Microsoft Copilot Studio Agent Integration

**Note:** "Copilot Studio" is a Power Platform product for conversational AI agents, not a coding agent.

Key rules:
- Use `ExecuteCopilotAsyncV2` — the other methods have known issues
- Add the connector via `pac code add-data-source -a "shared_microsoftcopilotstudio" -c <connectionId>`
- Use `scripts/discover-copilot-connection.mjs` to find existing connections
- Wrap the generated service in a `useCopilotAgent` hook with TanStack Query
- For local dev, create a mock that simulates agent responses with realistic delays
- Use `VITE_USE_MOCK` toggle to switch between mock and real implementations

Full details: `.github/instructions/08-copilot-studio.instructions.md`
