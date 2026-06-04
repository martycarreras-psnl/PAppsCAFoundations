---
paths:
  - "scripts/**"
  - "src/**"
  - "solution/**"
  - "dataverse/**"
---
<!-- Generated from .github/instructions/07b-org-structure-and-security.instructions.md — do not edit directly -->
# Organizational Structure & Security

Provisions the **business unit / owner team / Entra security group / role-mapping** layer for data isolation and group-based ownership. Runs AFTER schema + the Collaborator role (`07-dataverse-schema`) and consumes the `orgStructure` section of `dataverse/planning-payload.json` (derived in `00b`/`00c`).

## Plugin gap — agent drives this
The Dataverse-skills plugin does not document BU/team creation. So:
- **Business units & teams** → the plugin's bundled Python SDK (`DataverseClient.records.create("businessunit"|"team", ...)`), reusing the active PAC profile (no new auth).
- **Entra security groups** → `az ad group` / Graph (Dataverse can't create these).
- Always reuse OOB `businessunit`, `team`, `role` — never custom-model org structure or authorization (`07a`).

## When NOT to build it
Skip entirely for flat, org-wide visibility (everyone sees everything; ownership is just accountability). A single root business unit with user-owned records already satisfies that. Build BUs/teams only for a real, captured isolation or group-ownership requirement.

## Golden sequence
1. **Entra security groups** first (no Dataverse dependency; AAD teams need the object id). `az ad group create --display-name ... --mail-nickname ... --security-enabled true`. Reuse existing groups; record `entraObjectId` back into the payload.
2. **Business units** parent-first (`parentbusinessunitid@odata.bind`). Never create a second root.
3. **Owner teams** (`teamtype: 0`) after their BU. AAD team = set `azureactivedirectoryobjectid` + `membershiptype`; membership flows from Entra (don't add members manually).
4. **Role associations** via N:N `teamroles_association` — use the role instance whose `_businessunitid_value` matches the team's BU (Dataverse copies roles into each BU). Roles must already exist (`07`).
5. **User assignment** via `dv-security`: `pac admin assign-user --user <email> --role "<RoleName>" --environment <url>`.

## Wiring
Entra group → AAD team (membership) → security role (`teamroles_association`) → record ownership (assign records to the team so the group retains access independent of individuals).

## orgStructure payload
`businessUnits[{name,parentName}]`, `securityGroups[{displayName,mailNickname,entraObjectId}]`, `teams[{name,businessUnitName,teamType,membershipSource,securityGroupDisplayName}]`, `roleMappings[{teamName,roleName,scope}]`. `parentName:null` = top-level BU; `entraObjectId:null` until Step 1 fills it; `membershipSource` = `EntraGroup` | `Manual`; `scope` (`User`/`BusinessUnit`/`ParentChild`/`Organization`) must match the role's privilege depths.

## Key rules
- Idempotent everywhere — `records.get` by name / `az ad group list` before every create.
- Don't over-isolate. Roles before teams. Parents before children. Entra groups are out of Dataverse. In production, manage membership via Entra groups (AAD teams), not ad-hoc scripts.
