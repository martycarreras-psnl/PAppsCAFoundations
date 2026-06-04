---
description: "Read this file when a solution needs organizational data isolation or group-based ownership — business units, owner teams, Entra ID security groups, and the role mappings that wire them together. It fills a gap the Dataverse-skills plugin does not document: the agent drives the plugin's Python SDK (businessunit / team records) plus az ad group for Entra groups. Use it after schema is provisioned (07) and the orgStructure section of the planning payload is populated (00b/00c)."
applyTo: "scripts/**,src/**,solution/**,dataverse/**"
---

# Power Apps Code Apps — Organizational Structure & Security

This file provisions the **business unit / owner team / Entra security group / role-mapping** layer that enforces data isolation and group-based ownership. It runs **after** schema provisioning (`07-dataverse-schema.instructions.md`) and the Collaborator security role exist, and it consumes the `orgStructure` section of `dataverse/planning-payload.json` produced during planning (`00b` → `00c`).

## Why This File Exists — A Plugin Gap

The [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin owns most Dataverse work (`dv-metadata`, `dv-data`, `dv-query`, `dv-solution`, `dv-security`). It does **not** ship documented skills for creating business units, owner teams, or Entra-group-linked teams. So this is one of the few areas where the agent drives the work itself:

- **Business units & teams** → the plugin's bundled Python SDK (`DataverseClient.records.create("businessunit"|"team", {...})`), the same client `dv-connect` configures. No new auth — reuse the plugin's `scripts/auth.py` / active PAC profile.
- **Entra security groups** → `az ad group` (Azure CLI) or Microsoft Graph — Dataverse cannot create these.
- **Wiring** → team↔role association and AAD-group↔team linkage via the SDK.

> The OOB `businessunit`, `team`, and `role` tables are **always** reused — never model org structure or authorization in custom tables. `07a-existing-schema-discovery.instructions.md` enforces this.

## Phase Contract — Provision Structure, Then Wire, Then Assign

`schema provisioned (07)` → **`org structure (this file)`** → `record ownership / assignment`

**Inputs required:**
- A populated `orgStructure` section in `dataverse/planning-payload.json` (businessUnits, teams, securityGroups, roleMappings)
- The Collaborator (or other) security role(s) already created by `07`
- An authenticated PAC profile for the target environment (the plugin / SDK resolves the env from it)

**Mandatory outputs:**
- Business units created (or confirmed existing) per the hierarchy
- Owner teams created and assigned to their business units
- Entra security groups created (or confirmed existing) where membership mirrors Entra
- AAD-group teams linked to their Entra groups; standard teams populated as needed
- Security roles associated to each team per the role mappings

**Stop conditions:**
- If `orgStructure` is empty or declares flat org-wide visibility, **do nothing** — a single root business unit with user-owned records already satisfies that. Do not invent business units or teams.
- If a referenced security role does not yet exist, stop and create it in `07` first.

## When NOT to Build Org Structure

Over-isolation is a common, expensive mistake. Skip this file entirely when:

- The business wants everyone to see all records (flat visibility) and ownership is only for accountability — user-owned records in the default business unit already do this.
- There is a single team/department with no who-sees-what boundary.

Only build business units and owner teams when the planning payload captured a real isolation or group-ownership requirement (see `00b` "Data Isolation & Organizational Boundaries").

## Provisioning Order — The Golden Sequence

1. **Entra security groups first** (if any) — they have no Dataverse dependency and AAD-group teams need the group's object id.
2. **Business units** — parents before children (resolve `parentbusinessunitid`).
3. **Owner teams** — after their business unit exists; AAD teams after their Entra group exists.
4. **Role associations** — after both the team and the role exist.
5. **Membership** — add users to standard teams (or let Entra membership flow into AAD teams automatically).

## Step 1 — Entra Security Groups

Entra (Azure AD) security groups are created **outside** Dataverse. Use the Azure CLI. Capture the returned `id` (object id) — the AAD-group team needs it.

```bash
# Sign in if needed: az login
az ad group create \
  --display-name "Field Operations - West" \
  --mail-nickname "field-ops-west" \
  --security-enabled true \
  --query id -o tsv
```

To reuse an existing group, look it up instead of creating a duplicate:

```bash
az ad group list --display-name "Field Operations - West" --query "[0].id" -o tsv
```

> **Reuse-first applies to Entra too.** If a suitable group already exists (e.g. an HR-managed department group), record its object id in the planning payload rather than creating a parallel group. Surface a pause if a proposed group name resembles an existing one.

Record the object id back into `orgStructure.securityGroups[].entraObjectId` so the team-linking step is re-runnable.

## Step 2 — Business Units

Business units scope row ownership. Create the hierarchy parent-first. Use the plugin's Python SDK (same client `dv-connect` configured):

```python
# Driven via the Dataverse-skills plugin's bundled SDK / scripts/auth.py
from dataverse_client import DataverseClient  # the client dv-connect configures
client = DataverseClient()  # resolves env + auth from the active PAC profile

# Idempotency: check before create
existing = client.records.get(
    "businessunit",
    select=["businessunitid", "name"],
    filter="name eq 'Field Operations'",
)
if not existing:
    bu = client.records.create("businessunit", {
        "name": "Field Operations",
        # child BU: bind to an existing parent
        "parentbusinessunitid@odata.bind": f"/businessunits({parent_bu_id})",
    })
```

Rules:
- **Idempotent**: always `records.get` by `name` before `records.create`.
- **Parent-first**: resolve `parentbusinessunitid` before creating a child. The root business unit already exists — never create a second root.
- **Don't over-create**: one business unit per real who-sees-what boundary, not one per team.

## Step 3 — Owner Teams

Owner teams let a group own records and retain access as membership changes. Two kinds:

**Standard (membership managed in Dataverse):**

```python
team = client.records.create("team", {
    "name": "West Region Approvers",
    "businessunitid@odata.bind": f"/businessunits({bu_id})",
    "teamtype": 0,  # 0 = Owner team
})
```

**AAD-group team (membership mirrors an Entra security group):**

```python
team = client.records.create("team", {
    "name": "Field Operations - West",
    "businessunitid@odata.bind": f"/businessunits({bu_id})",
    "teamtype": 0,
    "azureactivedirectoryobjectid": entra_object_id,  # from Step 1
    "membershiptype": 0,  # 0 = Members and guests
})
```

Rules:
- `teamtype` `0` = **Owner** team (can own records), `1` = Access team. Use Owner teams for ownership scenarios.
- For AAD teams, members are managed in Entra — do **not** also add members manually in Dataverse.
- Each team belongs to exactly one business unit; pick the BU that matches the isolation boundary.

## Step 4 — Associate Security Roles to Teams

A team grants its members a role only after the role is associated. Roles must already exist (created in `07`). Use the N:N `teamroles_association`:

```python
# Look up the role id (role must live in the same business unit as the team,
# or be re-instantiated per BU — Dataverse copies roles into each BU)
role = client.records.get(
    "role",
    select=["roleid", "name"],
    filter=f"name eq 'Project Tracker Collaborator' and _businessunitid_value eq {bu_id}",
)
client.records.associate(
    "team", team_id, "teamroles_association", "role", role[0]["roleid"]
)
```

> **Business-unit-scoped roles:** Dataverse automatically copies each security role into every business unit. When associating a role to a team, use the role instance whose `_businessunitid_value` matches the team's business unit — not the root-BU copy.

For assigning roles to **individual users** (not teams), prefer the plugin's `dv-security` skill:

```bash
pac admin assign-user --user user@contoso.com --role "Project Tracker Collaborator" --environment <url>
```

## Step 5 — Wiring Summary

```
Entra security group ──(azureactivedirectoryobjectid)──► AAD-group Team
                                                              │
Business Unit ◄──(businessunitid)── Owner Team ──(teamroles_association)──► Security Role
                                                              │
                                              record ownership (assign records to the team)
```

- **Group → Team**: membership flows from Entra into the AAD team automatically.
- **Team → Role**: the role's privileges (and their BU depth) determine what team members can see/do.
- **Team → Records**: assign record ownership to the team so the group retains access independent of individuals.

## The `orgStructure` Planning Section

The agent reads this from `dataverse/planning-payload.json` (shape mirrored in `scripts/schema-plan.example.json`):

```jsonc
"orgStructure": {
  "businessUnits": [
    { "name": "Field Operations", "parentName": null },
    { "name": "West Region", "parentName": "Field Operations" }
  ],
  "securityGroups": [
    { "displayName": "Field Operations - West", "mailNickname": "field-ops-west", "entraObjectId": null }
  ],
  "teams": [
    {
      "name": "Field Operations - West",
      "businessUnitName": "West Region",
      "teamType": "Owner",
      "membershipSource": "EntraGroup",
      "securityGroupDisplayName": "Field Operations - West"
    }
  ],
  "roleMappings": [
    { "teamName": "Field Operations - West", "roleName": "Project Tracker Collaborator", "scope": "BusinessUnit" }
  ]
}
```

Field notes:
- `parentName: null` marks a top-level business unit; never create a second **root** — bind children to existing parents.
- `entraObjectId` is `null` until Step 1 fills it (re-runnable contract).
- `membershipSource` is `"EntraGroup"` (AAD team) or `"Manual"` (standard team).
- `scope` documents the intended privilege depth (`User` / `BusinessUnit` / `ParentChild` / `Organization`) — it must match the role's actual privilege depths created in `07`.

## Key Rules

- **Reuse OOB tables only** — `businessunit`, `team`, `role`. Never custom-model org structure or authorization (`07a`).
- **Idempotent everywhere** — `records.get` by name / `az ad group list` before every create; safe to re-run.
- **Don't over-isolate** — build structure only for real, captured isolation requirements. Flat visibility needs nothing here.
- **Entra groups are out of Dataverse** — created via `az ad group` / Graph; record the object id back into the payload.
- **Roles before teams** — the role must exist (`07`) before the `teamroles_association` step.
- **Parents before children** — for both business units and the team↔BU binding.
- **Production assignment** — in production, manage user membership via Entra groups (AAD teams), not ad-hoc scripts.

> For the conceptual background on Dataverse security (why supplementary roles, BU-scoped depth), see `06-security.instructions.md`. For the schema and the Collaborator role this file builds on, see `07-dataverse-schema.instructions.md`. For the planning inputs, see `00b` (isolation questions) and `00c` (org-structure derivation).
