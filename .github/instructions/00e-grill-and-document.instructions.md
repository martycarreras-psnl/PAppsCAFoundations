---
applyTo: "**"
description: "Read this file when the user wants to stress-test a plan, challenge assumptions, lock decisions, build or update the project glossary, or record an architectural decision. Use this guidance to interview the user one question at a time against the existing domain model, sharpen terminology into CONTEXT.md, and capture hard-to-reverse decisions as ADRs. Do NOT batch questions or skip to implementation."
---

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
