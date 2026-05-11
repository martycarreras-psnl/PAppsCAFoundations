@AGENTS.md

## Claude Code

This repository uses `.claude/rules/` for path-scoped guidance that mirrors the canonical `.github/instructions/` files. Rules load automatically when you work with files matching their `paths` frontmatter.

For the full agent support matrix and verification steps, see [docs/agent-support.md](docs/agent-support.md).

### Key conventions

- The canonical source of truth is `.github/instructions/*.instructions.md`. The `.claude/rules/` files are generated projections — do not edit them directly.
- `AGENTS.md` (imported above) contains the root architectural contract shared by all coding agents.
- `src/generated/` is read-only. Never edit files there.
- Port 3000 is required for local dev. Do not change it.
- This is a Power Apps Code App. Do not suggest non-Power-Platform deployment targets, alternative frameworks, or CSS libraries other than Fluent UI v9.
