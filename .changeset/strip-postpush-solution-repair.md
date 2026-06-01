---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
"@pacaf/scripts": patch
---

Deploy step now follows the documented `pac code push` golden path exactly and stops attempting post-push solution repair.

The first `pac code push -s <UNIQUE name>` (the CREATE) both creates the `canvasapp` record and adds it to the chosen solution in one shot — that single command is the whole fix. The previous post-push "ensure membership" machinery (`ensureAppInSolution` / `manualSolutionAddSteps` / the shared `solution-membership.mjs` lib / `solution add-solution-component` / `-ct 300`) was built on the disproven belief that the flow couldn't solution-bind in one push, so it has been removed from both deploy-step copies and deleted.

The CLI copy (`@pacaf/wizard`) no longer warns-and-pushes-bare when no solution unique name is available — it now **refuses** the push, matching the WizardUX copy. A bare first push creates the Code App outside any solution, which no later `-s` re-push (an ignored UPDATE) can fix, so both copies now hard-stop and tell you to re-run the solution step. The deploy-step parity test was updated to pin the bare-push refusal and to ban the removed repair helpers from ever returning.
