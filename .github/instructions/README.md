# `.github/instructions/` — Read This First

**You probably do not need to read the files in this folder.**

These are **instruction files for GitHub Copilot** (and other coding agents that honor `applyTo` scopes or `description` fields). Copilot loads them automatically as you edit matching files. They are a reference set, not a tutorial.

If you are a human opening this folder for the first time, do this instead:

1. Go back to [../../README.md](../../README.md) and run the wizard (`cd wizard && node index.mjs`)
2. If you want a visual walkthrough, open [../../docs/guide.html](../../docs/guide.html)
3. If you want the end-to-end methodology, read [../../docs/prototype-golden-path.md](../../docs/prototype-golden-path.md)
4. If a term is unfamiliar, check [../../docs/glossary.md](../../docs/glossary.md)

Trying to read all 14 instruction files front-to-back will not make you productive faster. It will slow you down. Copilot is the intended audience.

---

## When You *Do* Need To Look At These Files

Open a specific instruction file when:

- Copilot gave you guidance you want to double-check or override
- You are contributing back to the template and need to update a rule
- You are debugging why an agent keeps doing something you don't want
- You want to understand the "why" behind a convention the scaffold enforces

## Map Of The Instruction Set

Loaded by Copilot based on the file you are editing. The `applyTo` glob on each file controls when it loads.

### Planning phase (narrative → conceptual model)

Loaded via rich `description` fields during planning conversations, before any code exists.

| File | When it loads |
|------|---------------|
| [00a-business-problem-decomposition.instructions.md](00a-business-problem-decomposition.instructions.md) | User is describing an app idea in freeform language |
| [00b-scope-refinement-and-solution-shaping.instructions.md](00b-scope-refinement-and-solution-shaping.instructions.md) | Business problem is understood; scope needs pressure-testing |
| [00c-solution-concept-to-dataverse-plan.instructions.md](00c-solution-concept-to-dataverse-plan.instructions.md) | Scope is stable; translating into entities and relationships |
| [00d-prototype-validation.instructions.md](00d-prototype-validation.instructions.md) | Conceptual model needs UX validation before schema hardens |

### Setup phase (one-time team decisions)

| File | When it loads |
|------|---------------|
| [00-before-you-start.instructions.md](00-before-you-start.instructions.md) | Always — publisher prefix, environments, solution, connections |
| [00-environment-setup.instructions.md](00-environment-setup.instructions.md) | Editing `scripts/**`, `.env*`, `.github/workflows/**`, `power.config.json`, `*.sh` |

### Build phase (implementation)

| File | `applyTo` scope |
|------|-----------------|
| [01-scaffold.instructions.md](01-scaffold.instructions.md) | `src/**`, `vite.config.ts`, `tsconfig.json`, `package.json`, `power.config.json` |
| [02-connectors.instructions.md](02-connectors.instructions.md) | `src/generated/**`, `src/hooks/**`, `src/services/**` |
| [03-components.instructions.md](03-components.instructions.md) | `src/components/**`, `src/pages/**`, `src/App.tsx` |
| [06-security.instructions.md](06-security.instructions.md) | `src/**` |
| [07-dataverse-schema.instructions.md](07-dataverse-schema.instructions.md) | `scripts/**`, `src/**`, `solution/**` |
| [08-copilot-studio.instructions.md](08-copilot-studio.instructions.md) | `src/**`, `src/hooks/**`, `src/components/**`, `src/services/**` |

### Validate and ship phase

| File | `applyTo` scope |
|------|-----------------|
| [05-testing.instructions.md](05-testing.instructions.md) | `tests/**`, `src/**/*.test.{ts,tsx}`, `playwright.config.ts` |
| [04-deployment.instructions.md](04-deployment.instructions.md) | `.github/workflows/**`, `power.config.json`, `vite.config.ts` |

## Rules For Editing These Files

If you are contributing a change:

- Every file must have YAML frontmatter with either `applyTo` (for file-scoped rules) or `description` (for planning-phase files discovered by agents).
- Keep content prescriptive, not conversational. Agents follow imperative rules better than suggestions.
- Reference concrete file paths and commands. Avoid vague guidance like "consider using a good pattern".
- Do not duplicate content across files. Cross-link instead. Duplication drifts.
- See [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for the broader contribution workflow.
