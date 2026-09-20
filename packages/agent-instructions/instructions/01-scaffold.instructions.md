---
applyTo: "src/**,vite.config.ts,tsconfig.json,package.json,power.config.json"
---

# Power Apps Code Apps — Project Scaffolding & Structure

This instruction file governs how new Power Apps Code Apps projects are scaffolded, structured, and configured. Every Code App on this team follows this structure so that onboarding is instant and cross-project navigation is predictable.

## Technology Stack (Mandatory)

Every Code App uses this exact stack — no substitutions without team lead approval:

| Layer | Choice | Version | Why |
|-------|--------|---------|-----|
| Language | TypeScript | 5.x | Type safety across the entire codebase including connector models |
| UI Framework | React | 18.x | Microsoft-recommended; all official samples and SDK target React |
| Design System | Fluent UI v9 | `@fluentui/react-components` | Native Microsoft look and feel; matches Power Platform chrome |
| Bundler | Vite | 5.x | Fast HMR; official templates use Vite |
| Server State | TanStack Query | v5 | Declarative caching, deduplication, background refresh for connector calls |
| Routing | React Router | v6 | Nested layouts, data loaders, the FluentSample pattern |
| Power Apps SDK | `@microsoft/power-apps` | 1.4.0 (exact) | Connector access, auth context, platform integration |
| Code App CLI | local `@microsoft/power-apps-cli` | 1.0.2 (exact devDependency) | Initialize, run local host, generate data sources, publish |
| ALM/admin CLI | Power Platform CLI (PAC) | Team-tested version | Solution lifecycle and environment administration; separate authentication |

## Project Structure

When creating a new Code App, always generate this folder layout:

```
my-code-app/
├── .github/
│   ├── instructions/          # These instruction files (committed to repo)
│   └── workflows/
│       ├── ci.yml             # Build + lint + test on every PR
│       └── deploy.yml         # guarded publish / PAC solution ALM
├── src/
│   ├── components/            # Reusable UI components (buttons, cards, dialogs)
│   │   └── Layout/
│   │       ├── Layout.tsx
│   │       ├── Layout.test.tsx
│   │       └── index.ts
│   ├── pages/                 # Route-level components, one folder per route
│   │   ├── Home/
│   │   ├── Dashboard/
│   │   └── Settings/
│   ├── hooks/                 # Custom React hooks (useConnector, useCurrentUser, etc.)
│   ├── generated/             # Power Apps CLI output — NEVER edit manually
│   │   ├── services/          # Connector service classes
│   │   └── models/            # TypeScript interfaces for connector entities
│   ├── utils/                 # Pure helper functions (formatDate, parseError, etc.)
│   ├── types/                 # Shared TypeScript types and interfaces
│   ├── mockData/              # Dev-only mock data mirroring connector shapes
│   ├── constants/             # App-wide constants (route paths, config keys)
│   ├── App.tsx                # Root component: routes + providers
│   ├── main.tsx               # Entry point: renders App inside providers
│   └── PowerProvider.tsx      # Power Platform context wrapper
├── tests/
│   ├── e2e/                   # Playwright end-to-end tests
│   └── setup/                 # Test utilities, global setup, mock factories
├── public/                    # Static assets (favicon, manifest)
├── power.config.json          # CLI-managed app identity and bindings — preserve on migration
├── .power-apps-targets.json    # Durable non-secret deployment identities
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
├── .eslintrc.cjs              # ESLint configuration
├── .prettierrc                # Prettier configuration
└── package.json
```

## Critical Rules

### Every Code App Lives in a Solution — No Exceptions

This is the single most important rule for team development. Every Code App must be created inside a dedicated Power Platform solution from the very first day. The default solution is not acceptable — it cannot be exported, versioned, or promoted across environments.

**Why this matters:** Without a solution, your Code App and its Dataverse artifacts (tables, columns, option sets, security roles, connection references, environment variables) become trapped in the default environment. You cannot move them to test or production. You cannot version them. You cannot roll back. You lose all ALM capabilities. Fixing this after the fact is painful and error-prone.

**The rule is simple:** If it was created for or used by your Code App, it belongs in your solution.

**What goes in the solution:**

| Artifact | Why It Must Be In The Solution |
|----------|-------------------------------|
| The Code App itself | Core deliverable — cannot deploy without it |
| Dataverse tables | Schema must travel with the app |
| Dataverse columns | Custom columns on existing tables must be tracked |
| Option sets (choices) | Dropdown values the app depends on |
| Connection references | Connectors used by the app (SQL, O365, Custom APIs) |
| Environment variables | Config values that differ per environment |
| Security roles | Custom roles that govern access to app data |
| Canvas apps / Model-driven apps | If your Code App links to other apps in the platform |
| Power Automate flows | If the app triggers or depends on cloud flows |
| Business rules | Dataverse business rules on tables your app uses |
| Dashboards / Charts | If the solution includes Dataverse views |
| Web resources / Plugins | Any server-side logic tied to the app |

**What does NOT go in the solution:**

- User data (rows in tables) — data is environment-specific
- Personal views or user settings
- Temporary development artifacts

### Create the Solution Before Writing Any Code

The solution comes first, before scaffolding and `pa app init`. Use the wizard or Dataverse-skills `dv-solution` to discover/create it; local `pac solution init` alone does not provision a cloud solution.

Record both its **GUID** (`solutionId`, used by `pa app push --solution-id`) and **unique name** (`solutionName`, used by PAC ALM), bound to the same environment in `.power-apps-targets.json`. There is no implicit "active solution" supplied by PAC authentication. `pa app init --display-name "<name>" --environment-id "<id>"` initializes local metadata, not solution membership.

First creation requires explicit user-mode `--allow-create`, a verified solution GUID, and empty target `appId` (`""`), followed by persistence of the returned app ID. **Separate, explicitly authorized Azure CLI login with Global Discovery Service access is required** to verify environment ID, tenant, and URL independently of `pa` identity. A matching home-account tenant is insufficient. Missing discovery access fails closed, without auto-login. Never delete/reinitialize an existing app or bypass the guard to complete setup. See `04-deployment.instructions.md`.

See `04-deployment.instructions.md` for full solution lifecycle management, including exporting, unpacking for source control, and promoting across environments.

### All Dataverse Artifacts Must Be Solution-Aware

When you create a new Dataverse table, column, option set, or any other artifact that your Code App depends on, always create it inside the solution — never from the default Tables view in the Power Apps Maker Portal.

**Correct approach:**
1. Open the Power Apps Maker Portal
2. Navigate to your solution
3. Click "Add existing" or "New" from within the solution context
4. Create the table/column/option set inside the solution

**Wrong approach (creates untracked artifacts):**
1. Going to Tables in the left nav (outside any solution)
2. Creating a table there
3. Hoping it will "show up" in your solution later

If an artifact already exists outside your solution, you can add it retroactively — but this is error-prone and should be treated as a mistake to fix, not a workflow to follow:

```bash
# Add an existing table to your solution (retroactive fix — avoid needing this)
pac solution add-reference --component-name yourprefix_ProjectTask --component-type Table
```

### The `generated/` folder is sacrosanct
Files under `src/generated/` are produced when `pacaf-pa app add data-source` registers a connector or Dataverse table. Never modify them by hand. If the connector schema changes, use `pacaf-pa app refresh data-source --name "<data-source-name>"` — do not patch generated files. Verify generated paths and provider compatibility after regeneration. If you need to extend a generated type, create a wrapper in `src/types/` that extends it:

```typescript
// src/types/ProjectExtended.ts
import { Project } from '../generated/models/Project';

export interface ProjectWithStatus extends Project {
  computedStatus: 'on-track' | 'at-risk' | 'blocked';
}
```

### Port 3000 is mandatory for local development
The Power Apps SDK requires the dev server on port 3000. Vite config must set this explicitly:

```typescript
// vite.config.ts
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  server: { port: 3000 },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
}));
```

### Path aliases
Always configure the `@/` alias pointing to `./src/`. This keeps imports clean and avoids fragile relative paths:

```typescript
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ProjectCard } from '@/components/ProjectCard';
```

Configure in both `tsconfig.json` and `vite.config.ts`.

### TypeScript Configuration

These settings are required for SDK compatibility:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "verbatimModuleSyntax": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

The `verbatimModuleSyntax: false` setting is specifically required for Power Apps SDK compatibility — do not change it.

## Prerequisites

The wizard establishes separate authentication for PAC solution/admin operations and the local Power Apps CLI. A PAC SPN profile does not establish the account used by `pa`. Initial app creation uses user authentication; SPN publishing is an opt-in existing-app update path.

If you haven't set this up yet, complete the steps in `00-environment-setup.instructions.md` first. Once done, verify:

```bash
pac org who                    # PAC ALM context only
npm run pa -- auth status --json # Separate Power Apps CLI account/tenant
```

Before you add connectors, generate schema, or start building pages around assumed entities, complete the narrative-first planning flow if the business scope is still emerging:

- `00a-business-problem-decomposition.instructions.md`
- `00b-scope-refinement-and-solution-shaping.instructions.md`
- `00c-solution-concept-to-dataverse-plan.instructions.md`

Scaffolding is not the moment to lock in a premature data model. If the user is still describing the problem in freeform business language, stop and refine the scope before moving into connector registration or schema decisions.

## Scaffolding a New Project (Step by Step)

> **Code Apps plugin required.** Before scaffolding, verify the Code Apps plugin (`code-apps-preview@power-platform-skills`) is installed in your agent. If it is, invoke **`/create-code-app`** — it walks through prerequisites, scaffold, connector selection, and baseline deploy in one guided flow. If the plugin is not installed, the hard gate in `00-prereq-gate.instructions.md` Step 9 applies — stop and direct the user to install it first.

Use the PACAF wizard, not the plugin's generic `degit` scaffold. If the plugin is unavailable, stop at the prerequisite gate rather than bypassing it. The wizard owns initialization; do not run init again after it completes.

```bash
# 1. Scaffold through the wizard (includes solution discovery and local CLI init)
npx @pacaf/wizard-ux@latest

# 2. Complete planning; build in prototype mode first
npm run dev:local

# 3. Once planning/prototype are stable, invoke the matching Code Apps skill.
#    The skill uses this local runner; binding is not a setup-wizard step.
npm run pa -- app add data-source --connector "<connector-api-id>" --connection-id "<connection-id>"

# 4. Inspect generated output and adapt behind provider contracts.
#    Register live field metadata for every new Dataverse table.

# 5. Start connected dev (Vite 3000 + Power Apps local host 8080)
npm run dev
```

**After scaffolding, do not create Dataverse tables or add connectors based on guesswork.** First refine the business scope and convert it into a conceptual plan. Once that is stable, create any Dataverse tables your app needs from within the solution (see the "All Dataverse Artifacts Must Be Solution-Aware" rule above). Do not create tables from the top-level Tables view in the Power Apps Maker Portal.

**Connector binding is intentionally deferred.** During the initial scaffold, do not ask the developer for connection IDs up front. The expected method is: plan the workflow, prototype the UX with mock providers, refine `dataverse/planning-payload.json`, and only then bind real connectors.

When moving into connected mode, invoke `/list-connections` and use `npm run pa -- connection list --json` in the verified app environment. Filter by connector API ID and let the developer select the right connection. If no match is discovered, then prompt for creation in Maker Portal or a pasted Connection ID.

## Package.json Scripts

Every project must define these scripts:

```json
{
  "scripts": {
    "dev": "concurrently --kill-others-on-fail \"vite --port 3000 --strictPort\" \"pacaf-pa app run --config-only --port 8080 --local-app-url http://localhost:3000\"",
    "dev:local": "cross-env VITE_USE_MOCK=true vite --port 3000",
    "pa": "pacaf-pa",
    "prebuild": "pacaf-patch-datasources",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/ --ext .ts,.tsx --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "vitest run --reporter=verbose src/App.test.tsx",
    "test:e2e": "playwright test",
    "deploy": "pacaf-deploy --target dev"
  }
}
```

The `test:smoke` script runs the built-in smoke tests that ship with every scaffold. These pass immediately after setup — the wizard verifies this during Step 7 before declaring success. If smoke tests fail, the scaffold is broken.

Keep exact dependency pins and the chosen package-manager lockfile. `pacaf-pa` resolves the installed local CLI only; it must never download an executable on demand. Do not use bare `npx pa`, global updates, registry bypasses, or `PAC_BIN` to redirect PAC wrappers.

Native authentication dependency build scripts (keytar/MSAL extensions) require user-reviewed approval through the existing package-manager policy. Never automatically modify the build allowlist or blanket-approve dependency scripts.

`pacaf-deploy` owns preflight, build, and publish; a failed build must never reach push. It checks durable target metadata and uses a solution GUID. Use `npm run deploy -- --preflight` for non-mutating validation. See `04-deployment.instructions.md` for initial creation and opt-in SPN updates.

`--config-only` is required with a separate Vite process: CLI 1.0.2 otherwise starts the app's dev command too, risking duplicate servers/recursion. `--kill-others-on-fail` stops the companion when either process fails. Do not remove the prebuild guard just because legacy generator output no longer needs the missing-parameters repair.

## Local Development with Vite

Local development has two modes depending on where you are in the development lifecycle. Start with **Prototype Mode** — it requires zero Power Platform configuration and gets you building UI immediately. Graduate to **Connected Mode** when the prototype has influenced the final planning payload and you're ready to bind real providers.

### Mode 1: Prototype Mode (Mock Data — No Power Platform Required)

This is the fastest way to start building. Vite runs standalone with hot module replacement (HMR). No Power Apps local host, no auth profiles, no connections. Your app renders instantly in the browser using mock data.

**When to use:** Prototyping UI, building components, iterating on layout and design, demoing to stakeholders, onboarding new developers.

```bash
# Start Vite standalone with mock data
npm run dev:local
```

This runs `cross-env VITE_USE_MOCK=true vite --port 3000`. Vite serves your app at `http://localhost:3000` with sub-second HMR — save a file, see the change instantly.

**What works in this mode:**
- All React components, routing, and Fluent UI styling
- TanStack Query hooks (with mock data resolving as promises)
- Form validation, state management, error boundaries
- E2E tests via Playwright (pointed at localhost)

**What does NOT work in this mode:**
- Real connector calls (generated services require the Power Apps runtime)
- `pa app run` features (platform context, auth context, connection consent)
- `PowerProvider` context values that come from the Power Platform sandbox

**Required setup for mock data:**

1. Create domain models and provider contracts that are independent of `src/generated/**`:

```typescript
// src/types/domain-models.ts
export interface ProjectRequest {
  id: string;
  name: string;
  requestStatus: number;
  requestedOn?: string;
}

// src/services/data-contracts.ts
import type { ProjectRequest } from '@/types/domain-models';

export interface ProjectRequestRepository {
  list(): Promise<ProjectRequest[]>;
  getById(id: string): Promise<ProjectRequest | null>;
}
```

2. Seed mock data against those domain models:

```typescript
// src/mockData/projectRequests.ts
import type { ProjectRequest } from '@/types/domain-models';

export const mockProjectRequests: ProjectRequest[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Website Redesign',
    requestStatus: 100000000,
    requestedOn: '2026-06-15',
  },
];
```

3. Prefer one provider factory to choose mock vs real implementations:

```typescript
// src/services/providerFactory.ts
import { createMockDataProvider } from '@/services/mock-data-provider';
import { createRealDataProvider } from '@/services/real-data-provider';

export function createAppDataProvider() {
  return import.meta.env.VITE_USE_MOCK === 'true'
    ? createMockDataProvider()
    : createRealDataProvider();
}
```

4. Hooks should depend on provider contracts, not on generated services directly:

```typescript
// src/hooks/useProjectRequests.ts
import { useQuery } from '@tanstack/react-query';
import { createAppDataProvider } from '@/services/providerFactory';

const provider = createAppDataProvider();

export function useProjectRequests() {
  return useQuery({
    queryKey: ['projectRequests'],
    queryFn: () => provider.projectRequests.list(),
  });
}
```

5. Keep the real connector implementation at the integration edge:

```typescript
// src/services/real-data-provider.ts
import { ProjectRequestsService } from '@/generated/services/ProjectRequestsService';
import type { AppDataProvider } from '@/services/data-contracts';

export function createRealDataProvider(): AppDataProvider {
  return {
    projectRequests: {
      async list() {
        const result = await ProjectRequestsService.getAll();
        return (result.data || []).map(mapProjectRequestFromDataverse);
      },
      async getById(id: string) {
        const result = await ProjectRequestsService.get(id);
        return result.data ? mapProjectRequestFromDataverse(result.data) : null;
      },
    },
  };
}
```

Prototype mode is not just a visual sandbox. It is the moment where the UX is allowed to challenge the draft data model before that model becomes expensive to change.

### Mode 2: Connected Mode (Real Connectors via Power Platform)

Once you've built the UI and want to connect to real data, switch to connected mode. This runs Vite and the Power Apps local host side by side.

**Prerequisites for connected mode:**
- Local CLI user signed in (see `00-environment-setup.instructions.md`)
- Data sources generated via `pacaf-pa app add data-source` and adapted behind providers
- `power.config.json` matches the intended app/environment
- Active account verified separately: `npm run pa -- auth status --json`

```bash
# Start both Vite dev server and Power Apps local host
npm run dev
```

This runs the `concurrently --kill-others-on-fail` command shown above:
- **Vite** (`http://localhost:3000`): Serves your React app with HMR
- **`pacaf-pa app run --config-only --port 8080 --local-app-url http://localhost:3000`**: Starts only the Power Apps local host, not another Vite server

Use the local play URL printed by the Power Apps CLI for connected validation. Vite assets come from `http://localhost:3000`; the Power Apps local host uses port 8080. Do not conflate the two ports.

### Vite Environment Variables

Vite exposes environment variables prefixed with `VITE_` to client code via `import.meta.env`. Variables without the `VITE_` prefix are NOT available in the browser (this is a security feature).

| Variable | Purpose | Set In |
|----------|---------|--------|
| `VITE_USE_MOCK` | Toggle mock data (`'true'` / unset) | `dev:local` script or `.env.development` |
| `VITE_APP_TITLE` | App display name (optional) | `.env` or `.env.development` |

**Create a `.env.development` file** for Vite-specific dev settings (this is separate from `.env.local` which holds Power Platform credentials):

```bash
# .env.development — Vite development settings (safe to commit)
VITE_USE_MOCK=true
```

Override per-command on the CLI:

```bash
VITE_USE_MOCK=false npm run dev:local   # Force connected-mode behavior in standalone Vite
VITE_USE_MOCK=true npm run dev          # Force mock data even in connected mode
```

### Vite Configuration Reference

The complete `vite.config.ts` for a Code App:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/', // CRITICAL — Code Apps serve from a non-root path
  plugins: [react()],
  server: {
    port: 3000,          // Required — Power Apps SDK expects port 3000
    strictPort: true,    // Fail if 3000 is occupied instead of silently using another port
    open: true,          // Auto-open browser on npm run dev
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,     // Disable in production builds for Code Apps
  },
}));
```

Key settings:
- **`base: './'` (build) / `'/'` (dev)**: CRITICAL for Code Apps. Power Apps serves your bundle from a nested, non-root path inside an iframe. Without relative `base`, all asset URLs in the built HTML are absolute (`/assets/index-abc123.js`) which 404 → blank screen. The `({ command })` function form lets `npm run dev` keep using absolute paths (which Vite's dev server needs) while the production build uses relative paths.
- **`strictPort: true`**: Prevents Vite from falling back to 3001/3002 if 3000 is busy. If it fails, you have a stale process — kill it and retry.
- **`open: true`**: Launches your default browser automatically. Remove this if you prefer to open manually.

### Routing: use `HashRouter`, never `BrowserRouter`

For client-side routing inside a Code App you **must** use `react-router-dom`'s `HashRouter` (or `createHashRouter`). The Power Apps host owns the URL path — every deployed app is served from a nested path like `https://apps.powerapps.com/play/e/<env>/app/<app>/...` — so any non-root path the router pushes into history (or that the host pushes back into the iframe via deep-link) does not resolve to a static asset and `index.html` is served from the wrong base, producing a **404 on first load** or the moment a user navigates to a non-index route.

The fragment (`#/...`) is the only URL segment the iframe reliably owns. `HashRouter` keeps every route in the fragment, so the host never asks for a path it doesn't know.

Required scaffold in `src/main.tsx`:

```typescript
import { HashRouter } from 'react-router-dom';
// ...
<HashRouter>
  <App />
</HashRouter>
```

Deployed routes look like `…/app/<id>/#/episode/<id>` — exactly what works inside the iframe.

This rule is non-negotiable and enforced at build time. `npm run build` runs `pacaf-patch-datasources` as a `prebuild` hook, which fails loudly if `src/main.tsx` or `src/router.tsx` still references `BrowserRouter` / `createBrowserRouter`. Symptom that triggers this guard: a deployed app that 404s on first load — see issue #47.

#### If the routing guard fails on code that already uses `HashRouter` (stale `@pacaf/scripts`)

There is one false-positive that bites freshly-scaffolded repos: the prebuild guard reports **`✗ Code App routing guard FAILED … main.tsx imports BrowserRouter`** even though `src/main.tsx` correctly uses `HashRouter` and the only `BrowserRouter` text is inside an explanatory comment. **Do not "fix" the app code — it is already correct.** The repo has a stale `@pacaf/scripts` whose old guard matched the bare word `BrowserRouter` before stripping comments (fixed in `@pacaf/scripts@3.0.2`+).

Why a *brand-new* repo can still get a stale package — two machine-global caches that creating a new folder does **not** reset:

1. **The `npx` wizard cache.** `npx @pacaf/wizard-ux@latest` reuses a cached wizard under `~/.npm/_npx/<hash>/`. If that cache predates `@pacaf/wizard@3.3.5`, the wizard writes a caret range (`"@pacaf/scripts": "^3.0.0"`) into the new `package.json` instead of pinning the `latest` dist-tag.
2. **The pnpm warm shared store.** `pnpm install` then resolves that caret against already-cached store metadata instead of re-querying the registry, landing on a stale `@pacaf/scripts@3.0.1` rather than the newest release.

The two stack: old npx cache writes `^3.0.0` → warm pnpm store resolves it to the buggy `3.0.1`.

**Fix for an affected repo** (exact/`latest` pins defeat the warm store):

```bash
pnpm add -D @pacaf/scripts@latest @pacaf/agent-instructions@latest
npm run build   # guard now exits 0
```

**Defeat both caches before scaffolding a new app:**

```bash
npx clear-npx-cache 2>/dev/null || rm -rf ~/.npm/_npx   # force npx to refetch the wizard
pnpm store prune                                         # drop stale store entries
```

The factory-side fix is already shipped: `buildRequiredDevPackages` in the wizard pins first-party `@pacaf/*` dev deps to the `latest` dist-tag (`@pacaf/wizard@3.3.5`, `@pacaf/wizard-ux@3.3.3`), and the guard strips comments before matching (`@pacaf/scripts@3.0.5`). A scaffold from a refreshed npx cache no longer hits this.

### Tailwind v4 + CSS import — required scaffold

A freshly-scaffolded Code App renders **completely unstyled** on first run if either of these two pieces is missing — the CSS pipeline silently produces an empty stylesheet, JS runs, React mounts, the DOM is correct, but every element is unstyled and the dev server prints no warning. Both pieces ship in the wizard scaffold; never remove them.

1. **`src/main.tsx` must import `./index.css`.** Vite has no reason to include the stylesheet in the bundle unless something imports it. The wizard emits the import on the line immediately above `createRoot(...)`.

   ```typescript
   import './index.css';
   ```

2. **`vite.config.ts` must register the `@tailwindcss/vite` plugin.** Tailwind v4 requires the dedicated Vite plugin — the `@import "tailwindcss"` directive in `src/index.css` is processed *only* when that plugin is in the pipeline. Without it, the directive is treated as a literal CSS `@import` that resolves to nothing and is silently dropped.

   ```typescript
   import tailwindcss from '@tailwindcss/vite';
   // ...
   plugins: [react(), tailwindcss()],
   ```

3. **`src/index.css` must contain the Tailwind v4 entrypoint:**

   ```css
   @import "tailwindcss";
   ```

The scaffold's `package.json` declares both `tailwindcss` and `@tailwindcss/vite` as `devDependencies` — the Vite plugin is a hard requirement, not an option. If `npm run dev` produces a page where Fluent UI's chrome and every utility class are missing, the diagnosis is almost certainly one of these three pieces. See issue #48 and `TROUBLESHOOTING.md` keyed off "My app renders but everything is unstyled".

### Switching Between Modes

| Phase | Command | What's Running | Data Source |
|-------|---------|---------------|-------------|
| Prototyping | `npm run dev:local` | Vite only | Mock data |
| Integration | `npm run dev` | Vite 3000 + `pa app run --config-only` host 8080 | Real connectors |
| Testing | `npm run test` | Vitest | Mock data via MSW |
| E2E Testing | `npm run test:e2e` | Vite + Playwright | Mock data |
| Production Build | `npm run build` | `tsc` + Vite build | N/A (static output) |
| Deploy | `npm run deploy` | Guarded build + local `pa app push --solution-id <GUID>` | N/A |

### Troubleshooting Local Development

**Port 3000 already in use:**
```bash
# Find and kill the process using port 3000
lsof -ti:3000 | xargs kill -9
npm run dev:local
```

**Power Apps local host fails to start:**
- Verify separate CLI auth: `npm run pa -- auth status --json`
- Check the exact local CLI version with `npm run pa -- --version`; restore from the lockfile if missing
- Check both ports and retain `--config-only`; never start a second Vite server
- Ensure `power.config.json` exists next to `package.json`

**HMR not working (changes not reflected):**
- Check that `vite.config.ts` has the `react()` plugin
- Clear the Vite cache: `rm -rf node_modules/.vite && npm run dev:local`

**Mock data shape doesn't match real data:**
- Run `npm run pa -- app refresh data-source --name "<data-source-name>"` to refresh TypeScript models
- Compare `src/generated/models/` types against your mock data
- Remember: choice/picklist fields are **integers** (100000000), not strings

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase folder + file | `components/ProjectCard/ProjectCard.tsx` |
| Hooks | camelCase with `use` prefix | `hooks/useProjects.ts` |
| Utils | camelCase | `utils/formatDate.ts` |
| Types | PascalCase | `types/ProjectExtended.ts` |
| Constants | SCREAMING_SNAKE in file, camelCase filename | `constants/routes.ts` |
| Tests | Same name + `.test.tsx` | `ProjectCard.test.tsx` |
| Pages | PascalCase folder | `pages/Dashboard/Dashboard.tsx` |

Every component folder exports via an `index.ts` barrel file for clean imports.
