# @pacaf/agent-instructions

## 3.3.0

### Minor Changes

- 9a2f3d3: Add `00-prereq-gate` instruction: force every coding agent to verify Node.js, npm, Git, .NET SDK, PAC CLI, and Python (or the `py` launcher on Windows) **before** running the wizard or any tool that depends on them.

  On a fresh laptop — especially a new Windows machine — the wizard runs via `npx`, which itself requires Node.js. Agents historically tried to brute‑force around missing prerequisites and produced cryptic failure spirals that looked like PACAF bugs. This rule loads on every interaction (`applyTo: **`), runs a 5‑command precheck before any wizard attempt, and stops with a structured "🛑 Prerequisite missing — only you can install this" block listing the missing tools, official installer links, and OS‑specific gotchas (Microsoft Store python3 stub, VS Code terminal defaulting to cmd.exe, PATH refresh after `dotnet tool install`, npx exit 9009, corporate SSL inspection, OneDrive Files On‑Demand).

  The README now also shows a prominent "Brand-new machine? Do this first" callout above the prerequisites table with the same 30‑second self-test, so humans get the same guardrail even before they invoke an agent. Projections shipped for Claude Code (`.claude/rules/prereq-gate.md`) and Cursor (`.cursor/rules/00-prereq-gate.mdc`).

## 3.2.0

### Minor Changes

- 25da79c: Document the agent-instructions publishing flow so coding agents (and forkers) never silently skip the npm release step again.

  `10-publishing.instructions.md` now applies whenever any file under `.github/instructions/`, `.claude/rules/`, `.cursor/rules/`, `agent-guidance.config.json`, top-level `AGENTS.md`, top-level `CLAUDE.md`, or `.github/copilot-instructions.md` is edited. The new "Editing Agent Instructions Is Also Publishing" section walks through the full canonical → sync-from-root → changeset → release-PR → npm verify flow, lists mandatory pre-push checks, and documents how downstream forks pick up the change. The top-level `AGENTS.md` adds rule 8 calling out that instruction edits are shipped artifacts and must follow this flow.

## 3.1.0

### Minor Changes

- 9545f19: Add 07a existing-schema-discovery instruction: OOB-first Dataverse design with Pause Moments on duplication risk.

  When provisioning a new Dataverse table, column, choice, or lookup, agents now run an OOB-first discovery pass and emit a `⏸ Pause` block before creating anything that could duplicate `systemuser`, `contact`, `account`, `team`, `businessunit`, platform columns (`createdon`, `ownerid`, `statuscode`, etc.), or already-present custom assets. Developer overrides are honored and recorded into `dataverse/planning-payload.json` for traceability. The 00c handoff and 07-dataverse-schema gate now route through 07a, and projections ship for Claude Code (`.claude/rules/existing-schema-discovery.md`) and Cursor (`.cursor/rules/07a-existing-schema-discovery.mdc`).

## 3.0.0

### Major Changes

- acdc945: Initial 1.0.0 release as scoped, publishable packages.

  Replaces the previous in-repo `wizard/`, `wizard-ux/`, `scripts/`, and `.github/instructions/` trees that were copied into every template-derived repository.

  - **`@pacaf/wizard`** — CLI setup wizard (was `wizard/`). Run with `npx @pacaf/wizard@latest`.
  - **`@pacaf/wizard-ux`** — Browser-based setup wizard (was `wizard-ux/`). Run with `npx @pacaf/wizard-ux@latest`.
  - **`@pacaf/scripts`** — Helper bins: `pacaf-validate`, `pacaf-register`, `pacaf-generate`, `pacaf-seed`, `pacaf-patch-datasources`, `pacaf-discover-connection`, `pacaf-export-solution`, `pacaf-pac`, `pacaf-pac-safe`, `pacaf-setup-auth`, `pacaf-update`, `pacaf-migrate-thin`.
  - **`@pacaf/agent-instructions`** — Power Apps Code App agent guidance for GitHub Copilot, Claude, and Cursor. `pacaf-instructions sync` materializes the files into a target repo.
  - **`@pacaf/rebrand`** — Retarget a fork to a new scope and bin-prefix. See `FORKING.md`.

  Derived repos can migrate from the legacy "fat" layout via `npx pacaf-migrate-thin`.

## 2.0.0

### Major Changes

- 1226609: Initial 1.0.0 release as scoped, publishable packages.

  Replaces the previous in-repo `wizard/`, `wizard-ux/`, `scripts/`, and `.github/instructions/` trees that were copied into every template-derived repository.

  - **`@pacaf/wizard`** — CLI setup wizard (was `wizard/`). Run with `npx @pacaf/wizard@latest`.
  - **`@pacaf/wizard-ux`** — Browser-based setup wizard (was `wizard-ux/`). Run with `npx @pacaf/wizard-ux@latest`.
  - **`@pacaf/scripts`** — Helper bins: `pacaf-validate`, `pacaf-register`, `pacaf-generate`, `pacaf-seed`, `pacaf-patch-datasources`, `pacaf-discover-connection`, `pacaf-export-solution`, `pacaf-pac`, `pacaf-pac-safe`, `pacaf-setup-auth`, `pacaf-update`, `pacaf-migrate-thin`.
  - **`@pacaf/agent-instructions`** — Power Apps Code App agent guidance for GitHub Copilot, Claude, and Cursor. `pacaf-instructions sync` materializes the files into a target repo.
  - **`@pacaf/rebrand`** — Retarget a fork to a new scope and bin-prefix. See `FORKING.md`.

  Derived repos can migrate from the legacy "fat" layout via `npx pacaf-migrate-thin`.
