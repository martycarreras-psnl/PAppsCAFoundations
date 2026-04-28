---
paths:
  - "src/**"
---
<!-- Generated from .github/instructions/06-security.instructions.md — do not edit directly -->
# Security & Authentication

Key rules:
- Auth is handled by the Power Platform host — never use Auth0, Clerk, NextAuth, Firebase Auth, or MSAL directly
- No tokens, client secrets, or connection strings in committed files
- Use `.env.local` (gitignored) or 1Password `op://` references for local secrets
- Validate and sanitize all user input at component boundaries
- Use `DOMPurify` for any HTML rendering from external sources
- Never construct dynamic URLs from user input without validation
- The pre-commit hook blocks accidental secret commits
- Follow DLP (Data Loss Prevention) policies: connectors are the only data path

Full details: `.github/instructions/06-security.instructions.md`
