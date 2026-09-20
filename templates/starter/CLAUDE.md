# Claude Code — Power Apps Code App

@AGENTS.md

This repository is a **Power Apps Code App** generated from the [Power Apps Code App Foundations](https://github.com/martycarreras-psnl/PAppsCAFoundations) template.

See `AGENTS.md` (imported above) for the first move on a fresh clone and the non-negotiable architecture rules.

## TL;DR

- **Fresh clone?** Run `npx @pacaf/wizard-ux@latest` before writing any app code.
- **Need the full guidance?** Run `npx @pacaf/agent-instructions sync` to materialize `.claude/rules/`, `.github/instructions/`, and the full `CLAUDE.md` / `AGENTS.md` — this replaces this bootstrap file.
- This is a Power Apps Code App: no non-Power-Platform hosting, no alternative frameworks, Fluent UI v9 only, port 3000, `src/generated/` is read-only, HashRouter not BrowserRouter, no secrets in source.
- Code App lifecycle uses pinned local `pacaf-pa`; publish through `pacaf-deploy --target dev`. PAC remains for ALM/admin with separate auth. Never use bare `npx pa`, reinitialize existing apps, or grant SPN permissions automatically. Follow `AGENTS.md` for the full dual-CLI boundary.
