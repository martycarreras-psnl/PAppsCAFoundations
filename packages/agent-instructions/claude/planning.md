<!-- Generated from .github/instructions/00a-business-problem-decomposition.instructions.md — do not edit directly -->
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
5. **Grill** — ask follow-up questions using the cadence defined in `00e-grill-and-document.instructions.md`: one question at a time, with the agent's recommended answer, walking dependencies depth-first
6. **Synthesize** the updated understanding into a refined scope narrative

Do not batch multiple questions into a single response. Do not ask long questionnaires. See `00e-grill-and-document.instructions.md` for the full interview protocol.

**Glossary rule:** Before introducing a new business term, consult `CONTEXT.md` at the repo root (if it exists). If the term sharpens or conflicts with an existing entry, update `CONTEXT.md` inline. If `CONTEXT.md` does not exist yet and the first term is being resolved, create it. See `00e-grill-and-document.instructions.md` for the glossary format and the PACAF bridge (glossary term → Dataverse `DisplayName` → `DataverseFieldLabel` fallback).

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

1. Dumping a long intake checklist or batching multiple questions in one turn
2. Asking every possible question before providing any structure
3. Jumping into entities, tables, or UI without clarifying the business problem
4. Introducing a new business term without checking `CONTEXT.md` first

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
- `00e-grill-and-document.instructions.md` applies throughout — it governs the interview cadence, `CONTEXT.md` glossary maintenance, and ADR creation for all planning phases

Do not skip directly to connector or schema work while the core business narrative is still unstable.

---

<!-- Generated from .github/instructions/00b-scope-refinement-and-solution-shaping.instructions.md — do not edit directly -->
# Power Apps Code Apps — Scope Refinement & Solution Shaping

This instruction file governs how GitHub Copilot should deepen a partially understood business narrative into a complete planning scope. The objective is to make the solution boundary explicit enough that downstream technical planning can proceed with confidence.

## Phase Contract — Refine Until the Solution Boundary Is Real

This phase starts after the business problem has been restated and decomposed, but before conceptual data modeling or schema planning begins.

**Inputs required:**
- A clarified business problem statement
- Initial understanding of actors, workflows, and outcomes

**Mandatory outputs:**
- A refined solution narrative with enterprise-relevant dimensions surfaced
- A clear list of major workflows and exception paths
- A view of approvals, automation opportunities, and collaboration surfaces
- A list of governance, reporting, and control considerations

**Stop conditions:**
- If the scope still has major ambiguity around core workflows or outcomes, keep refining before moving on
- If critical enterprise concerns are still unknown, do not move into technical modeling yet

## Interview Cadence

Use the grilling cadence from `00e-grill-and-document.instructions.md` throughout this phase: one question at a time, with the agent's recommended answer, walking dependencies depth-first. Do not batch questions. If a question can be answered by reading the codebase or existing solution metadata, read instead of ask.

**Glossary rule:** Before introducing a new business term, consult `CONTEXT.md` at the repo root (if it exists). When a term is resolved or sharpened during refinement, update `CONTEXT.md` inline — do not wait until the session ends. See `00e-grill-and-document.instructions.md` for the glossary format and PACAF bridge.

## Refinement Domains

Copilot should expand the user's narrative across these domains, in whatever order best fits the conversation:

1. Primary workflows and subflows
2. Exception paths, failures, and recovery paths
3. Business validations and policy rules
4. Lifecycle stages, statuses, and transitions
5. Approvals, delegations, and escalations
6. Human tasks versus automated tasks
7. Reporting, dashboards, exports, and management visibility
8. Security boundaries, ownership expectations, and role separation
9. Collaboration surfaces such as Teams, Outlook, meetings, or shared files
10. Documents and Office outputs including Word, Excel, PowerPoint, PDF, and email artifacts
11. Governance, auditability, retention, and finance-sensitive controls
12. Phased delivery boundaries such as MVP versus later phases

Copilot does not need to force this into a fixed sequence. It should choose the next refinement area based on what is most consequential or currently missing.

## Enterprise Completeness Checks

When the user has described a workflow, Copilot should test it for completeness.

Ask or probe for:

1. What starts the process
2. What finishes the process
3. What can block the process
4. What happens when someone rejects, cancels, or corrects a step
5. What requires approval
6. What must be escalated or delegated
7. What must be visible to leaders or adjacent teams
8. What must be retained as a business record
9. What needs to happen on a schedule or recurrence
10. What happens when volume grows or multiple teams are involved

Copilot should challenge designs that only describe the happy path.

## Automation Placement Guidance

Copilot should help determine where a behavior belongs:

### App UX
Use when the work is interactive, user-driven, immediate, and best handled in context.

### Dataverse Model / Rule Layer
Use when the behavior is a structural business rule, ownership rule, lifecycle rule, or data integrity concern.

### Power Automate
Use when the behavior is event-driven, scheduled, approval-based, notification-based, or integration-oriented.

### Teams Interaction Patterns
Use when users collaborate or take lightweight actions inside Teams rather than navigating into the app.

### Copilot Studio
Use when the interaction benefits from conversational guidance, summarization, interpretation, orchestration, or assisted decision-making.

### Microsoft 365 Copilot Surfaces
Use when the work naturally occurs in Teams, Outlook, meetings, or Office content creation rather than inside the app itself.

Copilot should not assume AI or automation is always the right answer. It should prefer simpler deterministic patterns when the problem is fundamentally transactional and well-defined.

## Copilot Placement Guidance

Copilot should distinguish between:

1. **Autonomous agent behavior** — suitable only when the action scope, risk, and controls are clear enough
2. **Assistive in-app behavior** — suitable when the user remains the decision-maker and needs analysis, drafting, or summarization
3. **M365 Copilot / Teams-centric access** — suitable when the user's natural workspace is outside the app
4. **No AI required** — suitable when the workflow is better served by structured UI and deterministic automation

When considering agent usage, Copilot should explore:

1. What decisions are being delegated
2. What business risk exists if the agent is wrong
3. Whether a human approval checkpoint is required
4. Whether the user expects conversational access or structured task completion

## Teams & Microsoft 365 Exploration

Copilot should test whether the workflow depends on collaboration surfaces outside the app.

Explore whether:

1. Teams channels or chats should receive notifications
2. Users should approve or review actions from Teams
3. Meetings or collaborative reviews are part of the process
4. Outlook or email remains a first-class business touchpoint
5. Shared documents are part of the workflow rather than just outputs
6. The app should create, update, or summarize Office artifacts such as Word, Excel, or PowerPoint files

Copilot should distinguish between:

- Teams as a notification surface
- Teams as an action surface
- Teams as the primary work surface

These lead to different architectural implications.

## Reporting & Management Visibility

Copilot should surface questions around:

1. Operational dashboards
2. Executive or management summaries
3. Drill-down detail versus summary rollups
4. Scheduled reporting versus ad hoc reporting
5. Export requirements
6. Finance or compliance reporting

If the business outcome includes visibility, accountability, or performance management, reporting is not optional and must be treated as part of scope, not a later enhancement by default.

## Governance & Control Sensitivity

Copilot should become more rigorous when the solution touches:

1. Money or reimbursements
2. Sensitive personal data
3. Regulated or auditable decisions
4. Delegated authority
5. Approval chains
6. Executive-facing reports or records

In these cases, probe for:

1. Audit trail expectations
2. Retention expectations
3. Reversal and correction paths
4. Separation of duties
5. Escalation and exception review

## Data Isolation & Organizational Boundaries

Many enterprise solutions need records to be partitioned so that one part of the organization cannot see another part's data, or so that ownership and approval routing follow the org chart. This shapes the Dataverse **business unit / owner team / security group** model later (`07b-org-structure-and-security.instructions.md`), so surface it during shaping — not after the schema is frozen.

Probe for:

1. **Who-sees-what boundaries** — Should a region, department, branch, franchise, or client only see its own records? Or is all data visible org-wide?
2. **Ownership scoping** — Are records owned by an individual, or by a group/department that should retain access as people come and go?
3. **Approval routing along the org chart** — Do approvals escalate to a manager, a department lead, or a cross-functional review team?
4. **External/partner isolation** — Will vendors, partners, or customers ever access the app, and must their data be walled off from internal data and from each other?
5. **Membership source of truth** — Should access groups mirror an existing Entra ID (Azure AD) security group, an HR department list, or be managed manually inside Dataverse?

Reason out loud about what each answer implies:

- A who-sees-what boundary usually implies **business units** (org-scoped row ownership).
- A "the group keeps access, not the person" requirement usually implies **owner teams**.
- "Mirror our existing security group" usually implies an **Entra security group → Dataverse team** linkage (AAD-group team).
- "Everyone sees everything, ownership is just for accountability" usually implies a **single business unit with user-owned records** — do not over-engineer isolation that the business does not need.

If the user has not considered isolation at all, raise it as a gap before conceptual modeling. If they explicitly want flat, org-wide visibility, record that decision so `07b` does not invent unnecessary business units or teams.

## Preferred Response Shape

When helpful, structure the response in this order:

1. Current understanding of the solution scope
2. Areas that are now clear enough to treat as likely scope
3. Enterprise dimensions that still need refinement
4. A focused set of follow-up questions or challenge points
5. A revised scope summary after each refinement round

This phase should feel like progressive elaboration, not like a requirements spreadsheet pasted into chat. Follow the one-question-at-a-time cadence from `00e-grill-and-document.instructions.md` — do not batch follow-up questions.

## Outputs From This Phase

By the end of this phase, Copilot should be able to produce:

- A refined solution scope narrative
- A workflow and exception-path summary
- A list of business rules and approval points
- A preliminary automation-placement view
- A preliminary Teams / Office / Copilot suitability view
- A summary of reporting, governance, and control concerns
- A preliminary data-isolation / organizational-boundary view (who-sees-what, ownership scoping, Entra-group linkage)

Once those are strong enough, proceed to conceptual modeling and Dataverse planning.

## Downstream Handoff

Continue with `00c-solution-concept-to-dataverse-plan.instructions.md`.

`00e-grill-and-document.instructions.md` applies throughout — it governs the interview cadence, `CONTEXT.md` glossary maintenance, and ADR creation for all planning phases. Before handing off to 00c, check whether any decisions locked during this phase meet the ADR threshold (hard to reverse + surprising without context + real trade-off). If so, offer to record them now.

Do not move directly to connector registration or schema provisioning until the refined scope is stable enough to drive durable modeling decisions.

---

<!-- Generated from .github/instructions/00c-solution-concept-to-dataverse-plan.instructions.md — do not edit directly -->
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
4. **Register data sources** — after schema is provisioned and published, register each table with `pacaf-pa app add data-source --connector dataverse --table <table>` (driven by the add-dataverse skill, using the pinned local CLI). This generates the TypeScript service layer in `src/generated/`.
5. **Provision organizational structure & security** — if the `orgStructure` section of the planning payload defines business units, owner teams, Entra security groups, or role mappings, drive `07b-org-structure-and-security.instructions.md` to create them (plugin Python SDK for `businessunit` / `team` records + `az ad group` for Entra groups). Do this before assigning record ownership that depends on those teams.

The planning payload remains the re-runnable source of truth — there is no separate `pacaf-validate` / `pacaf-generate` / `pacaf-register` step. The agent drives Dataverse-skills for provisioning and the local Power Apps CLI for Code App bindings; PAC remains for ALM/admin. The reserved-name and OOB-first guards in `07a` are enforced by agent reasoning.

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

---

<!-- Generated from .github/instructions/00e-grill-and-document.instructions.md — do not edit directly -->
<!--
  Attribution
  ───────────
  The interview cadence, CONTEXT.md glossary pattern, and ADR gating criteria
  in this file are adapted with thanks from Matt Pocock's "grill-with-docs"
  skill — https://github.com/mattpocock/skills — MIT License, © 2026 Matt Pocock.

  PACAF-specific additions: Dataverse-aware glossary bridge, Code-App ADR
  trigger list, integration with dataverse/planning-payload.json and
  DataverseFieldLabel, single-context default.
-->

# Power Apps Code Apps — Grill & Document

This instruction file governs how a coding agent should stress-test a planning draft, sharpen business language into a living glossary, and record hard-to-reverse decisions as lightweight ADRs — all during the planning phase, before any code or schema is committed.

It is the **default interview style** for the entire 00a → 00b → 00c planning flow. When any of those phases calls for follow-up questions or challenge behavior, the agent should use the cadence described here.

## Phase Contract — Challenge Until Shared Understanding

This phase may be entered at any point during 00a, 00b, or 00c when ambiguity remains or a decision is about to be locked.

**Inputs required:**
- A planning draft, scope narrative, or conceptual model produced by 00a / 00b / 00c
- (Optional) An existing `CONTEXT.md` at the repo root
- (Optional) Existing ADRs in `docs/adr/`

**Mandatory outputs:**
- Sharpened terminology captured in `CONTEXT.md` (created lazily on the first resolved term)
- ADRs for any decisions that meet the three-part qualifying test (created lazily in `docs/adr/`)
- An updated planning narrative with resolved ambiguities

**Stop conditions:**
- Every branch of the design tree has been walked and either resolved or explicitly deferred
- The user confirms shared understanding of the remaining scope

---

## Grilling Cadence

**Interview the user one question at a time.** For each question, provide the agent's recommended answer. Walk down each branch of the design tree, resolving dependencies between decisions one by one. Wait for feedback on each question before continuing.

Rules:

1. **One atomic question per turn.** Do not batch multiple questions into a single response. A compound question like *"What's your primary user role, and how do they sign in?"* is two questions — split it and ask the first one only. If you catch yourself joining clauses with "and", "also", "plus", or a comma, stop and re-ask the first half alone.
2. **Always supply a recommended answer.** The user can accept, reject, or refine it. This is faster than open-ended prompts and exposes the agent's assumptions for challenge.
3. **Present options as a lettered list — every time.** Whenever the question has more than one plausible answer, lay the choices out as `**A)** …`, `**B)** …`, `**C)** …`, etc., one per line. Mark your recommendation with `*(recommended)*` after the option text. End the question by inviting the user to reply with just a letter — and tell them they can pick more than one (e.g. *"reply with a letter, or several like `A, C` if more than one applies"*) so a multi-select answer is always a legitimate response. Never bury the options inline in the question text or list them as parenthetical hints. If the answer is genuinely open-ended (e.g. "what's the project's name?"), say so and skip the list.

   Example shape:

   > **Where should approval routing live?**
   >
   > **A)** A Power Automate cloud flow triggered on record create *(recommended — easiest to evolve, surfaces in Approvals app)*
   > **B)** A Custom API in Dataverse
   > **C)** Inline in the Code App's submit handler
   >
   > Reply with a letter, or several like `A, C` if more than one applies.
4. **Walk depth-first.** When a question reveals a dependency, resolve the dependency before moving sideways to the next topic.
5. **Read instead of ask.** If a question can be answered by exploring the codebase, reading the existing solution metadata, querying Dataverse schema, or consulting `CONTEXT.md`, do that instead of asking the user. Surface what you found and ask only if it is ambiguous.
6. **Challenge against the glossary.** When the user uses a term that conflicts with an existing entry in `CONTEXT.md`, call it out immediately: *"Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"*
7. **Sharpen fuzzy language.** When the user uses a vague or overloaded term, propose a precise canonical term: *"You're saying 'account' — do you mean the Customer or the User? Those are different things in this context."*
8. **Discuss concrete scenarios.** When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.
9. **Cross-reference with code.** When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: *"Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"*

---

## CONTEXT.md — Living Glossary

`CONTEXT.md` lives at the **repo root**. It is a pure business glossary — no implementation details, no specs, no scratch notes. Create it lazily when the first business term is sharpened during a planning session.

### Format

```markdown
# {Project Name}

{One or two sentences describing what this project is and why it exists.}

## Language

**Order**:
A request from a customer to purchase one or more products.
_Avoid_: Purchase, transaction

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

### Rules

1. **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as `_Avoid_:` aliases.
2. **Flag conflicts explicitly.** If a term is used ambiguously during the grilling session, call it out and resolve it before updating the glossary.
3. **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
4. **Show relationships.** Use bold term names and express cardinality where obvious.
5. **Only include terms specific to this project's context.** General programming concepts and general Power Platform terminology (which already live in `docs/glossary.md`) do not belong in `CONTEXT.md`. Before adding a term, ask: is this a concept unique to this project's business domain? Only the former belongs.
6. **Group terms under subheadings** when natural clusters emerge. A flat list is fine for a small project.
7. **Update inline, not in batches.** When a term is resolved during the grilling session, update `CONTEXT.md` right then. Do not wait until the session ends.
8. **Do not introduce `CONTEXT-MAP.md`.** PACAF defaults to a single context. One `CONTEXT.md` at the repo root is sufficient for Code App projects.

### PACAF Bridge — Glossary → Dataverse → UI Labels

When a canonical term is sharpened in `CONTEXT.md`, propose mapping it through the full stack:

1. **`CONTEXT.md` term** → the agreed business name (e.g. **Competition**)
2. **`dataverse/planning-payload.json` `DisplayName`** → the same term becomes the Dataverse table or column display name
3. **`DataverseFieldLabel` `fallback` prop** → the same term becomes the UI label fallback for the form-field metadata pattern

One sharpened term, three downstream payoffs. The agent should propose this mapping when updating the glossary and note it in the planning narrative.

---

## docs/adr/ — Architecture Decision Records

ADRs live in `docs/adr/` with sequential numbering: `0001-slug.md`, `0002-slug.md`, etc. Create the directory lazily — only when the first qualifying ADR is needed.

### When to offer an ADR

Only offer to create an ADR when **all three** of these are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the project and wonder *"why on earth did they do it this way?"*
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Easy-to-reverse decisions do not need recording. Unsurprising decisions do not need explaining. Decisions with no real alternative are not trade-offs.

### PACAF-specific qualifying decisions

The following Code App decisions commonly meet all three criteria. When they come up during grilling, explicitly check whether an ADR is warranted:

- **Publisher prefix choice** — immutable once data exists; affects every Dataverse object name
- **Solution boundary / split strategy** — single solution vs. layered solutions; affects deployment and dependency management
- **Dataverse vs. SharePoint vs. Custom Connector as backing store** — for a given entity or data set; lock-in is real and migration is expensive
- **Environment topology** — Dev / Test / Prod layout, regions, data residency choices
- **Router choice deviation** — HashRouter is the contract (architectural rule #6); record only if deviating and why
- **Copilot Studio agent placement** — embedded panel, unified canvas, side pane, or no agent; affects UX architecture
- **Custom API vs. Power Automate flow boundary** — where server-side logic lives; affects testability, latency, and governance
- **Security model** — table permissions, web roles vs. security roles, role hierarchy, Business Unit structure
- **Seeding strategy** — real data vs. mock provider during prototype (per 00d); affects how quickly the prototype can flip to live data

### ADR format

Keep ADRs short. A single paragraph is often sufficient.

```markdown
# {Short title of the decision}

{1–3 sentences: what's the context, what did we decide, and why.}
```

**Optional sections** (include only when they add genuine value):

- **Status** (`proposed | accepted | deprecated | superseded by ADR-NNNN`)
- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need calling out

### Numbering

Scan `docs/adr/` for the highest existing number and increment by one. If the directory is empty, start at `0001`.

---

## Integration With the Planning Flow

This instruction file is not a standalone phase. It is a **style overlay** that applies during 00a, 00b, and 00c.

- **During 00a (Business Problem Decomposition):** Use the grilling cadence to decompose the narrative. Sharpen terms into `CONTEXT.md` as they emerge. Do not batch questions.
- **During 00b (Scope Refinement):** Use the grilling cadence to pressure-test workflows, exception paths, and enterprise concerns. Continue updating `CONTEXT.md`. Begin checking whether decisions meet the ADR threshold.
- **During 00c (Solution Concept → Dataverse Plan):** Every entity, relationship, and lifecycle state proposed for `planning-payload.json` must trace back to a term in `CONTEXT.md`. If no term exists, sharpen it first. At the end of 00c, explicitly prompt the user: *"Before we hand off to schema provisioning — are there any decisions we locked during this session that a future developer would find surprising? If so, let's record them as ADRs."*

## Downstream Handoff

When shared understanding is reached:

- `CONTEXT.md` is up to date with all resolved terms
- Any qualifying ADRs have been written to `docs/adr/`
- The planning narrative (00a / 00b / 00c outputs) reflects the grilled and sharpened scope
- Proceed to `00d-prototype-validation.instructions.md` or directly to Dataverse planning, depending on the project's delivery sequence
