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
| Power Apps SDK | `@microsoft/power-apps` | ^1.0.3 | Connector access, auth context, platform integration |
| CLI | Power Platform CLI (PAC) | latest | Scaffold, add data sources, deploy |

## Project Structure

When creating a new Code App, always generate this folder layout:

```
my-code-app/
├── .github/
│   ├── instructions/          # These instruction files (committed to repo)
│   └── workflows/
│       ├── ci.yml             # Build + lint + test on every PR
│       └── deploy.yml         # pac code push to target environment
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
│   ├── generated/             # PAC CLI output — NEVER edit manually
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
├── power.config.json          # PAC-generated — do not edit
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

The solution comes first, before scaffolding, before `pac code init`. Here's why: `pac code init` registers your Code App in the currently active solution context. If you haven't created and selected a solution, the app lands in the default solution where it's effectively unmanageable.

```bash
# 1. Create the solution in your dev environment (via the Power Apps Maker Portal or CLI)
pac solution init --publisher-name YourPublisher --publisher-prefix yourprefix

# 2. Then proceed with Code App scaffolding (see Scaffolding section below)
```

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
Files under `src/generated/` are produced when `pac code add-data-source` registers a connector or Dataverse table. Never modify them by hand. If the connector schema changes, re-add or refresh the data source — do not patch generated files. If you need to extend a generated type, create a wrapper in `src/types/` that extends it:

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

Before scaffolding, you must have a working PAC CLI authentication profile connected to your development environment via the team's Service Principal (App Registration). This enables headless deployment — no browser popups.

If you haven't set this up yet, complete the steps in `00-environment-setup.instructions.md` first. Once done, verify:

```bash
pac org who
# Expected: shows your org name and environment URL — no browser popup
```

Before you add connectors, generate schema, or start building pages around assumed entities, complete the narrative-first planning flow if the business scope is still emerging:

- `00a-business-problem-decomposition.instructions.md`
- `00b-scope-refinement-and-solution-shaping.instructions.md`
- `00c-solution-concept-to-dataverse-plan.instructions.md`

Scaffolding is not the moment to lock in a premature data model. If the user is still describing the problem in freeform business language, stop and refine the scope before moving into connector registration or schema decisions.

## Scaffolding a New Project (Step by Step)

```bash
# 1. Verify authentication is working (should show org info — no browser popup)
pac org who

# 2. Create your solution FIRST (or verify it exists in the Power Apps Maker Portal)
#    This ensures every artifact is tracked from the start.
#    If you prefer, create the solution in the Power Apps Maker Portal instead.
pac solution init --publisher-name YourPublisher --publisher-prefix yourprefix

# 3. Clone the starter template
npx degit microsoft/PowerAppsCodeApps/templates/starter my-app
cd my-app

# 4. Install dependencies
npm install

# 5. Add Fluent UI and TanStack Query
npm install @fluentui/react-components @tanstack/react-query react-router-dom

# 6. Copy the .env.template and fill in your credentials (if not already done)
cp .env.template .env.local
# Fill in PP_TENANT_ID, PP_APP_ID, PP_CLIENT_SECRET, PP_ENV_DEV

# 7. Initialize Code App metadata (registers the app in your active solution)
pac code init

# 8. If the app's business scope is still being defined, stop here and complete
#    the planning flow before choosing connectors or Dataverse tables.

# 9. Build in prototype mode first.
npm run dev:local

# 10. When the planning payload is stable and you are ready to bind real data,
#     re-run the wizard from the connector step so it can create connection
#     references and help discover existing connections.
node wizard/index.mjs --from 8

# 11. Confirm the connector registration produced or refreshed src/generated/**
#     If a table or connector is missing, re-run pac code add-data-source for it.

# 12. Verify your solution contains the Code App and connection references
#     Open Power Apps Maker Portal → Solutions → YourSolution
#     You should see: the Code App, connection reference(s), and any tables you've added

# 13. Start connected development (Vite + PAC Code Run on port 3000)
npm run dev
```

**After scaffolding, do not create Dataverse tables or add connectors based on guesswork.** First refine the business scope and convert it into a conceptual plan. Once that is stable, create any Dataverse tables your app needs from within the solution (see the "All Dataverse Artifacts Must Be Solution-Aware" rule above). Do not create tables from the top-level Tables view in the Power Apps Maker Portal.

**Connector binding is intentionally deferred.** During the initial scaffold, do not ask the developer for connection IDs up front. The expected method is: plan the workflow, prototype the UX with mock providers, refine `dataverse/planning-payload.json`, and only then bind real connectors.

When moving into connected mode, prefer a later wizard flow that can inspect existing environment connections with `pac connection list`, filter by connector API ID, and let the developer select the right one. If no match is discovered, then prompt for manual creation in Maker Portal or for a pasted Connection ID.

## Package.json Scripts

Every project must define these scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"vite --port 3000\" \"pac code run\"",
    "dev:local": "VITE_USE_MOCK=true vite --port 3000",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/ --ext .ts,.tsx --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "vitest run --reporter=verbose src/App.test.tsx",
    "test:e2e": "playwright test",
    "deploy": "npm run build && pac code push"
  }
}
```

The `test:smoke` script runs the built-in smoke tests that ship with every scaffold. These pass immediately after setup — the wizard verifies this during Step 7 before declaring success. If smoke tests fail, the scaffold is broken.

> **Auth note for `deploy`:** The `pac code push` in the deploy script requires a **user (interactive) auth profile** to be active — SPN auth is rejected by the BAP API. Select your repo-scoped user profile before running `npm run deploy`. The wizard creates this profile automatically; for manual setup see `00-environment-setup.instructions.md`.

## Local Development with Vite

Local development has two modes depending on where you are in the development lifecycle. Start with **Prototype Mode** — it requires zero Power Platform configuration and gets you building UI immediately. Graduate to **Connected Mode** when the prototype has influenced the final planning payload and you're ready to bind real providers.

### Mode 1: Prototype Mode (Mock Data — No Power Platform Required)

This is the fastest way to start building. Vite runs standalone with hot module replacement (HMR). No `pac code run`, no auth profiles, no connections. Your app renders instantly in the browser using mock data.

**When to use:** Prototyping UI, building components, iterating on layout and design, demoing to stakeholders, onboarding new developers.

```bash
# Start Vite standalone with mock data
npm run dev:local
```

This runs `VITE_USE_MOCK=true vite --port 3000`. Vite serves your app at `http://localhost:3000` with sub-second HMR — save a file, see the change instantly.

**What works in this mode:**
- All React components, routing, and Fluent UI styling
- TanStack Query hooks (with mock data resolving as promises)
- Form validation, state management, error boundaries
- E2E tests via Playwright (pointed at localhost)

**What does NOT work in this mode:**
- Real connector calls (generated services require the Power Apps runtime)
- `pac code run` features (platform context, auth context, connection consent)
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

Once you've built the UI and want to connect to real data, switch to connected mode. This runs Vite and `pac code run` side by side.

**Prerequisites for connected mode:**
- PAC auth profiles created (see `00-environment-setup.instructions.md`)
- At least one data source added via `pac code add-data-source`
- TypeScript SDK refreshed by `pac code add-data-source`
- Active connection to the target environment: `pac auth select --name "Dev"`

```bash
# Start both Vite dev server and PAC Code runtime
npm run dev
```

This runs `concurrently "vite --port 3000" "pac code run"`:
- **Vite** (`http://localhost:3000`): Serves your React app with HMR
- **`pac code run`**: Starts the Power Apps runtime proxy that handles connector calls, auth context, and platform integration

Open `http://localhost:3000` in your browser. The app loads from Vite, and connector calls route through the `pac code run` proxy transparently.

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

### Switching Between Modes

| Phase | Command | What's Running | Data Source |
|-------|---------|---------------|-------------|
| Prototyping | `npm run dev:local` | Vite only | Mock data |
| Integration | `npm run dev` | Vite + `pac code run` | Real connectors |
| Testing | `npm run test` | Vitest | Mock data via MSW |
| E2E Testing | `npm run test:e2e` | Vite + Playwright | Mock data |
| Production Build | `npm run build` | `tsc` + Vite build | N/A (static output) |
| Deploy | `npm run deploy` | Build + `pac code push` | N/A |

### Troubleshooting Local Development

**Port 3000 already in use:**
```bash
# Find and kill the process using port 3000
lsof -ti:3000 | xargs kill -9
npm run dev:local
```

**`pac code run` fails to start:**
- Verify auth: `pac org who` (should show org info, no popup)
- Check PAC version: avoid v2.3.2 (known bug — see `00-environment-setup.instructions.md`)
- Ensure `power.config.json` exists next to `package.json`

**HMR not working (changes not reflected):**
- Check that `vite.config.ts` has the `react()` plugin
- Clear the Vite cache: `rm -rf node_modules/.vite && npm run dev:local`

**Mock data shape doesn't match real data:**
- Re-run `pac code add-data-source` for the affected table or connector to refresh TypeScript models
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
