# Contributing to PAppsCAFoundations

Thank you for your interest in improving this template. Contributions are welcome — from bug fixes and documentation improvements to new wizard steps and scaffold enhancements.

## Getting Started

1. **Fork the repository** and clone your fork locally.
2. **Install dependencies** for the wizard:
   ```bash
   cd wizard && npm install
   ```
3. **Run the existing tests** to confirm everything passes:
   ```bash
   node --test scripts/tests/*.test.mjs
   ```
4. **Make your changes** on a feature branch.
5. **Run tests again** to confirm nothing is broken.
6. **Open a pull request** against `main`.

## What We're Looking For

- Bug fixes in wizard steps or helper scripts
- Improvements to GitHub Copilot instruction files
- New validation checks in `validate-schema-plan.mjs`
- Better error messages and recovery guidance
- Documentation clarity and typo fixes
- Cross-platform compatibility improvements (Windows, macOS, Linux)

## Guidelines

### Code Style

- All scripts use **Node.js ESM** (`.mjs` extension, `import`/`export`).
- Use `execFileSync` with argument arrays for subprocess calls — never template strings in shell commands.
- Keep functions small and focused. The wizard uses a step-per-file pattern.
- Match the existing code style — no linter is enforced on the wizard itself yet, but consistency matters.

### Commits

- Use conventional commit messages: `fix:`, `feat:`, `chore:`, `docs:`.
- One logical change per commit. Squash fixup commits before merging.

### Testing

- Add or update tests in `scripts/tests/` for any script logic changes.
- Tests use Node.js built-in test runner (`node --test`).
- If your change affects scaffold output, verify with the existing scaffold test (`scaffold-prototype-path.test.mjs`).

### Instruction Files

- Instruction files (`.github/instructions/*.md`) must include a YAML frontmatter `applyTo` scope.
- Keep instruction content prescriptive, not conversational.
- Reference concrete file paths and commands — avoid vague guidance.

## Pull Request Checklist

- [ ] Tests pass: `node --test scripts/tests/*.test.mjs`
- [ ] Syntax check passes on modified `.mjs` files: `node -c <file>`
- [ ] No secrets or credentials in the diff
- [ ] Commit messages follow conventional format
- [ ] PR description explains the why, not just the what

## Reporting Issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your OS and Node.js version

For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
