---
"@pacaf/agent-instructions": minor
---

Document the agent-instructions publishing flow so coding agents (and forkers) never silently skip the npm release step again.

`10-publishing.instructions.md` now applies whenever any file under `.github/instructions/`, `.claude/rules/`, `.cursor/rules/`, `agent-guidance.config.json`, top-level `AGENTS.md`, top-level `CLAUDE.md`, or `.github/copilot-instructions.md` is edited. The new "Editing Agent Instructions Is Also Publishing" section walks through the full canonical → sync-from-root → changeset → release-PR → npm verify flow, lists mandatory pre-push checks, and documents how downstream forks pick up the change. The top-level `AGENTS.md` adds rule 8 calling out that instruction edits are shipped artifacts and must follow this flow.
