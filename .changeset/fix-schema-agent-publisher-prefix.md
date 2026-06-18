---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
"@pacaf/agent-instructions": patch
"@pacaf/scripts": patch
---

Fix the schema agent always missing the publisher prefix set during the wizard.

The wizard captured the publisher prefix (Step 6) but never recorded it anywhere
machine-readable in the scaffolded project: `dataverse/planning-payload.json` was
a **verbatim copy** of the example with `yourprefix_` in every table/column name,
`.env` held only environment URLs, and `pacaf.client.json` held only branding. So
when a later plan-mode schema agent read the project's source of truth, it
literally saw `yourprefix` and either invented a prefix or dropped it.

The scaffold now threads the real prefix through (`@pacaf/wizard`
`copyFoundationFiles`, called by `@pacaf/wizard-ux` Step 8):

- **`dataverse/planning-payload.json`** is seeded with the actual prefix
  substituted for every `yourprefix` placeholder.
- **`.env`** gains a `PP_PUBLISHER_PREFIX=` line (durable, machine-readable
  source of truth, preserved/updated idempotently).
- **`pacaf.client.json`** records `publisherPrefix`.

The Dataverse schema instructions (`@pacaf/agent-instructions`, file `07`, plus
the Claude/Cursor projections) now tell the agent to resolve the concrete prefix
from `.env` → `pacaf.client.json` → `dataverse/planning-payload.json` → `README.md`
in priority order, and to ask the user rather than ever emit `yourprefix`.

`@pacaf/scripts` adds unit coverage for the prefix normalization and `.env`
upsert helpers.
