---
'@pacaf/wizard-ux': patch
---

Fix ROOT_DIR → PACKAGE_DIR / PROJECT_DIR split across all wizard-ux step
files. Under npx, __dirname resolves into the npx cache, so using it as
rootDir for PAC profile names, .env file paths, and command cwd caused
Step 4 to create auth profiles under a cache-derived name that Step 7
could not find ("Required repo-scoped PAC profile does not exist").

All step files now use:
- PACKAGE_DIR (= __dirname/../../..) for locating sibling @pacaf/wizard
  lib imports (correct, must stay cache-relative)
- PROJECT_DIR (= process.cwd()) for all project-facing operations:
  profile names, .env/.env.local/.env.template paths, git hooks, and
  command working directories

Closes #32.
