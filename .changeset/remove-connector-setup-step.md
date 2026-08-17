---
'@pacaf/wizard-ux': minor
'@pacaf/wizard': minor
'@pacaf/agent-instructions': minor
'@pacaf/scripts': patch
---

Remove connector binding from the setup wizard entirely. Connector selection was a
setup step (browser Step 9, CLI Step 8) even though it is phase 7 of the
prototype-first golden path — and it could not be answered correctly at that point:
there is no stable planning payload yet, no prototype, and a freshly created
environment normally has **zero** connections to choose from. Users read a numbered
step as a chore, turned off the (correctly defaulted) "keep binding deferred" toggle,
and pasted connection IDs that did not exist in the target environment. The Dataverse
half of the step was a guaranteed no-op as well, since it reads a
`dataverse/register-datasources.plan.json` that only planning can produce.

- **Browser wizard is now 10 steps** (was 11): Verify & Deploy moves 10 → 9 and
  Add App to Solution moves 11 → 10.
- **CLI wizard is now 9 steps** (was 10): Build/Verify/Deploy moves 9 → 8 and
  Dataverse-skills Plugin moves 10 → 9.
- In-flight setups are migrated automatically. `.wizard-state.json` gains a
  `WIZARD_STEP_SCHEMA` marker; a v1 `COMPLETED_STEP` of 9 or higher shifts down by
  one so nobody skips deploy. The CLI wizard's `WIZARD_VERSION` bumps to 5.
- The Summary page gains a "What's next" section spelling out plan → prototype →
  provision → connect, and stating that Dataverse is already bound at the
  environment level.
- Scaffold output, deploy output, and the `01-scaffold` / `00-before-you-start`
  instruction files now point at the Code Apps plugin (`/add-datasource`) or
  `pac code add-data-source` instead of a wizard step.

Also adds a `pnpm` presence check to the contributor-only source-tree gate in
`00-prereq-gate.instructions.md` (Step 7). The gate previously assumed `pnpm` was
already on PATH and jumped straight to `pnpm install`, which fails confusingly when
it is not — and `corepack` cannot always self-provision it on a restricted or
offline network. The gate now checks `pnpm` first, points at the version pinned in
the root `packageManager` field, and states explicitly that `pnpm` is **not** a
general prerequisite: consumers running `npx @pacaf/wizard-ux@latest` never need it,
because the scaffold falls back to `npm` when `pnpm` is absent.
