# @pacaf/scripts

## 4.0.1

### Patch Changes

- b390055: Fix the schema agent always missing the publisher prefix set during the wizard.

  The wizard captured the publisher prefix (Step 6) but never recorded it anywhere
  machine-readable in the scaffolded project: `dataverse/planning-payload.json` was
  a **verbatim copy** of the example with `yourprefix_` in every table/column name,
  `.env` held only environment URLs, and `pacaf.client.json` held only branding. So
  when a later plan-mode schema agent read the project's source of truth, it
  literally saw `yourprefix` and either invented a prefix or dropped it.

  The scaffold now threads the real prefix through (`@pacaf/wizard`
  `copyFoundationFiles`, called by `@pacaf/wizard-ux` Step 8):

  - **`dataverse/planning-payload.json`** is seeded with the actual prefix
    substituted for every `yourprefix` placeholder.
  - **`.env`** gains a `PP_PUBLISHER_PREFIX=` line (durable, machine-readable
    source of truth, preserved/updated idempotently).
  - **`pacaf.client.json`** records `publisherPrefix`.

  The Dataverse schema instructions (`@pacaf/agent-instructions`, file `07`, plus
  the Claude/Cursor projections) now tell the agent to resolve the concrete prefix
  from `.env` → `pacaf.client.json` → `dataverse/planning-payload.json` → `README.md`
  in priority order, and to ask the user rather than ever emit `yourprefix`.

  `@pacaf/scripts` adds unit coverage for the prefix normalization and `.env`
  upsert helpers.

## 4.0.0

### Major Changes

- ee6dbb1: Remove the four redundant Dataverse/solution Node scripts now owned by the [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin: `validate-schema-plan.mjs` (`pacaf-validate`), `generate-dataverse-plan.mjs` (`pacaf-generate`), `register-dataverse-data-sources.mjs` (`pacaf-register`), and `export-solution.mjs` (`pacaf-export-solution`), along with their `bin` entries and tests.

  BREAKING: the `pacaf-validate`, `pacaf-generate`, `pacaf-register`, and `pacaf-export-solution` commands no longer exist. The planning payload (`dataverse/planning-payload.json`) is now the re-runnable source of truth — the agent reads it and drives the plugin (`dv-metadata`, `dv-solution`) plus `pac code add-data-source` directly. Solution export uses native `pac solution export` / `pac solution unpack`. The generated npm scripts (`validate:schema-plan`, `generate:dataverse-plan`, `register:dataverse`, `solution:export*`) are dropped from `scaffold-foundations.mjs` and `sync-foundations.mjs`; `prototype:seed` is retained. The `orgStructure` section is added to `schema-plan.example.json`.

## 3.0.11

### Patch Changes

- 076d4a6: Verify the solution exists in the target environment before the first `pac code push`.

  Root cause (empirically verified against live Dataverse): `pac code push -s <uniqueName>`
  only associates the app with its solution when a solution with that exact **unique name**
  already exists in the pushed environment. If it does not, pac **silently** publishes the app
  into the Default solution with no error — the recurring "my app isn't in my solution" failure.
  This happened whenever the typed solution unique name had a typo, was a display name, or was
  never actually created in the Maker Portal.

  Both deploy-step copies (CLI `wizard/steps/09-verify-deploy.mjs` and browser
  `wizard-ux/server/steps/09-verify-deploy.mjs`) now call a shared
  `solutionExistsInSelectedEnv()` precondition on the first push. If the solution is absent the
  deploy stops with a precise, actionable message instead of silently orphaning the app; if the
  existence check itself cannot run, it warns and proceeds. A parity test pins this invariant in
  both copies.

  Also: the WizardUX no longer auto-advances to the summary screen when the final Verify & Deploy
  step finishes — it stays on step 9 so the deploy log stays readable, with a manual "View summary"
  button to continue.

## 3.0.10

### Patch Changes

- 122def8: Deploy step now follows the documented `pac code push` golden path exactly and stops attempting post-push solution repair.

  The first `pac code push -s <UNIQUE name>` (the CREATE) both creates the `canvasapp` record and adds it to the chosen solution in one shot — that single command is the whole fix. The previous post-push "ensure membership" machinery (`ensureAppInSolution` / `manualSolutionAddSteps` / the shared `solution-membership.mjs` lib / `solution add-solution-component` / `-ct 300`) was built on the disproven belief that the flow couldn't solution-bind in one push, so it has been removed from both deploy-step copies and deleted.

  The CLI copy (`@pacaf/wizard`) no longer warns-and-pushes-bare when no solution unique name is available — it now **refuses** the push, matching the WizardUX copy. A bare first push creates the Code App outside any solution, which no later `-s` re-push (an ignored UPDATE) can fix, so both copies now hard-stop and tell you to re-run the solution step. The deploy-step parity test was updated to pin the bare-push refusal and to ban the removed repair helpers from ever returning.

## 3.0.9

### Patch Changes

- f4643b2: Make the manual "add app to solution" fallback copy-paste-safe. When automatic
  add-to-solution can't be confirmed, the suggested `pac solution
add-solution-component` command now embeds the real `appId` (no `<appId>`
  placeholder to fill in) and explicitly warns it must be a SINGLE line — a pasted
  line break before `--componentType` makes zsh run it as two broken commands
  (`A required argument --componentType is missing` + `command not found:
--componentType`). `manualSolutionAddSteps` gains an optional `appId` argument;
  both deploy-step copies (CLI `@pacaf/wizard` and browser `@pacaf/wizard-ux`)
  pass it through.

## 3.0.8

### Patch Changes

- ec32369: Deploy step: read Code App ↔ solution membership from Dataverse and auto-repair (#81)

  The "Verify & Deploy" step now reliably confirms a deployed Code App is a
  component of the selected solution and **adds it automatically** when it is not —
  for both first (CREATE) and subsequent (UPDATE) pushes, and for both user and
  service-principal auth profiles.

  What changed and why:

  - **Authoritative read via `pac org fetch`.** The previous membership check
    exported the solution with a malformed `pac solution export --managed false`
    (`--managed` is a boolean switch, so `false` was a stray token) and counted
    type-300 components from the zip. That produced false negatives, which is why
    the check had been demoted to non-blocking — leaving apps silently orphaned.
    Membership is now read from the `solutioncomponent` table via FetchXML, which
    runs under the active auth profile (no client secret), so it works for **user
    and SPN** profiles alike.

  - **Automatic repair via `pac solution add-solution-component`.** The appId in
    `power.config.json` is the same GUID as the `canvasapp` record
    (`canvasappid` — verified), so the existing app can be added to the solution
    after the fact. The old #81 belief that this required a different GUID (and the
    only remedy was delete + recreate) was incorrect; the delete/recreate dead-end
    is removed. The rare manual fallback now guides an "Add existing → App → Code
    app" flow that preserves the app's appId and URL.

  - **Shared logic, enforced parity.** Read + repair live solely in
    `packages/wizard/lib/solution-membership.mjs` (`checkAppInSolution`,
    `addAppToSolution`, `ensureAppInSolution`, `buildMembershipFetchXml`,
    `manualSolutionAddSteps`). Both deploy-step copies (CLI `@pacaf/wizard` and
    browser `@pacaf/wizard-ux`) call the shared `ensureAppInSolution` after the
    push. The deploy-step parity guard and the membership unit tests were updated
    accordingly.

## 3.0.7

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

- 2469cbe: Add a deploy-step parity guard that prevents CLI-wizard vs browser-wizard-UX
  drift. `packages/scripts/tests/deploy-step-parity.test.mjs` asserts that both
  copies of the "Verify & Deploy" step
  (`packages/wizard/steps/09-verify-deploy.mjs` and
  `packages/wizard-ux/server/steps/09-verify-deploy.mjs`) satisfy the same
  `pac code push` solution-association safety invariants and that neither
  reintroduces the broken `solution add-solution-component -ct 300` repair path
  (issue #81 / wizard-ux@3.3.5 regression).
- 83f2d16: Fix orphaned Code Apps: authoritatively verify solution membership and hard-stop before a doomed push (issue #81).

  A Code App's solution membership is written exactly once — on the first `pac code push -s <UNIQUE name>` (the CREATE). Once an `appId` exists, every push is an UPDATE and `-s` is silently ignored, so an app that was first pushed without a valid unique name can never be associated afterward. The old verification only ran `pac solution list` and checked the name appeared, which proves the solution exists but NOT that the app is inside it — a false positive that let apps ship orphaned while the wizard reported success.

  - New shared `packages/wizard/lib/solution-membership.mjs`: dependency-free `pac solution export` + Canvas App (type 300) component count gives an authoritative `member` / `absent` / `unknown` membership signal. Imported by BOTH deploy-step copies so they cannot drift.
  - Pre-push orphan guard: when an `appId` already exists and a solution is selected, membership is verified BEFORE pushing. If the app is `absent`, the deploy hard-stops with recovery steps instead of wasting an UPDATE that cannot fix the orphan.
  - Real post-create verification: after the first push, the app's membership is confirmed by export rather than the false-positive `solution list` check; a create that failed to associate now fails loudly with recovery steps.
  - Tests: new `solution-membership.test.mjs` unit tests for the zip reader, component counter, and the three statuses; deploy-step parity test extended to force both copies to keep the shared check, pre-push guard, and recovery steps, and to ban the false-positive `solution list` membership check.

## 3.0.6

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

## 3.0.5

### Patch Changes

- 549648e: `pacaf-update --check` now also reports `@pacaf/scripts` version drift. It compares the locally installed version against the latest published version and prints whether it is up to date, drifted, not installed, or unreachable — alongside the existing `@pacaf/agent-instructions` check.

## 3.0.4

### Patch Changes

- bda4afe: Add regression tests for the routing guard (issue #74) covering:

  - `BrowserRouter` mentioned only inside a `//` line comment in `src/main.tsx` must not trip the guard.
  - `BrowserRouter` / `createBrowserRouter` mentioned only inside a `/* … */` block comment must not trip the guard.
  - A real `BrowserRouter` named import is still auto-rewritten to `HashRouter`.
  - A `src/router.tsx` that calls `createBrowserRouter` is still auto-removed.

  These lock in the comment-stripping + precise-regex behavior shipped in 3.0.3 so the 3.0.1-era false-positive cannot regress.

## 3.0.3

### Patch Changes

- 6a4d182: Fix routing guard false-positive on `BrowserRouter` mentions inside comments.

  The prebuild routing guard used a plain word-boundary regex (`\bBrowserRouter\b`) that matched the word `BrowserRouter` anywhere in `src/main.tsx` — including inside the explanatory comment our own scaffold writes (`// HashRouter (NOT BrowserRouter) is required…`). On `@pacaf/scripts@3.0.1` this failed the build outright; on 3.0.2's self-heal it silently rewrote the comment.

  The guard now strips comments first, then matches only on real named imports from `react-router-dom` or actual JSX/call usage (`<BrowserRouter>`, `createBrowserRouter(`). Documentation comments are safe.

## 3.0.2

### Patch Changes

- 32f4eba: Fix #63: BrowserRouter regression when the upstream Microsoft starter template
  ships routing in `src/router.tsx`. Two layers of defense:

  1. **Scaffold scrub** (`packages/wizard/lib/scaffold-foundations.mjs`):
     `writeStarterFiles` now deletes `src/router.tsx` if the upstream starter
     left one behind. Our `main.tsx` wraps `<App />` in `<HashRouter>` directly,
     so we don't use `src/router.tsx` at all.

  2. **Self-healing prebuild guard** (`packages/scripts/patch-datasources-info.mjs`):
     the routing guard no longer fails the build on `BrowserRouter` /
     `createBrowserRouter`. It auto-rewrites `src/main.tsx`
     (BrowserRouter → HashRouter, createBrowserRouter → createHashRouter) and
     removes `src/router.tsx`, emitting a warning. The build continues; the user
     can review and commit the patch. This way, future upstream starter
     reshuffles can't reintroduce the same 404-on-first-load bug.

## 3.0.1

### Patch Changes

- 0aa64f2: Make `HashRouter` the routing default for every Code App. `packages/wizard/lib/scaffold-foundations.mjs` now emits `<HashRouter>` around `<App />` in `src/main.tsx` (with an inline comment pointing at issue #47), `pacaf-patch-datasources` (the `prebuild` hook in `packages/scripts/patch-datasources-info.mjs`) now fails the build with a pointed error if `src/main.tsx` or `src/router.tsx` still imports `BrowserRouter` / `createBrowserRouter`, and `.github/instructions/01-scaffold.instructions.md`, `AGENTS.md`, and `TROUBLESHOOTING.md` document the rule and its symptom (404 on first load inside the Power Apps iframe). Closes #47.

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
