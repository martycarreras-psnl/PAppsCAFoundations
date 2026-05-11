---
paths:
  - "src/**"
  - "scripts/**"
  - "dataverse/**"
---
<!-- Generated from .github/instructions/00d-prototype-validation.instructions.md — do not edit directly -->
# Prototype Validation

Governs the phase between conceptual planning and Dataverse provisioning.

Key rules:
1. Components and hooks depend on domain contracts (`src/types/`, `src/services/`), never on `src/generated/**`
2. Mock providers satisfy the same contracts that real providers will later satisfy
3. Do not add connectors until the planning payload is stable
4. Use `dataverse/prototype-feedback.md` to capture findings
5. Feed findings back into `dataverse/planning-payload.json` and rerun `npm run prototype:seed`
6. Promote from prototype to schema work only when the UX stops forcing schema changes

Full details: `.github/instructions/00d-prototype-validation.instructions.md`
