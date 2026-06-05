---
"@pacaf/agent-instructions": minor
---

Make the planning-phase grilling cadence (00e-grill-and-document) always-on so
brand-new projects, which have no source files for `applyTo` globs to match,
actually pick it up. Adds `applyTo: "**"` to the canonical instruction file,
flips the Cursor projection to `alwaysApply: true`, adds a manifest entry for
00e, inlines the cadence rules into `.github/copilot-instructions.md`, and
strengthens the directive in `AGENTS.md` so coding agents can't silently fall
back to a structured questionnaire during a freeform "describe your app idea"
conversation.
