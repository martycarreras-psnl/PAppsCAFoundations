# @pacaf/wizard

## 3.4.1

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
- Updated dependencies [f4643b2]
  - @pacaf/scripts@3.0.9

## 3.4.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [ec32369]
  - @pacaf/scripts@3.0.8

## 3.3.11

### Patch Changes

- 22258bf: Fix scaffold install failure on pnpm caused by the `--prefer-online` cache-busting flag.

  The previous freshness fix passed `--prefer-online` to the package manager during all three install stages. That flag is **npm-only** — pnpm (the wizard's preferred installer) aborts with `Unknown option: 'prefer-online'`, so every install stage failed and fresh scaffolds ended up with no `node_modules` (e.g. `vitest: command not found` during smoke tests).

  The flag is removed from both wizards. First-party freshness is now guaranteed in a manager-agnostic way: `freshDevPackageSpecs()` / `resolveFirstPartyLatest()` resolve the exact latest published version of `@pacaf/scripts` and `@pacaf/agent-instructions` at scaffold time via `npm view <pkg> version --prefer-online` and pin that exact semver into the install spec. An exact version can never be served stale from a warm store, so both pnpm and npm always install the newest published `@pacaf/*` release. Falls back to the `latest` tag if the registry lookup fails (offline scaffolds still work).

## 3.3.10

### Patch Changes

- fb2f27d: Scaffold installs now always pull the latest published `@pacaf/*` packages (cache-proof).

  Both scaffolders pin the first-party dev deps (`@pacaf/scripts`, `@pacaf/agent-instructions`) to the `latest` dist-tag, but `latest` is resolved from the package manager's **cached packument** (registry metadata). With a warm pnpm/npm store, that metadata could be stale, so a fresh scaffold would install a previous `@pacaf/*` release even though a newer one was published — the "Already up to date" trap that left a new repo on an old `@pacaf/scripts` (and therefore an old in-repo `pac-safe` deploy guard).

  Both install paths (CLI `@pacaf/wizard` `steps/07-scaffold.mjs` and browser `@pacaf/wizard-ux` `server/steps/07-scaffold.mjs`) now pass `--prefer-online` on every `install` / `add`. This forces pnpm and npm to revalidate registry metadata before resolving `latest`, guaranteeing every newly scaffolded repo picks up the newest published capabilities with no manual cache busting.

## 3.3.9

### Patch Changes

- 6a74bfb: Don't block deploys on the post-push solution-membership cross-check (issue #81).

  The documented contract ([Microsoft Learn — ALM for code apps](https://learn.microsoft.com/power-apps/developer/code-apps/how-to/alm)) is `pac code push --solutionName <SolutionUniqueName>` — association happens as part of that push, which both deploy steps already enforce. The follow-up export-based membership cross-check (`pac solution export` + Canvas App component count) is **informational only** and must never fail a legitimate deploy: a clean export with zero Canvas App components is not an authoritative orphan signal. Both deploy steps (CLI `@pacaf/wizard` and browser `@pacaf/wizard-ux`) now downgrade an `absent` verdict to a Maker Portal hint — "Solutions → \<name\> → Add existing → App → Code app" — instead of throwing or aborting the push.

## 3.3.8

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

- 83f2d16: Fix orphaned Code Apps: authoritatively verify solution membership and hard-stop before a doomed push (issue #81).

  A Code App's solution membership is written exactly once — on the first `pac code push -s <UNIQUE name>` (the CREATE). Once an `appId` exists, every push is an UPDATE and `-s` is silently ignored, so an app that was first pushed without a valid unique name can never be associated afterward. The old verification only ran `pac solution list` and checked the name appeared, which proves the solution exists but NOT that the app is inside it — a false positive that let apps ship orphaned while the wizard reported success.

  - New shared `packages/wizard/lib/solution-membership.mjs`: dependency-free `pac solution export` + Canvas App (type 300) component count gives an authoritative `member` / `absent` / `unknown` membership signal. Imported by BOTH deploy-step copies so they cannot drift.
  - Pre-push orphan guard: when an `appId` already exists and a solution is selected, membership is verified BEFORE pushing. If the app is `absent`, the deploy hard-stops with recovery steps instead of wasting an UPDATE that cannot fix the orphan.
  - Real post-create verification: after the first push, the app's membership is confirmed by export rather than the false-positive `solution list` check; a create that failed to associate now fails loudly with recovery steps.
  - Tests: new `solution-membership.test.mjs` unit tests for the zip reader, component counter, and the three statuses; deploy-step parity test extended to force both copies to keep the shared check, pre-push guard, and recovery steps, and to ban the false-positive `solution list` membership check.

- Updated dependencies [83f2d16]
- Updated dependencies [2469cbe]
- Updated dependencies [83f2d16]
  - @pacaf/agent-instructions@3.5.6
  - @pacaf/scripts@3.0.7

## 3.3.7

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

- Updated dependencies [0affcdd]
  - @pacaf/agent-instructions@3.5.5
  - @pacaf/scripts@3.0.6

## 3.3.6

### Patch Changes

- Updated dependencies [91a06ea]
  - @pacaf/agent-instructions@3.5.4

## 3.3.5

### Patch Changes

- 937227c: Scaffold the first-party `@pacaf/scripts` and `@pacaf/agent-instructions` dev
  dependencies from the `latest` dist-tag instead of a `^3.0.0` caret. With a warm
  pnpm store the caret range could resolve to a previously-cached 3.x release, so
  fresh scaffolds occasionally landed on a stale `@pacaf/*` version while a newer
  one was already published. Pinning to `latest` forces the package manager to
  re-query the registry on every scaffold; it still writes back the resolved caret
  range into the generated project's package.json.
- Updated dependencies [549648e]
  - @pacaf/scripts@3.0.5

## 3.3.4

### Patch Changes

- b680dc4: Fix Step 7 scaffold failing when the target directory is a pnpm workspace root. Three fixes for issue #76:

  - **Detect pnpm workspace roots.** When `pnpm-workspace.yaml` is present at (or above) the project directory, `pnpm add` aborts with `ERR_PNPM_ADDING_TO_ROOT`, silently skipping the runtime `[2/3]` and dev `[3/3]` installs. The wizard now passes `-w` / `--workspace-root` to the `pnpm add` commands in that case (both the CLI wizard and the browser wizard-ux) and warns the user.
  - **Add `@fluentui/react-icons` to the runtime dependency list.** The generated `src/App.tsx` imports icons from it, but it was never installed — the smoke test failed with `Failed to resolve import "@fluentui/react-icons"` even in non-workspace directories.
  - **Pre-approve pnpm-blocked build scripts.** The generated `package.json` now declares `pnpm.onlyBuiltDependencies` (`esbuild`, `keytar`, `node-pty`, `@azure/msal-node-*`) so installs no longer require the interactive `pnpm approve-builds` step for Vite's bundler and PAC auth credential storage.

## 3.3.3

### Patch Changes

- Updated dependencies [bda4afe]
  - @pacaf/scripts@3.0.4

## 3.3.2

### Patch Changes

- Updated dependencies [6a4d182]
  - @pacaf/scripts@3.0.3

## 3.3.1

### Patch Changes

- Updated dependencies [d6dc0b6]
  - @pacaf/agent-instructions@3.5.3

## 3.3.0

### Minor Changes

- 06c137d: Own the starter payload: stop fetching from `microsoft/PowerAppsCodeApps/templates/starter` via `degit`. Both the CLI wizard (`@pacaf/wizard`) and the browser wizard (`@pacaf/wizard-ux`) now write the entire starter project locally via `createMinimalProject` + `writeConfig` + `writeStarterFiles`.

  Why: the upstream template was reshaped from a minimal scaffold into a full setup-wizard app of its own (xterm, an embedded terminal, a question runner, `src/router.tsx` using `createBrowserRouter`, `verbatimModuleSyntax` strict imports, dependencies we never merged). Every reshape leaked surplus files into fresh scaffolds and broke the build (`@fluentui/react-icons` not found, `@xterm/xterm` not found, etc.). Issues #47 and #63 patched the two most visible symptoms; this change removes the entire class of bug by no longer being downstream of a moving target. The `templates/starter/` directory in PAppsCAFoundations stays as documentation only — the wizard does not fetch it.

  Also removes the now-unreachable `src/router.tsx` scrub from `writeStarterFiles`, and updates `01-scaffold.instructions.md` to recommend the wizard instead of `npx degit microsoft/...`.

### Patch Changes

- Updated dependencies [06c137d]
  - @pacaf/agent-instructions@3.5.2

## 3.2.2

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

- Updated dependencies [32f4eba]
  - @pacaf/scripts@3.0.2

## 3.2.1

### Patch Changes

- Updated dependencies [5f32ac8]
  - @pacaf/agent-instructions@3.5.1

## 3.2.0

### Minor Changes

- f63d585: Replace the static celebratory launch screen in the scaffolded `App.tsx` with an interactive two-step onboarding flow. After the wizard deploys a new Code App, the developer now sees two clickable cards — "A brand new app" (new tables / idea-first) and "An app on existing data" (existing tables / data-first) — and each path renders tailored, copy-to-clipboard agent prompts for the recommended golden-path steps. Pure Fluent UI v9, no new dependencies, no routing.

### Patch Changes

- Updated dependencies [c7982e2]
  - @pacaf/agent-instructions@3.5.0

## 3.1.5

### Patch Changes

- bb43c0d: Step 7 (Scaffold): make long `npm install` runs feel alive. Each install now prints stage banners (`[1/3]`, `[2/3]`, `[3/3]`), uses `--loglevel=http --no-audit --no-fund` so npm streams one line per package fetch in non-TTY mode, and prefers `pnpm` (with `--reporter=append-only`) when it is on PATH for materially faster cold installs. The wizard-ux LiveLog now shows an elapsed-time footer while a step is running and swaps to "Still working — waiting on npm / network…" after 20s of silence so users no longer mistake a slow registry call for a hung wizard. Closes #43.
- 61b598b: Default the deployed-app URL to `?hideNavBar=true` so every Code App built from this template hides the Power Apps "purple bar" by default. The wizard appends `hideNavBar=true` when capturing the deployed URL from `pac code push` output, the state API normalizes any pre-existing URL when surfacing it to the Summary page, and `.github/instructions/04-deployment.instructions.md` now promotes the flag from "checklist item" to "default appended". Closes #44.
- 0aa64f2: Make `HashRouter` the routing default for every Code App. `packages/wizard/lib/scaffold-foundations.mjs` now emits `<HashRouter>` around `<App />` in `src/main.tsx` (with an inline comment pointing at issue #47), `pacaf-patch-datasources` (the `prebuild` hook in `packages/scripts/patch-datasources-info.mjs`) now fails the build with a pointed error if `src/main.tsx` or `src/router.tsx` still imports `BrowserRouter` / `createBrowserRouter`, and `.github/instructions/01-scaffold.instructions.md`, `AGENTS.md`, and `TROUBLESHOOTING.md` document the rule and its symptom (404 on first load inside the Power Apps iframe). Closes #47.
- a1de977: Make the Tailwind v4 + CSS pipeline work out of the box. The wizard scaffold now (a) emits `import './index.css';` in `src/main.tsx`, (b) writes a `src/index.css` containing `@import "tailwindcss";`, (c) registers the required `@tailwindcss/vite` plugin in `vite.config.ts`, and (d) declares both `tailwindcss` and `@tailwindcss/vite` as `devDependencies`. Documents both rules in `.github/instructions/01-scaffold.instructions.md` and adds a keyed `TROUBLESHOOTING.md` entry ("My app renders but everything is unstyled"). Closes #48.
- Updated dependencies [61b598b]
- Updated dependencies [e7accf6]
- Updated dependencies [c813f30]
- Updated dependencies [0aa64f2]
- Updated dependencies [a1de977]
  - @pacaf/agent-instructions@3.4.0
  - @pacaf/scripts@3.0.1

## 3.1.4

### Patch Changes

- Updated dependencies [9a2f3d3]
  - @pacaf/agent-instructions@3.3.0

## 3.1.3

### Patch Changes

- Updated dependencies [25da79c]
  - @pacaf/agent-instructions@3.2.0

## 3.1.2

### Patch Changes

- Updated dependencies [9545f19]
  - @pacaf/agent-instructions@3.1.0

## 3.1.1

### Patch Changes

- 60fd6dd: Fix smoke tests generated by writeStarterFiles to match the new celebratory
  App.tsx (issue #27). The old tests looked for "Prototype Mode|Connected Mode"
  badge text which no longer exists. Tests now assert on "is live!" which is
  always present in the launch screen title. Fixes Step 7 smoke test failure.

## 3.1.0

### Minor Changes

- 5354bad: Redesign the starter Code App (App.tsx) as a celebratory launch experience.
  The screen now opens with a bouncy 🎉 animation, personalises the title with
  the app name, and presents two clear next-step paths — idea-first and
  data-first — each with a styled agent prompt the user can copy straight into
  their coding agent. The golden-path loop (Plan → Prototype → Connect →
  Deploy → Iterate) is surfaced prominently so every user sees the delivery
  model on first launch. Closes #27.

### Patch Changes

- 5865299: Fix Step 7 scaffold: PROJECT_DIR now defaults to process.cwd() (the user's
  workspace) instead of the npx cache path, and @pacaf/scripts +
  @pacaf/agent-instructions version specifiers changed from ^1.0.0 (never
  published) to ^3.0.0. Closes #25.

## 3.0.1

### Patch Changes

- 2392b00: Use `pnpm publish -r` for release so workspace specifiers (`workspace:*`) get rewritten to actual published versions. Previously `changeset publish` (despite detecting pnpm) shipped the literal `workspace:*` strings, which broke `npm install` of the published packages with `EUNSUPPORTEDPROTOCOL`.

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

### Patch Changes

- acdc945: Fix cross-package imports that used relative paths (`../../scripts/...`) which only resolved inside the monorepo. Now use package-name imports (`@pacaf/scripts/detect-agent.mjs`, `@pacaf/wizard/lib/shell.mjs`) with proper runtime dependency declarations.

  Also: `@pacaf/wizard-ux` server no longer imports `vite` at top-level (it's a devDep). Vite is only loaded dynamically when `WIZARD_UX_DEV=1` or `NODE_ENV=development`; otherwise it serves the prebuilt `dist/` directly. This fixes "Cannot find package 'vite'" when end users install the published package.

- Updated dependencies [acdc945]
  - @pacaf/scripts@3.0.0
  - @pacaf/agent-instructions@3.0.0

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
