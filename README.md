# Power Apps Code Apps — Foundations

A **GitHub template repository** with opinionated, comprehensive GitHub Copilot instruction files for building Power Apps Code Apps. Each new project starts from this template — you get the full instruction set, setup wizard, and scaffolding tools from your first commit.

## Quick Start

### Step 1: Get the code

**Option A — Use this template (recommended)**

1. Click the green **"Use this template"** button at the top of this repo → **"Create a new repository"**
2. Name your new repo (e.g. `my-expense-tracker`), set visibility, and click **Create**
3. Clone **your new repo**:

```bash
git clone https://github.com/your-org/my-expense-tracker.git
cd my-expense-tracker
```

**Option B — degit (no GitHub account required)**

```bash
npx degit macarrer_microsoft/PAppsCAFoundations my-code-app
cd my-code-app
```

> **Do NOT `git clone` this template repo directly** — that leaves `origin` pointing back to PAppsCAFoundations instead of your own repo.

### Step 2: Run the wizard

```bash
cd wizard
npm install
node index.mjs
```

That's it. The wizard walks you through everything — tool checks, naming, Power Platform portal steps, authentication, scaffolding, and your first deploy. It works on **Windows, macOS, and Linux**.

You can quit anytime with Ctrl+C — the wizard saves your progress and picks up where you left off. To start over: `node wizard/index.mjs --reset`.

## Execution Roadmap

Foundations is now evolving against an explicit 8-step robustness roadmap:

1. Execution contracts across the lifecycle
2. Schema-plan artifact workflow
3. Reusable Dataverse helper scripts
4. Stricter three-layer architecture rules
5. Testing as a deployment gate
6. Discovery helpers for human-in-the-loop tasks
7. Separate npm CLI migration evaluation
8. Foundations version traceability for downstream repos

The implementation is designed so each change is traceable to those steps and can be validated through scaffold, build, test, and sync workflows.

## Narrative-First Planning Layer

Foundations now includes a narrative-first planning layer for future app development work. This layer is designed for the stage where a user can describe the business problem in their own words, but the solution still needs to be decomposed, challenged, and refined before technical implementation begins.

The planning flow is:

1. **Decompose the business problem** — interpret the user's narrative, identify actors, workflows, outcomes, records, constraints, and key unknowns
2. **Refine the solution scope** — challenge for approvals, automation, Teams and Microsoft 365 touchpoints, reporting, governance, and enterprise completeness
3. **Convert to technical planning inputs** — derive candidate entities, relationships, ownership patterns, lifecycle states, and handoff inputs for Dataverse planning
4. **Validate the model through a UX prototype** — generate domain contracts and mock providers, build the UX in prototype mode, and feed the findings back into the planning payload before schema provisioning

The new instruction files are:

- `00a-business-problem-decomposition.instructions.md`
- `00b-scope-refinement-and-solution-shaping.instructions.md`
- `00c-solution-concept-to-dataverse-plan.instructions.md`
- `00d-prototype-validation.instructions.md`

These files are intentionally not questionnaire-first. They teach Copilot how to work from a user's freeform narrative, ask targeted follow-up questions, and refine scope before the app moves into prototype validation, connectors, schema execution, and connected UI implementation.

For the recommended end-to-end workflow, see [docs/prototype-golden-path.md](docs/prototype-golden-path.md).

### What the wizard does

1. **Checks your machine** — Node.js, Git, .NET, PAC CLI, 1Password CLI
2. **Collects project identity** — publisher prefix, solution name, app name
3. **Guides you through Power Apps portal steps** — tells you exactly what to click and type, using the values you just entered
4. **Collects environment URLs** — Dev (required), Test, Prod (optional)
5. **Walks through App Registration** — Azure Portal steps with copy-paste-ready values
6. **Sets up authentication** — 1Password or .env.local, creates PAC auth profiles, verifies connection
7. **Scaffolds your Code App** — React + Fluent UI v9 + TanStack Query + TypeScript, configured per team standards, plus prototype assets seeded from the planning payload
8. **Builds, verifies, and optionally deploys** — while steering you toward mock-mode validation before real connector binding

### Already set up? Manual path

If you've already completed the Power Platform portal and Admin Center steps and have credentials:

```bash
cp .env.template .env.local   # Fill in credentials
node scripts/setup-auth.mjs   # Create PAC auth profiles
pac org who                   # Verify (no browser popup)
```

See `00-environment-setup.instructions.md` for details.

## Visual Guide

Once you have the code on your machine, open [docs/guide.html](docs/guide.html) in your browser for an interactive visual walkthrough — tech stack overview, naming conventions, Power Apps Maker Portal links, and a detailed breakdown of each wizard step all in one page.

## What's Inside

```
PAppsCAFoundations/
├── .github/
│   └── instructions/                              # GitHub Copilot instruction files
│       ├── 00-before-you-start.instructions.md    # Publisher, environments, solution setup
│       ├── 00-environment-setup.instructions.md   # App Registration, 1Password, headless auth
│       ├── 00a-business-problem-decomposition.instructions.md   # Decompose freeform business narratives
│       ├── 00b-scope-refinement-and-solution-shaping.instructions.md # Refine scope, automation, Teams, reporting, governance
│       ├── 00c-solution-concept-to-dataverse-plan.instructions.md    # Convert refined scope into Dataverse planning inputs
│       ├── 00d-prototype-validation.instructions.md            # Validate UX with mock data before schema hardens
│       ├── 01-scaffold.instructions.md            # Solution-first rules, project structure, tech stack
│       ├── 02-connectors.instructions.md          # Data sources, Dataverse, SQL, O365, Custom APIs
│       ├── 03-components.instructions.md          # React + Fluent UI v9 patterns, state management
│       ├── 04-deployment.instructions.md          # CI/CD, pac code push, ALM, solution management
│       ├── 05-testing.instructions.md             # Vitest, Playwright, MSW connector mocking
│       ├── 06-security.instructions.md            # Auth, secrets, DLP, input validation
│       ├── 07-dataverse-schema.instructions.md    # Tables, columns, option sets, relationships
│       └── 08-copilot-studio.instructions.md      # Copilot Studio agent integration
├── docs/
│   └── guide.html                          # Interactive visual setup guide (Fluent UI design)
├── scripts/
│   ├── op-pac.mjs                          # Cross-platform 1Password wrapper for pac commands
│   ├── op-pac.sh                           # Legacy Bash wrapper for pac commands
│   ├── setup-auth.mjs                      # Cross-platform auth setup (1Password or .env.local)
│   ├── setup-auth.sh                       # Legacy Bash auth setup
│   ├── discover-copilot-connection.mjs     # Cross-platform Copilot Studio connection discovery
│   ├── discover-copilot-connection.sh      # Resolve Copilot Studio connection IDs safely
│   ├── generate-dataverse-plan.mjs         # Expand planning payloads into execution plans
│   ├── register-dataverse-data-sources.mjs # Cross-platform Dataverse table registration via PAC
│   ├── register-dataverse-data-sources.sh  # Register planned tables with pac and regenerate SDK
│   ├── schema-plan.example.json            # Starter Dataverse planning artifact
│   ├── seed-prototype-assets.mjs           # Generate domain contracts, mock providers, and feedback artifacts
│   ├── sync-foundations.mjs                # Cross-platform template sync entry point
│   ├── validate-schema-plan.mjs            # Validate planning payloads before provisioning
│   ├── sync-foundations.sh                 # Pull latest updates from the template repo
│   └── setup-wizard.sh                     # Guided 8-step setup wizard (bash, legacy)
├── wizard/                                 # Cross-platform Node.js setup wizard
│   ├── index.mjs                           # Entry point + step orchestrator
│   ├── lib/                                # Shared helpers (state, UI, shell, validation)
│   └── steps/                              # 8 step modules (01-prerequisites … 08-verify-deploy)
├── solution/                               # Power Platform solution artifacts
├── .env                                    # 1Password secret references (safe to commit)
├── .env.template                           # Template for teams not using 1Password
├── .foundations-version.json               # Bundle/version metadata for downstream syncs
├── .gitignore
└── README.md
```

## How It Works

When you open this project in VS Code with GitHub Copilot, the `.github/instructions/*.instructions.md` files are automatically loaded. Copilot uses them to generate code and planning guidance that follows your team's standards — from narrative-first business discovery through Fluent UI v9 components, TanStack Query hooks, connector usage, and solution-aware Dataverse patterns.

Most files use `applyTo` scopes so Copilot only loads the relevant instructions based on which files you're editing. The narrative-first planning files also rely on rich `description` text so they can be discovered during planning conversations before implementation files even exist.

## Dataverse Helper Flow

Foundations now includes a reusable Dataverse execution layer that sits after prototype validation and before connector generation:

Before this technical flow begins for a non-trivial app, use the narrative-first planning instructions to refine the business scope, derive the conceptual model, and validate that model through a mock-backed UX prototype. The Dataverse helper flow assumes those planning decisions have already been pressure-tested.

```bash
node scripts/seed-prototype-assets.mjs dataverse/planning-payload.json
```

```bash
node scripts/validate-schema-plan.mjs dataverse/planning-payload.json
node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json
node scripts/register-dataverse-data-sources.mjs dataverse/register-datasources.plan.json
```

This gives downstream repos a standard way to validate the planning payload, materialize normalized execution plans, and register the final Dataverse tables with `pac code add-data-source` before running `pac code generate`.

If you want the full recommended sequence from planning payload to mock UX to real providers, follow [docs/prototype-golden-path.md](docs/prototype-golden-path.md).

The `.mjs` entry points are the cross-platform defaults for macOS, Linux, and Windows. The `.sh` variants remain available for Bash-based environments.

The same rule now applies to auth helpers: prefer `node scripts/setup-auth.mjs` and `node scripts/op-pac.mjs` as the canonical cross-platform entry points.

## Staying Updated

Projects created from this template can pull improvements (new instruction files, wizard fixes, security updates) without affecting project-specific code:

```bash
npm run sync:foundations            # Preview changes + apply
npm run sync:foundations -- --dry-run   # Preview only, no changes
```

> **No `package.json` yet?** If you haven't run the scaffold step (Step 7 of the wizard), there won't be a root `package.json` and `npm run` commands will fail. Use the scripts directly instead:
>
> ```bash
> bash scripts/sync-foundations.sh          # macOS / Linux
> node scripts/sync-foundations.mjs         # Any platform
> ```

**What gets synced:** `.github/instructions/`, `wizard/`, `scripts/`, `docs/guide.html`, `.env.template`

**What is never touched:** `src/`, `package.json`, `power.config.json`, `.env.local`, `solution/`, `README.md`, `.gitignore`

Each scaffolded project also gets a `.foundations-version.json` file so downstream repos can see which bundle version they currently have before syncing.

The script fetches the latest template via `degit`, shows a diff of what changed, and asks for confirmation before applying. Changes are committed as a single `chore: sync foundations` commit.
