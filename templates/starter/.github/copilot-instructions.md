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
- `src/generated/` is read-only — produced by pinned local `pa app add data-source` / refresh.
- Use local `pacaf-pa` for Code App operations and `pacaf-deploy --target dev` for guarded publishing. PAC stays for ALM/admin; auth is separate. Never bare `npx pa`, reinitialize an existing app, or grant SPN edit access automatically.
- CLI 1.0.2 home-account identity is not resource-tenant proof. Connected scaffold initialization and user publish/first creation require separate explicit Azure CLI login and matching read-only GDS environment/tenant/URL evidence; no auto-login or unguarded fallback.
- Connected dev uses Vite 3000 plus `pa app run --config-only --port 8080 --local-app-url http://localhost:3000` with companion shutdown. Preserve mock-only dev, HashRouter, relative production assets, and metadata-backed form labels.
- Solution-first: every Code App lives in a dedicated Power Platform solution from day one.
- Use the connector adapter pattern in `src/services/` to wrap generated services.

For everything else, defer to the instruction files under `.github/instructions/`.
