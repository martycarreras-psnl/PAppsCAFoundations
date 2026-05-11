# @pacaf/wizard-ux

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
