---
'@pacaf/agent-instructions': patch
---

Prerequisite gate now detects when the agent is working inside the PACAF
monorepo source tree (vs a downstream Code App) and gates source-tree wizard /
scripts / rebrand invocations on `pnpm install` and
`pnpm --filter @pacaf/wizard-ux build`. Prevents the misleading
`Cannot find package 'fastify'` error from being mistaken for a PACAF bug.
AGENTS.md / CLAUDE.md now clearly distinguish the consumer path
(`npx @pacaf/wizard-ux@latest`, self-contained) from the contributor path
(running from monorepo source, requires workspace install + build).
Closes #61.
