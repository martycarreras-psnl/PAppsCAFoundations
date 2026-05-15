---
"@pacaf/agent-instructions": minor
---

Add 07a existing-schema-discovery instruction: OOB-first Dataverse design with Pause Moments on duplication risk.

When provisioning a new Dataverse table, column, choice, or lookup, agents now run an OOB-first discovery pass and emit a `⏸ Pause` block before creating anything that could duplicate `systemuser`, `contact`, `account`, `team`, `businessunit`, platform columns (`createdon`, `ownerid`, `statuscode`, etc.), or already-present custom assets. Developer overrides are honored and recorded into `dataverse/planning-payload.json` for traceability. The 00c handoff and 07-dataverse-schema gate now route through 07a, and projections ship for Claude Code (`.claude/rules/existing-schema-discovery.md`) and Cursor (`.cursor/rules/07a-existing-schema-discovery.mdc`).
