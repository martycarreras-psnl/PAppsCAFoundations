---
applyTo: "scripts/**,src/**,solution/**"
---

# Power Apps Code Apps — Dataverse Schema Design

This file covers how to define, create, and maintain Dataverse schema artifacts — Option Sets (Choices), Tables, and Columns — in a way that is solution-portable, ALM-safe, and produces clean TypeScript types.

Schema mistakes are the most expensive kind to fix after data has been collected. Read this before creating a single table or option set.

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
| Appears in maker portal Choice library | ✅ | ❌ |

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

Do not create option sets manually through the maker portal for any option set that a Code App depends on. Instead, define them in a setup script that:

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

Never create a table from the "Tables" shortcut in the maker portal. Always navigate through your solution:

```
make.powerapps.com → Solutions → [Your Solution] → New → Table
```

A table created outside a solution lands in the default solution. Moving it later requires manually adding it and all dependent components — and you will miss some.

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

---

## Solution Layering and Import Order

If your schema spans multiple solutions (e.g. a base solution with shared option sets and a project-specific solution with tables that reference those option sets), the import order matters:

1. Import the base solution (which defines the shared option sets) first
2. Import the dependent solution second

If you import out of order, the dependent solution will fail with a "missing dependency" error. Document the import order in your `README.md` and encode it in your CI/CD pipeline's deploy step.

Use `pac solution check` before every import to catch dependency issues:

```bash
pac solution check --path ./solution/solution.zip --outputDirectory ./solution-check-results
```

---

## Pre-Schema Checklist

Before writing any setup script or creating any schema manually, answer these questions:

- [ ] Have you confirmed the solution publisher prefix you'll use for this project?
- [ ] Is every option set you need defined as a global choice (not inline)?
- [ ] Are option set integer values starting at 100000000?
- [ ] Are all schema artifacts (tables, option sets, columns, relationships) created inside the solution?
- [ ] Does your setup script create option sets before the columns that reference them?
- [ ] Is the setup script idempotent (safe to re-run on an environment that already has the schema)?
- [ ] Are generated TypeScript types regenerated after any schema change (`pac data-source add`)?
- [ ] Are raw integer literals absent from your React component code?
