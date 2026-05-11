<!-- Generated from .github/instructions/ — do not edit directly. See docs/agent-support.md -->
# Scripts — Codex Scoped Guidance

Helper scripts for setup, schema, deployment, and wizard automation.

## Key Scripts

- `setup-auth.mjs` — Create PAC auth profiles
- `validate-schema-plan.mjs` — Validate Dataverse planning artifact
- `generate-dataverse-plan.mjs` — Generate execution plans from planning artifact
- `register-dataverse-data-sources.mjs` — Register tables with `pac code add-data-source`
- `generate-agent-guidance.mjs` — Regenerate agent-native guidance from canonical instructions
- `discover-copilot-connection.mjs` — Find Microsoft Copilot Studio connections

## Rules

- All scripts use Node.js ESM (`.mjs`, `import`/`export`)
- Use `execFileSync` with argument arrays — never template strings in shell commands
- No secrets in scripts — use environment variables or 1Password references

Full details: `.github/instructions/00-environment-setup.instructions.md`, `.github/instructions/07-dataverse-schema.instructions.md`
