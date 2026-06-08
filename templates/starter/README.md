# Power Apps Code App — Starter

This is the minimal starter for a [Power Apps Code App](https://learn.microsoft.com/en-us/power-platform/power-apps/maker/canvas-apps/code-apps/overview), generated from the [Power Apps Code App Foundations](https://github.com/martycarreras-psnl/PAppsCAFoundations) template.

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
