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

Use:

1. `00d-prototype-validation.instructions.md` to build a clickable prototype against domain contracts and mock providers
2. `scripts/seed-prototype-assets.mjs` to seed prototype-facing assets from `dataverse/planning-payload.json` when helpful
3. `dataverse/prototype-feedback.md` to capture what the prototype changes in the eventual data model

After the prototype findings have been folded back into the planning payload, hand off into the Dataverse planning artifact workflow.

Use:

1. `scripts/schema-plan.example.json` as the starter artifact shape
2. `node scripts/validate-schema-plan.mjs dataverse/planning-payload.json` to validate the plan
3. `node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json` to generate normalized execution plans
4. `node scripts/register-dataverse-data-sources.mjs dataverse/register-datasources.plan.json` only after the schema is provisioned and ready for connector registration

For provisioning rules, naming rules, option set rules, and execution order, continue with `07-dataverse-schema.instructions.md`.

## Preferred Handoff Shape

When presenting the technical handoff, organize the result around:

1. Candidate entities
2. Candidate relationships
3. Candidate ownership patterns
4. Candidate lifecycle or choice domains
5. Approval and automation boundaries
6. Reporting and control implications
7. Readiness to populate `dataverse/planning-payload.json`

This keeps the handoff conceptual and planning-oriented instead of prematurely turning it into implementation work.

## Boundary Rule

This file is the bridge from business planning to technical planning.

It is not the place to:

1. Implement connectors
2. Write UI components
3. Provision schema directly
4. Decide final code structure

Its job is to make the technical handoff disciplined, not to skip it.