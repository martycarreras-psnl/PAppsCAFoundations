<!-- Generated from .github/instructions/ — do not edit directly. See docs/agent-support.md -->
# Scripts — Codex Scoped Guidance

Helper scripts for setup, schema, deployment, and wizard automation.

## Key Scripts

- `setup-auth.mjs` — Create PAC auth profiles
- `seed-prototype-assets.mjs` — Seed prototype mock providers, hooks, and components
- `generate-agent-guidance.mjs` — Regenerate agent-native guidance from canonical instructions
- `discover-copilot-connection.mjs` — Find Microsoft Copilot Studio connections

> Dataverse schema, data, query, solution, and export operations are **not** in this package — they are owned by the [Dataverse-skills plugin](https://github.com/microsoft/Dataverse-skills) (`dv-metadata`, `dv-data`, `dv-query`, `dv-solution`, `dv-admin`, `dv-security`).

## Rules

- All scripts use Node.js ESM (`.mjs`, `import`/`export`)
- Use `execFileSync` with argument arrays — never template strings in shell commands
- No secrets in scripts — use environment variables or 1Password references

Full details: `.github/instructions/00-environment-setup.instructions.md`, `.github/instructions/07-dataverse-schema.instructions.md`
