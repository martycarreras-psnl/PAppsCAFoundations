---
'@pacaf/wizard-ux': patch
---

Fix wizard-ux sharing state across projects when launched via npx.

ROOT_DIR in server/index.mjs resolved to the npx cache parent directory
(a fixed path on the machine) instead of the user's project directory.
Every project launched with `npx @pacaf/wizard-ux@latest` was reading and
writing the same .wizard-state.json, so a second project would immediately
load the first project's answers.

Fix: ROOT_DIR = process.cwd() — always the directory the user launched the
wizard from. UX_DIR (used to locate the dist/ bundle) remains __dirname-relative
and is unchanged. Closes #28.
