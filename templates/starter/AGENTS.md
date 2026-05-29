# Agent guidance — Power Apps Code App

This repository is a **Power Apps Code App** generated from the [Power Apps Code App Foundations](https://github.com/martycarreras-psnl/PAppsCAFoundations) template. It is read by every coding agent that honors `AGENTS.md` (GitHub Copilot CLI, Claude Code, Cursor, Cline, Aider, and others).

## First move on a fresh clone

If this repo has no `src/`, no `power.config.json`, and no `package.json` with app dependencies, the setup wizard has **not** run yet. Before generating any application code, run the browser-based wizard:

```bash
npx @pacaf/wizard-ux@latest
```

For headless / SSH-only environments, use the terminal wizard:

```bash
npx @pacaf/wizard@latest
```

The wizard configures the publisher, solution, App Registration, auth profile, `pac code init`, dependency selection, and the first smoke test in the correct order. **Do not hand-scaffold a Code App** — skipping the wizard produces apps that cannot be deployed.

## Load the full agent guidance

The authoritative guidance is published as the `@pacaf/agent-instructions` npm package. The wizard materializes it into this repo, but you can also do it directly:

```bash
npx @pacaf/agent-instructions sync
```

This writes the complete `.github/instructions/`, `.claude/rules/`, `.cursor/rules/`, plus the full `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` — **replacing this bootstrap file** with the full version. After syncing, load all `.github/instructions/*.instructions.md` for the complete ruleset.

## Non-negotiable rules (even before the full guidance loads)

- This is a Power Apps Code App. Do **not** suggest Vercel / Netlify / Azure Static Web Apps hosting, alternative frameworks (Next.js, Angular, Vue), or CSS libraries other than Fluent UI v9.
- **Port 3000** for local dev (Power Apps SDK requirement).
- `src/generated/` is **read-only** — produced by `pac code add-data-source`. Wrap it with adapters in `src/services/`.
- **Solution-first:** every Code App lives in a dedicated Power Platform solution from day one.
- Use **HashRouter**, never `BrowserRouter` (the Power Apps host owns the URL path).
- No secrets in source.

For everything else, defer to the instruction files under `.github/instructions/` after running the sync.
