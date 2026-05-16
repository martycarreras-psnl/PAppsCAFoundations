---
"@pacaf/agent-instructions": minor
---

`02-connectors.instructions.md` now opens its Dataverse section with a mandatory "Always call the `*WithOrganization` variants" subsection covering the silent-but-fatal HTTP 400 (`Invalid organization URL 'null' provided.`) that every Code App hits when its adapter calls the bare `ListRecords` / `GetItem` / `CreateRecord` / `UpdateRecord` / `DeleteRecord` overloads of `MicrosoftDataverseService`. Includes the bare-vs-`*WithOrganization` mapping table, the required `VITE_DATAVERSE_URL` `.env` entry, a canonical adapter snippet that threads the organization URL through every call, and the diagnostic rule for spotting the regression in network output. `.env.template` in `templates/starter/` now ships a commented-out `VITE_DATAVERSE_URL` line so it's discoverable at scaffold time. Closes #46.
