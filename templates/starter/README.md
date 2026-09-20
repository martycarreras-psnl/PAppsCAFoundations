# Power Apps Code App — Starter

This is the minimal starter for a [Power Apps Code App](https://learn.microsoft.com/en-us/power-platform/power-apps/maker/canvas-apps/code-apps/overview), generated from the [Power Apps Code App Foundations](https://github.com/martycarreras-psnl/PAppsCAFoundations) template.

## Prerequisites

You need VS Code with a coding-agent extension (GitHub Copilot Chat, Claude Code, Cursor, …) signed in — that's how you drive the wizard. All commands below run in the VS Code terminal (`` Ctrl+` `` on Windows, `` ⌃` `` on macOS).

Quick check — run these commands:

```bash
node --version
git --version
dotnet --version
pac help
```

Then run `python3 --version` on macOS/Linux, or `py -3 --version` on Windows (fall back to a real `python.exe`, never the Microsoft Store alias). If every command succeeds and Node is one of the supported LTS lines below, you're ready to run the wizard.

| Tool | Why | Version |
|---|---|---|
| Node.js | Runs the wizard and all build tooling (installs npm) | 22 or 24 LTS (24 recommended) |
| Git | Version control; the wizard commits scaffolded files | 2.x+ |
| .NET SDK | Required by the PAC CLI | 8.x+ |
| PAC CLI | Solution ALM/admin and Dataverse tooling (`dotnet tool install -g Microsoft.PowerApps.CLI.Tool`) | Team-tested version |
| Python 3 | Recommended — powers the Dataverse-skills plugin | 3.10+ for the SDK |
| GitHub CLI (optional) | Convenience for repo/PR/auth from the terminal | 2.x+ |
| Azure CLI (user publishing only) | Read-only Global Discovery Service environment/tenant verification after separate explicit login; not required for mocks/offline preflight/SPN updates | [Official install guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) |

**Install notes**

- After installing any tool, close and reopen the VS Code terminal so PATH changes take effect.
- Windows: install Node.js from [nodejs.org](https://nodejs.org/) (24 LTS), .NET from [dotnet.microsoft.com](https://dotnet.microsoft.com/download), and tick "Add python.exe to PATH" when installing Python. Prefer `py -3 --version`; do not probe the `python3` Store alias.
- macOS: use the official Node installer or an existing version manager. If you already use [Homebrew](https://brew.sh/), select `node@24`, not the current non-LTS line.
- Node 20 is EOL and Node 25/26 are unsupported as of September 2026. The wizard detects and blocks unsupported Node; it never changes your global installation. After switching Node, restart the wizard, not just the step.
- The wizard records `PYTHON_CMD`. SDK installs must use that interpreter with `-m pip`; a missing SDK import means **Python is installed**, not that Python needs reinstalling. See the [Dataverse setup guide](https://github.com/martycarreras-psnl/PAppsCAFoundations/blob/main/docs/dataverse-skills-setup.md).
- PAC CLI `command not found` after install → add `$HOME/.dotnet/tools` (macOS) or `%USERPROFILE%\.dotnet\tools` (Windows) to PATH, then restart the terminal.

> **On a Microsoft-managed device?** Direct access to the public PyPI and NuGet registries may be blocked by policy (Central Feed Services). If `dotnet tool install` or `pip install` fail with a **connection / DNS / 403** error (not a certificate error), point your package managers at the approved proxy feeds:
> ```bash
> pip config set global.index-url https://packagefeedproxy.microsoft.io/pypi/simple
> dotnet nuget add source https://packagefeedproxy.microsoft.io/nuget/v3/index.json -n CFS
> ```
> Many managed devices already have these configured by policy — in that case no action is needed. These proxies are Microsoft-internal and are not reachable from non-Microsoft networks.

Full step-by-step guide (per-OS, with verification): <https://github.com/martycarreras-psnl/PAppsCAFoundations/blob/main/docs/prerequisite-setup.md>

## Get started

Run the setup wizard. It scaffolds the Code App, configures auth, provisions the Power Platform solution, and (optionally) registers your first connectors and data sources:

```bash
npx @pacaf/wizard-ux@latest
```

That's it. The wizard handles dependency installation, local `pa app init`, and the first smoke test. It installs exact-pinned `@microsoft/power-apps-cli@1.0.2` separately from runtime SDK `@microsoft/power-apps@1.4.0`. No `wizard/`, `scripts/`, or `docs/` directory is copied into your repo — those are kept centrally and updated via `npx pacaf-update`.

### Working after setup

```bash
npm run dev:local                 # mock-only Vite, no platform auth needed
npm run pa -- auth login          # separate from PAC auth
npm run pa -- auth status --json
npm run dev                       # Vite 3000 + Power Apps local host 8080
npm run deploy -- --preflight      # non-mutating target validation
npm run deploy                    # guarded entry point; user mode needs Azure login/GDS evidence
```

The local host uses `--config-only` and companion shutdown, so it cannot start a second Vite process. Deploy uses `.power-apps-targets.json` plus the preserved `power.config.json`, not just ignored wizard state. Initial creation requires an explicit `--allow-create`; SPN updates require separate opt-in and pre-existing maker-granted edit access. Never use bare `npx pa`, bypass target checks, or grant permissions automatically.

**User-publish prerequisite:** CLI 1.0.2 home-account identity cannot prove the resource tenant. Separately sign into Azure CLI (`az login --allow-no-subscriptions --tenant "<expected-tenant-id>"`) with Global Discovery Service access. User publish/first creation verifies environment ID, tenant, and URL via a read-only fixed-cloud GDS query. Missing rows/access fail closed; there is no auto-login or unguarded fallback. Offline preflight makes no Azure/auth calls.

Already have a PAC-created app? Follow the [Code App CLI migration and rollback guide](https://github.com/martycarreras-psnl/PAppsCAFoundations/blob/main/MIGRATION.md); do not rerun init or recreate bindings.

## What this template gives you

- `.env.template` — environment variable scaffold (the wizard fills it out)
- `.gitignore` — sensible defaults for Power Apps Code Apps
- `.github/copilot-instructions.md` — pointer for VS Code Copilot to load the foundation's agent guidance via `@pacaf/agent-instructions`
- `AGENTS.md` / `CLAUDE.md` — bootstrap pointers so Copilot CLI, Claude Code, Cursor, and other agents know to run the wizard and load the full guidance (the sync replaces these with the full versions)
- This README

After the wizard runs, you will additionally have `src/`, `package.json`, `vite.config.ts`, `power.config.json`, `.github/instructions/`, and everything else needed to build and deploy.

## Updating later

```bash
npx pacaf-update          # refresh @pacaf/scripts and instruction files
npx pacaf-update --check  # only show drift, don't write
```

## Docs

Full guidance lives at <https://martycarreras-psnl.github.io/PAppsCAFoundations>.
