---
'@pacaf/scripts': major
---

Remove the four redundant Dataverse/solution Node scripts now owned by the [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin: `validate-schema-plan.mjs` (`pacaf-validate`), `generate-dataverse-plan.mjs` (`pacaf-generate`), `register-dataverse-data-sources.mjs` (`pacaf-register`), and `export-solution.mjs` (`pacaf-export-solution`), along with their `bin` entries and tests.

BREAKING: the `pacaf-validate`, `pacaf-generate`, `pacaf-register`, and `pacaf-export-solution` commands no longer exist. The planning payload (`dataverse/planning-payload.json`) is now the re-runnable source of truth — the agent reads it and drives the plugin (`dv-metadata`, `dv-solution`) plus `pac code add-data-source` directly. Solution export uses native `pac solution export` / `pac solution unpack`. The generated npm scripts (`validate:schema-plan`, `generate:dataverse-plan`, `register:dataverse`, `solution:export*`) are dropped from `scaffold-foundations.mjs` and `sync-foundations.mjs`; `prototype:seed` is retained. The `orgStructure` section is added to `schema-plan.example.json`.
