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

### What the wizard does

1. **Checks your machine** — Node.js, Git, .NET, PAC CLI, 1Password CLI
2. **Collects project identity** — publisher prefix, solution name, app name
3. **Guides you through Power Apps portal steps** — tells you exactly what to click and type, using the values you just entered
4. **Collects environment URLs** — Dev (required), Test, Prod (optional)
5. **Walks through App Registration** — Azure Portal steps with copy-paste-ready values
6. **Sets up authentication** — 1Password or .env.local, creates PAC auth profiles, verifies connection
7. **Scaffolds your Code App** — React + Fluent UI v9 + TanStack Query + TypeScript, configured per team standards
8. **Builds, verifies, and optionally deploys** — first `pac code push` to Power Platform

### Already set up? Manual path

If you've already completed the Power Platform portal and Admin Center steps and have credentials:

```bash
cp .env.template .env.local   # Fill in credentials
bash scripts/setup-auth.sh    # Create PAC auth profiles
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
│   ├── op-pac.sh                           # 1Password wrapper for pac commands
│   ├── setup-auth.sh                       # One-command auth setup (1Password or .env.local)
│   ├── sync-foundations.sh                 # Pull latest updates from the template repo
│   └── setup-wizard.sh                     # Guided 8-step setup wizard (bash, legacy)
├── wizard/                                 # Cross-platform Node.js setup wizard
│   ├── index.mjs                           # Entry point + step orchestrator
│   ├── lib/                                # Shared helpers (state, UI, shell, validation)
│   └── steps/                              # 8 step modules (01-prerequisites … 08-verify-deploy)
├── solution/                               # Power Platform solution artifacts
├── .env                                    # 1Password secret references (safe to commit)
├── .env.template                           # Template for teams not using 1Password
├── .gitignore
└── README.md
```

## How It Works

When you open this project in VS Code with GitHub Copilot, the `.github/instructions/*.instructions.md` files are automatically loaded. Copilot uses them to generate code that follows your team's exact standards — Fluent UI v9 components, TanStack Query hooks for connectors, solution-aware Dataverse patterns, and more.

Each file has an `applyTo` scope so Copilot only loads the relevant instructions based on which files you're editing.

## Staying Updated

Projects created from this template can pull improvements (new instruction files, wizard fixes, security updates) without affecting project-specific code:

```bash
npm run sync:foundations            # Preview changes + apply
npm run sync:foundations -- --dry-run   # Preview only, no changes
```

**What gets synced:** `.github/instructions/`, `wizard/`, `scripts/`, `docs/guide.html`, `.env.template`

**What is never touched:** `src/`, `package.json`, `power.config.json`, `.env.local`, `solution/`, `README.md`, `.gitignore`

The script fetches the latest template via `degit`, shows a diff of what changed, and asks for confirmation before applying. Changes are committed as a single `chore: sync foundations` commit.
