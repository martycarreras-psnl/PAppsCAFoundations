---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
---

Fix scaffold install failure on pnpm caused by the `--prefer-online` cache-busting flag.

The previous freshness fix passed `--prefer-online` to the package manager during all three install stages. That flag is **npm-only** — pnpm (the wizard's preferred installer) aborts with `Unknown option: 'prefer-online'`, so every install stage failed and fresh scaffolds ended up with no `node_modules` (e.g. `vitest: command not found` during smoke tests).

The flag is removed from both wizards. First-party freshness is now guaranteed in a manager-agnostic way: `freshDevPackageSpecs()` / `resolveFirstPartyLatest()` resolve the exact latest published version of `@pacaf/scripts` and `@pacaf/agent-instructions` at scaffold time via `npm view <pkg> version --prefer-online` and pin that exact semver into the install spec. An exact version can never be served stale from a warm store, so both pnpm and npm always install the newest published `@pacaf/*` release. Falls back to the `latest` tag if the registry lookup fails (offline scaffolds still work).
