---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
---

Don't block deploys on the post-push solution-membership cross-check (issue #81).

The documented contract ([Microsoft Learn — ALM for code apps](https://learn.microsoft.com/power-apps/developer/code-apps/how-to/alm)) is `pac code push --solutionName <SolutionUniqueName>` — association happens as part of that push, which both deploy steps already enforce. The follow-up export-based membership cross-check (`pac solution export` + Canvas App component count) is **informational only** and must never fail a legitimate deploy: a clean export with zero Canvas App components is not an authoritative orphan signal. Both deploy steps (CLI `@pacaf/wizard` and browser `@pacaf/wizard-ux`) now downgrade an `absent` verdict to a Maker Portal hint — "Solutions → \<name\> → Add existing → App → Code app" — instead of throwing or aborting the push.
