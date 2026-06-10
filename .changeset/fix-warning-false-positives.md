---
"@pacaf/wizard-ux": patch
---

Stop showing false "finished with warnings" banners on successful wizard steps.

The step UI previously treated **any** line a subprocess wrote to stderr as a
warning. But git, npm, vitest, and pac all write normal progress to stderr, so
steps that fully succeeded (scaffold, environments) still surfaced a yellow
"some items need attention" banner and an agent-triage prompt — telling users
to investigate things that didn't actually go wrong.

Warnings are now determined by intent, not by which OS pipe a line came from:
each log line carries an explicit `level` (`info` | `warn` | `error`), and only
`log.warn` / `log.fail` raise the banner. Benign subprocess stderr stays
informational.

Also downgraded the optional **Dataverse Python SDK** prerequisite check from a
warning to an informational note — it's installed on demand by `dv-connect`, so
its absence shouldn't tell users to `pip install` something they don't need yet.
