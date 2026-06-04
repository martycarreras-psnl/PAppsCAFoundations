---
description: "Read this file BEFORE proposing or provisioning any new Dataverse table, column, choice, or lookup. It governs the agent's responsibility to discover existing schema first, strongly recommend reuse of out-of-the-box (OOB) Dataverse entities and platform columns, and pause for explicit developer confirmation whenever a proposed addition could duplicate something that already exists."
applyTo: "scripts/**,src/**,solution/**,dataverse/**"
---

# Power Apps Code Apps — Existing Schema Discovery & OOB-First Design

This file is the gate between *planning* (`00a → 00d`) and *schema provisioning* (`07`). Its job is to make sure the agent never silently invents schema that Dataverse already provides.

The default Dataverse environment ships with hundreds of tables and thousands of columns — System Users, Teams, Business Units, Contacts, Accounts, Tasks, Queues, Notes, Activities, the platform ownership and audit columns, the global `statecode`/`statuscode` lifecycle, polymorphic `ownerid`, the polymorphic Customer lookup, and more. Duplicating any of these is the single most common and most expensive mistake in pro-code Dataverse work.

## Phase Contract — Discover First, Propose Second, Provision Last

`refined scope (from 00c)` → **`discovery & OOB matching (this file)`** → `provisioning (07)`

This file inserts itself before `07-dataverse-schema.instructions.md`. The agent must not call `dv-metadata`, `pac solution add-reference`, or any schema-creating Web API operation without first completing the discovery → reuse-vs-create decision flow described below.

## The Three Rules

1. **OOB-first.** If an out-of-the-box Dataverse table or column already represents the concept being modeled, the agent must propose reuse — not creation — of that asset.
2. **Pause on duplication risk.** If a proposed new table or column resembles, in name or in semantics, an OOB or already-present custom asset, the agent must stop and ask the developer to confirm before creating anything.
3. **The developer's override is final.** If the developer reviews the pause and chooses to create the custom asset anyway, the agent records the rationale and proceeds. The agent's job is to surface the question, not to win the argument.

## Rule 1 — OOB-First: The Always-Check Matrix

Before proposing any new table, the agent must check the proposed concept against this matrix. If a match exists, **reuse** is the default recommendation.

### People & organizations

| If you need to model… | Use the OOB table | Notes |
|---|---|---|
| An internal employee / app user | `systemuser` | Populated automatically from Entra ID. Never duplicate as `<prefix>_employee` or `<prefix>_user`. |
| An external person (customer, vendor contact, partner contact) | `contact` | Has email, phone, address, parent customer (Account) lookup OOB. |
| A company / organization / customer / vendor / supplier organization | `account` | Has full address blocks, primary contact, hierarchy via `parentaccountid`. |
| A group of internal users (security/access boundary) | `team` | Native security trimming. Works with row sharing. |
| An organizational unit / department / cost center | `businessunit` | Drives row ownership scoping. |
| A polymorphic "customer" (could be a person or an organization) | OOB `Customer` lookup type → polymorphic to `account` + `contact` | Don't roll your own polymorphic union. |
| A role or permission group | `role` (security roles) | Don't model authorization in custom tables. |

### Work, activities, communication

| If you need to model… | Use the OOB table |
|---|---|
| A task / to-do / action item | `task` |
| A meeting / appointment | `appointment` |
| An email message sent or received from inside the app | `email` |
| A phone call log | `phonecall` |
| A note attached to any record | `annotation` (which is what the OOB "Notes" timeline writes) |
| A queue of work to be picked up | `queue` + `queueitem` |
| A "case" / support ticket | `incident` |
| A sales opportunity | `opportunity` |

### Audit, lifecycle, ownership — platform columns on every table

Every Dataverse table already has these. **Never re-create them as custom columns:**

| Concept | Use the OOB column |
|---|---|
| Who created the row | `createdby` (Lookup → `systemuser`), `createdon` (DateTime) |
| Who last modified the row | `modifiedby`, `modifiedon` |
| Who owns the row | `ownerid` (polymorphic Lookup → `systemuser` or `team`), `owningbusinessunit`, `owningteam`, `owninguser` |
| Active vs Inactive state | `statecode` (OptionSet, two-state: Active/Inactive) |
| Sub-status / detailed status | `statuscode` (OptionSet, tied to statecode) — **extend this** before creating a custom status column |
| Version / optimistic concurrency | `versionnumber` |
| Import lineage | `importsequencenumber` |

> **The statecode/statuscode rule:** If your business needs an "Active / Pending Review / Archived / Cancelled" lifecycle on a custom table, **extend the OOB `statuscode` option set** rather than creating `<prefix>_lifecyclestatus`. The platform already wires `statuscode` to `statecode`, to the Activate/Deactivate ribbon actions, to the BPF stages, to Advanced Find, to flows, and to the audit log. A parallel custom column gets none of that.

### Reference & infrastructure

| Concept | OOB table |
|---|---|
| Currency | `transactioncurrency` |
| Time zone | platform setting on `usersettings` |
| Language | platform |
| Country / region | **Not OOB** — this is a legitimate custom table candidate |

## Rule 2 — The Pause Moment

The agent must trigger a Pause Moment before creating any of the following:

1. **A new table whose proposed `logicalSingularName` or `displayName`** matches or closely resembles a name in the OOB matrix above, *or* matches an already-present custom table in the environment.
2. **A new column on any table** whose name resembles a platform column (anything in `createdon`, `modifiedon`, `createdby`, `modifiedby`, `ownerid`, `statecode`, `statuscode`, `owningbusinessunit`, `owningteam`, `owninguser`, `versionnumber`).
3. **A new Lookup column targeting a person, organization, team, or business unit** — these almost always want to point at `systemuser`, `contact`, `account`, `team`, or `businessunit` and not at a custom equivalent.
4. **A new "status" / "stage" / "state" / "lifecycle" column** on any table — the agent must first evaluate whether the OOB `statuscode` option set can be extended instead.
5. **A new option set whose values mirror an OOB global choice** (e.g. an Industry list, a Country list, a Yes/No flag — Dataverse already ships several global option sets).
6. **A new table that conceptually represents a relationship** (e.g. `<prefix>_user_team_membership`) — Dataverse's native many-to-many relationships, security teams, and row sharing usually solve this without an extra table.

### Pause Moment format

When triggered, the agent must respond in this exact shape — never silently proceed:

```
⏸  Pause: existing Dataverse schema may already cover this.

You asked me to create:
  • Table: <prefix>_reviewer  (Reviewer)
  • Columns: name, email, department

Dataverse already provides an OOB equivalent:
  • systemuser  — represents an internal Entra ID user, populated automatically.
    Standard columns include: fullname, internalemailaddress, domainname,
    businessunitid (FK → businessunit), title, mobilephone, address1_*.

Recommendation:
  Use a Lookup column on <prefix>_supplier → systemuser instead.
  Add systemuser to your solution via `pac solution add-reference`,
  selecting only the columns you display (fullname, internalemailaddress, businessunitid).

Trade-offs of creating <prefix>_reviewer anyway:
  - You'll re-enter every employee manually.
  - Entra changes (new hires, terminations, name changes) will not flow through.
  - Row-level security trimming via ownerid will not apply.
  - Power Automate flows that resolve "current user" cannot bind to your custom table.

Three options:
  1. Reuse systemuser (recommended).
  2. Keep <prefix>_reviewer but justify why systemuser is insufficient
     (e.g. you need to track external reviewers who are NOT Entra users —
     in which case `contact` is the right OOB choice, not a fully custom table).
  3. Proceed with the custom table anyway, with explicit override.

How would you like to proceed?
```

The agent **must wait** for an explicit answer. It must not create the table while waiting.

## Rule 3 — The Override Path

If the developer chooses option 3 ("proceed anyway"), the agent must:

1. **Record the override** in `dataverse/planning-payload.json` under the table's metadata:
   ```jsonc
   {
     "schemaName": "<prefix>_reviewer",
     "displayName": "Reviewer",
     "oobAlternativeConsidered": "systemuser",
     "overrideRationale": "Reviewers include external auditors who are not Entra users.",
     "overrideApprovedBy": "<developer name or handle>",
     "overrideApprovedAt": "<ISO timestamp>"
   }
   ```
2. **Propose a hybrid design when appropriate.** If the override is "we have *both* internal and external reviewers," the agent should still suggest a `contact`-targeted Lookup as the modeling primitive for external parties, rather than a fully custom person table.
3. **Not re-raise the same pause for the same table later in the session.** The override stands until the developer revisits it.
4. **Still apply the reserved-name guard.** The reserved-name and reserved-column guards (see *Reserved-Name & Reserved-Column Guard* below) still reject names that collide with reserved Dataverse names (`account`, `contact`, `systemuser`, `owner`, `user`, `team`, etc.). An override clears the OOB-recommendation pause — it does **not** clear the reserved-name rule.

## Discovery — How the Agent Actually Checks

Before raising or skipping a Pause Moment, the agent must discover what's already in the target environment. Two paths:

### Preferred — Dataverse-skills plugin

Discovery is owned by the plugin's **dv-query** / **dv-metadata** skills. Use the MCP tools directly:

```text
# List all tables in the environment, including OOB
list_tables                     # dv-query / dv-metadata MCP tool

# Inspect a candidate OOB table to see its columns
describe_table systemuser       # returns columns, RequiredLevel, attribute types

# Look for an existing custom table that may already model the concept
list_tables  (then filter the result to schema names starting '<prefix>_')
```

The plugin resolves the target environment from the active PAC profile, so there is no environment URL to pass.

### Fallback — Web API

```bash
# All tables
GET {env}/api/data/v9.2/EntityDefinitions?$select=LogicalName,DisplayName,IsCustomEntity

# Specific OOB table's columns
GET {env}/api/data/v9.2/EntityDefinitions(LogicalName='systemuser')/Attributes?$select=LogicalName,DisplayName,RequiredLevel,AttributeType

# Existing global option sets
GET {env}/api/data/v9.2/GlobalOptionSetDefinitions?$select=Name,DisplayName
```

The agent records the discovery output in the session so it doesn't re-query the same metadata repeatedly.

## Augmentation — Custom Columns on OOB Tables

The right way to extend OOB tables is by adding `<prefix>_`-prefixed custom columns *to those tables* — not by creating parallel tables.

**Allowed:**

- Add `<prefix>_preferredreviewslot` (choice) to `systemuser` if your app legitimately tracks that.
- Add `<prefix>_riskscore` (decimal) to `account` for your domain-specific scoring.

**Required when you do this:**

1. Add the OOB table to your solution via `pac solution add-reference --component-name <table> --component-type Table` — **selecting only the columns you display or write**, never "all components."
2. Document the custom column under the **OOB table's section** in `dataverse/planning-payload.json` so it's discoverable in future sessions.
3. Be aware that custom columns on OOB tables are tracked separately from custom-table additions; they ship with your solution but the table itself is referenced, not owned.

**Not allowed:**

- Adding so many custom columns to an OOB table that the OOB table effectively becomes a custom one. If you're proposing more than a few custom columns on `systemuser` or `account`, the right modeling answer is usually a **related custom table** (e.g. `<prefix>_supplierprofile` 1:1 with `account`) rather than overloading the OOB table.

## Lookup Targeting — The Gotchas

When the OOB recommendation leads to a Lookup, the agent must get the targeting details right:

- **`systemuser` Lookups** filter to enabled users only when surfaced through the Power Apps SDK picker. If the app needs disabled users, use a Web API query with `isdisabled eq false` removed.
- **`ownerid` is polymorphic** (→ `systemuser` *or* `team`). On write via Web API, the `@odata.bind` must include the entity set name of the resolved target: `"ownerid@odata.bind": "/systemusers(<guid>)"` or `"/teams(<guid>)"`. The navigation property name and the lookup logical name are *not* interchangeable — `_ownerid_value` is the read property, `ownerid` is the navigation property.
- **Customer Lookups** (the type that polymorphs to `account` + `contact`) are not the same as creating two separate Lookups. Use the OOB `Customer` AttributeType when this is what you actually need.
- **`statuscode` extension** requires that each new statuscode value be tied to one of the two `statecode` values (Active=0 or Inactive=1). The agent must always specify the parent state when adding a statuscode option.

## When to Skip the OOB Recommendation Entirely

There are legitimate "yes, build a custom table" cases. The agent should not Pause in these scenarios:

| Scenario | Why custom is correct |
|---|---|
| The concept is genuinely domain-specific (Supplier, Project, Asset, Claim, Inspection, Sample) and has no OOB analogue. | These are what custom tables are for. |
| You need a many-to-many relationship between two custom tables with extra columns on the relationship. | A custom "junction" table with its own columns is appropriate (native N:N can't carry extra columns). |
| You need an immutable audit trail beyond Dataverse's audit feature. | A custom append-only table is a valid pattern. |
| You're modeling external entities that will never have Entra identities (e.g. an applicant who isn't a contact yet). | A custom or `contact`-augmented design is reasonable. |

In these cases the Pause Moment is unnecessary — but the **reserved-name and reserved-column guards below still apply**.

## Reserved-Name & Reserved-Column Guard

This guard used to live in a `pacaf-validate` script. It is now **agent-enforced prose** — apply it by reasoning, before you call `dv-metadata` to create anything. An OOB-override clears the duplication pause but never this guard.

**Reserved table names — never create a custom table with these schema/logical names** (they collide with OOB platform tables): `account`, `contact`, `systemuser`, `user`, `owner`, `team`, `businessunit`, `role`, `task`, `email`, `appointment`, `phonecall`, `annotation`, `queue`, `queueitem`, `incident`, `opportunity`, `activitypointer`. If your concept maps to one of these, reuse the OOB table (Rule 1) instead.

**Reserved / dangerous column names — never create a custom column with these unprefixed names** (they collide with platform columns or the global lifecycle): `status`, `state`, `statecode`, `statuscode`, `owner`, `ownerid`, `createdby`, `createdon`, `modifiedby`, `modifiedon`, `name`. Prefer specific, publisher-prefixed names such as `<prefix>_projectstatus`, `<prefix>_requestowner`, or `<prefix>_taskstage`.

**Naming format guard** — every custom schema name must be `^<publisherprefix>_[a-z][a-z0-9_]*$`: all lowercase, publisher prefix, underscores only, no camelCase, no hyphens. Reject names that omit the prefix (they collide across orgs) or use mixed case.

If a proposed name violates any of the three lists above, stop and rename before provisioning — these collisions are silent and expensive to unwind after data exists.

## Handoff to `07-dataverse-schema.instructions.md`

Once discovery has been completed, OOB matches have been raised (or skipped), and any developer overrides have been recorded, the agent proceeds to schema provisioning per `07-dataverse-schema.instructions.md`. The planning payload at that point should clearly show, for each entity:

- Whether it is **reused OOB** (recorded as a solution reference, not a creation)
- Whether it is **augmented OOB** (the OOB table plus listed `<prefix>_` columns)
- Whether it is **custom** (with `oobAlternativeConsidered` populated if a Pause Moment was raised)

This metadata travels with the project, so a future agent session inherits the design rationale rather than re-litigating it.
