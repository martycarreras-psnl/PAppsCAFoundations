# Power Apps Code App Foundations

[![CI](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/release.yml/badge.svg)](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions)

A pnpm monorepo that publishes the **`@pacaf/*`** family of npm packages — the setup wizard, helper scripts, and agent guidance that turn an empty repo into a production-ready [Power Apps Code App](https://learn.microsoft.com/en-us/power-platform/power-apps/maker/canvas-apps/code-apps/overview).

> **For end users:** you don't need to clone this repo. Run `npx @pacaf/wizard-ux@latest` in an empty repo, or click **Use this template** to start from `templates/starter/`.

## What's published

| Package | What it does | Used by |
|---|---|---|
| [`@pacaf/wizard`](packages/wizard/) | Interactive CLI setup wizard. 10 steps from prerequisites → first deploy. | End users (`npx @pacaf/wizard@latest`) |
| [`@pacaf/wizard-ux`](packages/wizard-ux/) | Browser-based equivalent (Fastify + React + xterm). | End users (`npx @pacaf/wizard-ux@latest`) |
| [`@pacaf/scripts`](packages/scripts/) | `pacaf-*` bins: validate, register, generate, seed, sync, update, migrate-thin, and more. | Derived repos as a devDependency |
| [`@pacaf/agent-instructions`](packages/agent-instructions/) | Power Apps Code App guidance for GitHub Copilot, Claude, Cursor. | Derived repos via `pacaf-instructions sync` |
| [`@pacaf/rebrand`](packages/rebrand/) | Retarget a fork to a different scope/prefix. | Fork owners |

## For end users — start a new Code App

1. Click **Use this template** on this repo (you'll get a copy of [`templates/starter/`](templates/starter/) — basically just a README and an `.env.template`).
2. In the new repo, run:

   ```bash
   npx @pacaf/wizard-ux@latest
   ```

3. Follow the wizard. It handles prerequisites, App Registration, auth, solution provisioning, scaffolding, and the first deploy.

That's it. Your repo now has `src/`, `package.json`, `power.config.json`, `.github/instructions/`, and everything else — without ever copying in `wizard/`, `scripts/`, or `docs/`.

### Updating later

```bash
npx pacaf-update          # refresh scripts and agent instructions
npx pacaf-update --check  # show drift only
```

## For derived repos still on the legacy "fat" layout

If your repo was generated from this template before the `@pacaf/*` packages existed, you have `wizard/`, `wizard-ux/`, `scripts/`, and `docs/` directories at your repo root. To migrate:

```bash
npx pacaf-migrate-thin             # interactive
npx pacaf-migrate-thin --dry-run   # preview
```

See [MIGRATION.md](MIGRATION.md) for the full walkthrough.

## For organizations — fork and own your scope

Forking this repo is a first-class workflow. All branding lives in one config file ([`pacaf.config.json`](pacaf.config.json)) and a single tool ([`pacaf-rebrand`](packages/rebrand/)) rewrites every reference.

```bash
git clone https://github.com/<your-org>/PAppsCAFoundations.git
cd PAppsCAFoundations
corepack enable && pnpm install
node packages/rebrand/bin/pacaf-rebrand.mjs --scope @contoso --bin-prefix cpcaf
```

See [FORKING.md](FORKING.md) for the full guide, including an upstream-sync workflow.

## For contributors to this repo

```bash
corepack enable
pnpm install
pnpm -r --if-present run build
```

Repo layout:

```
PAppsCAFoundations/
├── packages/
│   ├── wizard/                 # @pacaf/wizard
│   ├── wizard-ux/              # @pacaf/wizard-ux
│   ├── scripts/                # @pacaf/scripts
│   ├── agent-instructions/     # @pacaf/agent-instructions
│   └── rebrand/                # @pacaf/rebrand
├── templates/
│   └── starter/                # what "Use this template" delivers
├── .github/instructions/       # canonical agent guidance source
├── docs/                       # GitHub Pages site
├── pacaf.config.json           # branding (scope, binPrefix, templateRepo, docsUrl)
└── pnpm-workspace.yaml
```

### Releasing

Changesets handles versioning. Add a changeset describing your change:

```bash
pnpm changeset
git add .changeset && git commit -m "feat: ..."
```

When the PR merges to `main`, `release.yml` opens a Version Packages PR. Merging that PR publishes to npm.

## Docs

Full guidance and architecture rules: <https://martycarreras-psnl.github.io/PAppsCAFoundations>.
