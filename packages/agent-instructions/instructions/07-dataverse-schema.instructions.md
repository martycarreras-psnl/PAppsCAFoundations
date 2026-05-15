---
applyTo: "scripts/**,src/**,solution/**"
---

# Power Apps Code Apps — Dataverse Schema Design

This file covers how to define, create, and maintain Dataverse schema artifacts — Option Sets (Choices), Tables, and Columns — in a way that is solution-portable, ALM-safe, and produces clean TypeScript types.

Schema mistakes are the most expensive kind to fix after data has been collected. Read this before creating a single table or option set.

## Phase Contract — Plan First, Then Provision

Dataverse work is not a single step. It is a sequence:

`schema plan artifact -> existing-schema discovery -> option sets -> tables -> columns -> relationships -> security role -> publish -> register data sources -> generate SDK`

If the app requirements still exist only as a rough narrative or brainstorming discussion, stop here and complete the upstream planning flow first:

- `00a-business-problem-decomposition.instructions.md`
- `00b-scope-refinement-and-solution-shaping.instructions.md`
- `00c-solution-concept-to-dataverse-plan.instructions.md`

This file assumes the business problem has already been decomposed, refined, and translated into a conceptual plan that is ready to become a Dataverse planning artifact.

For non-trivial apps, that planning artifact should also have been pressure-tested by the prototype-validation phase. If the UX has not yet been validated with representative mock data and stakeholder review, strongly consider returning to `00d-prototype-validation.instructions.md` before freezing tables and relationships.

> **Mandatory gate before this file.** Before provisioning anything, the agent must run the existing-schema discovery and OOB-first decision flow in `07a-existing-schema-discovery.instructions.md`. That file is what raises the Pause Moment when a proposed table or column duplicates something Dataverse already provides (e.g. `systemuser`, `contact`, `account`, `team`, `statuscode`). Skipping it produces the single most expensive class of schema mistake — inventing a parallel table for a concept the platform already models.

**Inputs required:**
- Publisher prefix
- Solution unique name
- Target environment URL
- Approved schema plan artifact for the app

**Mandatory outputs:**
- A persisted schema plan JSON file in the app project
- Re-runnable provisioning commands or scripts
- Published metadata
- Registered data sources and generated SDK files

**Stop conditions:**
- If the schema plan does not exist, stop and create it before provisioning
- If a change would delete or repurpose live values, stop and plan an additive migration instead

## Schema Planning Artifact — Required for Non-Trivial Apps

For anything beyond a one-table prototype, persist the schema plan inside the app project before running provisioning.

If the planning artifact does not yet exist because the user is still refining workflows, approvals, reporting, Teams scenarios, document outputs, or Copilot placement, do not improvise the schema. Return to the upstream planning instructions and stabilize the solution concept first.

**Recommended path:**

```text
dataverse/planning-payload.json
```

Use the scaffolded template file:

```text
scripts/schema-plan.example.json
```

The plan file is the handoff between planning and execution. It should define:

1. `domains` — business areas / language used by the app
2. `tables` — table metadata, logical names, and attributes
3. `relationships` — lookup relationships and lookup column names
4. `provisioningPlansJson` — executable payload shape for future orchestration scripts

### Foundation helper workflow

Foundations now provides a reusable script chain for this handoff:

```bash
pacaf-validate dataverse/planning-payload.json
pacaf-generate dataverse/planning-payload.json
pacaf-register dataverse/register-datasources.plan.json
```

- `validate-schema-plan.mjs` checks the planning artifact before any provisioning work starts
- `generate-dataverse-plan.mjs` emits normalized execution plans for tables, relationships, and connector registration
- `register-dataverse-data-sources.mjs` consumes the generated registration plan and runs `pac code add-data-source` in order, refreshing generated connector output as each table is registered

Prefer the `.mjs` entry points for cross-platform automation. The `.sh` variant exists for Bash-heavy environments but is not the canonical path for Windows.

Use these helpers as the default execution path in downstream repos. If you replace them, the alternative must still preserve the same ordered contract and re-runnable plan artifacts.

### Required naming data in the schema plan

Each planned table should capture all of the following explicitly:

- `schemaName`
- `displayName`
- `displayCollectionName`
- `logicalSingularName`
- `entitySetName`
- `tableLogicalName` when needed by provisioning scripts

Do not rely on informal pluralization during implementation. Write the naming decisions down once in the plan.

### Reserved-name rule

Avoid general-purpose column names that collide with Dataverse system concepts:

- `status`
- `owner`
- `statecode`
- `statuscode`

Prefer specific names such as `project_status`, `request_owner`, or `task_stage`.

---

## Schema Creation Order — The Golden Sequence

Every schema bootstrap script must follow this exact order. Reversing any step causes dependency failures.

```
1. Global Option Sets (Choices)
2. Tables (with HasActivities: false, primary name column defined)
3. Simple Columns (String, Number, Boolean, DateTime, Currency)
4. Picklist Columns (bound to global option sets created in step 1)
5. Lookup Columns / Relationships (referencing tables created in step 2)
6. Security Role — "<App Name> Collaborator" with Collaborator-level privileges on all custom tables
7. PublishAllXml (makes ALL schema changes visible to the runtime)
8. pac code add-data-source -a dataverse -t <table> (registers each table)
9. Generated connector output refreshes as each `pac code add-data-source` command completes
```

Skipping step 7 is the most common cause of "column not found" or "table not found" errors — Dataverse metadata API creates artifacts in an unpublished state. They exist in the metadata but are invisible to the runtime, OData, and `pac code add-data-source` until published.

Skipping step 6 means users with only Basic User cannot access your custom tables — Dataverse denies access by default on new custom entities.

**Step 4 (Picklist columns) has a specific gotcha that trips almost every first-time project:** Dataverse rejects any attempt to embed an option set inline inside a `PicklistAttributeMetadata` payload. You must create the global option set in step 1, then bind to its `MetadataId` via `GlobalOptionSet@odata.bind`. See [Binding a column to a global option set](#binding-a-column-to-a-global-option-set) below for the exact payload shape.

---

## Solution Context — CRITICAL for Every API Call

**Every Dataverse Web API call that creates schema must include the `MSCRM.SolutionUniqueName` header.** Without it, artifacts are created in the Default Solution — they won't travel with your solution export/import and become orphans that are painful to move later.

When using the Dataverse-skills plugin, pass `solution="<UniqueName>"` on every SDK call, or include `"MSCRM.SolutionName": "<UniqueName>"` on raw Web API calls. The plugin's `dv-metadata` skill enforces this automatically when you confirm the solution at the start of a metadata session.

**If you forget the solution context:**
- The artifact is created in the Default Solution
- It won't appear in your solution's component list
- It won't be included when you export the solution
- You'll have to manually "Add existing" from the Maker Portal to move it — and you'll miss dependencies

---

## Preferred Provisioning Mechanism — Dataverse-skills Plugin

If the [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin is installed, use it for all schema provisioning operations. The plugin provides:

- **`dv-metadata`** — Create tables, columns, relationships, forms, views. Handles idempotency, metadata propagation delays, and error recovery via the Python SDK.
- **`dv-solution`** — Solution lifecycle: create, export, import, promote across environments.
- **`dv-security`** — Role assignment via PAC CLI.
- **`dv-data`** — Seed data, bulk import, CSV loads.

The plugin uses a **MCP → Python SDK → Web API** priority order. It handles the common gotchas (metadata cache delays, `*Id` suffix collisions, field casing rules, global-vs-inline option sets) that are documented in detail below.

**Install commands:**
- GitHub Copilot: `/plugin install dataverse@awesome-copilot`
- Claude Code: `/plugin install dataverse@claude-plugins-official`

**Prerequisites:** Python 3 + `pip install PowerPlatform-Dataverse-Client pandas`

If the plugin is NOT installed, the bash/Web API patterns documented below remain a valid fallback. The golden sequence, naming rules, and TypeScript usage patterns apply regardless of which mechanism provisions the schema.

---

## Option Sets (Global Choices)

### Always use Global, never Inline

When creating a Choice column in Dataverse you have two options: a **global** option set (defined independently, shared across tables) or a **local/inline** option set (embedded directly in the column definition, not reusable).

**Always create a global option set.** There are no circumstances in a Code App project where an inline choice is preferable.

| | Global Choice | Inline Choice |
|---|---|---|
| Reusable across tables | ✅ | ❌ |
| Travels with solution | ✅ | Partial |
| Scriptable via Web API | ✅ | ❌ |
| Generates clean TypeScript type | ✅ | ❌ |
| Appears in Power Apps Maker Portal Choice library | ✅ | ❌ |

### Naming convention — always use your publisher prefix

Every global option set name must begin with your solution publisher prefix (e.g. `agtpo_`, `contoso_`, `cr8b4_`). This prefix is set when you create your solution publisher in the Power Platform admin center.

```
<publisher_prefix>_<descriptivename>

✅ agtpo_ideastatus
✅ agtpo_complexitylevel
✅ agtpo_platformtype

❌ IdeaStatus         (no prefix — will collide across orgs)
❌ idea_status        (wrong format)
❌ agtpo_IdeaStatus   (camelCase — use all lowercase)
```

The logical name must be all lowercase, no spaces, no hyphens — underscores only after the prefix.

### Integer value convention — always start at 100000000

Dataverse custom option values must be in the range reserved for your publisher prefix customizations. The standard starting value for custom choices is **100000000**, incrementing by 1:

```
✅ 100000000 → Draft
✅ 100000001 → Under Review
✅ 100000002 → Approved

❌ 1 → Draft   (reserved for system/OOB option sets)
❌ 0 → Draft   (zero is ambiguous and often means "no selection")
```

Never use sequential values starting at 1 — those collide with system-managed status codes and create ambiguity in OData filters.

### The add-don't-delete rule — critical for live data

Once an option set value has been saved to a record in any environment, that integer value is permanently associated with that label in your data. Removing or renumbering values breaks all existing records silently — Dataverse will still store the old integer but the label lookup returns null.

**The only safe operations on a live option set are:**
- ✅ Add a new value (new integer, new label)
- ✅ Rename an existing label (the integer stays the same — safe)
- ❌ Delete a value (breaks records that stored that integer)
- ❌ Reorder values (renumbering breaks existing data)
- ❌ Change an integer (impossible after creation — Dataverse won't allow it)

If a value is truly deprecated, rename it to `[Deprecated] OldName` rather than deleting it. Filter it out in your UI but keep it in the option set.

### Idempotent creation via setup script (recommended pattern)

Do not create option sets manually through the Power Apps Maker Portal for any option set that a Code App depends on. Instead, define them programmatically so they are re-runnable on any fresh environment.

**With the Dataverse-skills plugin (preferred):** Use `dv-metadata` — it creates global option sets via the Python SDK with idempotent check-first patterns and handles metadata propagation delays automatically.

**Without the plugin (fallback):** Use the Web API with bash scripts that check existence before creating. The pattern requires:

1. A `get_global_optionset_id()` helper that queries `GET /GlobalOptionSetDefinitions(Name='...')`
2. A `create_global_optionset_if_missing()` wrapper that checks before POSTing
3. An `ensure_global_optionset_option()` helper for adding individual values idempotently

These helpers must always include the `MSCRM.SolutionUniqueName` header on every API call.
### Binding a column to a global option set

When creating a Picklist column via the Web API, bind it to the global option set using `GlobalOptionSet@odata.bind` — do not redefine the values inline.

> **⚠️ CRITICAL — Dataverse will reject inline option sets on a Picklist attribute.**
>
> This is the single most common way the first Picklist column in a new project fails. The Web API does not accept an `OptionSet` object embedded inside a `PicklistAttributeMetadata` payload (it only accepts this embedded form for Boolean's `TrueOption`/`FalseOption`). You **must** create the global option set first, retrieve its `MetadataId`, and reference it via `GlobalOptionSet@odata.bind`.
>
> **❌ WRONG — fails with `400 Bad Request: An undeclared property 'OptionSet'...`**
> ```json
> {
>   "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
>   "SchemaName": "rpvms_status",
>   "OptionSet": {
>     "OptionSetType": "Picklist",
>     "IsGlobal": false,
>     "Options": [ { "Value": 100000000, "Label": { ... } } ]
>   }
> }
> ```
>
> **✅ RIGHT — create the global option set first, then bind by MetadataId:**
> ```json
> {
>   "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
>   "SchemaName": "rpvms_status",
>   "GlobalOptionSet@odata.bind": "/GlobalOptionSetDefinitions(<metadata-id-guid>)"
> }
> ```
>
> If you are tempted to use an inline/local option set "just for this one column," don't — see the Global vs Inline table above. Local option sets also do not travel cleanly with solution export and are not scriptable.

**With the Dataverse-skills plugin:** The `dv-metadata` skill's `add_columns` method handles choice columns via Python `IntEnum` classes — it creates the option set and binds it automatically, no manual MetadataId lookup needed.

**Without the plugin (fallback):** Create a `create_picklist_column_if_missing()` bash helper that retrieves the global option set MetadataId via `GET /GlobalOptionSetDefinitions(Name='...')` and then creates the column with `GlobalOptionSet@odata.bind`.

**Critical ordering rule:** Always create the global option set first, then the column that references it.

---

## TypeScript — Generated Types for Option Sets

### Never hardcode integer values in React code

The PAC CLI generates TypeScript models from your Dataverse schema in `src/generated/models/`. These generated files contain `as const` objects mapping integer values to string labels. Always import and use these — never write raw numbers like `100000002` in your components.

**The generated pattern (do not edit these files manually):**

```typescript
// src/generated/models/Agtpo_agentideasModel.ts — AUTO-GENERATED, do not edit
export const Agtpo_agentideasagtpo_status = {
  100000000: 'Draft',
  100000001: 'UnderReview',
  100000002: 'Approved',
  100000003: 'InDevelopment',
  100000004: 'Completed',
  100000005: 'Rejected'
} as const;
export type Agtpo_agentideasagtpo_status =
  keyof typeof Agtpo_agentideasagtpo_status;
```

**Using generated types in components:**

```typescript
// ✅ Correct — use generated constants, never raw integers
import {
  Agtpo_agentideasagtpo_status,
  type Agtpo_agentideasBase
} from '../generated/models/Agtpo_agentideasModel';

// Type-safe status check
const isApproved = (idea: Agtpo_agentideasBase) =>
  idea.agtpo_status === 100000002; // ❌ raw integer — fragile, unreadable

const isApproved = (idea: Agtpo_agentideasBase) =>
  Agtpo_agentideasagtpo_status[idea.agtpo_status!] === 'Approved'; // ✅

// Display label from integer value
const statusLabel = Agtpo_agentideasagtpo_status[idea.agtpo_status!];
// Returns 'UnderReview', 'Approved', etc.

// Build a dropdown from the option set
const statusOptions = Object.entries(Agtpo_agentideasagtpo_status).map(
  ([value, label]) => ({ key: Number(value), text: label })
);
```

**Filtering with OData — use the integer, not the label:**

```typescript
// When querying Dataverse via OData, filter by the integer value
const approvedIdeas = await dataverse.get(
  `agtpo_agentideas?$filter=agtpo_status eq 100000002`
);

// Better — derive the integer from the generated constant so renaming the label is safe
const APPROVED_VALUE = Number(
  Object.entries(Agtpo_agentideasagtpo_status)
    .find(([, label]) => label === 'Approved')![0]
);
```

### When generated types don't exist yet (pre-scaffolding)

Before running `pac data-source add` and generating the model, define a temporary local enum in your feature folder. Move to the generated type once it exists:

```typescript
// src/features/ideas/ideaTypes.ts — temporary, until generation runs
export const IdeaStatus = {
  Draft: 100000000,
  UnderReview: 100000001,
  Approved: 100000002,
  InDevelopment: 100000003,
  Completed: 100000004,
  Rejected: 100000005,
} as const;
export type IdeaStatus = (typeof IdeaStatus)[keyof typeof IdeaStatus];
```

Mark it with a `// TODO: replace with generated type after pac data-source add` comment.

---

## Tables

### Naming convention

| Component | Rule | Example |
|---|---|---|
| Schema name | PascalCase with publisher prefix | `Agtpo_AgentIdea` |
| Logical name | Lowercase, underscore | `agtpo_agentidea` |
| Display name (singular) | Human readable | `Agent Idea` |
| Display name (plural) | Human readable | `Agent Ideas` |
| Primary name column | Use a meaningful descriptor | `agtpo_name` or `agtpo_title` |

Always define a meaningful Primary Name column — this is what appears in lookups and relationship views. Don't leave it as the default `Name`.

### Table type selection

| Type | Use when |
|---|---|
| Standard table | Most cases — transactional records your app owns |
| Activity table | The record represents a communication or task (email, call, appointment) |
| Virtual table | The data lives in an external system and you're presenting it read-only |
| Elastic table | Very high volume append-mostly data (logs, telemetry) |

For most Code App use cases, standard tables are correct.

### Create tables inside the solution — every time

Never create a table from the "Tables" shortcut in the Power Apps Maker Portal. Always navigate through your solution, or create via the Web API with the `MSCRM.SolutionUniqueName` header (which the `api_call` helper includes automatically).

```
make.powerapps.com → Solutions → [Your Solution] → New → Table
```

A table created outside a solution lands in the default solution. Moving it later requires manually adding it and all dependent components — and you will miss some.

### Programmatic table creation

**With the Dataverse-skills plugin (preferred):** Use `dv-metadata` — `client.tables.create()` handles table creation with the Python SDK, including idempotent check-first patterns and metadata propagation delay handling.

```python
# SDK approach via dv-metadata
info = client.tables.create(
    "prefix_ProjectBudget",
    {"prefix_Amount": "decimal", "prefix_Description": "string"},
    solution="MySolution",
    primary_column="prefix_Name",
    display_name="Project Budget",
)
```

**Without the plugin (fallback):** Use the Web API with a `create_table_if_missing()` bash helper that checks `GET /EntityDefinitions(LogicalName='...')` before POSTing the `EntityMetadata` payload. Always include the `MSCRM.SolutionUniqueName` header.

**Critical properties for table creation:**

| Property | Value | Why |
|---|---|---|
| `HasActivities` | `false` | Must always be included. Omitting it can cause the API to use a default that adds unwanted activity relationships. |
| `HasNotes` | `false` | Set `true` only if you need the Notes/Annotations timeline on records. |
| `OwnershipType` | `"UserOwned"` | Standard for most tables. Use `"OrganizationOwned"` only for reference/config data. |
| `IsActivity` | `false` | Only set `true` for activity-type tables (rare in Code Apps). |
| `PrimaryNameAttribute` | Your primary name column | Appears in lookups and views — make it meaningful (not generic "Name"). |

---

## Columns

### Column naming convention

```
<publisher_prefix>_<descriptivename>

✅ agtpo_businessvalue
✅ agtpo_deliverylead
✅ agtpo_aienrichmentrequested

❌ businessvalue     (no prefix)
❌ agtpo_BusinessValue  (camelCase)
```

### Recommended data types by use case

| Use case | Dataverse type | OData type in TypeScript |
|---|---|---|
| Short text (name, title) | Single line of text | `string` |
| Long text (description, notes) | Multiple lines of text | `string` |
| Status, category, type | Choice (use global option set) | `number` (integer value) |
| True/false flag | Yes/No (boolean) | `boolean` |
| Date only (no time) | Date Only | `string` (ISO date) |
| Date + time | Date and Time | `string` (ISO datetime) |
| Whole number | Whole Number | `number` |
| Decimal | Decimal Number | `number` |
| Currency amount | Currency | `number` |
| Related record | Lookup | `string` (GUID) |

### Required vs Optional

Only mark a column as **Business Required** if the data truly cannot be absent for any business process. Required columns make bulk imports and API operations harder and block solution upgrades when records violate the constraint.

For UI-level "required" (you want to prompt the user), enforce that in your React component validation, not at the Dataverse column level.

### Programmatic column creation

**With the Dataverse-skills plugin (preferred):** Use `dv-metadata` — `client.tables.add_columns()` supports string, integer, decimal, boolean, datetime, and choice columns. Example:

```python
client.tables.add_columns(
    "prefix_tablename",
    {"prefix_Description": "string", "prefix_Amount": "decimal", "prefix_Active": "bool"},
)
```

**Without the plugin (fallback):** Use the Web API with `column_exists()` + type-specific `create_*_column_if_missing()` bash helpers. Each helper checks existence before POSTing to `/EntityDefinitions(LogicalName='...')/Attributes`. Always include the `MSCRM.SolutionUniqueName` header.

**Usage pattern (after table creation, before relationships):**

```bash
echo ">>> Creating columns on agtpo_agentidea"

create_string_column_if_missing  "agtpo_agentidea" "agtpo_title"       "Title" 200 "ApplicationRequired"
create_memo_column_if_missing    "agtpo_agentidea" "agtpo_description" "Description" 10000
create_boolean_column_if_missing "agtpo_agentidea" "agtpo_isarchived"  "Is Archived" "false"
create_integer_column_if_missing "agtpo_agentidea" "agtpo_votecount"   "Vote Count" 0 100000
create_datetime_column_if_missing "agtpo_agentidea" "agtpo_submittedon" "Submitted On" "DateOnly"

# Picklist columns — must bind to global option set created earlier:
create_picklist_column_if_missing "agtpo_agentidea" "agtpo_status" "Status" "agtpo_ideastatus" "100000000"
```

---

## Relationships

### Always define relationships inside the solution

Like tables and option sets, relationships created outside a solution become orphaned. Navigate through your solution to create them.

### Naming convention

```
<publisher_prefix>_<parent_entity>_<child_entity>

✅ agtpo_agentidea_productmapping
✅ agtpo_agentidea_feedback
```

### Cascade behavior defaults

For most Code App relationships, these defaults are correct:

| Behavior | Setting |
|---|---|
| Assign | Cascade None |
| Delete | Restrict (prevent deleting parent if children exist) |
| Reparent | Cascade None |
| Share / Unshare | Cascade None |

Only change cascade delete to "Cascade All" if you explicitly want child records destroyed when a parent is deleted (e.g. a line item table that is meaningless without its header).

### Programmatic relationship creation

**With the Dataverse-skills plugin (preferred):** Use `dv-metadata` — `client.tables.create_lookup_field()` for simple lookups and `client.tables.create_one_to_many_relationship()` for full control. Many-to-many relationships use `client.tables.create_many_to_many_relationship()`.

```python
# Simple lookup via dv-metadata
result = client.tables.create_lookup_field(
    referencing_table="prefix_agentidea",
    lookup_field_name="prefix_ProjectId",
    referenced_table="prefix_project",
    display_name="Project",
    solution="MySolution",
)
```

**Without the plugin (fallback):** Use the Web API with a `create_relationship_if_missing()` bash helper that checks `GET /RelationshipDefinitions(SchemaName='...')` before POSTing the `OneToManyRelationshipMetadata` payload.

**Relationship creation order:** Both the parent and child tables must exist before creating the relationship. This is why the Golden Sequence places relationships after tables and columns.

### Lookup field usage in TypeScript

Lookup fields behave differently for reads vs writes:

```typescript
// ── READING a lookup value ──
// The GUID is in the navigation property prefixed with underscore and suffixed with _value
const projectId = record._agtpo_projectid_value;  // GUID string
// The display name (if expanded) is in @OData.Community.Display.V1.FormattedValue
const projectName = record["_agtpo_projectid_value@OData.Community.Display.V1.FormattedValue"];

// ── WRITING / SETTING a lookup value ──
// Use @odata.bind with the entity set name (plural) and the target record GUID
const updatePayload = {
  "agtpo_ProjectId@odata.bind": `/agtpo_projects(${targetProjectGuid})`
};

// ── CLEARING a lookup value ──
// Set the navigation property to null
const clearPayload = {
  "agtpo_ProjectId@odata.bind": null
};
```

**Key rules for lookups:**
- Read GUIDs from `_<field>_value` (lowercase, underscore prefix)
- Write relationships with `<SchemaName>@odata.bind` (PascalCase, no underscore prefix)
- The `@odata.bind` value uses the **entity set name** (plural logical name), not the entity logical name
- Never try to write directly to `_<field>_value` — it's read-only

---

## Security Role — App Collaborator

Every Code App that uses custom Dataverse tables **must** have a dedicated security role. Without it, users with only the Basic User role cannot read, create, or update records in your custom tables — Dataverse denies access by default.

### Design: Supplementary Role (not a copy)

The role is **supplementary** — it is designed to be assigned **alongside** Basic User, not to replace it. It contains **only** privileges for your custom tables. This approach:

- Avoids duplicating ~100+ platform privileges from Basic User (no drift when Microsoft updates it)
- Is portable across environments (no dependency on Basic User's internal privilege GUIDs)
- Is easy to create and maintain programmatically

### Naming Convention

The role name follows this pattern:

```
<SOLUTION_DISPLAY_NAME> Collaborator
```

Examples: `Project Tracker Collaborator`, `Expense Manager Collaborator`, `HR Onboarding Collaborator`

The wizard stores this as `SOLUTION_DISPLAY_NAME` in project state.

### Privilege Levels — Collaborator Settings

The Collaborator permission setting (per [Microsoft docs](https://learn.microsoft.com/en-us/power-platform/admin/security-roles-privileges#permission-settings)) maps to these Dataverse privilege depths:

| Privilege | Depth | Constant | Meaning |
|-----------|-------|----------|----------|
| Create | Local (BU) | `2` | Create records in own business unit |
| Read | Global (Org) | `3` | Read all records in the organization |
| Write | Local (BU) | `2` | Update records in own business unit |
| Delete | Local (BU) | `2` | Delete records in own business unit |
| Append | Local (BU) | `2` | Attach records to this entity |
| AppendTo | Local (BU) | `2` | Allow other records to be attached to this entity |
| Assign | Local (BU) | `2` | Assign records to another user in BU |
| Share | Local (BU) | `2` | Share records with another user in BU |

Depth values for the API: `0` = None, `1` = User, `2` = Business Unit (Local), `3` = Parent:Child BU, `4` = Organization (Global).

### Programmatic creation

**With the Dataverse-skills plugin (preferred):** Use `dv-security` — `pac admin assign-user` handles role assignment. For creating the Collaborator role itself, use `dv-metadata` with the Python SDK to create the role record and add privileges.

**Without the plugin (fallback):** Use the Web API with a `create_or_update_security_role()` bash helper that:

1. Checks if the role exists via `GET /roles?$filter=name eq '...'`
2. Creates if missing via `POST /roles`
3. Auto-detects all custom tables with `GET /EntityDefinitions?$filter=IsCustomEntity eq true and startswith(LogicalName, '<prefix>')`
4. Adds Collaborator-level privileges via `POST /AddPrivilegesRole`

The script must include `MSCRM.SolutionUniqueName` on the role creation call so the role travels with the solution.

### Assigning the role to users (dev/test environments)

**With the Dataverse-skills plugin:** Use `pac admin assign-user --user <email> --role "<RoleName>" --environment <url>`.

**Without the plugin:** Use the Web API to look up the user via `GET /systemusers?$filter=internalemailaddress eq '...'`, look up the role via `GET /roles?$filter=name eq '...'`, then associate via `POST /systemusers(<id>)/systemuserroles_association/$ref`.

### Key rules for security roles

- **Supplementary, not standalone**: Always assign alongside Basic User — never expect this role alone to be sufficient for platform functionality (dashboards, personal views, etc.)
- **Auto-detect tables**: Use the `IsCustomEntity eq true and startswith(LogicalName, '<prefix>')` filter to automatically discover all tables with your prefix — no hardcoded table lists that go stale
- **Collaborator is the safe default**: It gives broad read access (global) but limits writes to the user's business unit — appropriate for most business apps
- **Include in solution**: The role is created with the `MSCRM.SolutionUniqueName` header (via `api_call`), so it travels with your solution export/import
- **Re-run safe**: The script checks for existing roles before creating — it's idempotent
- **Production assignment**: In production, assign roles via the Power Platform Admin Center or Azure AD group-to-role mapping — not via script

> For the conceptual background on why supplementary roles and Dataverse security role design, see `06-security.instructions.md`.

---

## Solution Layering and Import Order

If your schema spans multiple solutions (e.g. a base solution with shared option sets and a project-specific solution with tables that reference those option sets), the import order matters:

1. Import the base solution (which defines the shared option sets) first
2. Import the dependent solution second
3. **Publish customizations** after import (`PublishAllXml`)

If you import out of order, the dependent solution will fail with a "missing dependency" error. Document the import order in your `README.md` and encode it in your CI/CD pipeline's deploy step.

Use `pac solution check` before every import to catch dependency issues:

```bash
pac solution check --path ./solution/solution-unmanaged.zip --outputDirectory ./solution-check-results
```

---

## Publishing and Registration

Schema changes created via the Web API are **not visible** to apps, connectors, or `pac code add-data-source` until they're published. This is the most commonly missed step.

### Step 1: Publish all customizations

After all option sets, tables, columns, and relationships have been created:

```bash
# Publish all customizations in the environment
api_call POST "/PublishAllXml" '{}'
echo "[OK] Published all customizations"
```

If you want to publish only specific entities (faster for large orgs):

```bash
# Publish only the entities you changed
api_call POST "/PublishXml" '{"ParameterXml": "<importexportxml><entities><entity>agtpo_project</entity><entity>agtpo_agentidea</entity></entities></importexportxml>"}'
```

**Always use `PublishAllXml` in setup scripts** — it's safer and the extra time is negligible for initial schema creation.

### Step 2: Register tables as data sources

After publishing, register each table with your Code App so the TypeScript SDK is generated:

```bash
# For each table your app needs:
~/.dotnet/tools/pac code add-data-source -a dataverse -t agtpo_project
~/.dotnet/tools/pac code add-data-source -a dataverse -t agtpo_agentidea
# ... one command per table

# Generated files in src/generated/ refresh during each add-data-source run
```

This creates/updates:
- `src/generated/services/<Table>Service.ts` — CRUD operations
- `src/generated/models/<Table>Model.ts` — TypeScript interfaces
- `.power/schemas/` — schema metadata

**Never edit files in `src/generated/`** — they're regenerated when `pac code add-data-source` refreshes connector output.

### Step 3: Install/update the SDK package

```bash
npm install @microsoft/power-apps@^1.0.3
```

### Complete bootstrap sequence

**With the Dataverse-skills plugin (preferred):**

The agent uses the planning artifact (`dataverse/planning-payload.json`) to drive `dv-metadata` for schema provisioning, then returns to this repo's data-source registration:

1. Validate: `pacaf-validate dataverse/planning-payload.json`
2. Generate plans: `pacaf-generate dataverse/planning-payload.json`
3. Provision via `dv-metadata`: Create global option sets, tables, columns, relationships (the plugin handles idempotency and propagation delays)
4. Create security role via `dv-security` or `dv-metadata`
5. Publish: The plugin calls `PublishAllXml` automatically after metadata changes
6. Register data sources: `pacaf-register dataverse/register-datasources.plan.json`
7. Install SDK: `npm install @microsoft/power-apps@^1.0.3`

**Without the plugin (fallback):**

Use the bash/Web API patterns described above in a single bootstrap script that follows the golden sequence.

## Validation and Output Contract

After completing the schema phase, return all of the following:

1. **Actions performed** — option sets, tables, columns, relationships, roles, publish, data-source registration
2. **Artifacts updated** — schema plan file, setup scripts, generated SDK files
3. **Validation result** — publish succeeded, `pac code add-data-source` succeeded, and generated connector output is current
4. **Generated plan artifacts** — `provision-tables.plan.json`, `provision-relationships.plan.json`, and `register-datasources.plan.json` are current for the checked-in planning payload
4. **Next phase recommendation** — connector integration or UI implementation

---

## Pre-Schema Checklist

Before writing any setup script or creating any schema manually, answer these questions:

**Solution & Publisher:**
- [ ] Have you confirmed the solution publisher prefix you'll use for this project?
- [ ] Are all schema artifacts (tables, option sets, columns, relationships) created inside the solution?
- [ ] Does every API call include the `MSCRM.SolutionUniqueName` header (via the `api_call` helper)?

**Option Sets:**
- [ ] Is every option set you need defined as a global choice (not inline)?
- [ ] Are option set integer values starting at your publisher's choice value prefix (e.g. 100000000)?
- [ ] Are raw integer literals absent from your React component code (use named constants/enums instead)?

**Tables:**
- [ ] Does every `EntityDefinitions` POST include `HasActivities: false` and `HasNotes: false`?
- [ ] Is `OwnershipType` set to `"UserOwned"` (or `"Organization"` if appropriate)?
- [ ] Is the primary name attribute specified with your publisher prefix?

**Columns:**
- [ ] Does your setup script create option sets before the picklist columns that reference them?
- [ ] Do Picklist column payloads use `GlobalOptionSet@odata.bind: "/GlobalOptionSetDefinitions(<MetadataId>)"` — **never** an inline `OptionSet` object? (Dataverse rejects inline option sets on `PicklistAttributeMetadata`.)
- [ ] Are simple columns (string, integer, boolean) created before lookup columns (relationships)?

**Relationships:**
- [ ] Do both parent and child tables exist before creating the relationship?
- [ ] Is cascade delete set to `"Restrict"` (safe default)?

**Security Role:**
- [ ] Does the script create a `<SOLUTION_DISPLAY_NAME> Collaborator` security role?
- [ ] Is the role supplementary (designed to be assigned alongside Basic User, not replace it)?
- [ ] Does the role auto-detect all custom tables with the publisher prefix?
- [ ] Are privileges set to Collaborator depth (Create/Write/Delete/Append/AppendTo/Assign/Share=BU, Read=Org)?
- [ ] Is the role created within the solution (via `api_call` with `MSCRM.SolutionUniqueName`)?

**Publishing & Registration:**
- [ ] Does the script call `PublishAllXml` after all schema changes (including the security role)?
- [ ] Is `pac code add-data-source -a dataverse -t <table>` run for every table the app needs?
- [ ] Is generated connector output current after adding data sources?
- [ ] Is the setup script idempotent (safe to re-run on an environment that already has the schema)?
- [ ] Are generated TypeScript types regenerated after any schema change?
