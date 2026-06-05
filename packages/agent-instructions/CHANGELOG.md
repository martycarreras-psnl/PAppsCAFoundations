# @pacaf/agent-instructions

## 3.7.0

### Minor Changes

- b0496b3: Make the planning-phase grilling cadence (00e-grill-and-document) always-on so
  brand-new projects, which have no source files for `applyTo` globs to match,
  actually pick it up. Adds `applyTo: "**"` to the canonical instruction file,
  flips the Cursor projection to `alwaysApply: true`, adds a manifest entry for
  00e, inlines the cadence rules into `.github/copilot-instructions.md`, and
  strengthens the directive in `AGENTS.md` so coding agents can't silently fall
  back to a structured questionnaire during a freeform "describe your app idea"
  conversation.
- e234201: Strengthen the grilling cadence to (a) forbid compound questions — joining
  clauses with "and" / "also" / "plus" / a comma is now an explicit cadence
  violation, split the question instead, and (b) require that whenever the
  question has more than one plausible answer, the agent presents the choices
  as a lettered list (`**A)** …`, `**B)** …`, `**C)** …`, one per line, with
  `*(recommended)*` on the agent's pick) and invites the user to reply with a
  letter — or multiple like `A, C` if more than one applies. This makes
  planning conversations far easier to navigate when the user is on mobile or
  just wants to fire back a one-character answer. Mirrored into the always-on
  copilot-instructions block, the Cursor projection, and the Claude planning
  projection so every agent surface honors the new shape.

## 3.6.0

### Minor Changes

- ee6dbb1: Make the Dataverse-skills plugin the first-class, only-supported path for all Dataverse work across the shipped agent guidance.

  - New canonical instruction `07b-org-structure-and-security.instructions.md` (plus `.claude` / `.cursor` projections): provisions business units, owner teams, Entra ID security groups, and role mappings — a documented plugin gap the agent fills via the plugin's bundled Python SDK (`businessunit` / `team` records) plus `az ad group`. Registered in `agent-guidance.config.json`.
  - Rewrote `07-dataverse-schema`, `07a-existing-schema-discovery`, `02-connectors`, `04-deployment`, `00-environment-setup`, and `00c` to route schema/data/query/solution/export operations to the plugin (`dv-metadata`, `dv-solution`, `list_tables` / `describe_table`) and native `pac solution export`; removed all references to the deleted `pacaf-validate` / `pacaf-generate` / `pacaf-register` / `pacaf-export-solution` scripts. The reserved-name / reserved-column guard is now agent-enforced prose in `07a`.
  - Added data-isolation / organizational-boundary discovery to `00b` and org-structure derivation to `00c` (feeding the new `orgStructure` planning section).
  - `AGENTS.md`: the plugin is now a hard requirement (was "strongly recommended"); scope-split table updated and the deleted-script rows removed.
  - Refreshed the stale `prereq-gate` and `before-you-start` condensations (`.claude` + `.cursor`) to reflect the plugin hard gate and the wizard/plugin-produced publisher & solution flow.

## 3.5.7

### Patch Changes

- bb66ce0: Point agents at a single authoritative Dataverse-skills setup walkthrough. AGENTS.md and the "before you start" instruction now link to docs/dataverse-skills-setup.md — one linear, OS-specific guide covering Python, pip, the PowerPlatform-Dataverse-Client SDK, PAC auth, the /plugin install dataverse step, MCP verification, and an end-to-end smoke test, each with an official reference, a verify command, and the most common failure/fix. Agents are instructed to send users there rather than improvising install commands. Closes #94.

## 3.5.6

### Patch Changes

- 83f2d16: Fix Code App not being associated with its solution on deploy (issue #81). A
  by-the-book deploy ran a bare `pac code push`, which silently created the app
  **outside** its solution — PAC prints `App pushed successfully` even though the
  app never becomes a solution component, and a later `-s` re-push cannot
  retroactively fix it.

  - `@pacaf/scripts` `pac-safe.mjs` now hardens `code push`: it forces a user
    auth profile (BAP rejects SPN tokens), injects `-s <SolutionUniqueName>` from
    a new `--solution-name` flag / `PP_SOLUTION_UNIQUE_NAME` / wizard state, and
    refuses to run a bare push (exits non-zero with a clear message) when no
    unique name can be resolved.
  - `@pacaf/scripts` `sync-foundations.mjs` preserves any `--solution-name`
    already baked into the project's `deploy` script when re-syncing.
  - `@pacaf/wizard` `scaffold-foundations.mjs` bakes the solution unique name into
    the generated `deploy` script via `--solution-name`, and Step 9
    (`09-verify-deploy.mjs`) now passes the solution **unique** name (not the
    friendly display name) to `pac code push -s`, replaces the broken
    `add-solution-component -ct 300` fallback with a verification + recovery gate,
    and removes every bare-push fallback hint.
  - `@pacaf/wizard-ux` carried a **second, independent copy** of Step 9
    (`server/steps/09-verify-deploy.mjs`) that the browser wizard
    (`npx @pacaf/wizard-ux@latest`, the default scaffolder) actually executes. It
    still pushed with the friendly **display name** and still ran the broken
    `add-solution-component -ct 300` fallback, so the fix never reached the most
    common deploy path. It now mirrors the CLI wizard exactly: push with the
    solution **unique** name, refuse a bare push when no unique name is resolvable,
    and verify solution membership instead of attempting the broken component add.
  - `@pacaf/agent-instructions`: `01-scaffold`, `04-deployment`, and
    `00-environment-setup` drop the false "init registers the app in the active
    solution context" claim and replace all bare `pac code push` examples with
    `pac code push -s "<SolutionUniqueName>"`, documenting the first-push-critical
    and unique-vs-display-name rules.

## 3.5.5

### Patch Changes

- 0affcdd: Fix Code App not being associated with its solution on deploy (issue #81). A
  by-the-book deploy ran a bare `pac code push`, which silently created the app
  **outside** its solution — PAC prints `App pushed successfully` even though the
  app never becomes a solution component, and a later `-s` re-push cannot
  retroactively fix it.

  - `@pacaf/scripts` `pac-safe.mjs` now hardens `code push`: it forces a user
    auth profile (BAP rejects SPN tokens), injects `-s <SolutionUniqueName>` from
    a new `--solution-name` flag / `PP_SOLUTION_UNIQUE_NAME` / wizard state, and
    refuses to run a bare push (exits non-zero with a clear message) when no
    unique name can be resolved.
  - `@pacaf/scripts` `sync-foundations.mjs` preserves any `--solution-name`
    already baked into the project's `deploy` script when re-syncing.
  - `@pacaf/wizard` `scaffold-foundations.mjs` bakes the solution unique name into
    the generated `deploy` script via `--solution-name`, and Step 9
    (`09-verify-deploy.mjs`) now passes the solution **unique** name (not the
    friendly display name) to `pac code push -s`, replaces the broken
    `add-solution-component -ct 300` fallback with a verification + recovery gate,
    and removes every bare-push fallback hint.
  - `@pacaf/agent-instructions`: `01-scaffold`, `04-deployment`, and
    `00-environment-setup` drop the false "init registers the app in the active
    solution context" claim and replace all bare `pac code push` examples with
    `pac code push -s "<SolutionUniqueName>"`, documenting the first-push-critical
    and unique-vs-display-name rules.

## 3.5.4

### Patch Changes

- 91a06ea: Document the stale-`@pacaf/scripts` routing-guard false-positive in the scaffold instructions (and projections) so agents self-heal instead of "fixing" already-correct `HashRouter` code. Explains the two machine-global caches that bite even a brand-new repo (the `npx` wizard cache writing a caret range + a warm pnpm store resolving it to a buggy release) and the fix (`pnpm add -D @pacaf/scripts@latest @pacaf/agent-instructions@latest`) plus the pre-scaffold cache-clear recipe.

## 3.5.3

### Patch Changes

- d6dc0b6: Fix prerequisite gate so it stops blocking "run the wizard" when the cwd happens to be the PACAF monorepo source tree.

  The previous Step 7 trigger was "is the cwd the source tree?" — which fired even when the user just said "run the wizard" (intent: `npx @pacaf/wizard-ux@latest`, a self-contained published artifact that does not need the local workspace built). Agents stopped users with a `🛑 Monorepo source tree — workspace not ready` block and demanded `pnpm install` + build before doing anything, even though those steps were irrelevant to the user's actual command.

  Step 7 now fires **only** when the user has explicitly typed a source-tree invocation (`pnpm --filter @pacaf/...`, `node packages/...`, etc.). For any `npx @pacaf/...` invocation — or any natural-language "run the wizard" request — the agent goes straight to `npx @pacaf/wizard-ux@latest` regardless of cwd.

  Updated: `00-prereq-gate.instructions.md` (canonical), `.claude/rules/prereq-gate.md` (projection), `AGENTS.md` (root contract).

## 3.5.2

### Patch Changes

- 06c137d: Own the starter payload: stop fetching from `microsoft/PowerAppsCodeApps/templates/starter` via `degit`. Both the CLI wizard (`@pacaf/wizard`) and the browser wizard (`@pacaf/wizard-ux`) now write the entire starter project locally via `createMinimalProject` + `writeConfig` + `writeStarterFiles`.

  Why: the upstream template was reshaped from a minimal scaffold into a full setup-wizard app of its own (xterm, an embedded terminal, a question runner, `src/router.tsx` using `createBrowserRouter`, `verbatimModuleSyntax` strict imports, dependencies we never merged). Every reshape leaked surplus files into fresh scaffolds and broke the build (`@fluentui/react-icons` not found, `@xterm/xterm` not found, etc.). Issues #47 and #63 patched the two most visible symptoms; this change removes the entire class of bug by no longer being downstream of a moving target. The `templates/starter/` directory in PAppsCAFoundations stays as documentation only — the wizard does not fetch it.

  Also removes the now-unreachable `src/router.tsx` scrub from `writeStarterFiles`, and updates `01-scaffold.instructions.md` to recommend the wizard instead of `npx degit microsoft/...`.

## 3.5.1

### Patch Changes

- 5f32ac8: Prerequisite gate now detects when the agent is working inside the PACAF
  monorepo source tree (vs a downstream Code App) and gates source-tree wizard /
  scripts / rebrand invocations on `pnpm install` and
  `pnpm --filter @pacaf/wizard-ux build`. Prevents the misleading
  `Cannot find package 'fastify'` error from being mistaken for a PACAF bug.
  AGENTS.md / CLAUDE.md now clearly distinguish the consumer path
  (`npx @pacaf/wizard-ux@latest`, self-contained) from the contributor path
  (running from monorepo source, requires workspace install + build).
  Closes #61.

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
