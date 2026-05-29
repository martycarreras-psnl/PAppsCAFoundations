---
"@pacaf/agent-instructions": patch
---

Document the stale-`@pacaf/scripts` routing-guard false-positive in the scaffold instructions (and projections) so agents self-heal instead of "fixing" already-correct `HashRouter` code. Explains the two machine-global caches that bite even a brand-new repo (the `npx` wizard cache writing a caret range + a warm pnpm store resolving it to a buggy release) and the fix (`pnpm add -D @pacaf/scripts@latest @pacaf/agent-instructions@latest`) plus the pre-scaffold cache-clear recipe.
