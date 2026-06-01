---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
---

Scaffold installs now always pull the latest published `@pacaf/*` packages (cache-proof).

Both scaffolders pin the first-party dev deps (`@pacaf/scripts`, `@pacaf/agent-instructions`) to the `latest` dist-tag, but `latest` is resolved from the package manager's **cached packument** (registry metadata). With a warm pnpm/npm store, that metadata could be stale, so a fresh scaffold would install a previous `@pacaf/*` release even though a newer one was published — the "Already up to date" trap that left a new repo on an old `@pacaf/scripts` (and therefore an old in-repo `pac-safe` deploy guard).

Both install paths (CLI `@pacaf/wizard` `steps/07-scaffold.mjs` and browser `@pacaf/wizard-ux` `server/steps/07-scaffold.mjs`) now pass `--prefer-online` on every `install` / `add`. This forces pnpm and npm to revalidate registry metadata before resolving `latest`, guaranteeing every newly scaffolded repo picks up the newest published capabilities with no manual cache busting.
