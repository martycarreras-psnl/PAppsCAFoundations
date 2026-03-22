# Power Apps Code Apps — Foundations

A template repository with opinionated, comprehensive GitHub Copilot instruction files for building Power Apps Code Apps. Clone this repo (or use it as a template) to give every developer on your team consistent, AI-assisted guidance for scaffolding, connectors, components, deployment, testing, and security.

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
│   └── setup-wizard.sh                     # Guided 8-step setup wizard for new developers
├── solution/                               # Power Platform solution artifacts
├── .env                                    # 1Password secret references (safe to commit)
├── .env.template                           # Template for teams not using 1Password
├── .gitignore
└── README.md
```

## Interactive Guide

Open [docs/guide.html](docs/guide.html) in your browser for a visual walkthrough of the entire setup process, tech stack, naming conventions, and portal links — all in one page.

## Quick Start

Run one command. The wizard walks you through everything — tool checks, naming, portal steps, authentication, scaffolding, and your first deploy:

```bash
git clone https://github.com/macarrer_microsoft/PAppsCAFoundations.git my-code-app
cd my-code-app
bash scripts/setup-wizard.sh
```

The wizard:
1. **Checks your machine** — Node.js, Git, .NET, PAC CLI, 1Password CLI
2. **Collects project identity** — publisher prefix, solution name, app name
3. **Guides you through portal steps** — tells you exactly what to click and type in Power Platform admin center and maker portal, using the values you just entered
4. **Collects environment URLs** — Dev (required), Test, Prod (optional)
5. **Walks through App Registration** — Azure portal steps with copy-paste-ready values
6. **Sets up authentication** — 1Password or .env.local, creates PAC auth profiles, verifies connection
7. **Scaffolds your Code App** — React + Fluent UI v9 + TanStack Query + TypeScript, configured per team standards
8. **Builds, verifies, and optionally deploys** — first `pac code push` to Power Platform

You can quit anytime with Ctrl+C — the wizard saves your progress and picks up where you left off.

To start over: `bash scripts/setup-wizard.sh --reset`

### Already set up? Manual path

If you've already completed the portal steps and have credentials:

```bash
cp .env.template .env.local   # Fill in credentials
bash scripts/setup-auth.sh    # Create PAC auth profiles
pac org who                   # Verify (no browser popup)
```

See `00-environment-setup.instructions.md` for details.

## How It Works

When you open this project in VS Code with GitHub Copilot, the `.github/instructions/*.instructions.md` files are automatically loaded. Copilot uses them to generate code that follows your team's exact standards — Fluent UI v9 components, TanStack Query hooks for connectors, solution-aware Dataverse patterns, and more.

Each file has an `applyTo` scope so Copilot only loads the relevant instructions based on which files you're editing.

## Using as a Template

1. Go to this repo's Settings → check "Template repository"
2. Every new Code App starts with "Use this template" on GitHub
3. Developers get the full instruction set from their first commit
