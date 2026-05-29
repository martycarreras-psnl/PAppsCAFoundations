# @pacaf/agent-instructions

## 3.5.0

### Minor Changes

- c7982e2: Add grill-and-document planning guidance (00e): default grilling cadence for 00a→00c planning phases, CONTEXT.md living glossary with Dataverse bridge, and docs/adr/ with PACAF-specific qualifying-decision list. Adapted from Matt Pocock's grill-with-docs skill (MIT). Updated 00a, 00b, 00c to reference the new cadence and glossary rules. Added NOTICES.md with full attribution.

## 3.4.0

### Minor Changes

- e7accf6: Prereq gate now probes the canonical install path before declaring a tool missing, so a working `pac`/`dotnet`/`node`/`git` install that simply isn't on `PATH` is no longer misdiagnosed as "Prerequisite missing — please reinstall". The classic macOS/zsh trigger — a `PATH` entry with a literal unexpanded `~` (e.g. `~/.dotnet/tools`, which neither zsh nor bash tilde-expand inside `PATH`) — is now called out explicitly with a one-line zsh / bash / PowerShell fix. New Step 2.5 + Step 3a in `.github/instructions/00-prereq-gate.instructions.md`, mirrored to the Claude and Cursor projections. Closes #45.
- c813f30: `02-connectors.instructions.md` now opens its Dataverse section with a mandatory "Always call the `*WithOrganization` variants" subsection covering the silent-but-fatal HTTP 400 (`Invalid organization URL 'null' provided.`) that every Code App hits when its adapter calls the bare `ListRecords` / `GetItem` / `CreateRecord` / `UpdateRecord` / `DeleteRecord` overloads of `MicrosoftDataverseService`. Includes the bare-vs-`*WithOrganization` mapping table, the required `VITE_DATAVERSE_URL` `.env` entry, a canonical adapter snippet that threads the organization URL through every call, and the diagnostic rule for spotting the regression in network output. `.env.template` in `templates/starter/` now ships a commented-out `VITE_DATAVERSE_URL` line so it's discoverable at scaffold time. Closes #46.
- 0aa64f2: Make `HashRouter` the routing default for every Code App. `packages/wizard/lib/scaffold-foundations.mjs` now emits `<HashRouter>` around `<App />` in `src/main.tsx` (with an inline comment pointing at issue #47), `pacaf-patch-datasources` (the `prebuild` hook in `packages/scripts/patch-datasources-info.mjs`) now fails the build with a pointed error if `src/main.tsx` or `src/router.tsx` still imports `BrowserRouter` / `createBrowserRouter`, and `.github/instructions/01-scaffold.instructions.md`, `AGENTS.md`, and `TROUBLESHOOTING.md` document the rule and its symptom (404 on first load inside the Power Apps iframe). Closes #47.

### Patch Changes

- 61b598b: Default the deployed-app URL to `?hideNavBar=true` so every Code App built from this template hides the Power Apps "purple bar" by default. The wizard appends `hideNavBar=true` when capturing the deployed URL from `pac code push` output, the state API normalizes any pre-existing URL when surfacing it to the Summary page, and `.github/instructions/04-deployment.instructions.md` now promotes the flag from "checklist item" to "default appended". Closes #44.
- a1de977: Make the Tailwind v4 + CSS pipeline work out of the box. The wizard scaffold now (a) emits `import './index.css';` in `src/main.tsx`, (b) writes a `src/index.css` containing `@import "tailwindcss";`, (c) registers the required `@tailwindcss/vite` plugin in `vite.config.ts`, and (d) declares both `tailwindcss` and `@tailwindcss/vite` as `devDependencies`. Documents both rules in `.github/instructions/01-scaffold.instructions.md` and adds a keyed `TROUBLESHOOTING.md` entry ("My app renders but everything is unstyled"). Closes #48.

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
