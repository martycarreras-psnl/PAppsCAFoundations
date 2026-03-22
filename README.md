# Power Apps Code Apps — Foundations

A **GitHub template repository** with opinionated, comprehensive GitHub Copilot instruction files for building Power Apps Code Apps. Each new project starts from this template — you get the full instruction set, setup wizard, and scaffolding tools from your first commit.

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

## Interactive Guide

Open [docs/guide.html](docs/guide.html) in your browser for a visual walkthrough of the entire setup process, tech stack, naming conventions, and Power Apps Maker Portal links — all in one page.

## Quick Start

### Option A: Use this template (recommended)

This is the standard GitHub workflow. It creates a brand-new repo under your account/org with no shared git history.

1. Click the green **"Use this template"** button at the top of this repo → **"Create a new repository"**
2. Name your new repo (e.g. `my-expense-tracker`), set visibility, and click **Create**
3. Clone **your new repo** and run the wizard:

```bash
git clone https://github.com/your-org/my-expense-tracker.git
cd my-expense-tracker/wizard
npm install
node index.mjs
```

Because you cloned your own repo, `origin` already points to the right place. The wizard detects this and skips the remote URL prompt.

### Option B: degit (no GitHub account required)

If you just want to explore or don't want to create a GitHub repo yet:

```bash
npx degit macarrer_microsoft/PAppsCAFoundations my-code-app
cd my-code-app/wizard
npm install
node index.mjs
```

`degit` downloads the files without any `.git` history. The wizard will `git init` a fresh repo and ask you for a remote URL during Step 7 — you can provide one then or add it later.

> **Do NOT `git clone` this template repo directly** — that leaves `origin` pointing back to PAppsCAFoundations instead of your own repo.

> **Works on Windows, macOS, and Linux — no bash required.**

### What the wizard does

1. **Checks your machine** — Node.js, Git, .NET, PAC CLI, 1Password CLI
2. **Collects project identity** — publisher prefix, solution name, app name
3. **Guides you through Power Apps Maker Portal and Admin Center steps** — tells you exactly what to click and type, using the values you just entered
4. **Collects environment URLs** — Dev (required), Test, Prod (optional)
5. **Walks through App Registration** — Azure Portal steps with copy-paste-ready values
6. **Sets up authentication** — 1Password or .env.local, creates PAC auth profiles, verifies connection
7. **Scaffolds your Code App** — React + Fluent UI v9 + TanStack Query + TypeScript, configured per team standards
8. **Builds, verifies, and optionally deploys** — first `pac code push` to Power Platform

You can quit anytime with Ctrl+C — the wizard saves your progress and picks up where you left off.

To start over: `node wizard/index.mjs --reset`

> **Prefer bash?** The original shell wizard is still available: `bash scripts/setup-wizard.sh` (macOS/Linux only).

### Already set up? Manual path

If you've already completed the Power Apps Maker Portal and Admin Center steps and have credentials:

```bash
cp .env.template .env.local   # Fill in credentials
bash scripts/setup-auth.sh    # Create PAC auth profiles
pac org who                   # Verify (no browser popup)
```

See `00-environment-setup.instructions.md` for details.

## How It Works

When you open this project in VS Code with GitHub Copilot, the `.github/instructions/*.instructions.md` files are automatically loaded. Copilot uses them to generate code that follows your team's exact standards — Fluent UI v9 components, TanStack Query hooks for connectors, solution-aware Dataverse patterns, and more.

Each file has an `applyTo` scope so Copilot only loads the relevant instructions based on which files you're editing.
