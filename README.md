# Power Apps Code Apps — Foundations

A template repository with opinionated, comprehensive GitHub Copilot instruction files for building Power Apps Code Apps. Clone this repo (or use it as a template) to give every developer on your team consistent, AI-assisted guidance for scaffolding, connectors, components, deployment, testing, and security.

## What's Inside

```
PAppsCAFoundations/
├── .github/
│   └── instructions/                       # GitHub Copilot instruction files
│       ├── 00-environment-setup.instructions.md   # App Registration, 1Password, headless auth
│       ├── 01-scaffold.instructions.md            # Solution-first rules, project structure, tech stack
│       ├── 02-connectors.instructions.md          # Data sources, Dataverse, SQL, O365, Custom APIs
│       ├── 03-components.instructions.md          # React + Fluent UI v9 patterns, state management
│       ├── 04-deployment.instructions.md          # CI/CD, pac code push, ALM, solution management
│       ├── 05-testing.instructions.md             # Vitest, Playwright, MSW connector mocking
│       └── 06-security.instructions.md            # Auth, secrets, DLP, input validation
├── scripts/
│   ├── setup-auth.sh                       # One-command auth setup (1Password or .env.local)
│   └── op-pac.sh                           # 1Password wrapper for pac commands
│   └── setup-wizard.sh                     # Guided local setup wizard for new developers
├── .env                                    # 1Password secret references (safe to commit)
├── .env.template                           # Template for teams not using 1Password
├── .gitignore
└── README.md
```

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/macarrer_microsoft/PAppsCAFoundations.git my-code-app
cd my-code-app
npm install
```

### 2. Set up authentication

**If using 1Password (recommended):**
- Ensure you have access to the team's shared 1Password vault
- Update `.env` with your vault/item/field names
- Run `npm run setup:auth`

**If using .env.local:**
- Copy `.env.template` to `.env.local`
- Fill in credentials from your team lead
- Run `npm run setup:auth`

### Optional: use the local setup wizard (recommended for first-time users)

```bash
bash scripts/setup-wizard.sh
```

The wizard walks you through tool checks, dependency install, and auth setup with simple prompts.

### 3. Verify (no browser popup)

```bash
pac org who
```

### 4. Start building

See `00-environment-setup.instructions.md` for full setup details, then `01-scaffold.instructions.md` for project scaffolding.

## How It Works

When you open this project in VS Code with GitHub Copilot, the `.github/instructions/*.instructions.md` files are automatically loaded. Copilot uses them to generate code that follows your team's exact standards — Fluent UI v9 components, TanStack Query hooks for connectors, solution-aware Dataverse patterns, and more.

Each file has an `applyTo` scope so Copilot only loads the relevant instructions based on which files you're editing.

## Using as a Template

1. Go to this repo's Settings → check "Template repository"
2. Every new Code App starts with "Use this template" on GitHub
3. Developers get the full instruction set from their first commit
