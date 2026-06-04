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
- Dataverse schema, data, query, and solution operations are owned by the [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin — there are no `pacaf-validate` / `pacaf-generate` / `pacaf-register` scripts
- Discover existing schema first (`07a`), then provision with `dv-metadata`, then register with `pac code add-data-source`
- Option set integer values start at `{CHOICE_VALUE_PREFIX}0000`
- Schema mistakes are the most expensive to fix after data exists — plan first
- If the planning artifact is not yet stable, return to upstream planning instructions

## Preferred provisioning mechanism

If the [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin is installed, use it for all schema provisioning:
- `dv-metadata` for tables, columns, relationships, option sets (Python SDK, idempotent, handles propagation delays)
- `dv-solution` for solution lifecycle (export, import, promote)
- `dv-security` for role assignment
- `dv-data` for seeding data, bulk import

The planning workflow in this repo feeds INTO the plugin's execution. After `dv-metadata` provisions schema, return to `pac code add-data-source` registration to generate TypeScript services.

Install: `/plugin install dataverse@claude-plugins-official`
Prerequisites: Python 3 + `pip install PowerPlatform-Dataverse-Client pandas`

Full details: `.github/instructions/07-dataverse-schema.instructions.md`
