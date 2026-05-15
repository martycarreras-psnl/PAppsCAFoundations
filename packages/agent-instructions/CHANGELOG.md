# @pacaf/agent-instructions

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
