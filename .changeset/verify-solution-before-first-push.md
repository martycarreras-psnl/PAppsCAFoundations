---
"@pacaf/wizard-ux": patch
"@pacaf/wizard": patch
"@pacaf/scripts": patch
---

Verify the solution exists in the target environment before the first `pac code push`.

Root cause (empirically verified against live Dataverse): `pac code push -s <uniqueName>`
only associates the app with its solution when a solution with that exact **unique name**
already exists in the pushed environment. If it does not, pac **silently** publishes the app
into the Default solution with no error — the recurring "my app isn't in my solution" failure.
This happened whenever the typed solution unique name had a typo, was a display name, or was
never actually created in the Maker Portal.

Both deploy-step copies (CLI `wizard/steps/09-verify-deploy.mjs` and browser
`wizard-ux/server/steps/09-verify-deploy.mjs`) now call a shared
`solutionExistsInSelectedEnv()` precondition on the first push. If the solution is absent the
deploy stops with a precise, actionable message instead of silently orphaning the app; if the
existence check itself cannot run, it warns and proceeds. A parity test pins this invariant in
both copies.

Also: the WizardUX no longer auto-advances to the summary screen when the final Verify & Deploy
step finishes — it stays on step 9 so the deploy log stays readable, with a manual "View summary"
button to continue.
