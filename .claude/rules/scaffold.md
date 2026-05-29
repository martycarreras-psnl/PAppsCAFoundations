---
paths:
  - "src/**"
  - "vite.config.ts"
  - "tsconfig.json"
  - "package.json"
  - "power.config.json"
---
<!-- Generated from .github/instructions/01-scaffold.instructions.md — do not edit directly -->
# Project Scaffolding & Structure

Mandatory tech stack: React 18 + TypeScript + Vite + Fluent UI v9 + TanStack Query + React Router.

Key rules:
- Solution-first: every Code App lives inside a dedicated Power Platform solution
- `src/generated/` is **read-only** — produced by `pac code add-data-source`
- Three-layer architecture: Components → Hooks → Services/Providers → Generated (behind adapters)
- Components never call generated services directly
- Port 3000 for local dev (Power Apps SDK requires it)
- `base: './'` in `vite.config.ts` for production builds
- Use `HashRouter`, never `BrowserRouter` (Power Apps host owns the path); the `prebuild` guard enforces it
- No secrets in source

**Routing guard false-positive on a fresh repo:** if `npm run build` reports `Code App routing guard FAILED … BrowserRouter` but `main.tsx` already uses `HashRouter` (BrowserRouter only in a comment), the repo has a **stale `@pacaf/scripts`** from caches that survive folder creation (the `npx` wizard cache writing `^3.0.0` + a warm pnpm store resolving it to buggy `3.0.1`). Don't touch the app code. Fix: `pnpm add -D @pacaf/scripts@latest @pacaf/agent-instructions@latest && npm run build`. Prevent before scaffolding: `rm -rf ~/.npm/_npx && pnpm store prune`. Factory fix shipped in `@pacaf/scripts@3.0.5` / `@pacaf/wizard@3.3.5`.

Full details: `.github/instructions/01-scaffold.instructions.md`
