# Power Apps Code Apps — Foundations

A **GitHub template repository** with opinionated, comprehensive GitHub Copilot instruction files for building Power Apps Code Apps. Each new project starts from this template — you get the full instruction set, setup wizard, and scaffolding tools from your first commit.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Prerequisites

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| **Node.js** | 20+ | Required for wizard and all scripts |
| **VS Code** | Latest | With GitHub Copilot extension for instruction-file support |
| **Git** | 2.30+ | For template cloning and version control |
| **.NET SDK** | 8.0+ | Required for PAC CLI installation |
| **PAC CLI** | 2.2.x | `dotnet tool install -g Microsoft.PowerApps.CLI.Tool --version 2.2.1` |
| **Power Platform** | Access to at least one environment with Dataverse enabled | See licensing note below |
| **1Password CLI** | Optional | Recommended for secret management (`op`) |

### Power Apps Code Apps licensing

Code Apps are a **premium Power Apps feature**. Publishing (`pac code push`) requires one of:

- **Power Apps Premium** per-user license for each user running the app, OR
- **Power Apps Developer Plan** (free, individual use only) for personal learning, OR
- **Microsoft 365 Developer Program** sandbox tenant (free, renewable) for learning and demos

If you are trying this template **for the first time or for personal learning**, sign up for the free [Microsoft 365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program) and create a developer tenant. It gives you a Power Platform environment with Dataverse and permissions to create App Registrations — which your corporate tenant likely will not let you do.

Code Apps also require the **Power Platform environment to have Dataverse provisioned** (most environments do by default, but "Teams environments" do not). If `pac org who` works but `pac code init` fails with a Dataverse-related error, provision Dataverse on the environment from the Power Platform Admin Center.

### Windows, macOS, Linux

The wizard and all scripts run natively on all three platforms. Two notes for Windows:

- Use the **`.mjs`** entry points directly: `node scripts/setup-auth.mjs`, `node scripts/sync-foundations.mjs`, etc. The matching `.sh` files are thin Bash wrappers for macOS and Linux only — they do not run in `cmd.exe` or PowerShell without WSL or Git Bash.
- Run the wizard the same way on every platform: `cd wizard && node index.mjs`.

## New here? Start with these

- [AGENTS.md](AGENTS.md) — Top-level agent directive. Read this if you are (or are using) a coding agent.
- [docs/glossary.md](docs/glossary.md) — One-page reference for Power Platform terminology. Skim before diving in.
- [.github/instructions/README.md](.github/instructions/README.md) — Map of the Copilot instruction set. **You probably do not need to read the individual files** — Copilot reads them for you.

## Quick Start

Use this README when you want the shortest text path through the repo.
Use [docs/guide.html](docs/guide.html) when you want the same flow as a visual walkthrough.
Use [docs/prototype-golden-path.md](docs/prototype-golden-path.md) when you want the full prototype-first sequence from planning through real providers.

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
npx degit your-org/PAppsCAFoundations my-code-app
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

If you prefer a visual walkthrough of the same sequence, open [docs/guide.html](docs/guide.html).

## Methodology

Foundations now assumes a deliberate sequence for non-trivial apps: plan first, prototype second, connect later.

1. Plan the business workflow
2. Prototype the UX against mock providers
3. Let prototype feedback change the planning payload
4. Freeze the Dataverse plan
5. Bind real connectors and implement real providers

This means the wizard does **not** expect connection IDs during the first scaffold run. Connector binding is a later, explicit move into connected mode.

When you are ready for real data, run:

```bash
node wizard/index.mjs --from 8
```

That later flow creates connection references in the solution, attempts to discover existing environment connections with `pac connection list`, and lets the developer select the right connection when matches exist.

## Execution Roadmap

Foundations is now evolving against an explicit 9-step robustness roadmap:

1. Execution contracts across the lifecycle
2. Schema-plan artifact workflow
3. Reusable Dataverse helper scripts
4. Stricter three-layer architecture rules
5. Testing as a deployment gate
6. Built-in smoke tests that pass from the first scaffold
7. Discovery helpers for human-in-the-loop tasks
8. Separate npm CLI migration evaluation
9. Foundations version traceability for downstream repos

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
3. **Guides you through the remaining portal-only steps** — App Registration, Application User setup, feature toggles, and other values the wizard cannot create for you
4. **Collects environment URLs** — Dev (required), Test, Prod (optional)
5. **Walks through App Registration** — Azure Portal steps with copy-paste-ready values
6. **Sets up authentication** — 1Password or .env.local, creates PAC auth profiles, verifies connection
7. **Scaffolds your Code App** — React + Fluent UI v9 + TanStack Query + TypeScript, configured per team standards, plus prototype assets seeded from the planning payload. Includes a `vitest.config.ts`, test setup, and smoke tests that the wizard runs automatically to verify the scaffold is healthy before proceeding.
8. **Binds connectors and data sources later** — discovers existing environment connections where possible, creates connection references, and moves the app into connected mode only when the prototype is stable
9. **Builds, verifies, and optionally deploys** — after prototype validation and connector binding are complete

Connector setup is intentionally deferred. The expected next move after scaffold is `npm run dev:local`, not collecting connection IDs.

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

There is also [docs/index.html](docs/index.html) — a marketing-style landing page that gives a high-level overview of the methodology, tech stack, and value proposition.

The short version is: plan first, prototype second, connect later.

If you started in the guide and want the concise repo overview, come back here to [README.md](README.md).

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
│   ├── index.html                          # Marketing landing page (Fluent UI design)
│   ├── guide.html                          # Interactive visual setup guide (sidebar walkthrough)
│   └── prototype-golden-path.md            # End-to-end delivery sequence from planning to real providers
├── scripts/
│   ├── decrypt-secret.mjs                  # Decrypt AES-256-GCM encrypted secrets from .env.local
│   ├── discover-copilot-connection.mjs     # Cross-platform Copilot Studio connection discovery
│   ├── discover-copilot-connection.sh      # Resolve Copilot Studio connection IDs safely
│   ├── export-solution.mjs                 # Export unmanaged, refresh solution-source, optionally pack managed
│   ├── generate-dataverse-plan.mjs         # Expand planning payloads into execution plans
│   ├── op-pac.mjs                          # Cross-platform 1Password wrapper for pac commands
│   ├── op-pac.sh                           # Legacy Bash wrapper for pac commands
│   ├── pac-safe.mjs                        # Safe pac CLI wrapper with version and profile guards
│   ├── patch-datasources-info.mjs          # Patch datasources-info.json after data source changes
│   ├── pre-commit-hook.sh                  # Git pre-commit hook to block accidental secret leaks
│   ├── register-dataverse-data-sources.mjs # Cross-platform Dataverse table registration via PAC
│   ├── register-dataverse-data-sources.sh  # Register planned tables with pac and regenerate SDK
│   ├── schema-plan.example.json            # Starter Dataverse planning artifact
│   ├── seed-prototype-assets.mjs           # Generate domain contracts, mock providers, and feedback artifacts
│   ├── setup-auth.mjs                      # Cross-platform auth setup (1Password or .env.local)
│   ├── setup-auth.sh                       # Legacy Bash auth setup
│   ├── setup-wizard.sh                     # Bash wrapper that delegates to the Node wizard
│   ├── sync-foundations.mjs                # Cross-platform template sync entry point
│   ├── sync-foundations.sh                 # Pull latest updates from the template repo
│   ├── validate-schema-plan.mjs            # Validate planning payloads before provisioning
│   └── tests/                              # Unit tests for scripts (connection discovery, scaffold, etc.)
├── wizard/                                 # Cross-platform Node.js setup wizard
│   ├── index.mjs                           # Entry point + step orchestrator
│   ├── lib/                                # Shared helpers (state, UI, shell, validation)
│   └── steps/                              # 9 step modules (01-prerequisites … 08-connectors + deploy)
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

This gives downstream repos a standard way to validate the planning payload, materialize normalized execution plans, and register the final Dataverse tables with `pac code add-data-source`, which refreshes the generated connector output as each table is added.

If you want the full recommended sequence from planning payload to mock UX to real providers, follow [docs/prototype-golden-path.md](docs/prototype-golden-path.md).

For later connector binding, prefer rerunning the wizard from the dedicated connector step:

```bash
node wizard/index.mjs --from 8
```

That path is designed for the point where the planning payload is stable enough that connection references and connection IDs are no longer guesses.

The `.mjs` entry points are the cross-platform defaults for macOS, Linux, and Windows. The `.sh` variants remain available as thin wrappers to those Node entry points so downstream repos do not drift into alternate behavior.

The same rule now applies to auth helpers: prefer `node scripts/setup-auth.mjs` and `node scripts/op-pac.mjs` as the canonical cross-platform entry points.

For solution ALM, prefer `node scripts/export-solution.mjs --name YourSolutionName --target dev` as the canonical export path. PAC profile selection is now repo-scoped and target-verified inside the helper instead of relying on generic profile names. It exports `solution/solution-unmanaged.zip`, rebuilds `solution-source/` for Git, and packs `solution/solution-managed.zip` for downstream import. Commit `solution-source/`; the zip files are gitignored build artifacts.

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

**What gets synced:** `.github/instructions/`, `wizard/`, `scripts/`, `docs/`, `.env.template`, `.foundations-version.json`

**What is never touched:** `src/`, `package.json`, `power.config.json`, `.env.local`, `solution/`, `README.md`, `.gitignore`

Each scaffolded project also gets a `.foundations-version.json` file so downstream repos can see which bundle version they currently have before syncing.

The script fetches the latest template via `degit`, shows a diff of what changed, and asks for confirmation before applying. Changes are committed as a single `chore: sync foundations` commit.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting issues, pull requests, and code standards.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for solutions to common issues with PAC CLI, authentication, 1Password, connections, and deployment.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting policy and security practices.

## License

This project is licensed under the [MIT License](LICENSE).
