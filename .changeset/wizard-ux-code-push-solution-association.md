---
"@pacaf/wizard-ux": patch
---

Apply the issue #81 solution-association fix to the **browser** wizard's Step 9.

The #81 fix landed in the CLI wizard (`@pacaf/wizard`), `@pacaf/scripts`, and
the agent instructions, but the browser wizard — `npx @pacaf/wizard-ux@latest`,
the default and recommended scaffolder — runs its **own** copy of Step 9 at
`server/steps/09-verify-deploy.mjs`, which the original fix missed. That copy
still pushed with the friendly **display name** (`pac code push -s "AI PMO"`,
which silently no-ops and leaves the Code App outside its solution) and still
ran the broken `solution add-solution-component -ct 300` fallback with the
play-URL appId (always "...because it does not exist").

The browser Step 9 now mirrors the CLI wizard exactly:

- pushes with the solution **unique** name (`state.SOLUTION_UNIQUE_NAME`), never
  the display name;
- refuses to run a bare `pac code push` (throws with a clear message) when no
  unique name is resolvable, instead of silently creating an orphaned app;
- replaces `addAppToSolution()` (the broken `-ct 300` component add) with
  `verifyAppInSolution()`, which confirms the solution exists and guides
  recovery (delete the orphan, re-push with `-s <unique>`) rather than
  attempting an impossible retroactive association.
