# @pacaf/scripts

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
