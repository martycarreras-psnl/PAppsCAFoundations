---
'@pacaf/wizard-ux': patch
---

Strip trailing punctuation (comma, period, semicolon, etc.) from URLs rendered
as links in `QuestionCard` help/why text, and from pasted Solution URLs before
GUID extraction. Fixes the broken `/solutions/{guid},` link in Step 5.
Closes #22.
