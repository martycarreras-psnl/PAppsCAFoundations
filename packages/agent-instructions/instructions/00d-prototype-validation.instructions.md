---
description: "Read this file when a refined scope or draft Dataverse planning payload needs to be validated through a clickable UX prototype before schema provisioning. Use this guidance for mock-data prototyping, swappable data providers, stakeholder review, and turning UX findings into schema-plan refinements."
applyTo: "src/**,scripts/**,dataverse/**"
---

# Power Apps Code Apps — Prototype Validation Before Schema

This instruction file governs the phase between conceptual planning and Dataverse provisioning. Its purpose is to let teams build a believable UX with mock data, validate workflows with stakeholders, and use those findings to refine the final schema plan before tables, relationships, and connectors harden.

## Phase Contract — Prototype First, Then Freeze the Model

This phase starts after the business narrative has been decomposed and refined and after the team has a draft conceptual model or `dataverse/planning-payload.json`.

**Inputs required:**
- A refined scope narrative
- Candidate entities, relationships, and lifecycle concepts
- A draft planning payload or enough structure to create one

**Mandatory outputs:**
- A clickable UX prototype that runs in mock mode
- Domain-level models and provider contracts that are independent of generated connector files
- A structured feedback artifact capturing what the prototype changed in the data model
- An updated planning payload that reflects validated workflow and UX discoveries

**Stop conditions:**
- If the business scope is still unstable, return to `00a`, `00b`, or `00c`
- If the prototype is still exposing major workflow confusion, do not freeze the Dataverse schema yet

## Architectural Rule — Keep UX Logically Disconnected From the Data Source

Prototype UX must not depend directly on `src/generated/**` models or services.

Use this boundary instead:

1. **Domain models** — app-facing record shapes that describe the UX language
2. **Provider / repository contracts** — interfaces the UI and hooks depend on
3. **Mock provider** — returns representative in-memory data for prototype mode
4. **Real provider** — later adapts Dataverse or connector-generated services into the same contract

The generated SDK belongs at the integration edge. It is not the UX contract.

## Required Prototype Workflow

1. Start from the draft planning payload
2. Generate or hand-author domain models and provider contracts
3. Seed mock datasets that exercise realistic happy paths and edge cases
4. Build the UX in `npm run dev:local`
5. Review with stakeholders and capture confusion, missing fields, lifecycle gaps, reporting gaps, and relationship corrections
6. Update the planning payload and prototype feedback artifact
7. Only then finalize the Dataverse schema plan and move into provisioning

## Mock Data Standards

Mock data is not decorative. It should pressure-test the design.

Include records that represent:

1. Normal in-progress work
2. Boundary cases such as empty states, rejected states, overdue states, or missing assignments
3. Role-based visibility differences where relevant
4. Records that imply reporting and dashboard needs
5. Records that challenge naming assumptions in the data model

Prefer shared factories or seed modules that can be reused by both the prototype and tests.

## Provider Switching Guidance

Do not scatter `VITE_USE_MOCK` checks across every component.

Prefer one composition point such as a provider factory or service registry that selects either:

- a mock implementation in prototype mode, or
- a real connector-backed implementation in connected mode.

Hooks should depend on provider contracts, not on the selection logic itself.

## Prototype Feedback Artifact

Persist findings in a repo file such as:

```text
dataverse/prototype-feedback.md
```

Capture:

1. Screens or flows reviewed
2. What users understood immediately
3. What users found confusing or missing
4. Fields that should be added, removed, merged, or renamed
5. Relationship changes implied by the UX
6. Lifecycle or status changes implied by the UX
7. Reporting or summary needs discovered during review
8. Decision: update planning payload now / later / reject change

The prototype is successful only when its findings are translated into planning changes intentionally.

## Promotion Checklist — When to Leave Prototype Mode

Move from prototype mode to schema finalization only when:

1. The primary workflow is understandable without hand-holding
2. Empty, error, and exception states are represented
3. The draft entities still make sense after users see the flows
4. Field names and record boundaries feel natural in the UX
5. Reporting and management visibility needs are no longer surprising
6. The feedback artifact has been reviewed and the planning payload updated

## Downstream Handoff

After prototype validation:

1. Validate the updated planning payload
2. Generate Dataverse execution plans
3. Provision schema
4. Register data sources
5. Implement a real provider that satisfies the same domain contracts as the mock provider

Proceed with:

- `07-dataverse-schema.instructions.md`
- `02-connectors.instructions.md`
- `03-components.instructions.md`

The prototype phase is a recommended checkpoint, not a ceremonial extra step. Its job is to improve the data model before that model becomes expensive to change.