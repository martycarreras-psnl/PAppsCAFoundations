---
'@pacaf/wizard-ux': minor
---

Re-architect the Wizard UX setup flow around the Dataverse-skills plugin and auth-first environment discovery.

- Prerequisites step now detects the Dataverse-skills plugin (filesystem + config) and the Python SDK, surfacing plain-language, agent-branched (Copilot CLI / Claude) copy-paste install steps; the missing plugin is a blocking failure.
- Removed the pasted `PP_ENV_DEV/TEST/PROD` URL inputs. Authentication now signs in at the tenant level first, then a new environment-discovery step runs `pac env list` and presents Dev/Test/Prod pickers from the results (human-readable environment names — no GUIDs shown). Steps were renumbered (old 5–10 → 6–11; the loader now exposes 11 sequential steps).
- Connector and scaffold step log messages now direct Dataverse table registration through `dv-metadata` + `pac code add-data-source` (the `register:dataverse` npm script is gone).
