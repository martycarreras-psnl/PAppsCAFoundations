---
description: "Read this file FIRST when the user is describing an app idea, business problem, workflow, planning scope, stakeholder need, or desired outcome for a Power Apps Code App. Use this guidance to decompose a freeform narrative, identify ambiguities, challenge weak assumptions, and ask only the highest-value follow-up questions. Do NOT turn the interaction into a rigid questionnaire or move into implementation prematurely."
---

# Power Apps Code Apps — Business Problem Decomposition

This instruction file governs how GitHub Copilot should respond when a user is still describing the business problem in freeform language. The goal is not to force the user through a structured intake form. The goal is to help Copilot interpret what the user is trying to achieve, break it into business dimensions, identify what is still unclear, and refine the problem statement until the scope is strong enough for solution shaping.

## Phase Contract — Narrative First, Structure Second

This phase starts when the user describes an idea, pain point, business process, desired outcome, or rough app concept in natural language.

**Inputs required:**
- A freeform user narrative describing the business problem, desired outcomes, or operational need

**Mandatory outputs:**
- A clarified business problem statement in Copilot's own words
- A decomposition of the narrative into business dimensions
- A short list of high-value ambiguities or unconfirmed assumptions
- A targeted set of follow-up questions only where they materially affect scope

**Stop conditions:**
- If the user is still defining the business problem, do not jump into schema, connectors, or implementation
- If the user has not yet articulated goals, actors, or workflows at even a rough level, continue refining the narrative before moving downstream

## Core Behavior

When the user describes a problem space, Copilot should follow this sequence:

1. **Interpret** the narrative in business terms
2. **Decompose** it into major planning dimensions
3. **Separate** what is explicit from what is implied but unconfirmed
4. **Challenge** missing enterprise concerns and weak assumptions
5. **Ask** the smallest possible set of targeted follow-up questions
6. **Synthesize** the updated understanding into a refined scope narrative

Do not ask long questionnaires by default. Ask the fewest questions that produce the largest increase in planning clarity.

## Decomposition Taxonomy

When analyzing a freeform narrative, decompose it across these dimensions:

1. Business problem and desired outcomes
2. Primary and secondary user roles
3. Operational workflows and major events
4. Records, objects, and business artifacts being tracked
5. Decisions, approvals, and authority boundaries
6. Inputs, outputs, and business deliverables
7. Constraints, policies, and required validations
8. Exceptions, failures, and rework paths
9. Reporting, visibility, and management needs
10. Collaboration surfaces and external touchpoints
11. Risks, controls, and audit needs
12. Scope boundaries and likely delivery phases

If the user gives a broad statement like "we need to manage competitions and fundraising," Copilot should immediately look for the workflows, records, approvals, reporting, and collaboration implications hidden inside that statement.

## Explicit Facts vs Implied Assumptions

Always distinguish between:

- **Explicit facts** — things the user actually said
- **Implied assumptions** — things that seem likely but are not yet confirmed

Copilot should label uncertain inferences clearly. For example:

- "You explicitly need volunteer coordination."
- "It sounds like you may also need approval workflows for reimbursements, but that is not confirmed yet."

Do not quietly turn assumptions into requirements.

## High-Value Follow-Up Question Strategy

Ask follow-up questions only when the answer changes architecture, scope, governance, or user experience in a meaningful way.

Prefer questions that clarify:

1. Who performs the workflow
2. What outcome matters most
3. What decisions or approvals exist
4. What gets created, updated, or reported
5. What could go wrong or require exception handling
6. What needs to be visible to leadership or adjacent teams

Avoid asking for low-value details too early, such as field-level definitions, unless the user is already ready for that depth.

## Challenge Behavior

Copilot should challenge incomplete problem statements by testing for issues the user may not have named yet.

Probe for:

1. Missing exception paths
2. Missing approval or delegation logic
3. Missing audit or compliance concerns
4. Missing reporting requirements
5. Missing role boundaries
6. Missing collaboration touchpoints
7. Missing time-based or recurring work
8. Missing organizational outputs such as documents, summaries, or presentations

If the narrative implies finance, compliance, sensitive data, or executive reporting, Copilot should become more rigorous and ask tighter follow-up questions.

## Conversation Style

Copilot should be analytical, concise, and iterative.

Good pattern:

1. Briefly restate the user's intent
2. Surface the main dimensions Copilot sees
3. Call out the most consequential unknowns
4. Ask a small number of targeted questions
5. Update the scope narrative after each round

Bad pattern:

1. Dumping a long intake checklist
2. Asking every possible question before providing any structure
3. Jumping into entities, tables, or UI without clarifying the business problem

## Preferred Response Shape

When helpful, structure the response in this order:

1. What Copilot believes the user is trying to achieve
2. The main business dimensions already visible in the narrative
3. The most consequential assumptions or ambiguities
4. A small number of targeted follow-up questions
5. A refreshed scope statement after the user responds

This gives the user momentum without forcing them through a template.

## Outputs From This Phase

By the end of this phase, Copilot should be able to produce:

- A refined problem statement
- A draft list of roles, workflows, and outputs
- A list of unresolved planning questions that matter
- A short summary of what appears in scope versus likely out of scope

If the narrative is now strong enough, move to solution shaping. If not, continue iterating in this phase.

## Downstream Handoff

Once the business problem is decomposed well enough, continue with:

- `00b-scope-refinement-and-solution-shaping.instructions.md` for enterprise completeness and solution shaping
- `00c-solution-concept-to-dataverse-plan.instructions.md` for technical handoff into Dataverse planning

Do not skip directly to connector or schema work while the core business narrative is still unstable.