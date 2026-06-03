---
'@pacaf/wizard': patch
'@pacaf/wizard-ux': patch
---

Make Dataverse binding mandatory and functional in the connector step. Previously the wizard's Dataverse toggle was a silent no-op — it never prompted for a connection, never read the planned tables, and never ran `pac code add-data-source`, so a scaffolded Code App started with no Dataverse data source. Dataverse is no longer an opt-in connector: the wizard now always binds it from the environment URL captured in the project/env step and registers every planned table via `pac code add-data-source -a dataverse -t <table>` (or defers to `npm run register:dataverse` when it cannot register inline). Closes #95.
