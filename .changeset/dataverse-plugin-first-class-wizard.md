---
'@pacaf/wizard': patch
---

Stop scaffolding the `validate:schema-plan`, `generate:dataverse-plan`, `register:dataverse`, and `solution:export*` npm scripts, which pointed at the four Node Dataverse/solution scripts removed from `@pacaf/scripts` (now owned by the Dataverse-skills plugin). The scaffolder retains `prototype:seed`, and the bind-Dataverse step log now directs table registration through `dv-metadata` + `pac code add-data-source`.
