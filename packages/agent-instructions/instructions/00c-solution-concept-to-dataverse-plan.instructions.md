---
description: "Read this file when a business narrative has already been decomposed and refined and now needs to be translated into a conceptual solution model and Dataverse planning inputs. Use this guidance to move from refined scope into candidate entities, relationships, ownership patterns, lifecycle states, automation boundaries, and handoff into the Dataverse planning artifact workflow."
applyTo: "scripts/**,solution/**"
---

# Power Apps Code Apps — Solution Concept to Dataverse Plan

This instruction file governs the transition from refined business scope into technical planning readiness. It does not replace the Dataverse schema execution guidance. It prepares the conceptual model and handoff inputs that feed that execution guidance.

## Phase Contract — Convert Refined Scope into Modeling Inputs

This phase starts after the business narrative has been decomposed and refined enough that the solution boundary is stable.

**Inputs required:**
- A refined business scope narrative
- Identified workflows, exceptions, approvals, and outputs
- Initial understanding of collaboration, reporting, and governance needs

**Mandatory outputs:**
- A conceptual entity and relationship inventory
- Candidate ownership and access patterns
- Candidate lifecycle and choice domains
- Candidate automation and approval boundaries
- A handoff path into prototype validation and then the Dataverse planning artifact workflow

**Stop conditions:**
- If the workflow model is still unstable, stop and continue solution shaping first
- If major reporting, governance, or authority concerns are still unresolved, stop before freezing conceptual entities

## Interview Cadence & Glossary Traceability

Use the grilling cadence from `00e-grill-and-document.instructions.md` throughout this phase. Continue updating `CONTEXT.md` inline as terms are resolved.

**Traceability rule:** Every entity, relationship, and lifecycle state proposed for `dataverse/planning-payload.json` must trace back to a term in `CONTEXT.md`. If no term exists for a proposed entity or column, sharpen it in `CONTEXT.md` first — then add it to the planning payload. The `DisplayName` in the payload should match the canonical glossary term.

## Conversion Goals

Copilot should translate the refined narrative into the kinds of planning inputs needed for durable Dataverse design.

That means identifying:

1. Core entities the solution appears to track
2. Relationships between those entities
3. Ownership implications for those records
4. Lifecycle states and controlled vocabularies
5. Approval and workflow state boundaries
6. Reporting aggregates and management views
7. Audit and control implications for the model

Do not jump straight to exact schema details if the conceptual model is still uncertain.

## Conceptual Entity Identification

When deriving entities from the narrative, Copilot should separate:

1. **Core business records** — primary things the business manages
2. **Junction / association records** — records that represent participation, assignment, membership, or involvement
3. **Workflow records** — records that represent requests, submissions, approvals, or escalations
4. **Financial or audit records** — records that require stronger controls or history
5. **Output-oriented records** — records that support reports, documents, summaries, or presentations

If the same concept is doing too many jobs, Copilot should challenge whether it needs to be separated into multiple conceptual entities.

## Relationship Modeling Guidance

Copilot should identify likely:

1. One-to-many relationships
2. Many-to-many relationships and whether they imply a real junction entity
3. Parent-child hierarchies
4. Cross-functional or cross-team relationships
5. Approval or review relationships between people and records

Do not flatten relationships prematurely just to simplify the first draft.

## Ownership & Access Patterns

Before creating schema concepts, Copilot should reason about who owns or governs each type of record.

Explore whether records are likely:

1. User-owned
2. Team-owned
3. Organization-owned

Ask what each choice implies for:

1. Visibility
2. Collaboration
3. Approval routing
4. Reporting
5. Administrative control

If the user has not thought about access boundaries, surface that gap before modeling too deeply.

## Organizational Structure & Security Model

The data-isolation answers gathered in `00b` ("Data Isolation & Organizational Boundaries") must now be turned into a concrete **business unit / owner team / security group** model. This is the input to `07b-org-structure-and-security.instructions.md`, which provisions these constructs (a gap the Dataverse-skills plugin does not document, so the agent drives the plugin's Python SDK + `az ad group` directly).

Derive, and record into the `orgStructure` section of `dataverse/planning-payload.json`:

1. **Business units** — one per who-sees-what boundary (region, department, division). If the business wants flat org-wide visibility, model a single root business unit and say so explicitly. Capture parent/child hierarchy where it exists.
2. **Owner teams** — where a group (not an individual) should own records or retain access as membership changes. Note which business unit each team belongs to and whether it is a standard team or an Entra-group-linked (AAD) team.
3. **Security groups (Entra ID)** — where team membership should mirror an existing or new Entra security group. Capture the intended display name and whether it already exists.
4. **Role mappings** — which security role each team/group receives, and the scope (User / Business Unit / Parent-Child / Organization) each role grants.

Reuse-first still applies: the OOB `businessunit`, `team`, and `role` tables are always used — never model authorization or org structure in custom tables (`07a` enforces this). If the business genuinely needs no isolation, record that decision so `07b` does not invent unnecessary business units or teams.

## Lifecycle & Choice Domains

Copilot should identify where the business process implies controlled states or status transitions.

Look for:

1. Submission states
2. Approval states
3. Operational states
4. Completion or archival states
5. Exception or hold states

These often become option sets or other controlled lifecycle constructs later, so they should be called out during conceptual planning.

## Automation & Approval Boundaries

Copilot should identify which parts of the conceptual model are tied to:

1. Human decisions
2. Approval checkpoints
3. Background automation
4. Notifications
5. Agent-assisted or agent-initiated behavior

If a conceptual entity exists mainly to support workflow orchestration, say so clearly.

## Reporting & Control Implications

Conceptual planning should also identify:

1. Where rollups or aggregates are likely needed
2. Where history or audit detail must be retained
3. Where financial or compliance reporting will shape the model
4. Where summary outputs may require additional supporting records or automation

Do not assume reporting can always be layered on later without model impact.

## Handoff Into Dataverse Planning

Once the conceptual model is strong enough, validate it through a mock-backed UX prototype before freezing the schema plan.

**ADR checkpoint:** Before handing off to prototype validation or schema provisioning, explicitly prompt the user: *"Before we hand off to schema provisioning — are there any decisions we locked during this session that a future developer would find surprising? If so, let's record them as ADRs."* Check the PACAF-specific qualifying decision list in `00e-grill-and-document.instructions.md` against what was resolved in this phase.

Use:

1. `00d-prototype-validation.instructions.md` to build a clickable prototype against domain contracts and mock providers
2. `scripts/seed-prototype-assets.mjs` to seed prototype-facing assets from `dataverse/planning-payload.json` when helpful
3. `dataverse/prototype-feedback.md` to capture what the prototype changes in the eventual data model

After the prototype findings have been folded back into the planning payload, hand off into the Dataverse planning artifact workflow.

Use:

1. `scripts/schema-plan.example.json` as the starter artifact shape
2. **Existing-schema discovery & OOB-first decision** — run `07a-existing-schema-discovery.instructions.md` against the planning payload **before** provisioning anything. For every candidate entity and column, the agent must check whether an OOB Dataverse asset already covers it (e.g. `systemuser`, `contact`, `account`, `team`, `statuscode`) and raise a Pause Moment for any duplication risk. Reused / augmented / custom decisions are recorded back into the planning payload.
3. **Provision schema** — Drive the [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin's `dv-metadata` skill to provision tables, columns, relationships, and option sets directly from the planning payload. The plugin handles idempotency, metadata propagation delays, and error recovery. If the plugin is not installed, use the Web API patterns in `07-dataverse-schema.instructions.md`.
4. **Register data sources** — after schema is provisioned and published, register each table with `pac code add-data-source -a dataverse -t <table>` (driven by the add-dataverse skill). This generates the TypeScript service layer in `src/generated/`.
5. **Provision organizational structure & security** — if the `orgStructure` section of the planning payload defines business units, owner teams, Entra security groups, or role mappings, drive `07b-org-structure-and-security.instructions.md` to create them (plugin Python SDK for `businessunit` / `team` records + `az ad group` for Entra groups). Do this before assigning record ownership that depends on those teams.

The planning payload remains the re-runnable source of truth — there is no separate `pacaf-validate` / `pacaf-generate` / `pacaf-register` step. The agent reads the plan and drives the plugin + PAC CLI; the reserved-name and OOB-first guards in `07a` are enforced by agent reasoning.

For provisioning rules, naming rules, option set rules, and execution order, continue with `07a-existing-schema-discovery.instructions.md` and then `07-dataverse-schema.instructions.md`.

## Preferred Handoff Shape

When presenting the technical handoff, organize the result around:

1. Candidate entities
2. Candidate relationships
3. Candidate ownership patterns
4. Candidate organizational structure & security model (business units, owner teams, Entra security groups, role mappings)
5. Candidate lifecycle or choice domains
6. Approval and automation boundaries
7. Reporting and control implications
8. Readiness to populate `dataverse/planning-payload.json`

This keeps the handoff conceptual and planning-oriented instead of prematurely turning it into implementation work.

## Boundary Rule

This file is the bridge from business planning to technical planning.

It is not the place to:

1. Implement connectors
2. Write UI components
3. Provision schema directly
4. Decide final code structure

Its job is to make the technical handoff disciplined, not to skip it.