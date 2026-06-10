# @pacaf/wizard-ux

## 3.6.8

### Patch Changes

- ab449b0: Stop showing false "finished with warnings" banners on successful wizard steps.

  The step UI previously treated **any** line a subprocess wrote to stderr as a
  warning. But git, npm, vitest, and pac all write normal progress to stderr, so
  steps that fully succeeded (scaffold, environments) still surfaced a yellow
  "some items need attention" banner and an agent-triage prompt — telling users
  to investigate things that didn't actually go wrong.

  Warnings are now determined by intent, not by which OS pipe a line came from:
  each log line carries an explicit `level` (`info` | `warn` | `error`), and only
  `log.warn` / `log.fail` raise the banner. Benign subprocess stderr stays
  informational.

  Also downgraded the optional **Dataverse Python SDK** prerequisite check from a
  warning to an informational note — it's installed on demand by `dv-connect`, so
  its absence shouldn't tell users to `pip install` something they don't need yet.

## 3.6.7

### Patch Changes

- 21e0279: Permanently fix the recurring "Could not finalize the auth profile" failure at the Environments step. The previous fix (#110) pruned duplicate profiles _after_ retargeting the discovery profile onto Dev — by then the discovery profile already shared the same (user, environment, tenant) key as any leftover profile, forming the ambiguous auth store that crashes both `pac auth delete` and `pac auth name`. The cleanup now runs **before** `pac env select`, while keys are still distinct, and also removes any leftover profile already holding the target name. The discovery index is re-resolved against the live store (no out-of-range cached-index fallback), finalize is verified by re-listing, and pac's real error text (written to stdout) is now surfaced instead of the generic `Command failed: …` wrapper that previously shadowed it.

## 3.6.6

### Patch Changes

- Updated dependencies [d2950c1]
  - @pacaf/wizard@3.4.9

## 3.6.5

### Patch Changes

- 4bfebc2: Step 6 (Solution & Publisher) now only offers "+ Create new solution" when authenticating with a service principal, which can create solutions via the Dataverse API. User-auth sessions no longer see the option (and the unreachable manual create-and-enter-details flow was removed); they create the solution in the Maker Portal and paste its URL instead.
  - @pacaf/wizard@3.4.8

## 3.6.4

### Patch Changes

- 33bb1dc: Harden the Environments step against the "Could not finalize the auth profile" crash. Before renaming the discovery profile, the wizard now prunes stale same-user duplicate `pac` auth profiles that trigger an upstream pac CLI bug ("Sequence contains more than one matching element"), and surfaces an actionable `pac auth clear` remediation when the auth store is still corrupted. Closes #102.

## 3.6.3

### Patch Changes

- @pacaf/wizard@3.4.7

## 3.6.2

### Patch Changes

- @pacaf/wizard@3.4.6

## 3.6.1

### Patch Changes

- 0e51561: Add an "Ask your coding agent" helper banner that appears on any wizard step
  when it errors out or completes with warnings. The banner explains what
  commonly goes wrong for that specific step and provides a copy-to-clipboard
  prompt the user can paste back to their coding agent for help — covering
  prereqs (Node/.NET/Python/PAC/Dataverse plugin), auth, env selection,
  publisher prefix, scaffold, connector binding, and build/deploy.

## 3.6.0

### Minor Changes

- ee6dbb1: Re-architect the Wizard UX setup flow around the Dataverse-skills plugin and auth-first environment discovery.

  - Prerequisites step now detects the Dataverse-skills plugin (filesystem + config) and the Python SDK, surfacing plain-language, agent-branched (Copilot CLI / Claude) copy-paste install steps; the missing plugin is a blocking failure.
  - Removed the pasted `PP_ENV_DEV/TEST/PROD` URL inputs. Authentication now signs in at the tenant level first, then a new environment-discovery step runs `pac env list` and presents Dev/Test/Prod pickers from the results (human-readable environment names — no GUIDs shown). Steps were renumbered (old 5–10 → 6–11; the loader now exposes 11 sequential steps).
  - Connector and scaffold step log messages now direct Dataverse table registration through `dv-metadata` + `pac code add-data-source` (the `register:dataverse` npm script is gone).

### Patch Changes

- Updated dependencies [ee6dbb1]
  - @pacaf/wizard@3.4.5

## 3.5.2

### Patch Changes

- 4649254: Fix: clicking **Finish** on the manual "Add app to solution" step (Step 10) now marks the step complete before navigating to the Summary, so the Summary recognizes setup as done and renders the launch card with the deployed **App URL**. Previously the manual step had no `apply()` to persist `COMPLETED_STEP`, so `completed` stayed at 9 while `totalSteps` was 10 — the Summary read `isDone=false` and showed an "in progress / Continue setup" page instead of the App URL.

## 3.5.1

### Patch Changes

- bb66ce0: Make Dataverse binding mandatory and functional in the connector step. Previously the wizard's Dataverse toggle was a silent no-op — it never prompted for a connection, never read the planned tables, and never ran `pac code add-data-source`, so a scaffolded Code App started with no Dataverse data source. Dataverse is no longer an opt-in connector: the wizard now always binds it from the environment URL captured in the project/env step and registers every planned table via `pac code add-data-source -a dataverse -t <table>` (or defers to `npm run register:dataverse` when it cannot register inline). Closes #95.
- Updated dependencies [bb66ce0]
  - @pacaf/wizard@3.4.4

## 3.5.0

### Minor Changes

- 76f5a53: Add a required manual "Add app to solution" step (step 10) to the WizardUX. After deploy, the wizard now guides users through adding their Code app to the target solution in the Maker Portal — with a direct deep link to the solution, an inline illustration of the **Add existing → App → Code app** menu, and an explicit reminder to switch the picker to the **Outside Dataverse** filter and search for the app by name. The deploy step (step 9) no longer auto-advances, so users can read the `pac code push` log before continuing.

## 3.4.3

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

- Updated dependencies [076d4a6]
  - @pacaf/wizard@3.4.3

## 3.4.2

### Patch Changes

- 122def8: Deploy step now follows the documented `pac code push` golden path exactly and stops attempting post-push solution repair.

  The first `pac code push -s <UNIQUE name>` (the CREATE) both creates the `canvasapp` record and adds it to the chosen solution in one shot — that single command is the whole fix. The previous post-push "ensure membership" machinery (`ensureAppInSolution` / `manualSolutionAddSteps` / the shared `solution-membership.mjs` lib / `solution add-solution-component` / `-ct 300`) was built on the disproven belief that the flow couldn't solution-bind in one push, so it has been removed from both deploy-step copies and deleted.

  The CLI copy (`@pacaf/wizard`) no longer warns-and-pushes-bare when no solution unique name is available — it now **refuses** the push, matching the WizardUX copy. A bare first push creates the Code App outside any solution, which no later `-s` re-push (an ignored UPDATE) can fix, so both copies now hard-stop and tell you to re-run the solution step. The deploy-step parity test was updated to pin the bare-push refusal and to ban the removed repair helpers from ever returning.

- Updated dependencies [122def8]
  - @pacaf/wizard@3.4.2

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
  - @pacaf/wizard@3.4.1

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
  - @pacaf/wizard@3.4.0

## 3.3.10

### Patch Changes

- 22258bf: Fix scaffold install failure on pnpm caused by the `--prefer-online` cache-busting flag.

  The previous freshness fix passed `--prefer-online` to the package manager during all three install stages. That flag is **npm-only** — pnpm (the wizard's preferred installer) aborts with `Unknown option: 'prefer-online'`, so every install stage failed and fresh scaffolds ended up with no `node_modules` (e.g. `vitest: command not found` during smoke tests).

  The flag is removed from both wizards. First-party freshness is now guaranteed in a manager-agnostic way: `freshDevPackageSpecs()` / `resolveFirstPartyLatest()` resolve the exact latest published version of `@pacaf/scripts` and `@pacaf/agent-instructions` at scaffold time via `npm view <pkg> version --prefer-online` and pin that exact semver into the install spec. An exact version can never be served stale from a warm store, so both pnpm and npm always install the newest published `@pacaf/*` release. Falls back to the `latest` tag if the registry lookup fails (offline scaffolds still work).

- Updated dependencies [22258bf]
  - @pacaf/wizard@3.3.11

## 3.3.9

### Patch Changes

- fb2f27d: Scaffold installs now always pull the latest published `@pacaf/*` packages (cache-proof).

  Both scaffolders pin the first-party dev deps (`@pacaf/scripts`, `@pacaf/agent-instructions`) to the `latest` dist-tag, but `latest` is resolved from the package manager's **cached packument** (registry metadata). With a warm pnpm/npm store, that metadata could be stale, so a fresh scaffold would install a previous `@pacaf/*` release even though a newer one was published — the "Already up to date" trap that left a new repo on an old `@pacaf/scripts` (and therefore an old in-repo `pac-safe` deploy guard).

  Both install paths (CLI `@pacaf/wizard` `steps/07-scaffold.mjs` and browser `@pacaf/wizard-ux` `server/steps/07-scaffold.mjs`) now pass `--prefer-online` on every `install` / `add`. This forces pnpm and npm to revalidate registry metadata before resolving `latest`, guaranteeing every newly scaffolded repo picks up the newest published capabilities with no manual cache busting.

- Updated dependencies [fb2f27d]
  - @pacaf/wizard@3.3.10

## 3.3.8

### Patch Changes

- 6a74bfb: Don't block deploys on the post-push solution-membership cross-check (issue #81).

  The documented contract ([Microsoft Learn — ALM for code apps](https://learn.microsoft.com/power-apps/developer/code-apps/how-to/alm)) is `pac code push --solutionName <SolutionUniqueName>` — association happens as part of that push, which both deploy steps already enforce. The follow-up export-based membership cross-check (`pac solution export` + Canvas App component count) is **informational only** and must never fail a legitimate deploy: a clean export with zero Canvas App components is not an authoritative orphan signal. Both deploy steps (CLI `@pacaf/wizard` and browser `@pacaf/wizard-ux`) now downgrade an `absent` verdict to a Maker Portal hint — "Solutions → \<name\> → Add existing → App → Code app" — instead of throwing or aborting the push.

- Updated dependencies [6a74bfb]
  - @pacaf/wizard@3.3.9

## 3.3.7

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
- Updated dependencies [83f2d16]
  - @pacaf/wizard@3.3.8

## 3.3.6

### Patch Changes

- 76233bf: Apply the issue #81 solution-association fix to the **browser** wizard's Step 9.

  The #81 fix landed in the CLI wizard (`@pacaf/wizard`), `@pacaf/scripts`, and
  the agent instructions, but the browser wizard — `npx @pacaf/wizard-ux@latest`,
  the default and recommended scaffolder — runs its **own** copy of Step 9 at
  `server/steps/09-verify-deploy.mjs`, which the original fix missed. That copy
  still pushed with the friendly **display name** (`pac code push -s "AI PMO"`,
  which silently no-ops and leaves the Code App outside its solution) and still
  ran the broken `solution add-solution-component -ct 300` fallback with the
  play-URL appId (always "...because it does not exist").

  The browser Step 9 now mirrors the CLI wizard exactly:

  - pushes with the solution **unique** name (`state.SOLUTION_UNIQUE_NAME`), never
    the display name;
  - refuses to run a bare `pac code push` (throws with a clear message) when no
    unique name is resolvable, instead of silently creating an orphaned app;
  - replaces `addAppToSolution()` (the broken `-ct 300` component add) with
    `verifyAppInSolution()`, which confirms the solution exists and guides
    recovery (delete the orphan, re-push with `-s <unique>`) rather than
    attempting an impossible retroactive association.

## 3.3.5

### Patch Changes

- Updated dependencies [0affcdd]
  - @pacaf/wizard@3.3.7

## 3.3.4

### Patch Changes

- @pacaf/wizard@3.3.6

## 3.3.3

### Patch Changes

- Updated dependencies [937227c]
  - @pacaf/wizard@3.3.5

## 3.3.2

### Patch Changes

- b680dc4: Fix Step 7 scaffold failing when the target directory is a pnpm workspace root. Three fixes for issue #76:

  - **Detect pnpm workspace roots.** When `pnpm-workspace.yaml` is present at (or above) the project directory, `pnpm add` aborts with `ERR_PNPM_ADDING_TO_ROOT`, silently skipping the runtime `[2/3]` and dev `[3/3]` installs. The wizard now passes `-w` / `--workspace-root` to the `pnpm add` commands in that case (both the CLI wizard and the browser wizard-ux) and warns the user.
  - **Add `@fluentui/react-icons` to the runtime dependency list.** The generated `src/App.tsx` imports icons from it, but it was never installed — the smoke test failed with `Failed to resolve import "@fluentui/react-icons"` even in non-workspace directories.
  - **Pre-approve pnpm-blocked build scripts.** The generated `package.json` now declares `pnpm.onlyBuiltDependencies` (`esbuild`, `keytar`, `node-pty`, `@azure/msal-node-*`) so installs no longer require the interactive `pnpm approve-builds` step for Vite's bundler and PAC auth credential storage.

- Updated dependencies [b680dc4]
  - @pacaf/wizard@3.3.4

## 3.3.1

### Patch Changes

- @pacaf/wizard@3.3.3

## 3.3.0

### Minor Changes

- 33b2501: Add an `advanced: true` flag on wizard questions, and render flagged questions inside a collapsed **Advanced options** accordion at the bottom of the step form.

  Applied to step 7 (Scaffold the Code App): the **Project path** field stays visible, while **Continue if directory not empty**, **Git remote URL**, and **Push to remote** are now hidden by default so users can power through with just the path. Any step can opt into the same treatment by adding `advanced: true` to a question definition.

## 3.2.2

### Patch Changes

- @pacaf/wizard@3.3.2

## 3.2.1

### Patch Changes

- @pacaf/wizard@3.3.1

## 3.2.0

### Minor Changes

- 06c137d: Own the starter payload: stop fetching from `microsoft/PowerAppsCodeApps/templates/starter` via `degit`. Both the CLI wizard (`@pacaf/wizard`) and the browser wizard (`@pacaf/wizard-ux`) now write the entire starter project locally via `createMinimalProject` + `writeConfig` + `writeStarterFiles`.

  Why: the upstream template was reshaped from a minimal scaffold into a full setup-wizard app of its own (xterm, an embedded terminal, a question runner, `src/router.tsx` using `createBrowserRouter`, `verbatimModuleSyntax` strict imports, dependencies we never merged). Every reshape leaked surplus files into fresh scaffolds and broke the build (`@fluentui/react-icons` not found, `@xterm/xterm` not found, etc.). Issues #47 and #63 patched the two most visible symptoms; this change removes the entire class of bug by no longer being downstream of a moving target. The `templates/starter/` directory in PAppsCAFoundations stays as documentation only — the wizard does not fetch it.

  Also removes the now-unreachable `src/router.tsx` scrub from `writeStarterFiles`, and updates `01-scaffold.instructions.md` to recommend the wizard instead of `npx degit microsoft/...`.

### Patch Changes

- Updated dependencies [06c137d]
  - @pacaf/wizard@3.3.0

## 3.1.2

### Patch Changes

- Updated dependencies [32f4eba]
  - @pacaf/wizard@3.2.2

## 3.1.1

### Patch Changes

- @pacaf/wizard@3.2.1

## 3.1.0

### Minor Changes

- e023520: Add configuration export/import to the wizard.

  A new Settings menu in the wizard header lets developers download the current project's reusable configuration as a JSON file and import it into a new project. The seed includes publisher identity, environment URLs, auth-profile choice, 1Password references (no secrets), coding agent, and connector selection — but explicitly excludes secrets, tenant/client IDs, deferred flags, and any key matching a secret-like name. Imports support `merge` (only fill empty values) and `replace-allowlisted` modes, show a preview before applying, warn when environment URLs differ, and refuse seeds from a newer schema version.

### Patch Changes

- Updated dependencies [f63d585]
  - @pacaf/wizard@3.2.0

## 3.0.13

### Patch Changes

- bb43c0d: Step 7 (Scaffold): make long `npm install` runs feel alive. Each install now prints stage banners (`[1/3]`, `[2/3]`, `[3/3]`), uses `--loglevel=http --no-audit --no-fund` so npm streams one line per package fetch in non-TTY mode, and prefers `pnpm` (with `--reporter=append-only`) when it is on PATH for materially faster cold installs. The wizard-ux LiveLog now shows an elapsed-time footer while a step is running and swaps to "Still working — waiting on npm / network…" after 20s of silence so users no longer mistake a slow registry call for a hung wizard. Closes #43.
- 61b598b: Default the deployed-app URL to `?hideNavBar=true` so every Code App built from this template hides the Power Apps "purple bar" by default. The wizard appends `hideNavBar=true` when capturing the deployed URL from `pac code push` output, the state API normalizes any pre-existing URL when surfacing it to the Summary page, and `.github/instructions/04-deployment.instructions.md` now promotes the flag from "checklist item" to "default appended". Closes #44.
- Updated dependencies [bb43c0d]
- Updated dependencies [61b598b]
- Updated dependencies [0aa64f2]
- Updated dependencies [a1de977]
  - @pacaf/wizard@3.1.5

## 3.0.12

### Patch Changes

- d86b0d9: Step 7 (Scaffold): show an info banner while `pac code init` is running, letting users know that scaffolding can take a few minutes and asking them to keep the tab open and maintain their network/VPN connection. Closing the tab, sleeping the machine, or dropping the network mid-run can interrupt PAC CLI auth and leave the scaffold in an incomplete state — the banner heads that off before users assume the wizard has hung.

## 3.0.11

### Patch Changes

- @pacaf/wizard@3.1.4

## 3.0.10

### Patch Changes

- @pacaf/wizard@3.1.3

## 3.0.9

### Patch Changes

- @pacaf/wizard@3.1.2

## 3.0.8

### Patch Changes

- 68e77a2: Fix Python 3 detection false negative on Windows caused by Microsoft Store
  App Execution Alias stub. When `python3` resolves to the WindowsApps stub
  it exits non-zero and returns no valid version string. The probe now
  validates that the command output starts with "Python 3" before accepting
  it, and falls through a priority list: python3 → python → py (Windows-only
  py launcher). Windows-specific error messages guide users to either add
  python.exe to PATH or disable the Store alias. Closes #37.

## 3.0.7

### Patch Changes

- Updated dependencies [60fd6dd]
  - @pacaf/wizard@3.1.1

## 3.0.6

### Patch Changes

- e582caa: Fix ROOT_DIR → PACKAGE_DIR / PROJECT_DIR split across all wizard-ux step
  files. Under npx, \_\_dirname resolves into the npx cache, so using it as
  rootDir for PAC profile names, .env file paths, and command cwd caused
  Step 4 to create auth profiles under a cache-derived name that Step 7
  could not find ("Required repo-scoped PAC profile does not exist").

  All step files now use:

  - PACKAGE_DIR (= \_\_dirname/../../..) for locating sibling @pacaf/wizard
    lib imports (correct, must stay cache-relative)
  - PROJECT_DIR (= process.cwd()) for all project-facing operations:
    profile names, .env/.env.local/.env.template paths, git hooks, and
    command working directories

  Closes #32.

## 3.0.5

### Patch Changes

- 31a0473: Sort solution dropdown A→Z by display name (case-insensitive) so the list
  is predictable regardless of solution creation order or environment size.
  Closes #30.

## 3.0.4

### Patch Changes

- 5bc8883: Fix wizard-ux sharing state across projects when launched via npx.

  ROOT_DIR in server/index.mjs resolved to the npx cache parent directory
  (a fixed path on the machine) instead of the user's project directory.
  Every project launched with `npx @pacaf/wizard-ux@latest` was reading and
  writing the same .wizard-state.json, so a second project would immediately
  load the first project's answers.

  Fix: ROOT_DIR = process.cwd() — always the directory the user launched the
  wizard from. UX_DIR (used to locate the dist/ bundle) remains \_\_dirname-relative
  and is unchanged. Closes #28.

## 3.0.3

### Patch Changes

- a6bdab6: Fix Maker Portal `/e/` shorthand URL (Step 5) and Step 3 1Password vault/item
  dropdown UX (load without refresh, persist toggle/vault/item across refresh).
  Closes #17, #18, and ships those fixes that were merged in `24b9423` but missed
  the `3.0.2` cut — see #19.
- 94dc210: Switch Step 5 `pac env fetch` calls from `--xml` (inline FetchXML) to
  `--xmlFile` (temp file) to avoid `System.Xml.XmlException` on macOS PAC CLI
  2.2.1+ where inline XML attribute quotes get corrupted. Closes #23.
- 8fb8c06: Rewrite Step 5 `pac env fetch` parsing to use a single joined FetchXML query
  with `<link-entity>` and a proper column-position-based tabular output parser.
  Fixes publisher prefix always showing `(?_)` and eliminates the N+1
  per-solution fetch loop that caused ~50 s load times. Closes #24.
- 5865299: Fix Step 7 scaffold: PROJECT_DIR now defaults to process.cwd() (the user's
  workspace) instead of the npx cache path, and @pacaf/scripts +
  @pacaf/agent-instructions version specifiers changed from ^1.0.0 (never
  published) to ^3.0.0. Closes #25.
- 8233f43: Strip trailing punctuation (comma, period, semicolon, etc.) from URLs rendered
  as links in `QuestionCard` help/why text, and from pasted Solution URLs before
  GUID extraction. Fixes the broken `/solutions/{guid},` link in Step 5.
  Closes #22.
- Updated dependencies [5354bad]
- Updated dependencies [5865299]
  - @pacaf/wizard@3.1.0

## 3.0.2

### Patch Changes

- f3efbdb: Fix SPA refresh on deep routes (e.g. /step/3) returning a blank page with MIME type error. Changed Vite `base` from `'./'` to `'/'` so asset URLs resolve correctly regardless of the current route path. Fixes #9.

## 3.0.1

### Patch Changes

- 2392b00: Use `pnpm publish -r` for release so workspace specifiers (`workspace:*`) get rewritten to actual published versions. Previously `changeset publish` (despite detecting pnpm) shipped the literal `workspace:*` strings, which broke `npm install` of the published packages with `EUNSUPPORTEDPROTOCOL`.
- Updated dependencies [2392b00]
  - @pacaf/wizard@3.0.1

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
- Updated dependencies [acdc945]
  - @pacaf/wizard@3.0.0

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
