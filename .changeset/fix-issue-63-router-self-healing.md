---
'@pacaf/scripts': patch
'@pacaf/wizard': patch
---

Fix #63: BrowserRouter regression when the upstream Microsoft starter template
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
