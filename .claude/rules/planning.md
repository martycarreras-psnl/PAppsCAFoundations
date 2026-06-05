<!-- Generated from .github/instructions/00a, 00b, 00c, 00e — do not edit directly -->
# Narrative-First Planning

These rules govern the planning phase before any code or schema exists.

## Grilling Cadence (00e — default for all planning phases)
The interview style from `00e-grill-and-document.instructions.md` applies throughout 00a → 00b → 00c:
1. One **atomic** question at a time; always supply the agent's recommended answer. Never compound — if you'd join clauses with "and", "also", "plus", or a comma, split it and ask the first half only.
2. When the question has multiple plausible answers, present them as a lettered list: `**A)** …`, `**B)** …`, `**C)** …` (one per line), mark your recommendation with `*(recommended)*`, and invite the user to reply with a letter — or multiple like `A, C` if more than one applies.
3. Walk the design tree depth-first — resolve dependencies before moving sideways
4. If a question can be answered by reading code, solution metadata, or Dataverse schema, read instead of asking
5. Challenge against `CONTEXT.md` when the user's terminology conflicts with established glossary entries
6. Sharpen fuzzy language: propose a precise canonical term, update `CONTEXT.md` inline
7. Offer ADRs in `docs/adr/` only when all three hold: hard to reverse + surprising without context + real trade-off

Adapted with thanks from Matt Pocock's "grill-with-docs" skill (https://github.com/mattpocock/skills, MIT © 2026 Matt Pocock). PACAF-specific additions: Dataverse-aware glossary bridge, Code-App ADR trigger list, planning-payload integration.

## CONTEXT.md — Living Glossary
- Lives at repo root. Created lazily on the first sharpened term.
- Pure business glossary — no implementation details, no specs.
- When a term is canonicalized, propose the PACAF bridge: glossary term → Dataverse `DisplayName` in `planning-payload.json` → `DataverseFieldLabel` `fallback` prop.
- Consult `CONTEXT.md` before introducing any new business term. Update inline, not in batches.

## Business Problem Decomposition (00a)
When a user describes an app idea in freeform language:
1. Interpret the narrative in business terms
2. Decompose across 12 dimensions: problem/outcomes, roles, workflows, records, decisions/approvals, inputs/outputs, constraints, exceptions, reporting, collaboration, risks/audit, scope boundaries
3. Separate explicit facts from implied assumptions
4. Use the grilling cadence above — do NOT batch questions or dump a questionnaire

## Scope Refinement (00b)
When the business problem is partially understood:
1. Challenge for missing exception paths, approval logic, audit/compliance, reporting, role boundaries, collaboration, time-based work, organizational outputs
2. Explore Teams/M365 touchpoints, Power Automate flows, Microsoft Copilot Studio agent placement
3. Before handing off to 00c, check whether any locked decisions meet the ADR threshold
4. Do NOT move to technical implementation until the solution boundary is stable

## Solution Concept → Dataverse Plan (00c)
When scope is stable:
1. Derive candidate entities, relationships, ownership patterns, lifecycle states
2. Every entity/column in `planning-payload.json` must trace back to a `CONTEXT.md` term — sharpen first if missing
3. Map to Dataverse planning inputs (tables, columns, option sets, relationships)
4. Before handing off to prototype/schema, prompt: "Any decisions a future developer would find surprising? Record as ADRs."
5. Hand off into the planning artifact workflow (`dataverse/planning-payload.json`)

Full details: `.github/instructions/00a-business-problem-decomposition.instructions.md`, `00b-scope-refinement-and-solution-shaping.instructions.md`, `00c-solution-concept-to-dataverse-plan.instructions.md`, `00e-grill-and-document.instructions.md`
