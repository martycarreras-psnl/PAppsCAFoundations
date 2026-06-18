---
"@pacaf/wizard-ux": patch
---

Stop more false "finished with warnings" banners on successful wizard steps.

A follow-up to the earlier stderr-level fix — three remaining sources still
flagged fully-successful steps as needing attention:

- **Environments step:** the routine cleanup of leftover auth profiles from a
  prior run was logged at `warn`. Pruning a stale profile is expected
  self-healing, so it now logs at `info`. A genuine failure to remove a profile
  still warns.
- **Scaffold step:** subprocess **stderr** (pnpm, npm, git, pac) was logged at
  `warn` in both the `runCommand` and `runFile` helpers. These tools write
  normal progress, update notices, and deprecation warnings to stderr, so a
  successful install raised the banner. Subprocess stderr is now `info`; genuine
  failure is still detected from the non-zero exit code.
- **Scaffold step:** **pnpm v11 exits non-zero on `ERR_PNPM_IGNORED_BUILDS`**
  even when the build scripts are pre-approved in `package.json` — the install
  itself still completes. That specific benign exit is now treated as success
  instead of surfacing a false "Base dependency install reported errors"
  warning. Any other non-zero exit remains a real failure.
