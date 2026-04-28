# Coding Agent Support Matrix

Foundations ships native guidance artifacts for **four** coding agents. Each agent reads the instructions in its own format — the underlying rules are identical, projected from the same canonical source.

## Which Files Does My Agent Read?

| Agent | Root Entry Point | Scoped / Path-Specific Rules | Planning-Phase Discovery | Fallback |
|-------|-----------------|------------------------------|--------------------------|----------|
| **GitHub Copilot** | `AGENTS.md` | `.github/instructions/*.instructions.md` via `applyTo` frontmatter | `description` frontmatter on planning files | — |
| **Claude Code** | `CLAUDE.md` (imports `AGENTS.md`) | `.claude/rules/*.md` via `paths` frontmatter | Loaded unconditionally or via path match | `AGENTS.md` via import |
| **Cursor** | `AGENTS.md` (native support) | `.cursor/rules/*.mdc` via `globs` frontmatter | `description` frontmatter | `AGENTS.md` |
| **Codex** | `AGENTS.md` (native support) | Nested `AGENTS.md` files in subdirectories | Included in root or nested files | — |
| **Cline / Aider** | `AGENTS.md` | Not currently provided — use `AGENTS.md` as the single guidance source | Manual context loading | `AGENTS.md` |

## Canonical Source of Truth

All agent-native artifacts are **generated** from the canonical instruction corpus:

- **`AGENTS.md`** — hand-authored root contract shared by all agents
- **`.github/instructions/*.instructions.md`** — detailed, Copilot-native rules that serve as the canonical source for all projections

Do **not** edit `.claude/rules/`, `.cursor/rules/`, or nested `AGENTS.md` files directly. Edit the canonical `.github/instructions/` files, then run:

```bash
npm run guidance:generate   # Regenerate all agent-native artifacts
npm run guidance:check      # Verify committed files match generated output
```

## How Each Agent Loads Instructions

### GitHub Copilot (VS Code)

Copilot loads `.github/instructions/*.instructions.md` automatically based on `applyTo` glob patterns. Files with `description` frontmatter are discovered during planning conversations. No manual action needed — Copilot is the native format.

### Claude Code

Claude reads `CLAUDE.md` at session start. That file imports `AGENTS.md` for the root contract. Path-scoped rules in `.claude/rules/` load when Claude works with files matching the `paths` frontmatter.

**Verify:** Run `/memory` in a Claude Code session and confirm `CLAUDE.md` plus the relevant `.claude/rules/` entries appear.

### Cursor

Cursor reads `AGENTS.md` from the project root and loads `.cursor/rules/*.mdc` files based on `globs` patterns or `description`-driven relevance.

**Verify:** Open `Cursor Settings → Rules` and confirm the project rules are listed. While editing a file in `src/components/`, check that the components rule auto-attaches.

### Codex (CLI or IDE)

Codex reads `AGENTS.md` from the project root and walks into subdirectories to discover nested `AGENTS.md` files. Each nested file adds scoped guidance for that directory tree.

**Verify:** Run `codex "Summarize the current instructions."` from the repo root and from a subdirectory like `src/components/`. Confirm root + nested files appear.

### Cline / Aider

These tools read `AGENTS.md` from the project root. They do not currently have native scoped-rule artifacts in this repo. The root `AGENTS.md` provides the full architectural contract. For deeper guidance, manually load the relevant `.github/instructions/` file into context.

## Rule Categories

| Category | Canonical File | Scope |
|----------|---------------|-------|
| Before You Start | `00-before-you-start` | Always loaded |
| Environment Setup | `00-environment-setup` | Scripts, env files, workflows, shell |
| Business Problem Decomposition | `00a-business-problem-decomposition` | Planning conversations |
| Scope Refinement | `00b-scope-refinement-and-solution-shaping` | Planning conversations |
| Solution Concept → Dataverse Plan | `00c-solution-concept-to-dataverse-plan` | Planning + scripts/solution |
| Prototype Validation | `00d-prototype-validation` | src, scripts, dataverse |
| Project Scaffolding | `01-scaffold` | src, config files |
| Connectors & Data | `02-connectors` | generated, hooks, services |
| Component Architecture | `03-components` | components, pages, App.tsx |
| Deployment & CI/CD | `04-deployment` | workflows, config |
| Testing | `05-testing` | tests, test files |
| Security | `06-security` | src |
| Dataverse Schema | `07-dataverse-schema` | scripts, src, solution |
| Copilot Studio Integration | `08-copilot-studio` | src, hooks, components, services |
| Form Field Pattern | `09-form-field-pattern` | src |

## Terminology

- **Coding agent**: GitHub Copilot, Claude Code, Cursor, Codex, Cline, Aider — tools that read repo instructions and generate code.
- **Microsoft Copilot Studio**: The Power Platform product for building conversational AI agents. Not a coding agent. File `08-copilot-studio` is about this product, not about coding agents.
