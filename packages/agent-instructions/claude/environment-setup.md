---
paths:
  - "scripts/**"
  - ".env"
  - ".env.template"
  - ".env.local"
  - ".github/workflows/**"
  - "power.config.json"
  - "*.sh"
---
<!-- Generated from .github/instructions/00-environment-setup.instructions.md — do not edit directly -->
# Environment & Authentication Setup

Covers App Registration, 1Password integration, headless auth profiles, and CI/CD credentials.

Key rules:
- Use `pac auth create --kind CDS` with SPN credentials for headless auth.
- Never store client secrets in committed files. Use 1Password `op://` references or `.env.local` (gitignored).
- Each environment (Dev, Test, Prod) needs its own auth profile.
- CI/CD uses the same SPN with secrets stored in GitHub Actions secrets.

Full details: `.github/instructions/00-environment-setup.instructions.md`
