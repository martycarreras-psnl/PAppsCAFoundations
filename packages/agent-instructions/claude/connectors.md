---
paths:
  - "src/generated/**"
  - "src/hooks/**"
  - "src/services/**"
---
<!-- Generated from .github/instructions/02-connectors.instructions.md — do not edit directly -->
# Connectors & Data Integration

Key rules:
- Connectors are added via `pac code add-data-source`
- Never edit `src/generated/**` — wrap generated services in provider adapters under `src/services/`
- Connector registration is downstream of planning — complete the planning flow first
- Use the provider pattern: domain contract → mock provider → real provider (adapter over generated service)
- Connection IDs are environment-specific — use deployment settings files for promotion
- For local dev, use mock providers or `VITE_USE_MOCK=true`
- Use `useOptimisticSave<T>` for all Dataverse mutations — Dataverse read replicas lag behind writes; naive invalidate-and-refetch shows stale data
- Merge user input over cache on success instead of invalidating queries

Full details: `.github/instructions/02-connectors.instructions.md`
