# Contributing

This project welcomes contributions and suggestions. Most contributions require you to
agree to a Contributor License Agreement (CLA) declaring that you have the right to,
and actually do, grant us the rights to use your contribution. For details, visit
https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need
to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply
follow the instructions provided by the bot. You will only need to do this once across
all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

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
