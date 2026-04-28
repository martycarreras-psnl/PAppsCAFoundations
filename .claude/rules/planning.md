<!-- Generated from .github/instructions/00a, 00b, 00c — do not edit directly -->
# Narrative-First Planning

These rules govern the planning phase before any code or schema exists.

## Business Problem Decomposition (00a)
When a user describes an app idea in freeform language:
1. Interpret the narrative in business terms
2. Decompose across 12 dimensions: problem/outcomes, roles, workflows, records, decisions/approvals, inputs/outputs, constraints, exceptions, reporting, collaboration, risks/audit, scope boundaries
3. Separate explicit facts from implied assumptions
4. Ask the fewest follow-up questions that produce the largest planning clarity increase
5. Do NOT dump a questionnaire or jump to schema/connectors

## Scope Refinement (00b)
When the business problem is partially understood:
1. Challenge for missing exception paths, approval logic, audit/compliance, reporting, role boundaries, collaboration, time-based work, organizational outputs
2. Explore Teams/M365 touchpoints, Power Automate flows, Microsoft Copilot Studio agent placement
3. Do NOT move to technical implementation until the solution boundary is stable

## Solution Concept → Dataverse Plan (00c)
When scope is stable:
1. Derive candidate entities, relationships, ownership patterns, lifecycle states
2. Map to Dataverse planning inputs (tables, columns, option sets, relationships)
3. Hand off into the planning artifact workflow (`dataverse/planning-payload.json`)

Full details: `.github/instructions/00a-business-problem-decomposition.instructions.md`, `00b-scope-refinement-and-solution-shaping.instructions.md`, `00c-solution-concept-to-dataverse-plan.instructions.md`
