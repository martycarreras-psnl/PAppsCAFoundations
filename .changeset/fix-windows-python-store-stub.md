---
'@pacaf/wizard-ux': patch
---

Fix Python 3 detection false negative on Windows caused by Microsoft Store
App Execution Alias stub. When `python3` resolves to the WindowsApps stub
it exits non-zero and returns no valid version string. The probe now
validates that the command output starts with "Python 3" before accepting
it, and falls through a priority list: python3 → python → py (Windows-only
py launcher). Windows-specific error messages guide users to either add
python.exe to PATH or disable the Store alias. Closes #37.
