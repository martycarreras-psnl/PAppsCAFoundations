---
paths:
  - "scripts/**"
  - "src/**"
  - "solution/**"
  - "dataverse/**"
---
<!-- Generated from .github/instructions/07a-existing-schema-discovery.instructions.md — do not edit directly -->
# Existing Schema Discovery & OOB-First Design

This rule is the gate between planning (`00a → 00d`) and provisioning (`07-dataverse-schema`). Run it BEFORE creating any new Dataverse table, column, choice, or lookup.

## Three rules
1. **OOB-first.** If a Dataverse out-of-the-box table or column already represents the concept, propose reuse — not creation.
2. **Pause on duplication risk.** When a proposed addition resembles an OOB or already-present custom asset, stop and ask the developer to confirm before creating anything.
3. **Developer override is final.** If the developer chooses to proceed with the custom asset, record the rationale in `dataverse/planning-payload.json` and continue.

## Always check the OOB matrix first

| Concept | OOB table |
|---|---|
| Internal employee / app user | `systemuser` (auto-synced from Entra ID) |
| External person | `contact` |
| Company / supplier / customer organization | `account` |
| Security group of users | `team` |
| Department / cost center | `businessunit` |
| Task / action item | `task` |
| Note attached to a record | `annotation` |
| Queue of work | `queue` + `queueitem` |
| Case / support ticket | `incident` |

Never recreate platform columns: `createdon`, `modifiedon`, `createdby`, `modifiedby`, `ownerid`, `owningbusinessunit`, `owningteam`, `owninguser`, `statecode`, `statuscode`, `versionnumber`. Extend `statuscode` (tied to its parent `statecode`) before adding a custom status column.

## Pause Moment format
When duplication risk is detected the agent MUST output a `⏸ Pause:` block listing:
- What the developer asked to create
- The matching OOB asset and its standard columns
- The recommended reuse approach (including `pac solution add-reference --component-name <table> --component-type Table` with only the columns the app uses)
- Trade-offs of building custom anyway
- Three options: reuse, hybrid, override

The agent must wait for an explicit answer and must not create the table while waiting.

## Override recording
If the developer overrides, write to `dataverse/planning-payload.json`:
```jsonc
{
  "oobAlternativeConsidered": "systemuser",
  "overrideRationale": "<why OOB is insufficient>",
  "overrideApprovedBy": "<developer>",
  "overrideApprovedAt": "<ISO timestamp>"
}
```
The reserved-name and reserved-column guards (agent-enforced prose in `07a`) still apply — an override clears the OOB-recommendation pause, not the reserved-name rule.

## Discovery commands
Preferred: the Dataverse-skills plugin's `list_tables` and `describe_table systemuser` MCP tools (env resolved from the active PAC profile).
Fallback: `GET {env}/api/data/v9.2/EntityDefinitions?$select=LogicalName,DisplayName,IsCustomEntity`.

## Lookup gotchas
- `ownerid` is polymorphic (`systemuser` or `team`). On write: `"ownerid@odata.bind": "/systemusers(<guid>)"` vs `/teams(<guid>)`. `_ownerid_value` is the read property; `ownerid` is the navigation property.
- Use the OOB `Customer` AttributeType for "could be account or contact" — don't roll your own polymorphic union.
- Adding an OOB table to your solution: select ONLY the columns and views the app uses. Never "all components."

Full details: `.github/instructions/07a-existing-schema-discovery.instructions.md`
