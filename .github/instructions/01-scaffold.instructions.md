---
applyTo: "**"
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
# 1. Create the solution in your dev environment (via Power Platform maker portal or CLI)
pac solution init --publisher-name YourPublisher --publisher-prefix yourprefix

# 2. Then proceed with Code App scaffolding (see Scaffolding section below)
```

See `04-deployment.instructions.md` for full solution lifecycle management, including exporting, unpacking for source control, and promoting across environments.

### All Dataverse Artifacts Must Be Solution-Aware

When you create a new Dataverse table, column, option set, or any other artifact that your Code App depends on, always create it inside the solution — never from the default Tables view in the maker portal.

**Correct approach:**
1. Open the Power Platform maker portal
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
Files under `src/generated/` are produced by `pac code add-data-source` and `pac code generate`. Never modify them by hand. If the connector schema changes, regenerate — do not patch. If you need to extend a generated type, create a wrapper in `src/types/` that extends it:

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
export default defineConfig({
  server: { port: 3000 },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
});
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

## Scaffolding a New Project (Step by Step)

```bash
# 1. Verify authentication is working (should show org info — no browser popup)
pac org who

# 2. Create your solution FIRST (or verify it exists in the maker portal)
#    This ensures every artifact is tracked from the start.
#    If you prefer, create the solution in the Power Platform maker portal instead.
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

# 8. Add your first data source (interactive — choose a connector)
#    This creates a connection reference in your solution automatically
pac code add-data-source

# 9. Generate typed services from the connector
pac code generate

# 10. Verify your solution contains the Code App and connection references
#     Open Power Platform maker portal → Solutions → YourSolution
#     You should see: the Code App, connection reference(s), and any tables you've added

# 11. Start development (Vite + PAC Code Run on port 3000)
npm run dev
```

**After scaffolding, immediately create any Dataverse tables your app needs from within the solution** (see the "All Dataverse Artifacts Must Be Solution-Aware" rule above). Do not create tables from the top-level Tables view in the maker portal.

## Package.json Scripts

Every project must define these scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"vite --port 3000\" \"pac code run\"",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/ --ext .ts,.tsx --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "deploy": "npm run build && pac code push",
    "generate": "pac code generate"
  }
}
```

## Starting with Mock Data

Always begin development with mock data before connecting real connectors. This enables offline development, faster iteration, and reliable demos.

Create mock data files that mirror the exact shape of your generated models:

```typescript
// src/mockData/projects.ts
import type { Project } from '@/generated/models/Project';

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Website Redesign',
    status: 'Active',
    owner: 'Jane Smith',
    dueDate: '2026-06-15'
  },
  // ... more entries
];
```

Use an environment variable or a simple flag to toggle between mock and real data:

```typescript
// src/hooks/useProjects.ts
import { useQuery } from '@tanstack/react-query';
import { mockProjects } from '@/mockData/projects';
import { ProjectService } from '@/generated/services/ProjectService';

const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: USE_MOCK
      ? () => Promise.resolve(mockProjects)
      : () => ProjectService.getAll(),
  });
}
```

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
