---
"@pacaf/agent-instructions": patch
---

Fix prerequisite gate so it stops blocking "run the wizard" when the cwd happens to be the PACAF monorepo source tree.

The previous Step 7 trigger was "is the cwd the source tree?" — which fired even when the user just said "run the wizard" (intent: `npx @pacaf/wizard-ux@latest`, a self-contained published artifact that does not need the local workspace built). Agents stopped users with a `🛑 Monorepo source tree — workspace not ready` block and demanded `pnpm install` + build before doing anything, even though those steps were irrelevant to the user's actual command.

Step 7 now fires **only** when the user has explicitly typed a source-tree invocation (`pnpm --filter @pacaf/...`, `node packages/...`, etc.). For any `npx @pacaf/...` invocation — or any natural-language "run the wizard" request — the agent goes straight to `npx @pacaf/wizard-ux@latest` regardless of cwd.

Updated: `00-prereq-gate.instructions.md` (canonical), `.claude/rules/prereq-gate.md` (projection), `AGENTS.md` (root contract).
