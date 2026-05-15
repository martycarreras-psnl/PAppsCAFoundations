# Power Apps Code App Foundations

[![CI](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/ci.yml/badge.svg)](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/ci.yml)
[![Release](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/release.yml/badge.svg)](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/release.yml)
[![npm: @pacaf/wizard-ux](https://img.shields.io/npm/v/@pacaf/wizard-ux?label=%40pacaf%2Fwizard-ux)](https://www.npmjs.com/package/@pacaf/wizard-ux)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**The fastest way to scaffold, deploy, and maintain a [Power Apps Code App](https://learn.microsoft.com/en-us/power-platform/power-apps/maker/canvas-apps/code-apps/overview).**

This repository is the central source for the [`@pacaf/*`](https://www.npmjs.com/org/pacaf) family of npm packages — the setup wizard, helper scripts, and agent guidance that turn an empty repository into a deployable Power Apps Code App. The packages install as devDependencies, so each project you create stays light: only a small amount of metadata and configuration lives in your repo; the tooling lives in npm and updates like any other package.

---

## 🚀 I just want to build a Code App

You'll do everything from inside **VS Code with a coding agent enabled** (GitHub Copilot Chat in Agent mode, Claude Code, Cursor, or similar). The agent reads the guidance shipped by `@pacaf/agent-instructions` and drives the wizard, the deploy, and day-two changes for you.

> ### 🛑 Brand-new machine? Do this first — the agent cannot.
>
> The wizard runs via `npx`, which means **Node.js must already be installed**. Likewise, the agent cannot install the .NET SDK, the PAC CLI, Python, or Git for you — those need installers with admin rights and PATH changes that no terminal command in a coding-agent session can reliably do, especially on Windows.
>
> **If this is a fresh laptop, follow [docs/prerequisite-setup.md](docs/prerequisite-setup.md) first.** It takes about 10 minutes. Then come back here.
>
> A 30‑second self-test you can paste into the VS Code terminal **before** asking your agent to run the wizard:
>
> ```bash
> node --version && npm --version && git --version && dotnet --version && pac help
> ```
>
> On **Windows**, also run `py -V`. On **macOS / Linux**, also run `python3 --version`.
>
> If any of those print *"command not found"* / *"is not recognized"* / opens the Microsoft Store, **do not ask the agent to run the wizard yet** — open [the prerequisite guide](docs/prerequisite-setup.md) and install the missing piece. Close and reopen the VS Code terminal after each install so the new PATH takes effect.
>
> **Common Windows gotchas** that look like PACAF bugs but are not:
> - `python3` opens the Microsoft Store → test with `py -V` instead.
> - VS Code terminal defaults to `cmd.exe`, not PowerShell → Command Palette → **Terminal: Select Default Profile** → **PowerShell**.
> - `pac help` fails right after `dotnet tool install` → close and reopen the terminal; it's a PATH refresh, not a reinstall.
> - `npx` returns exit code 9009 → Node.js is missing or the terminal needs restarting.
>
> If you skip this step and ask the agent to "just run the wizard", the wizard will fail with a cryptic error that looks like a bug. It isn't — the prerequisites are missing. Your agent is also instructed (via [`.github/instructions/00-prereq-gate.instructions.md`](.github/instructions/00-prereq-gate.instructions.md)) to detect this and stop with a clear list of what to install, but the cleanest experience is to do the precheck yourself first.

### Prerequisites

You also need a [Power Platform environment](https://admin.powerplatform.microsoft.com) you can deploy to (developer/sandbox is fine) and a GitHub account. Everything else is a local tool:

| Tool | When & why you need it | Required? |
|---|---|---|
| **[VS Code](https://code.visualstudio.com/)** | Hosts the coding agent (GitHub Copilot Chat, Claude Code, Cursor, …) that drives the wizard, planning workflow, schema provisioning, and day‑two edits. The whole UX assumes an agent‑capable editor. | **Required** |
| **[Git](https://git-scm.com/)** | Clones the template, tracks changes, lets the wizard auto‑commit scaffolded files, and powers the upstream‑sync workflow when new PACAF versions ship. | **Required** |
| **[GitHub CLI (`gh`)](https://cli.github.com/)** | Convenience only — no PACAF tool invokes `gh` directly. Useful if you prefer creating the repo from the template (`gh repo create --template …`) and managing PRs from the terminal instead of the browser. | Optional |
| **[Node.js 20+](https://nodejs.org/)** | Runs the wizard (`npx @pacaf/wizard-ux`), the Vite dev server on port 3000, `pnpm build`, and every `pacaf-*` CLI. Also installs `npm` and (via `corepack`) `pnpm`. | **Required** |
| **[.NET SDK 8+](https://dotnet.microsoft.com/download)** | Sole purpose: the PAC CLI is a .NET global tool. Without .NET you can't run `dotnet tool install -g Microsoft.PowerApps.CLI.Tool`. You never write .NET code in this template. | **Required** |
| **[Power Platform CLI (`pac`)](https://learn.microsoft.com/power-platform/developer/cli/introduction)** | The only bridge to Power Platform. Used by the wizard and agent for `pac auth`, `pac solution`, `pac code init`, `pac code add-data-source`, and `pac code push` (the actual deploy). | **Required** |
| **[Python 3](https://www.python.org/downloads/)** | Powers the [Dataverse‑skills plugin](https://github.com/microsoft/Dataverse-skills) (`dv-connect`, `dv-metadata`, `dv-data`, `dv-solution`, …) that the agent uses to provision tables, import data, and manage solutions. The wizard runs without it, but the agent will hit a wall on the first Dataverse step. | **Required** for the full agent flow |
| **Python Launcher (`py`)** | **Windows only.** On Windows, `python3` usually resolves to the Microsoft Store stub (which exits non‑zero and prompts to install). The wizard's prereq check falls back to `py -3` via the launcher. You get it automatically when you check **"Add python.exe to PATH"** in the python.org installer. | **Required on Windows** — irrelevant on macOS/Linux |

> **First time on this machine?** Follow the [Prerequisite Setup Guide](docs/prerequisite-setup.md) — it walks you through installing each tool step by step on macOS or Windows, with copy‑pasteable commands and verification checks. Takes about 10 minutes.

### Step 1. Create your repo from this template

Click **[Use this template → Create a new repository](https://github.com/martycarreras-psnl/PAppsCAFoundations/generate)** at the top of this page. You'll get a clean repo containing a starter README, `.gitignore`, `.env.template`, and a `.github/copilot-instructions.md` pointer that tells your agent where to load the foundations guidance from. Clone the new repo and open it in VS Code.

### Step 2. Ask your agent to run the wizard

Open the agent chat panel in VS Code and say something like:

> **"Set up this Code App using the PACAF wizard."**

The agent will:

1. Detect that this is a starter repo (it sees `.env.template` and the empty `src/` tree).
2. Launch the wizard for you — preferring the browser-based UX:
   ```bash
   npx @pacaf/wizard-ux@latest
   ```
   This opens a wizard at `http://127.0.0.1:5174` in your browser. (If you prefer to stay in the terminal, ask the agent for the CLI version: `npx @pacaf/wizard@latest`.)
3. Walk you through the 10 wizard steps — prerequisite checks, App Registration, auth, solution creation, code scaffolding, data source registration, first smoke test — answering questions in plain English while you pick values in the UI for the steps that need your decisions (publisher prefix, environment URL, solution name, etc.).
4. Commit the scaffolded files (`src/`, `package.json`, `vite.config.ts`, `power.config.json`, `.github/instructions/`, …) once the wizard finishes.

You don't need to run anything by hand. If the agent gets stuck, paste the wizard's error output into chat and it will diagnose using the guidance in `.github/instructions/`.

### Step 3. Plan first, then build

Don't jump straight into "add a table and a page." Your agent has been pre-loaded with a **planning workflow** — a sequence of instruction files that walk you from a fuzzy business problem to a validated Dataverse model and a working app, in deliberate order:

1. **`00a` Business problem decomposition** — what are we actually solving, for whom, with what outcomes?
2. **`00b` Scope refinement and solution shaping** — workflows, approvals, exceptions, reporting, governance, automation placement
3. **`00c` Solution concept to Dataverse plan** — translate refined scope into candidate entities, relationships, lifecycle states
4. **`00d` Prototype validation** — exercise the UX with mock data before schema hardens
5. Then schema, components, connectors, deployment

#### Switch your agent into Plan mode and start the conversation

| Agent | How to enter Plan mode |
|---|---|
| **GitHub Copilot Chat** | In the chat panel, switch the mode dropdown from *Ask* / *Edit* to **Agent**, then prefix your first message with `[[PLAN]]` |
| **Claude Code** | Toggle Plan mode with `⌘+Shift+P` → *Claude: Toggle Plan Mode*, or start your message with `/plan` |
| **Cursor** | Use **Composer → Plan** before *Apply* |
| **Other agents** | Tell it explicitly: *"Stay in plan mode. Don't write code yet."* |

Then describe what you want to build — in business terms, not technical ones:

> **"I want to manage equipment loans across our field offices. Multiple regions, approvers, and an audit trail when assets go missing. Help me plan this out properly before we touch any code or schema."**

Your agent will work through `00a → 00b → 00c → 00d`, asking the questions that matter (who approves, what triggers reassignment, what reports the operations lead needs, what happens when an asset is reported lost). It produces:

- A refined scope narrative
- A draft conceptual model
- A `dataverse/planning-payload.json` you can validate with `pacaf-validate`
- A prototype UX that exercises the model with mock data

You review and refine. Only after the plan is stable does the agent move to schema provisioning, real connectors, and deploy.

#### Then exit Plan mode and let the agent build

Once you're happy with the plan, switch out of Plan mode and say:

> **"Looks good. Provision the Dataverse schema, generate the connectors, and deploy to my dev environment."**

The agent runs the underlying commands — the same ones you could run yourself if you wanted:

```bash
pnpm dev          # local dev server on :3000
pnpm build        # produce ./dist/
pac code push     # upload ./dist/ to your Power Platform environment
```

> **First time on Power Apps Code Apps?** Read [docs/glossary.md](docs/glossary.md) for a one-page primer on Power Platform terminology. Your agent already has this loaded.
>
> **Curious about the planning workflow?** See [docs/prototype-golden-path.md](docs/prototype-golden-path.md) — the end-to-end recipe your agent is following.

### Keeping your project up to date

When new `@pacaf/*` versions ship, ask your agent:

> **"Update the PACAF tooling and refresh the agent instructions."**

It runs:

```bash
npx pacaf-update              # refresh @pacaf/scripts, @pacaf/agent-instructions, and instruction files
npx pacaf-update --check      # preview drift only, write nothing
```

Your tooling lives in npm and updates like any other dependency.

---

## 📦 What gets published

All five packages are published to public npm under [`@pacaf/*`](https://www.npmjs.com/org/pacaf). They are independently versioned via [Changesets](https://github.com/changesets/changesets) and released by GitHub Actions.

| Package | Purpose | Consumed by |
|---|---|---|
| **[`@pacaf/wizard-ux`](packages/wizard-ux/)** | Browser-based 10-step setup wizard (Fastify + React + xterm) | End users — `npx @pacaf/wizard-ux@latest` |
| **[`@pacaf/wizard`](packages/wizard/)** | Equivalent CLI wizard for headless/SSH workflows | End users — `npx @pacaf/wizard@latest` |
| **[`@pacaf/scripts`](packages/scripts/)** | 15 `pacaf-*` CLIs: validate, register, generate, seed, sync, update, migrate-thin, … | Derived repos as a **devDependency** |
| **[`@pacaf/agent-instructions`](packages/agent-instructions/)** | Agent guidance for GitHub Copilot, Claude, Cursor — synced into derived repos | Derived repos via `pacaf-instructions sync` |
| **[`@pacaf/rebrand`](packages/rebrand/)** | Retarget a fork to a different npm scope and bin prefix | Fork owners — `npx @pacaf/rebrand` |

### The `pacaf-*` CLIs at a glance

| CLI | Purpose |
|---|---|
| `pacaf-update` | Refresh `@pacaf/scripts` + `@pacaf/agent-instructions` and re-sync instruction files |
| `pacaf-migrate-thin` | Convert a derived repo from the in-tree tooling layout to consume `@pacaf/*` packages |
| `pacaf-instructions` | `sync` / `check` / `list` agent-guidance projections |
| `pacaf-validate` | Validate a Dataverse `planning-payload.json` against the schema |
| `pacaf-generate` | Generate a Dataverse plan from a planning artifact |
| `pacaf-register` | Register a Dataverse data source as a Code App connector |
| `pacaf-seed` | Seed prototype assets (mock providers, hooks, components) |
| `pacaf-discover-connection` | Discover existing Power Platform connections by API ID |
| `pacaf-export-solution` | Export a Power Platform solution as `.zip` |
| `pacaf-pac` / `pacaf-pac-safe` | Wrappers around `pac` CLI with retry + error normalization |
| `pacaf-setup-auth` | Idempotent PAC auth profile bootstrap |
| `pacaf-patch-datasources` | Patch `power.config.json` data source info |
| `pacaf-detect-agent` | Detect which coding agent is in use (Copilot / Claude / Cursor) |
| `pacaf-generate-agent-guidance` | Regenerate Claude/Cursor projections from the canonical instructions |
| `pacaf-decrypt-secret` | Decrypt a `.env.local` secret encrypted by the wizard |

---

## 🍴 I want to fork and own my own scope

Forking is a first-class workflow. Every brandable string (npm scope, bin prefix, template repo, docs URL) lives in **[`pacaf.config.json`](pacaf.config.json)** and the [`pacaf-rebrand`](packages/rebrand/) tool rewrites every reference in one command.

There are three paths depending on whether you want to republish under your own scope or just use upstream:

| Path | When to choose it |
|---|---|
| **A — Public npm scope** (`@contoso/*`) | You want to own and rebrand the toolchain. Most orgs pick this. |
| **B — Private GitHub Packages** | Regulated industries; proprietary instruction files; internal-only tooling |
| **C — No publishing**, customize template only | Small teams who just want a tweaked starter; updates from upstream `@pacaf/*` |

```bash
# After cloning your fork:
corepack enable && pnpm install
npx @pacaf/rebrand --scope @contoso --bin-prefix contoso
```

Full walkthrough including npm account setup, GitHub Packages PAT configuration, and the upstream-sync workflow: **[FORKING.md](FORKING.md)**.

---

## 🔄 I have an existing derived repo with the tooling in-tree

If your repo has `wizard/`, `wizard-ux/`, `scripts/`, and `docs/` directories at the root, it was generated before the tooling moved to npm. Migrate in one command:

```bash
npx pacaf-migrate-thin                # interactive
npx pacaf-migrate-thin --dry-run      # preview only
```

This archives the in-tree directories to `.pacaf-archive/`, rewrites `package.json` script references from `node scripts/X.mjs` to `pacaf-X`, adds the two devDependencies, and resyncs the instruction files. Full guide: **[MIGRATION.md](MIGRATION.md)**.

---

## 🤖 For coding agents working in *this* repo

> If you are a coding agent (GitHub Copilot, Claude Code, Cursor, Aider, etc.) and you are working in **this** repository — read this section, then go to [`AGENTS.md`](AGENTS.md).
>
> If you are an agent in a **derived** repo (one that was scaffolded by `@pacaf/wizard-ux`), your guidance is already installed at `.github/instructions/` and `AGENTS.md` — read those instead.

### Where things live in this monorepo

```
PAppsCAFoundations/
├── packages/                      ← the published @pacaf/* packages
│   ├── wizard/                    ← @pacaf/wizard         (interactive CLI)
│   │   ├── index.mjs              ← entrypoint, 10-step orchestrator
│   │   ├── lib/                   ← shared helpers (state, ui, shell, dataverse, …)
│   │   └── steps/                 ← one file per wizard step
│   ├── wizard-ux/                 ← @pacaf/wizard-ux      (browser UI)
│   │   ├── server/                ← Fastify backend (mirrors wizard/steps)
│   │   ├── src/                   ← React + Fluent UI frontend
│   │   └── dist/                  ← prebuilt UI bundle (shipped in tarball)
│   ├── scripts/                   ← @pacaf/scripts        (pacaf-* CLIs)
│   │   ├── *.mjs                  ← individual CLI implementations
│   │   ├── bin/                   ← npm bin shims for pacaf-update / pacaf-migrate-thin
│   │   └── tests/                 ← node --test unit tests
│   ├── agent-instructions/        ← @pacaf/agent-instructions (synced into derived repos)
│   │   ├── instructions/          ← canonical .github/instructions/*.instructions.md
│   │   ├── claude/                ← Claude Code projection
│   │   ├── cursor/                ← Cursor projection
│   │   └── meta/                  ← AGENTS.md, CLAUDE.md, copilot-instructions.md
│   └── rebrand/                   ← @pacaf/rebrand        (one-shot rewrite tool)
├── templates/
│   └── starter/                   ← what "Use this template" delivers (minimal)
├── .github/
│   ├── instructions/              ← canonical agent-guidance SOURCE OF TRUTH
│   └── workflows/                 ← ci.yml + release.yml
├── docs/                          ← GitHub Pages site (glossary, golden-path, etc.)
├── pacaf.config.json              ← branding source of truth
├── pnpm-workspace.yaml            ← workspace discovery
└── package.json                   ← root scripts: build, test, release, rebrand
```

### Key conventions agents must respect

1. **`.github/instructions/` is canonical.** `packages/agent-instructions/instructions/` and the `claude/` / `cursor/` projections are generated by `packages/agent-instructions/scripts/sync-from-root.mjs`. **Edit the canonical files, then run the sync script** — never the projections directly.
2. **`packages/wizard-ux/dist/` is committed and shipped.** It's the prebuilt React UI bundle. Don't `.gitignore` it; do regenerate it via `pnpm -r run build` before publishing.
3. **Cross-package imports must use package names** (`@pacaf/scripts/foo.mjs`), never relative paths (`../../scripts/foo.mjs`). The latter breaks in published tarballs.
4. **Workspace specifiers (`workspace:*`) only work because we use `pnpm publish -r`** — switching to `npm publish` would ship literal `workspace:*` strings to the registry. Don't change the `release` script in `package.json` without re-testing the publish path.
5. **The published wizard-ux server defaults to serving prebuilt `dist/`.** It only loads Vite when `WIZARD_UX_DEV=1` or `NODE_ENV=development`, because Vite is a devDependency.
6. **Branding is read from `pacaf.config.json` at runtime.** When the wizard scaffolds into a derived repo, it reads scope and bin prefix from this config so forks "just work" without code changes.

### How to add a new `pacaf-*` CLI

1. Drop your implementation as `packages/scripts/your-thing.mjs`.
2. Register it in `packages/scripts/package.json` under `"bin": { "pacaf-yourthing": "./your-thing.mjs" }`.
3. Add a `node --test` file under `packages/scripts/tests/` if it has business logic worth testing.
4. Update the CLI table in this README and add a changeset: `pnpm changeset`.

### How to add or modify agent guidance

1. Edit (or create) `.github/instructions/<NN>-<topic>.instructions.md`.
2. Run `pnpm -F @pacaf/agent-instructions build` to regenerate the projections under `packages/agent-instructions/{instructions,claude,cursor,meta}/`.
3. Add a changeset bumping `@pacaf/agent-instructions`.
4. Once published, derived repos pick up the change via `npx pacaf-update`.

---

## 🛠 For contributors to this repo

```bash
git clone https://github.com/martycarreras-psnl/PAppsCAFoundations.git
cd PAppsCAFoundations
corepack enable                   # uses pnpm version pinned in package.json
pnpm install
pnpm -r --if-present run build    # build all packages
pnpm -r --if-present run test     # run all tests
```

### Local smoke test of a published package without publishing

```bash
pnpm -F @pacaf/wizard-ux pack             # produces packages/wizard-ux/pacaf-wizard-ux-X.Y.Z.tgz
cd /tmp && mkdir test && cd test && npm init -y
npm i /path/to/pacaf-wizard-ux-X.Y.Z.tgz  # install the tarball
node node_modules/@pacaf/wizard-ux/server/index.mjs
```

### Releasing

Versioning uses [Changesets](https://github.com/changesets/changesets). For any change that should ship to npm:

```bash
pnpm changeset                    # interactive — pick packages and bump levels
git add .changeset && git commit -m "feat: ..."
```

When the PR merges to `main`:

1. `.github/workflows/release.yml` runs and opens (or updates) a **"Version Packages"** PR. This PR consumes pending changesets, bumps versions, and writes CHANGELOGs.
2. Merging the Version Packages PR triggers another release.yml run.
3. That run executes `pnpm publish -r --filter '@pacaf/*'`, which publishes every package whose version is not yet on npm and creates git tags.

> **Why `pnpm publish` and not `changeset publish`?** Changesets v2's publish path did not consistently rewrite `workspace:*` specifiers in our tarballs. `pnpm publish` guarantees the rewrite. Versioning still uses `changeset version`.

---

## 📚 Documentation

| Topic | Where |
|---|---|
| Power Platform glossary | [docs/glossary.md](docs/glossary.md) |
| Prototype-first golden path | [docs/prototype-golden-path.md](docs/prototype-golden-path.md) |
| Top-level agent contract | [AGENTS.md](AGENTS.md) |
| Per-domain instruction files | [.github/instructions/](.github/instructions/) |
| Forking guide | [FORKING.md](FORKING.md) |
| Migration guide | [MIGRATION.md](MIGRATION.md) |
| Troubleshooting | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Security policy | [SECURITY.md](SECURITY.md) |
| Hosted docs site | <https://martycarreras-psnl.github.io/PAppsCAFoundations> |

---

## License

MIT — see [LICENSE](LICENSE).
