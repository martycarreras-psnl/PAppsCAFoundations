# Prototype-First Golden Path

This is the recommended end-to-end workflow for non-trivial Power Apps Code Apps projects that want the UX to influence the final Dataverse model before schema hardens.

## Goal

Move through planning, prototype validation, and schema work in a deliberate order:

1. Refine the business problem
2. Draft the conceptual model
3. Prototype the UX with mock providers
4. Capture what the prototype changes in the data model
5. Finalize the planning payload
6. Provision Dataverse schema
7. Bind real providers and connectors

## Phase Sequence

### 1. Decompose and refine the business problem

Use:

- `.github/instructions/00a-business-problem-decomposition.instructions.md`
- `.github/instructions/00b-scope-refinement-and-solution-shaping.instructions.md`
- `.github/instructions/00c-solution-concept-to-dataverse-plan.instructions.md`

Outputs:

- Refined business scope
- Candidate entities and relationships
- Draft lifecycle states and ownership patterns

### 2. Create or refine the planning payload

Start from:

```bash
cp scripts/schema-plan.example.json dataverse/planning-payload.json
```

Populate the payload with the current best conceptual model.

At this point, the model is still provisional.

### 3. Seed prototype assets from the planning payload

Run:

```bash
pacaf-seed dataverse/planning-payload.json
```

This generates:

- `src/types/domain-models.ts`
- `src/services/data-contracts.ts`
- `src/services/mock-data-provider.ts`
- `src/services/real-data-provider.ts`
- `src/services/providerFactory.ts`
- `src/hooks/usePrototypeData.ts`
- `src/mockData/*.ts`
- `src/prototypeManifest.ts`
- `dataverse/prototype-feedback.md`

### 4. Build the UX in prototype mode

Run:

```bash
npm run dev:local
```

Rules:

1. Components and hooks depend on domain contracts, not `src/generated/**`
2. Mock providers satisfy the same contracts that real providers will later satisfy
3. Do not add connectors yet unless the planning payload is already stable

### 5. Review the prototype and capture findings

Use:

- `dataverse/prototype-feedback.md`

Capture:

1. Missing fields
2. Confusing statuses or lifecycle transitions
3. Relationship changes implied by the UX
4. Reporting needs discovered during review
5. Terminology changes the UI made obvious

### 6. Feed prototype findings back into the planning payload

Update:

- `dataverse/planning-payload.json`

Then rerun:

```bash
npm run prototype:seed
```

Repeat steps 4 to 6 until the workflow and data model feel stable.

### 7. Provision the Dataverse schema

With the planning payload stable, drive the [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin to provision the schema. Discover existing tables first (`07a`), then create the tables, columns, relationships, and option sets with the `dv-metadata` skill.

If the planning payload's `orgStructure` section defines data-isolation boundaries (business units, owner teams, Entra security groups, role mappings), provision them next with `07b-org-structure-and-security.instructions.md`. Skip this when the app uses flat, org-wide visibility — do not invent business units or teams.

### 8. Register the tables as Code App data sources

After schema provisioning is complete, register each table with the Code App via the add-dataverse skill, which drives:

```bash
pac code add-data-source -a dataverse -t <logical_table_name>
```

This is the point where `src/generated/**` becomes available.

### 9. Implement the real provider adapters

Update:

- `src/services/real-data-provider.ts`

Replace the generated TODO stubs with adapters that map connector or Dataverse-generated service responses into the domain contracts already used by the UI.

The intended result is that most components and hooks do not need to be rewritten.

## Promotion Checklist

Move from prototype mode to schema work only when:

1. The primary workflow feels natural
2. Empty, error, and exception states are visible
3. The UX no longer keeps forcing schema changes every review cycle
4. `dataverse/prototype-feedback.md` has been reviewed and folded into the planning payload

## Verification Commands

Prototype asset generation test:

```bash
node --test scripts/tests/seed-prototype-assets.test.mjs
```

Schema discovery (Dataverse-skills plugin):

```text
list_tables          # confirm the environment is reachable and inspect existing tables
```

## Anti-Patterns

Avoid these:

1. Building the UI directly on generated Dataverse types before the model is stable
2. Treating mock mode as a purely visual demo with unrealistic data
3. Adding connectors early just because the wizard offers the step
4. Skipping the feedback artifact and relying on memory to update the planning payload

The value of this flow is not mock data by itself. The value is forcing the data model to earn its permanence through UX validation first.