---
"@pacaf/wizard-ux": minor
---

Add configuration export/import to the wizard.

A new Settings menu in the wizard header lets developers download the current project's reusable configuration as a JSON file and import it into a new project. The seed includes publisher identity, environment URLs, auth-profile choice, 1Password references (no secrets), coding agent, and connector selection — but explicitly excludes secrets, tenant/client IDs, deferred flags, and any key matching a secret-like name. Imports support `merge` (only fill empty values) and `replace-allowlisted` modes, show a preview before applying, warn when environment URLs differ, and refuse seeds from a newer schema version.
