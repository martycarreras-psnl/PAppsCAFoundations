---
"@pacaf/agent-instructions": patch
"@pacaf/scripts": patch
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
---

Fix Code App not being associated with its solution on deploy (issue #81). A
by-the-book deploy ran a bare `pac code push`, which silently created the app
**outside** its solution — PAC prints `App pushed successfully` even though the
app never becomes a solution component, and a later `-s` re-push cannot
retroactively fix it.

- `@pacaf/scripts` `pac-safe.mjs` now hardens `code push`: it forces a user
  auth profile (BAP rejects SPN tokens), injects `-s <SolutionUniqueName>` from
  a new `--solution-name` flag / `PP_SOLUTION_UNIQUE_NAME` / wizard state, and
  refuses to run a bare push (exits non-zero with a clear message) when no
  unique name can be resolved.
- `@pacaf/scripts` `sync-foundations.mjs` preserves any `--solution-name`
  already baked into the project's `deploy` script when re-syncing.
- `@pacaf/wizard` `scaffold-foundations.mjs` bakes the solution unique name into
  the generated `deploy` script via `--solution-name`, and Step 9
  (`09-verify-deploy.mjs`) now passes the solution **unique** name (not the
  friendly display name) to `pac code push -s`, replaces the broken
  `add-solution-component -ct 300` fallback with a verification + recovery gate,
  and removes every bare-push fallback hint.
- `@pacaf/wizard-ux` carried a **second, independent copy** of Step 9
  (`server/steps/09-verify-deploy.mjs`) that the browser wizard
  (`npx @pacaf/wizard-ux@latest`, the default scaffolder) actually executes. It
  still pushed with the friendly **display name** and still ran the broken
  `add-solution-component -ct 300` fallback, so the fix never reached the most
  common deploy path. It now mirrors the CLI wizard exactly: push with the
  solution **unique** name, refuse a bare push when no unique name is resolvable,
  and verify solution membership instead of attempting the broken component add.
- `@pacaf/agent-instructions`: `01-scaffold`, `04-deployment`, and
  `00-environment-setup` drop the false "init registers the app in the active
  solution context" claim and replace all bare `pac code push` examples with
  `pac code push -s "<SolutionUniqueName>"`, documenting the first-push-critical
  and unique-vs-display-name rules.
