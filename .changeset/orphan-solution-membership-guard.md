---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
"@pacaf/scripts": patch
---

Fix orphaned Code Apps: authoritatively verify solution membership and hard-stop before a doomed push (issue #81).

A Code App's solution membership is written exactly once — on the first `pac code push -s <UNIQUE name>` (the CREATE). Once an `appId` exists, every push is an UPDATE and `-s` is silently ignored, so an app that was first pushed without a valid unique name can never be associated afterward. The old verification only ran `pac solution list` and checked the name appeared, which proves the solution exists but NOT that the app is inside it — a false positive that let apps ship orphaned while the wizard reported success.

- New shared `packages/wizard/lib/solution-membership.mjs`: dependency-free `pac solution export` + Canvas App (type 300) component count gives an authoritative `member` / `absent` / `unknown` membership signal. Imported by BOTH deploy-step copies so they cannot drift.
- Pre-push orphan guard: when an `appId` already exists and a solution is selected, membership is verified BEFORE pushing. If the app is `absent`, the deploy hard-stops with recovery steps instead of wasting an UPDATE that cannot fix the orphan.
- Real post-create verification: after the first push, the app's membership is confirmed by export rather than the false-positive `solution list` check; a create that failed to associate now fails loudly with recovery steps.
- Tests: new `solution-membership.test.mjs` unit tests for the zip reader, component counter, and the three statuses; deploy-step parity test extended to force both copies to keep the shared check, pre-push guard, and recovery steps, and to ban the false-positive `solution list` membership check.
