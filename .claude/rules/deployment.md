---
paths:
  - ".github/workflows/**"
  - "power.config.json"
  - "vite.config.ts"
---
<!-- Generated from .github/instructions/04-deployment.instructions.md — do not edit directly -->
# Deployment, CI/CD & ALM

Key rules:
- Deploy with `pac code push` — never manual uploads
- `vite.config.ts` must set `base: './'` for `command === 'build'`
- Use solution export → managed import for environment promotion (Dev → Test → Prod)
- CI/CD uses GitHub Actions with SPN auth (no interactive browser)
- Use deployment settings files for connection reference mapping per environment
- Never deploy unmanaged solutions to production
- Version the solution on every release: `pac solution version`

Full details: `.github/instructions/04-deployment.instructions.md`
