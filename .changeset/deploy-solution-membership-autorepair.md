---
"@pacaf/wizard": minor
"@pacaf/wizard-ux": minor
"@pacaf/scripts": patch
---

Deploy step: read Code App ↔ solution membership from Dataverse and auto-repair (#81)

The "Verify & Deploy" step now reliably confirms a deployed Code App is a
component of the selected solution and **adds it automatically** when it is not —
for both first (CREATE) and subsequent (UPDATE) pushes, and for both user and
service-principal auth profiles.

What changed and why:

- **Authoritative read via `pac org fetch`.** The previous membership check
  exported the solution with a malformed `pac solution export --managed false`
  (`--managed` is a boolean switch, so `false` was a stray token) and counted
  type-300 components from the zip. That produced false negatives, which is why
  the check had been demoted to non-blocking — leaving apps silently orphaned.
  Membership is now read from the `solutioncomponent` table via FetchXML, which
  runs under the active auth profile (no client secret), so it works for **user
  and SPN** profiles alike.

- **Automatic repair via `pac solution add-solution-component`.** The appId in
  `power.config.json` is the same GUID as the `canvasapp` record
  (`canvasappid` — verified), so the existing app can be added to the solution
  after the fact. The old #81 belief that this required a different GUID (and the
  only remedy was delete + recreate) was incorrect; the delete/recreate dead-end
  is removed. The rare manual fallback now guides an "Add existing → App → Code
  app" flow that preserves the app's appId and URL.

- **Shared logic, enforced parity.** Read + repair live solely in
  `packages/wizard/lib/solution-membership.mjs` (`checkAppInSolution`,
  `addAppToSolution`, `ensureAppInSolution`, `buildMembershipFetchXml`,
  `manualSolutionAddSteps`). Both deploy-step copies (CLI `@pacaf/wizard` and
  browser `@pacaf/wizard-ux`) call the shared `ensureAppInSolution` after the
  push. The deploy-step parity guard and the membership unit tests were updated
  accordingly.
