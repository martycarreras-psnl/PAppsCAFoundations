# @pacaf/wizard-ux

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
