---
'@pacaf/wizard-ux': patch
'@pacaf/wizard': patch
---

Fix Step 7 scaffold: PROJECT_DIR now defaults to process.cwd() (the user's
workspace) instead of the npx cache path, and @pacaf/scripts + 
@pacaf/agent-instructions version specifiers changed from ^1.0.0 (never
published) to ^3.0.0. Closes #25.
