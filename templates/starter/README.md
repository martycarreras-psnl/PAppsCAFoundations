# Power Apps Code App — Starter

This is the minimal starter for a [Power Apps Code App](https://learn.microsoft.com/en-us/power-platform/power-apps/maker/canvas-apps/code-apps/overview), generated from the [Power Apps Code App Foundations](https://github.com/martycarreras-psnl/PAppsCAFoundations) template.

## Prerequisites

You need VS Code with a coding-agent extension (GitHub Copilot Chat, Claude Code, Cursor, …) signed in — that's how you drive the wizard. All commands below run in the VS Code terminal (`` Ctrl+` `` on Windows, `` ⌃` `` on macOS).

Quick check — paste this into the terminal to verify everything at once:

```bash
node --version && git --version && dotnet --version && pac help && python3 --version
```

If every line prints a version number with no errors, you're ready to run the wizard.

| Tool | Why | Version |
|---|---|---|
| Node.js | Runs the wizard and all build tooling (installs npm) | v20+ |
| Git | Version control; the wizard commits scaffolded files | 2.x+ |
| .NET SDK | Required by the PAC CLI | 8.x+ |
| PAC CLI | Registers and deploys the Code App to Power Platform (`dotnet tool install -g Microsoft.PowerApps.CLI.Tool`) | latest |
| Python 3 | Recommended — powers the Dataverse-skills plugin | 3.x+ |
| GitHub CLI (optional) | Convenience for repo/PR/auth from the terminal | 2.x+ |

**Install notes**

- After installing any tool, close and reopen the VS Code terminal so PATH changes take effect.
- Windows: install Node.js from [nodejs.org](https://nodejs.org/) (LTS), .NET from [dotnet.microsoft.com](https://dotnet.microsoft.com/download), and tick "Add python.exe to PATH" when installing Python. Use `py -3 --version` if `python3` opens the Microsoft Store.
- macOS: easiest via [Homebrew](https://brew.sh/): `brew install node@20 git dotnet-sdk python@3`.
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

That's it. The wizard handles `pnpm install`, `pac code init`, dependency selection, and the first smoke test. No `wizard/`, `scripts/`, or `docs/` directory is copied into your repo — those are kept centrally and updated via `npx pacaf-update`.

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
