# @pacaf/wizard

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
