---
applyTo: "scripts/**,src/**,solution/**"
---

# Power Apps Code Apps — Dataverse Schema Design

This file covers how to define, create, and maintain Dataverse schema artifacts — Option Sets (Choices), Tables, and Columns — in a way that is solution-portable, ALM-safe, and produces clean TypeScript types.

Schema mistakes are the most expensive kind to fix after data has been collected. Read this before creating a single table or option set.

---

## Schema Creation Order — The Golden Sequence

Every schema bootstrap script must follow this exact order. Reversing any step causes dependency failures.

```
1. Global Option Sets (Choices)
2. Tables (with HasActivities: false, primary name column defined)
3. Simple Columns (String, Number, Boolean, DateTime, Currency)
4. Picklist Columns (bound to global option sets created in step 1)
5. Lookup Columns / Relationships (referencing tables created in step 2)
6. PublishAllXml (makes ALL schema changes visible to the runtime)
7. pac code add-data-source -a dataverse -t <table> (registers each table)
8. pac code generate (generates TypeScript SDK from registered tables)
```

Skipping step 6 is the most common cause of "column not found" or "table not found" errors — Dataverse metadata API creates artifacts in an unpublished state. They exist in the metadata but are invisible to the runtime, OData, and `pac code add-data-source` until published.

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

## Solution Layering and Import Order

If your schema spans multiple solutions (e.g. a base solution with shared option sets and a project-specific solution with tables that reference those option sets), the import order matters:

1. Import the base solution (which defines the shared option sets) first
2. Import the dependent solution second
3. **Publish customizations** after import (`PublishAllXml`)

If you import out of order, the dependent solution will fail with a "missing dependency" error. Document the import order in your `README.md` and encode it in your CI/CD pipeline's deploy step.

Use `pac solution check` before every import to catch dependency issues:

```bash
pac solution check --path ./solution/solution.zip --outputDirectory ./solution-check-results
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

# Then regenerate the TypeScript SDK
~/.dotnet/tools/pac code generate
```

This creates/updates:
- `src/generated/services/<Table>Service.ts` — CRUD operations
- `src/generated/models/<Table>Model.ts` — TypeScript interfaces
- `.power/schemas/` — schema metadata

**Never edit files in `src/generated/`** — they're regenerated on every `pac code generate`.

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

# ── 9. Publish ──
api_call POST "/PublishAllXml" '{}'
echo "[DONE] Schema created and published."

# ── 10. Register data sources (run from the Code App project directory) ──
echo ""
echo "Now run these commands in your project directory:"
echo "  ~/.dotnet/tools/pac code add-data-source -a dataverse -t ${PREFIX}_project"
echo "  ~/.dotnet/tools/pac code add-data-source -a dataverse -t ${PREFIX}_agentidea"
echo "  ~/.dotnet/tools/pac code generate"
echo "  npm install @microsoft/power-apps@^1.0.3"
```

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

**Publishing & Registration:**
- [ ] Does the script call `PublishAllXml` after all schema changes?
- [ ] Is `pac code add-data-source -a dataverse -t <table>` run for every table the app needs?
- [ ] Is `pac code generate` run after adding data sources?
- [ ] Is the setup script idempotent (safe to re-run on an environment that already has the schema)?
- [ ] Are generated TypeScript types regenerated after any schema change?
