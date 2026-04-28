---
paths:
  - "scripts/**"
  - "src/**"
  - "solution/**"
---
<!-- Generated from .github/instructions/07-dataverse-schema.instructions.md — do not edit directly -->
# Dataverse Schema Design

Key rules:
- Every table, column, and option set must use the publisher prefix (e.g., `yourprefix_tablename`)
- Schema changes happen through the planning artifact workflow: validate → generate plan → provision
- Use `scripts/validate-schema-plan.mjs` before provisioning
- Use `scripts/generate-dataverse-plan.mjs` to create execution plans
- Use `scripts/register-dataverse-data-sources.mjs` to register tables with the Code App
- Option set integer values start at `{CHOICE_VALUE_PREFIX}0000`
- Schema mistakes are the most expensive to fix after data exists — plan first
- If the planning artifact is not yet stable, return to upstream planning instructions

Full details: `.github/instructions/07-dataverse-schema.instructions.md`
