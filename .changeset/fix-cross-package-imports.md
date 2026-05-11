---
'@pacaf/wizard': patch
'@pacaf/wizard-ux': patch
---

Fix cross-package imports that used relative paths (`../../scripts/...`) which only resolved inside the monorepo. Now use package-name imports (`@pacaf/scripts/detect-agent.mjs`, `@pacaf/wizard/lib/shell.mjs`) with proper runtime dependency declarations.

Also: `@pacaf/wizard-ux` server no longer imports `vite` at top-level (it's a devDep). Vite is only loaded dynamically when `WIZARD_UX_DEV=1` or `NODE_ENV=development`; otherwise it serves the prebuilt `dist/` directly. This fixes "Cannot find package 'vite'" when end users install the published package.
