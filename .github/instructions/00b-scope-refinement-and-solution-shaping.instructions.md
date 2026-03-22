---
description: "Read this file when the user's business problem is partially understood and now needs to be refined into a complete enterprise solution scope. Use this guidance to explore workflows, validations, approvals, automation, Teams and Microsoft 365 interactions, reporting, governance, and Copilot placement decisions. Do NOT reduce this to a fixed questionnaire or move into technical implementation until the solution boundary is stable."
---

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

## Preferred Response Shape

When helpful, structure the response in this order:

1. Current understanding of the solution scope
2. Areas that are now clear enough to treat as likely scope
3. Enterprise dimensions that still need refinement
4. A focused set of follow-up questions or challenge points
5. A revised scope summary after each refinement round

This phase should feel like progressive elaboration, not like a requirements spreadsheet pasted into chat.

## Outputs From This Phase

By the end of this phase, Copilot should be able to produce:

- A refined solution scope narrative
- A workflow and exception-path summary
- A list of business rules and approval points
- A preliminary automation-placement view
- A preliminary Teams / Office / Copilot suitability view
- A summary of reporting, governance, and control concerns

Once those are strong enough, proceed to conceptual modeling and Dataverse planning.

## Downstream Handoff

Continue with `00c-solution-concept-to-dataverse-plan.instructions.md`.

Do not move directly to connector registration or schema provisioning until the refined scope is stable enough to drive durable modeling decisions.