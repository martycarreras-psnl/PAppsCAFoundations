---
'@pacaf/agent-instructions': minor
---

Make the Dataverse-skills plugin the first-class, only-supported path for all Dataverse work across the shipped agent guidance.

- New canonical instruction `07b-org-structure-and-security.instructions.md` (plus `.claude` / `.cursor` projections): provisions business units, owner teams, Entra ID security groups, and role mappings — a documented plugin gap the agent fills via the plugin's bundled Python SDK (`businessunit` / `team` records) plus `az ad group`. Registered in `agent-guidance.config.json`.
- Rewrote `07-dataverse-schema`, `07a-existing-schema-discovery`, `02-connectors`, `04-deployment`, `00-environment-setup`, and `00c` to route schema/data/query/solution/export operations to the plugin (`dv-metadata`, `dv-solution`, `list_tables` / `describe_table`) and native `pac solution export`; removed all references to the deleted `pacaf-validate` / `pacaf-generate` / `pacaf-register` / `pacaf-export-solution` scripts. The reserved-name / reserved-column guard is now agent-enforced prose in `07a`.
- Added data-isolation / organizational-boundary discovery to `00b` and org-structure derivation to `00c` (feeding the new `orgStructure` planning section).
- `AGENTS.md`: the plugin is now a hard requirement (was "strongly recommended"); scope-split table updated and the deleted-script rows removed.
- Refreshed the stale `prereq-gate` and `before-you-start` condensations (`.claude` + `.cursor`) to reflect the plugin hard gate and the wizard/plugin-produced publisher & solution flow.
