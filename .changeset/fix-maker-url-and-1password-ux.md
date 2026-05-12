---
'@pacaf/wizard-ux': patch
---

Fix Maker Portal `/e/` shorthand URL (Step 5) and Step 3 1Password vault/item
dropdown UX (load without refresh, persist toggle/vault/item across refresh).
Closes #17, #18, and ships those fixes that were merged in `24b9423` but missed
the `3.0.2` cut — see #19.
