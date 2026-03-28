---
applyTo: "scripts/**,src/**,solution/**"
---

# Power Apps Code Apps — Dataverse Schema Design

This file covers how to define, create, and maintain Dataverse schema artifacts — Option Sets (Choices), Tables, and Columns — in a way that is solution-portable, ALM-safe, and produces clean TypeScript types.

Schema mistakes are the most expensive kind to fix after data has been collected. Read this before creating a single table or option set.

## Phase Contract — Plan First, Then Provision

Dataverse work is not a single step. It is a sequence:

`schema plan artifact -> option sets -> tables -> columns -> relationships -> security role -> publish -> register data sources -> generate SDK`

If the app requirements still exist only as a rough narrative or brainstorming discussion, stop here and complete the upstream planning flow first:

- `00a-business-problem-decomposition.instructions.md`
- `00b-scope-refinement-and-solution-shaping.instructions.md`
- `00c-solution-concept-to-dataverse-plan.instructions.md`

This file assumes the business problem has already been decomposed, refined, and translated into a conceptual plan that is ready to become a Dataverse planning artifact.

For non-trivial apps, that planning artifact should also have been pressure-tested by the prototype-validation phase. If the UX has not yet been validated with representative mock data and stakeholder review, strongly consider returning to `00d-prototype-validation.instructions.md` before freezing tables and relationships.

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
node scripts/validate-schema-plan.mjs dataverse/planning-payload.json
node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json
node scripts/register-dataverse-data-sources.mjs dataverse/register-datasources.plan.json
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

---

## Solution Context — CRITICAL for Every API Call

**Every Dataverse Web API call that creates schema must include the `MSCRM.SolutionUniqueName` header.** Without it, artifacts are created in the Default Solution — they won't travel with your solution export/import and become orphans that are painful to move later.

```bash
# ── api_call helper — ALWAYS pass the solution header ──
# This is the standard helper function used throughout all schema scripts.
# Define this at the top of every setup script.

SOLUTION_NAME="${SOLUTION_UNIQUE_NAME}"   # From your .env or wizard state

api_call() {
  local method="$1" path="$2" body="$3"
  local url="${DATAVERSE_URL}/api/data/v9.2${path}"
  local args=(
    -s -S
    -X "$method"
    -H "Authorization: Bearer ${ACCESS_TOKEN}"
    -H "OData-MaxVersion: 4.0"
    -H "OData-Version: 4.0"
    -H "Accept: application/json"
    -H "Content-Type: application/json; charset=utf-8"
    -H "Prefer: return=representation"
    -H "MSCRM.SolutionUniqueName: ${SOLUTION_NAME}"
  )
  if [ -n "$body" ]; then
    args+=(-d "$body")
  fi
  curl "${args[@]}" "$url"
}
```

**If you forget the `MSCRM.SolutionUniqueName` header:**
- The artifact is created in the Default Solution
- It won't appear in your solution's component list
- It won't be included when you export the solution
- You'll have to manually "Add existing" from the Maker Portal to move it — and you'll miss dependencies

The wizard stores the solution unique name in `SOLUTION_UNIQUE_NAME` state. The `wizard/lib/dataverse.mjs` helper supports this via the `{ solutionName }` option on `dvPost`.

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

Do not create option sets manually through the Power Apps Maker Portal for any option set that a Code App depends on. Instead, define them in a setup script that:

1. Checks whether the option set already exists before creating it
2. Adds individual values idempotently (checks before inserting)
3. Can be run on any fresh environment to reproduce the full schema

This pattern comes directly from production use and handles both first-time setup and re-runs on existing environments:

```bash
#!/bin/bash
# scripts/setup.sh — Dataverse schema bootstrap

API_URL="${DATAVERSE_URL}/api/data/v9.2"

# ---- Helper: Get global option set MetadataId by name ----
get_global_optionset_id() {
  local optionset_name="$1"
  local body
  body=$(api_call GET "/GlobalOptionSetDefinitions(Name='${optionset_name}')?\$select=MetadataId" 2>/dev/null || true)
  python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d.get('MetadataId',''))" "$body" 2>/dev/null || true
}

# ---- Helper: Create global option set if it doesn't already exist ----
create_global_optionset_if_missing() {
  local optionset_name="$1"   # e.g. "agtpo_ideastatus"
  local display_name="$2"     # e.g. "Idea Status"
  local options_json="$3"     # JSON array: [{"value":100000000,"label":"Draft"}, ...]

  if [ -n "$(get_global_optionset_id "$optionset_name")" ]; then
    echo "  [OK] Already exists: $optionset_name"
    return
  fi

  payload=$(python3 - "$optionset_name" "$display_name" "$options_json" <<'PY'
import json, sys
name, display_name, options_json = sys.argv[1:4]
options = json.loads(options_json)
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.OptionSetMetadata",
    "Name": name,
    "DisplayName": {"LocalizedLabels": [{"Label": display_name, "LanguageCode": 1033}]},
    "IsGlobal": True,
    "OptionSetType": "Picklist",
    "Options": [
        {
            "Value": option["value"],
            "Label": {"LocalizedLabels": [{"Label": option["label"], "LanguageCode": 1033}]},
        }
        for option in options
    ],
}))
PY
)
  api_call POST "/GlobalOptionSetDefinitions" "$payload" >/dev/null
  echo "  [OK] Created: $optionset_name"
}

# ---- Helper: Add a single value to an existing option set (idempotent) ----
ensure_global_optionset_option() {
  local optionset_name="$1"
  local option_value="$2"   # integer: 100000006
  local option_label="$3"   # string: "Azure Storage"

  # Check if value already exists
  local body
  body=$(api_call GET "/GlobalOptionSetDefinitions(Name='${optionset_name}')/Microsoft.Dynamics.CRM.OptionSetMetadata?\$select=Options" 2>/dev/null || true)
  local exists
  exists=$(python3 -c "
import json, sys
body = json.loads(sys.argv[1])
values = [o.get('Value') for o in body.get('Options', [])]
print('1' if int(sys.argv[2]) in values else '0')
" "$body" "$option_value" 2>/dev/null || echo "0")

  if [ "$exists" = "1" ]; then
    echo "  [OK] Option already exists: ${option_label} (${option_value}) in ${optionset_name}"
    return
  fi

  payload=$(python3 - "$optionset_name" "$option_value" "$option_label" <<'PY'
import json, sys
name, value, label = sys.argv[1], int(sys.argv[2]), sys.argv[3]
print(json.dumps({
    "OptionSetName": name,
    "Value": value,
    "Label": {"@odata.type": "Microsoft.Dynamics.CRM.Label",
              "LocalizedLabels": [{"@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                                   "Label": label, "LanguageCode": 1033}]},
}))
PY
)
  api_call POST "/InsertOptionValue" "$payload" >/dev/null
  echo "  [OK] Added option: ${option_label} (${option_value}) to ${optionset_name}"
}

# ============================================================
# STEP 1: Create global option sets BEFORE any table columns
# ============================================================

echo ">>> Creating global option sets"

create_global_optionset_if_missing "agtpo_ideastatus" "Idea Status" \
  '[{"value":100000000,"label":"Draft"},
    {"value":100000001,"label":"Under Review"},
    {"value":100000002,"label":"Approved"},
    {"value":100000003,"label":"In Development"},
    {"value":100000004,"label":"Completed"},
    {"value":100000005,"label":"Rejected"}]'

create_global_optionset_if_missing "agtpo_complexitylevel" "Complexity Level" \
  '[{"value":100000000,"label":"Low"},
    {"value":100000001,"label":"Medium"},
    {"value":100000002,"label":"High"}]'

# To add a new value to an existing option set later (never delete old values):
# ensure_global_optionset_option "agtpo_ideastatus" 100000006 "On Hold"
```

### Binding a column to a global option set

When creating a Picklist column via the Web API, bind it to the global option set using `GlobalOptionSet@odata.bind` — do not redefine the values inline:

```bash
create_picklist_column_if_missing() {
  local entity_logical_name="$1"   # e.g. "agtpo_agentideas"
  local attribute_logical_name="$2" # e.g. "agtpo_status"
  local display_name="$3"           # e.g. "Status"
  local optionset_name="$4"         # e.g. "agtpo_ideastatus"
  local default_value="$5"          # e.g. "100000000"

  local optionset_id
  optionset_id=$(get_global_optionset_id "$optionset_name")
  if [ -z "$optionset_id" ]; then
    echo "[ERROR] Option set not found: $optionset_name — create it before the column"
    exit 1
  fi

  payload=$(python3 - "$attribute_logical_name" "$display_name" "$optionset_id" "$default_value" <<'PY'
import json, sys
logical_name, display_name, optionset_id, default_value = sys.argv[1:5]
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
    "SchemaName": logical_name,
    "LogicalName": logical_name,
    "DisplayName": {"LocalizedLabels": [{"Label": display_name, "LanguageCode": 1033}]},
    "RequiredLevel": {"Value": "None"},
    "DefaultFormValue": int(default_value),
    "GlobalOptionSet@odata.bind": f"/GlobalOptionSetDefinitions({optionset_id})"
}))
PY
)
  api_call POST "/EntityDefinitions(LogicalName='${entity_logical_name}')/Attributes" "$payload" >/dev/null
  echo "  [OK] Created column: ${attribute_logical_name} on ${entity_logical_name}"
}
```

**Critical ordering rule:** Always create the global option set first, then the column that references it. If you reverse the order, `get_global_optionset_id` returns empty and the script exits with an error.

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

### Programmatic table creation via Web API

When Copilot or a setup script creates tables, use this pattern. The `api_call` helper (defined in the Solution Context section above) automatically includes the `MSCRM.SolutionUniqueName` header.

```bash
# ---- Helper: Create table if it doesn't already exist ----
create_table_if_missing() {
  local logical_name="$1"       # e.g. "agtpo_agentidea" (all lowercase)
  local schema_name="$2"        # e.g. "Agtpo_AgentIdea" (PascalCase with prefix)
  local display_name="$3"       # e.g. "Agent Idea"
  local display_name_plural="$4" # e.g. "Agent Ideas"
  local primary_attr_name="$5"  # e.g. "agtpo_name" (the primary name column)
  local primary_attr_label="$6" # e.g. "Name"
  local description="$7"        # e.g. "Tracks ideas submitted by agents"

  # Check if table already exists
  local check
  check=$(api_call GET "/EntityDefinitions(LogicalName='${logical_name}')?\\$select=LogicalName" 2>/dev/null || true)
  if echo "$check" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); exit(0 if d.get('LogicalName') else 1)" 2>/dev/null; then
    echo "  [OK] Table already exists: ${logical_name}"
    return
  fi

  payload=$(python3 - "$logical_name" "$schema_name" "$display_name" "$display_name_plural" "$primary_attr_name" "$primary_attr_label" "$description" <<'PY'
import json, sys
logical, schema, display, plural, pk_name, pk_label, desc = sys.argv[1:8]
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
    "SchemaName": schema,
    "LogicalName": logical,
    "DisplayName": {"@odata.type": "Microsoft.Dynamics.CRM.Label",
                    "LocalizedLabels": [{"@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                                         "Label": display, "LanguageCode": 1033}]},
    "DisplayCollectionName": {"@odata.type": "Microsoft.Dynamics.CRM.Label",
                              "LocalizedLabels": [{"@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                                                   "Label": plural, "LanguageCode": 1033}]},
    "Description": {"@odata.type": "Microsoft.Dynamics.CRM.Label",
                     "LocalizedLabels": [{"@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                                          "Label": desc, "LanguageCode": 1033}]},
    "HasActivities": False,
    "HasNotes": False,
    "OwnershipType": "UserOwned",
    "IsActivity": False,
    "PrimaryNameAttribute": pk_name,
    "Attributes": [{
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        "SchemaName": pk_name[0].upper() + pk_name[1:] if '_' not in pk_name else
                      '_'.join(p.capitalize() if i > 0 else p for i, p in enumerate(pk_name.split('_'))),
        "LogicalName": pk_name,
        "DisplayName": {"@odata.type": "Microsoft.Dynamics.CRM.Label",
                        "LocalizedLabels": [{"@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                                             "Label": pk_label, "LanguageCode": 1033}]},
        "RequiredLevel": {"Value": "ApplicationRequired"},
        "MaxLength": 200,
        "IsPrimaryName": True
    }]
}))
PY
)
  api_call POST "/EntityDefinitions" "$payload" >/dev/null
  echo "  [OK] Created table: ${logical_name}"
}

# Usage:
create_table_if_missing \
  "agtpo_agentidea" \
  "Agtpo_AgentIdea" \
  "Agent Idea" \
  "Agent Ideas" \
  "agtpo_name" \
  "Name" \
  "Tracks ideas submitted by agents"
```

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

### Programmatic column creation via Web API

The `api_call` helper passes `MSCRM.SolutionUniqueName` automatically. Create columns after the table exists.

```bash
# ---- Helper: Check if a column already exists on a table ----
column_exists() {
  local entity="$1" attribute="$2"
  local check
  check=$(api_call GET "/EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${attribute}')?\\$select=LogicalName" 2>/dev/null || true)
  echo "$check" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); exit(0 if d.get('LogicalName') else 1)" 2>/dev/null
}

# ---- Helper: Create a string column ----
create_string_column_if_missing() {
  local entity="$1" attr_name="$2" display="$3" max_length="${4:-200}" required="${5:-None}"
  if column_exists "$entity" "$attr_name"; then
    echo "  [OK] Column already exists: ${attr_name} on ${entity}"
    return
  fi
  payload=$(python3 - "$attr_name" "$display" "$max_length" "$required" <<'PY'
import json, sys
name, display, max_len, req = sys.argv[1:5]
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
    "SchemaName": name,
    "LogicalName": name,
    "DisplayName": {"LocalizedLabels": [{"Label": display, "LanguageCode": 1033}]},
    "RequiredLevel": {"Value": req},
    "MaxLength": int(max_len),
    "FormatName": {"Value": "Text"}
}))
PY
)
  api_call POST "/EntityDefinitions(LogicalName='${entity}')/Attributes" "$payload" >/dev/null
  echo "  [OK] Created string column: ${attr_name} on ${entity}"
}

# ---- Helper: Create a memo (multi-line text) column ----
create_memo_column_if_missing() {
  local entity="$1" attr_name="$2" display="$3" max_length="${4:-10000}"
  if column_exists "$entity" "$attr_name"; then
    echo "  [OK] Column already exists: ${attr_name} on ${entity}"
    return
  fi
  payload=$(python3 - "$attr_name" "$display" "$max_length" <<'PY'
import json, sys
name, display, max_len = sys.argv[1:4]
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata",
    "SchemaName": name,
    "LogicalName": name,
    "DisplayName": {"LocalizedLabels": [{"Label": display, "LanguageCode": 1033}]},
    "RequiredLevel": {"Value": "None"},
    "MaxLength": int(max_len),
    "Format": "TextArea"
}))
PY
)
  api_call POST "/EntityDefinitions(LogicalName='${entity}')/Attributes" "$payload" >/dev/null
  echo "  [OK] Created memo column: ${attr_name} on ${entity}"
}

# ---- Helper: Create a boolean (Yes/No) column ----
create_boolean_column_if_missing() {
  local entity="$1" attr_name="$2" display="$3" default_val="${4:-false}"
  if column_exists "$entity" "$attr_name"; then
    echo "  [OK] Column already exists: ${attr_name} on ${entity}"
    return
  fi
  local default_int=0
  [ "$default_val" = "true" ] && default_int=1
  payload=$(python3 - "$attr_name" "$display" "$default_int" <<'PY'
import json, sys
name, display, default_val = sys.argv[1], sys.argv[2], int(sys.argv[3])
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
    "SchemaName": name,
    "LogicalName": name,
    "DisplayName": {"LocalizedLabels": [{"Label": display, "LanguageCode": 1033}]},
    "RequiredLevel": {"Value": "None"},
    "DefaultValue": default_val == 1,
    "OptionSet": {
        "TrueOption": {"Value": 1, "Label": {"LocalizedLabels": [{"Label": "Yes", "LanguageCode": 1033}]}},
        "FalseOption": {"Value": 0, "Label": {"LocalizedLabels": [{"Label": "No", "LanguageCode": 1033}]}}
    }
}))
PY
)
  api_call POST "/EntityDefinitions(LogicalName='${entity}')/Attributes" "$payload" >/dev/null
  echo "  [OK] Created boolean column: ${attr_name} on ${entity}"
}

# ---- Helper: Create a whole number column ----
create_integer_column_if_missing() {
  local entity="$1" attr_name="$2" display="$3" min_val="${4:-0}" max_val="${5:-2147483647}"
  if column_exists "$entity" "$attr_name"; then
    echo "  [OK] Column already exists: ${attr_name} on ${entity}"
    return
  fi
  payload=$(python3 - "$attr_name" "$display" "$min_val" "$max_val" <<'PY'
import json, sys
name, display, min_v, max_v = sys.argv[1:5]
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.IntegerAttributeMetadata",
    "SchemaName": name,
    "LogicalName": name,
    "DisplayName": {"LocalizedLabels": [{"Label": display, "LanguageCode": 1033}]},
    "RequiredLevel": {"Value": "None"},
    "MinValue": int(min_v),
    "MaxValue": int(max_v),
    "Format": "None"
}))
PY
)
  api_call POST "/EntityDefinitions(LogicalName='${entity}')/Attributes" "$payload" >/dev/null
  echo "  [OK] Created integer column: ${attr_name} on ${entity}"
}

# ---- Helper: Create a date/time column ----
create_datetime_column_if_missing() {
  local entity="$1" attr_name="$2" display="$3" format="${4:-DateOnly}"
  # format: "DateOnly" or "DateAndTime"
  if column_exists "$entity" "$attr_name"; then
    echo "  [OK] Column already exists: ${attr_name} on ${entity}"
    return
  fi
  payload=$(python3 - "$attr_name" "$display" "$format" <<'PY'
import json, sys
name, display, fmt = sys.argv[1:4]
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.DateTimeAttributeMetadata",
    "SchemaName": name,
    "LogicalName": name,
    "DisplayName": {"LocalizedLabels": [{"Label": display, "LanguageCode": 1033}]},
    "RequiredLevel": {"Value": "None"},
    "Format": fmt,
    "DateTimeBehavior": {"Value": "UserLocal"}
}))
PY
)
  api_call POST "/EntityDefinitions(LogicalName='${entity}')/Attributes" "$payload" >/dev/null
  echo "  [OK] Created datetime column: ${attr_name} on ${entity}"
}
```

**Usage examples (after table creation, before relationships):**

```bash
echo ">>> Creating columns on agtpo_agentidea"

create_string_column_if_missing  "agtpo_agentidea" "agtpo_title"       "Title" 200 "ApplicationRequired"
create_memo_column_if_missing    "agtpo_agentidea" "agtpo_description" "Description" 10000
create_boolean_column_if_missing "agtpo_agentidea" "agtpo_isarchived"  "Is Archived" "false"
create_integer_column_if_missing "agtpo_agentidea" "agtpo_votecount"   "Vote Count" 0 100000
create_datetime_column_if_missing "agtpo_agentidea" "agtpo_submittedon" "Submitted On" "DateOnly"

# Picklist columns (uses the existing create_picklist_column_if_missing helper):
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

### Programmatic relationship creation via Web API

Lookup columns and relationships are created together as a single `OneToManyRelationship` POST. The `api_call` helper passes `MSCRM.SolutionUniqueName` automatically.

```bash
# ---- Helper: Create a One-to-Many relationship (adds a lookup column on the child) ----
create_relationship_if_missing() {
  local relationship_name="$1"     # e.g. "agtpo_project_agentidea"
  local parent_entity="$2"         # e.g. "agtpo_project" (the "one" side)
  local child_entity="$3"          # e.g. "agtpo_agentidea" (the "many" side)
  local lookup_attr_name="$4"      # e.g. "agtpo_projectid" (lookup column on child)
  local lookup_display_name="$5"   # e.g. "Project"

  # Check if relationship already exists
  local check
  check=$(api_call GET "/RelationshipDefinitions(SchemaName='${relationship_name}')?\\$select=SchemaName" 2>/dev/null || true)
  if echo "$check" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); exit(0 if d.get('SchemaName') else 1)" 2>/dev/null; then
    echo "  [OK] Relationship already exists: ${relationship_name}"
    return
  fi

  payload=$(python3 - "$relationship_name" "$parent_entity" "$child_entity" "$lookup_attr_name" "$lookup_display_name" <<'PY'
import json, sys
rel_name, parent, child, lookup_name, lookup_display = sys.argv[1:6]
# Build SchemaName for the lookup attribute (PascalCase)
parts = lookup_name.split('_')
schema = '_'.join(p.capitalize() if i > 0 else p for i, p in enumerate(parts))
print(json.dumps({
    "@odata.type": "Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata",
    "SchemaName": rel_name,
    "ReferencedEntity": parent,
    "ReferencingEntity": child,
    "CascadeConfiguration": {
        "Assign": "NoCascade",
        "Delete": "Restrict",
        "Merge": "NoCascade",
        "Reparent": "NoCascade",
        "Share": "NoCascade",
        "Unshare": "NoCascade",
        "RollupView": "NoCascade"
    },
    "Lookup": {
        "@odata.type": "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
        "SchemaName": schema,
        "LogicalName": lookup_name,
        "DisplayName": {"LocalizedLabels": [{"Label": lookup_display, "LanguageCode": 1033}]},
        "RequiredLevel": {"Value": "None"}
    }
}))
PY
)
  api_call POST "/RelationshipDefinitions" "$payload" >/dev/null
  echo "  [OK] Created relationship: ${relationship_name} (${parent_entity} → ${child_entity})"
}

# Usage:
create_relationship_if_missing \
  "agtpo_project_agentidea" \
  "agtpo_project" \
  "agtpo_agentidea" \
  "agtpo_projectid" \
  "Project"
```

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

### Programmatic creation via Web API

The script below auto-detects all custom tables with your publisher prefix and grants Collaborator-level privileges on each.

```bash
# ── Helper: Create or update the app's Collaborator security role ──
create_or_update_security_role() {
  local role_name="${SOLUTION_DISPLAY_NAME} Collaborator"
  local prefix="${PREFIX}_"

  echo "── Security Role: ${role_name} ──"

  # ── Step 1: Check if role already exists ──
  local encoded_name
  encoded_name=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$role_name")
  local existing
  existing=$(api_call GET "/roles?\$filter=name eq '${encoded_name}'&\$select=roleid,name" 2>/dev/null || echo '{}')
  local role_id
  role_id=$(echo "$existing" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); v=d.get('value',[]); print(v[0]['roleid'] if v else '')" 2>/dev/null || echo '')

  if [ -z "$role_id" ]; then
    # ── Step 2a: Create the role ──
    local create_result
    create_result=$(api_call POST "/roles" "$(python3 -c "
import json,sys
print(json.dumps({
    'name': sys.argv[1],
    'description': f'Collaborator-level access to all {sys.argv[1].replace(\" Collaborator\", \"\")} custom tables. Assign alongside Basic User.',
    'isinherited': 0
}))" "$role_name")")
    role_id=$(echo "$create_result" | python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('roleid',''))" 2>/dev/null)
    if [ -z "$role_id" ]; then
      echo "  [ERROR] Failed to create security role '${role_name}'"
      return 1
    fi
    echo "  [OK] Created security role: ${role_name} (${role_id})"
  else
    echo "  [OK] Security role already exists: ${role_name} (${role_id})"
  fi

  # ── Step 3: Auto-detect all custom tables with our prefix ──
  local tables_json
  tables_json=$(api_call GET "/EntityDefinitions?\$filter=IsCustomEntity eq true and startswith(LogicalName, '${prefix}')&\$select=LogicalName,ObjectTypeCode" 2>/dev/null || echo '{"value":[]}')
  local table_count
  table_count=$(echo "$tables_json" | python3 -c "import json,sys; print(len(json.loads(sys.stdin.read()).get('value',[])))" 2>/dev/null || echo '0')
  echo "  Found ${table_count} custom tables with prefix '${prefix}'"

  # ── Step 4: For each table, add Collaborator privileges ──
  # Privilege names follow the pattern: prvCreate<EntityName>, prvRead<EntityName>, etc.
  # The entity name in privilege names uses the SchemaName-like format (no underscores, PascalCase-ish)
  echo "$tables_json" | python3 -c "
import json, sys

data = json.loads(sys.stdin.read())
tables = data.get('value', [])

# Collaborator privilege depths
# Create=BU(2), Read=Org(4), Write=BU(2), Delete=BU(2), Append=BU(2), AppendTo=BU(2), Assign=BU(2), Share=BU(2)
privileges = [
    ('Create',   2),
    ('Read',     4),  # 4 = Organization (Global) depth in privilege API
    ('Write',    2),
    ('Delete',   2),
    ('Append',   2),
    ('AppendTo', 2),
    ('Assign',   2),
    ('Share',    2),
]

for t in tables:
    otc = t['ObjectTypeCode']
    logical = t['LogicalName']
    for priv_name, depth in privileges:
        # Output: ObjectTypeCode|PrivilegeName|Depth
        print(f'{otc}|{priv_name}|{depth}|{logical}')
" | while IFS='|' read -r otc priv_action depth logical_name; do
    # Look up the privilege ID for this action on this entity
    local priv_name="prv${priv_action}${logical_name}"
    local priv_result
    priv_result=$(api_call GET "/privileges?\$filter=Name eq '${priv_name}'&\$select=privilegeid,Name" 2>/dev/null || echo '{"value":[]}')
    local priv_id
    priv_id=$(echo "$priv_result" | python3 -c "import json,sys; v=json.loads(sys.stdin.read()).get('value',[]); print(v[0]['privilegeid'] if v else '')" 2>/dev/null || echo '')

    if [ -n "$priv_id" ]; then
      # Add privilege to role with the specified depth
      # Depth mapping for AddPrivilegesRole: 1=User, 2=BU, 3=Parent:Child, 4=Org
      api_call POST "/roles(${role_id})/systemuserroles_association/\$ref" \
        "{}" >/dev/null 2>&1 || true
      # Use the dedicated AddPrivilegesRole action
      api_call POST "/AddPrivilegesRole" "$(python3 -c "
import json
print(json.dumps({
    'RoleId': '${role_id}',
    'Privileges': [{
        'PrivilegeId': '${priv_id}',
        'Depth': '${depth}'
    }]
}))" )" >/dev/null 2>&1 || true
    fi
  done
  echo "  [OK] Collaborator privileges applied to ${table_count} tables"
}

# Usage in bootstrap script:
create_or_update_security_role
```

### Assigning the role to users (dev/test environments)

For automated test/dev setup, you can assign the role programmatically:

```bash
# ── Helper: Assign a security role to a user ──
assign_security_role() {
  local user_email="$1"     # e.g. "testuser@contoso.com"
  local role_name="$2"      # e.g. "Project Tracker Collaborator"

  # Find the user's systemuserid
  local user_result
  user_result=$(api_call GET "/systemusers?\$filter=internalemailaddress eq '${user_email}'&\$select=systemuserid" 2>/dev/null)
  local user_id
  user_id=$(echo "$user_result" | python3 -c "import json,sys; v=json.loads(sys.stdin.read()).get('value',[]); print(v[0]['systemuserid'] if v else '')" 2>/dev/null || echo '')
  if [ -z "$user_id" ]; then
    echo "  [WARN] User not found: ${user_email}"
    return 1
  fi

  # Find the role ID
  local encoded_name
  encoded_name=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$role_name")
  local role_result
  role_result=$(api_call GET "/roles?\$filter=name eq '${encoded_name}'&\$select=roleid" 2>/dev/null)
  local role_id
  role_id=$(echo "$role_result" | python3 -c "import json,sys; v=json.loads(sys.stdin.read()).get('value',[]); print(v[0]['roleid'] if v else '')" 2>/dev/null || echo '')
  if [ -z "$role_id" ]; then
    echo "  [WARN] Role not found: ${role_name}"
    return 1
  fi

  # Associate the role with the user
  api_call POST "/systemusers(${user_id})/systemuserroles_association/\$ref" \
    "{\"@odata.id\": \"${DATAVERSE_URL}/api/data/v9.2/roles(${role_id})\"}" >/dev/null 2>&1
  echo "  [OK] Assigned '${role_name}' to ${user_email}"
}

# Usage:
assign_security_role "testuser@contoso.com" "${SOLUTION_DISPLAY_NAME} Collaborator"
```

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

Here's the full end-to-end script pattern for a schema bootstrap:

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── 1. Configuration (from .env / wizard output) ──
DATAVERSE_URL="${DATAVERSE_URL:?Set DATAVERSE_URL}"
TENANT_ID="${TENANT_ID:?Set TENANT_ID}"
SOLUTION_NAME="${PP_SOLUTION_NAME:?Set PP_SOLUTION_NAME}"
PREFIX="${PP_PUBLISHER_PREFIX:?Set PP_PUBLISHER_PREFIX}"

# ── 2. Auth token ──
TOKEN=$(az account get-access-token --resource "$DATAVERSE_URL" --tenant "$TENANT_ID" --query accessToken -o tsv)

# ── 3. api_call helper (includes MSCRM.SolutionUniqueName on every call) ──
api_call() { ... }  # (defined above in Solution Context section)

# ── 4. Create global option sets ──
# ... option set creation calls ...

# ── 5. Create tables ──
# ... create_table_if_missing calls ...

# ── 6. Create simple columns ──
# ... column creation calls (string, integer, boolean, memo, datetime) ...

# ── 7. Create picklist columns (referencing option sets from step 4) ──
# ... picklist column creation calls ...

# ── 8. Create relationships (lookup columns) ──
# ... create_relationship_if_missing calls ...

# ── 9. Create / update security role ──
create_or_update_security_role   # (defined above in Security Role section)

# ── 10. Publish ──
api_call POST "/PublishAllXml" '{}'
echo "[DONE] Schema created and published."

# ── 11. Register data sources (run from the Code App project directory) ──
echo ""
echo "Now run these commands in your project directory:"
echo "  ~/.dotnet/tools/pac code add-data-source -a dataverse -t ${PREFIX}_project"
echo "  ~/.dotnet/tools/pac code add-data-source -a dataverse -t ${PREFIX}_agentidea"
echo "  npm install @microsoft/power-apps@^1.0.3"
```

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
