<!-- Generated from .github/instructions/ — do not edit directly. See docs/agent-support.md -->
# Source Code — Codex Scoped Guidance

This directory contains a Power Apps Code App. Follow these rules for all source files.

## Architecture

- Three-layer architecture: Components → Hooks → Services/Providers → Generated (behind adapters)
- Components never call generated services directly
- `src/generated/` is **read-only** — produced by `pac code add-data-source`

## Tech Stack

React 18 + TypeScript + Vite + Fluent UI v9 + TanStack Query + React Router. No alternatives.

## Security

- No tokens, client secrets, or connection strings in source
- Auth is handled by the Power Platform host — no external auth libraries
- Validate/sanitize user input at component boundaries

## Form Fields (Non-Negotiable)

Every editable Dataverse-bound field must use `<DataverseFieldLabel>` backed by live metadata. Never hardcode `*` asterisks. See `.github/instructions/09-form-field-pattern.instructions.md`.

## Full Details

- Scaffolding: `.github/instructions/01-scaffold.instructions.md`
- Security: `.github/instructions/06-security.instructions.md`
- Form fields: `.github/instructions/09-form-field-pattern.instructions.md`
