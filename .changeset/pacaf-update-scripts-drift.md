---
"@pacaf/scripts": patch
---

`pacaf-update --check` now also reports `@pacaf/scripts` version drift. It compares the locally installed version against the latest published version and prints whether it is up to date, drifted, not installed, or unreachable — alongside the existing `@pacaf/agent-instructions` check.
