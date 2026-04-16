# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **[marty.carreras@microsoft.com](mailto:marty.carreras@microsoft.com)** with:

1. A description of the vulnerability
2. Steps to reproduce
3. The potential impact
4. Any suggested fix (optional)

You should receive an acknowledgment within 48 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

This policy applies to the PAppsCAFoundations template repository, including:

- Wizard scripts (`wizard/`)
- Helper scripts (`scripts/`)
- GitHub Copilot instruction files (`.github/instructions/`)
- Generated scaffold output (the code produced by the wizard)
- Documentation (`docs/`)

## Security Practices in This Repo

- **No secrets in source control.** Credentials are stored in 1Password or `.env.local` (gitignored). The pre-commit hook blocks accidental secret commits.
- **File permissions.** Sensitive files (`.env.local`, `.wizard-state.json`) are written with restrictive permissions (`0o600`).
- **Shell injection prevention.** All subprocess calls use `execFileSync` with argument arrays — never string interpolation into shell commands.
- **Temp directory hygiene.** Temporary directories are created with `0o700` permissions and cleaned up on process exit or signal.
- **Encrypted secrets at rest.** When 1Password is not available, secrets in `.env.local` are encrypted with AES-256-GCM.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (`main` branch) | Yes |
| Older tagged releases | Best effort |
