---
'@pacaf/wizard-ux': patch
---

Rewrite Step 5 `pac env fetch` parsing to use a single joined FetchXML query
with `<link-entity>` and a proper column-position-based tabular output parser.
Fixes publisher prefix always showing `(?_)` and eliminates the N+1
per-solution fetch loop that caused ~50 s load times. Closes #24.
