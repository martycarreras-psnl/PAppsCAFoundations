# GitHub Copilot — load the Power Apps Code App Foundations agent guidance

This repository is a Power Apps Code App generated from the [PAppsCAFoundations](https://github.com/martycarreras-psnl/PAppsCAFoundations) template.

The authoritative agent guidance is published as the `@pacaf/agent-instructions` npm package and materialized into this repo's `.github/instructions/`, `.claude/rules/`, and `.cursor/rules/` directories.

If those directories are empty or missing, run:

```bash
npx @pacaf/agent-instructions sync
```

To check for drift against the latest published guidance:

```bash
npx @pacaf/agent-instructions check
```

To update everything (scripts + instructions) in one shot:

```bash
npx pacaf-update
```

## Architecture rules (load all `.github/instructions/*.instructions.md` for the full set)

- This is a Power Apps Code App. Do not suggest Vercel/Netlify/Azure-SWA hosting, alternative frameworks, or CSS libraries other than Fluent UI v9.
- Port 3000 for local dev (Power Apps SDK requirement).
- `src/generated/` is read-only — produced by `pac code add-data-source`.
- Solution-first: every Code App lives in a dedicated Power Platform solution from day one.
- Use the connector adapter pattern in `src/services/` to wrap generated services.

For everything else, defer to the instruction files under `.github/instructions/`.
