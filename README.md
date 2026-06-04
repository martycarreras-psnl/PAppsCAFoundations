# Power Apps Code App Foundations

[![CI](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/ci.yml/badge.svg)](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/ci.yml)
[![Release](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/release.yml/badge.svg)](https://github.com/martycarreras-psnl/PAppsCAFoundations/actions/workflows/release.yml)
[![npm: @pacaf/wizard-ux](https://img.shields.io/npm/v/@pacaf/wizard-ux?label=%40pacaf%2Fwizard-ux)](https://www.npmjs.com/package/@pacaf/wizard-ux)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**The source factory for the toolchain that scaffolds, deploys, and maintains a [Power Apps Code App](https://learn.microsoft.com/en-us/power-platform/power-apps/maker/canvas-apps/code-apps/overview).**

> ### 👉 Building an app? You don't start here.
> Create your project from the **[PowerAppsCodeApp-Starter](https://github.com/martycarreras-psnl/PowerAppsCodeApp-Starter)** template and follow its README. **This** repository only builds and publishes the `@pacaf/*` packages that the Starter and your app consume.

This repository is the central source for the [`@pacaf/*`](https://www.npmjs.com/org/pacaf) family of npm packages — the setup wizard, helper scripts, and agent guidance that turn an empty repository into a deployable Power Apps Code App. The packages install as devDependencies, so each project stays light: only a small amount of metadata and configuration lives in the app repo; the tooling lives in npm and updates like any other package.

---

## 🚀 I just want to build a Code App

**You're in the wrong repo for that — and that's by design.**

This repository is the **tooling factory**. It builds and publishes the `@pacaf/*` npm packages (the wizard, the `pacaf-*` CLIs, and the agent guidance). It is **not** where you start your own app, and you should not clone or template it to build one — its `pnpm-workspace.yaml` and `packages/` tree will be pulled into your app and break the install.

👉 **Start from the [PowerAppsCodeApp-Starter](https://github.com/martycarreras-psnl/PowerAppsCodeApp-Starter) template instead.**

1. Click **[Use this template → Create a new repository](https://github.com/martycarreras-psnl/PowerAppsCodeApp-Starter/generate)**.
2. Clone your new repo and open it in **VS Code with a coding agent enabled** (GitHub Copilot Chat in Agent mode, Claude Code, Cursor, …).
3. Follow the Starter's README.

The **Starter README** is the single home for everything an app builder needs:

- ✅ Prerequisites and the fresh-machine setup checklist
- ✅ Running the setup wizard (`npx @pacaf/wizard-ux@latest`)
- ✅ The plan-first → prototype → build workflow your agent follows
- ✅ Keeping your project up to date (`npx pacaf-update`)

> Everything below this line is for people **building, forking, or contributing to the tooling itself** — not for building an app.

---

## 📦 What gets published

All five packages are published to public npm under [`@pacaf/*`](https://www.npmjs.com/org/pacaf). They are independently versioned via [Changesets](https://github.com/changesets/changesets) and released by GitHub Actions.

| Package | Purpose | Consumed by |
|---|---|---|
| **[`@pacaf/wizard-ux`](packages/wizard-ux/)** | Browser-based 10-step setup wizard (Fastify + React + xterm) | End users — `npx @pacaf/wizard-ux@latest` |
| **[`@pacaf/wizard`](packages/wizard/)** | Equivalent CLI wizard for headless/SSH workflows | End users — `npx @pacaf/wizard@latest` |
| **[`@pacaf/scripts`](packages/scripts/)** | 15 `pacaf-*` CLIs: validate, register, generate, seed, sync, update, migrate-thin, … | Derived repos as a **devDependency** |
| **[`@pacaf/agent-instructions`](packages/agent-instructions/)** | Agent guidance for GitHub Copilot, Claude, Cursor — synced into derived repos | Derived repos via `pacaf-instructions sync` |
| **[`@pacaf/rebrand`](packages/rebrand/)** | Retarget a fork to a different npm scope and bin prefix | Fork owners — `npx @pacaf/rebrand` |

### The `pacaf-*` CLIs at a glance

| CLI | Purpose |
|---|---|
| `pacaf-update` | Refresh `@pacaf/scripts` + `@pacaf/agent-instructions` and re-sync instruction files |
| `pacaf-migrate-thin` | Convert a derived repo from the in-tree tooling layout to consume `@pacaf/*` packages |
| `pacaf-instructions` | `sync` / `check` / `list` agent-guidance projections |
| `pacaf-seed` | Seed prototype assets (mock providers, hooks, components) |
| `pacaf-discover-connection` | Discover existing Power Platform connections by API ID |
| `pacaf-pac` / `pacaf-pac-safe` | Wrappers around `pac` CLI with retry + error normalization |
| `pacaf-setup-auth` | Idempotent PAC auth profile bootstrap |
| `pacaf-patch-datasources` | Patch `power.config.json` data source info |
| `pacaf-detect-agent` | Detect which coding agent is in use (Copilot / Claude / Cursor) |
| `pacaf-generate-agent-guidance` | Regenerate Claude/Cursor projections from the canonical instructions |
| `pacaf-decrypt-secret` | Decrypt a `.env.local` secret encrypted by the wizard |

---

## 🍴 I want to fork and own my own scope

Forking is a first-class workflow. Every brandable string (npm scope, bin prefix, template repo, docs URL) lives in **[`pacaf.config.json`](pacaf.config.json)** and the [`pacaf-rebrand`](packages/rebrand/) tool rewrites every reference in one command.

There are three paths depending on whether you want to republish under your own scope or just use upstream:

| Path | When to choose it |
|---|---|
| **A — Public npm scope** (`@contoso/*`) | You want to own and rebrand the toolchain. Most orgs pick this. |
| **B — Private GitHub Packages** | Regulated industries; proprietary instruction files; internal-only tooling |
| **C — No publishing**, customize template only | Small teams who just want a tweaked starter; updates from upstream `@pacaf/*` |

```bash
# After cloning your fork:
corepack enable && pnpm install
npx @pacaf/rebrand --scope @contoso --bin-prefix contoso
```

Full walkthrough including npm account setup, GitHub Packages PAT configuration, and the upstream-sync workflow: **[FORKING.md](FORKING.md)**.

---

## 🔄 I have an existing derived repo with the tooling in-tree

If your repo has `wizard/`, `wizard-ux/`, `scripts/`, and `docs/` directories at the root, it was generated before the tooling moved to npm. Migrate in one command:

```bash
npx pacaf-migrate-thin                # interactive
npx pacaf-migrate-thin --dry-run      # preview only
```

This archives the in-tree directories to `.pacaf-archive/`, rewrites `package.json` script references from `node scripts/X.mjs` to `pacaf-X`, adds the two devDependencies, and resyncs the instruction files. Full guide: **[MIGRATION.md](MIGRATION.md)**.

---

## 🤖 For coding agents working in *this* repo

> If you are a coding agent (GitHub Copilot, Claude Code, Cursor, Aider, etc.) and you are working in **this** repository — read this section, then go to [`AGENTS.md`](AGENTS.md).
>
> If you are an agent in a **derived** repo (one that was scaffolded by `@pacaf/wizard-ux`), your guidance is already installed at `.github/instructions/` and `AGENTS.md` — read those instead.

### Where things live in this monorepo

```
PAppsCAFoundations/
├── packages/                      ← the published @pacaf/* packages
│   ├── wizard/                    ← @pacaf/wizard         (interactive CLI)
│   │   ├── index.mjs              ← entrypoint, 10-step orchestrator
│   │   ├── lib/                   ← shared helpers (state, ui, shell, dataverse, …)
│   │   └── steps/                 ← one file per wizard step
│   ├── wizard-ux/                 ← @pacaf/wizard-ux      (browser UI)
│   │   ├── server/                ← Fastify backend (mirrors wizard/steps)
│   │   ├── src/                   ← React + Fluent UI frontend
│   │   └── dist/                  ← prebuilt UI bundle (shipped in tarball)
│   ├── scripts/                   ← @pacaf/scripts        (pacaf-* CLIs)
│   │   ├── *.mjs                  ← individual CLI implementations
│   │   ├── bin/                   ← npm bin shims for pacaf-update / pacaf-migrate-thin
│   │   └── tests/                 ← node --test unit tests
│   ├── agent-instructions/        ← @pacaf/agent-instructions (synced into derived repos)
│   │   ├── instructions/          ← canonical .github/instructions/*.instructions.md
│   │   ├── claude/                ← Claude Code projection
│   │   ├── cursor/                ← Cursor projection
│   │   └── meta/                  ← AGENTS.md, CLAUDE.md, copilot-instructions.md
│   └── rebrand/                   ← @pacaf/rebrand        (one-shot rewrite tool)
├── templates/
│   └── starter/                   ← what "Use this template" delivers (minimal)
├── .github/
│   ├── instructions/              ← canonical agent-guidance SOURCE OF TRUTH
│   └── workflows/                 ← ci.yml + release.yml
├── docs/                          ← GitHub Pages site (glossary, golden-path, etc.)
├── pacaf.config.json              ← branding source of truth
├── pnpm-workspace.yaml            ← workspace discovery
└── package.json                   ← root scripts: build, test, release, rebrand
```

### Key conventions agents must respect

1. **`.github/instructions/` is canonical.** `packages/agent-instructions/instructions/` and the `claude/` / `cursor/` projections are generated by `packages/agent-instructions/scripts/sync-from-root.mjs`. **Edit the canonical files, then run the sync script** — never the projections directly.
2. **`packages/wizard-ux/dist/` is committed and shipped.** It's the prebuilt React UI bundle. Don't `.gitignore` it; do regenerate it via `pnpm -r run build` before publishing.
3. **Cross-package imports must use package names** (`@pacaf/scripts/foo.mjs`), never relative paths (`../../scripts/foo.mjs`). The latter breaks in published tarballs.
4. **Workspace specifiers (`workspace:*`) only work because we use `pnpm publish -r`** — switching to `npm publish` would ship literal `workspace:*` strings to the registry. Don't change the `release` script in `package.json` without re-testing the publish path.
5. **The published wizard-ux server defaults to serving prebuilt `dist/`.** It only loads Vite when `WIZARD_UX_DEV=1` or `NODE_ENV=development`, because Vite is a devDependency.
6. **Branding is read from `pacaf.config.json` at runtime.** When the wizard scaffolds into a derived repo, it reads scope and bin prefix from this config so forks "just work" without code changes.

### How to add a new `pacaf-*` CLI

1. Drop your implementation as `packages/scripts/your-thing.mjs`.
2. Register it in `packages/scripts/package.json` under `"bin": { "pacaf-yourthing": "./your-thing.mjs" }`.
3. Add a `node --test` file under `packages/scripts/tests/` if it has business logic worth testing.
4. Update the CLI table in this README and add a changeset: `pnpm changeset`.

### How to add or modify agent guidance

1. Edit (or create) `.github/instructions/<NN>-<topic>.instructions.md`.
2. Run `pnpm -F @pacaf/agent-instructions build` to regenerate the projections under `packages/agent-instructions/{instructions,claude,cursor,meta}/`.
3. Add a changeset bumping `@pacaf/agent-instructions`.
4. Once published, derived repos pick up the change via `npx pacaf-update`.

---

## 🛠 For contributors to this repo

```bash
git clone https://github.com/martycarreras-psnl/PAppsCAFoundations.git
cd PAppsCAFoundations
corepack enable                   # uses pnpm version pinned in package.json
pnpm install
pnpm -r --if-present run build    # build all packages
pnpm -r --if-present run test     # run all tests
```

### Local smoke test of a published package without publishing

```bash
pnpm -F @pacaf/wizard-ux pack             # produces packages/wizard-ux/pacaf-wizard-ux-X.Y.Z.tgz
cd /tmp && mkdir test && cd test && npm init -y
npm i /path/to/pacaf-wizard-ux-X.Y.Z.tgz  # install the tarball
node node_modules/@pacaf/wizard-ux/server/index.mjs
```

### Releasing

Versioning uses [Changesets](https://github.com/changesets/changesets). For any change that should ship to npm:

```bash
pnpm changeset                    # interactive — pick packages and bump levels
git add .changeset && git commit -m "feat: ..."
```

When the PR merges to `main`:

1. `.github/workflows/release.yml` runs and opens (or updates) a **"Version Packages"** PR. This PR consumes pending changesets, bumps versions, and writes CHANGELOGs.
2. Merging the Version Packages PR triggers another release.yml run.
3. That run executes `pnpm publish -r --filter '@pacaf/*'`, which publishes every package whose version is not yet on npm and creates git tags.

> **Why `pnpm publish` and not `changeset publish`?** Changesets v2's publish path did not consistently rewrite `workspace:*` specifiers in our tarballs. `pnpm publish` guarantees the rewrite. Versioning still uses `changeset version`.

---

## 📚 Documentation

| Topic | Where |
|---|---|
| Power Platform glossary | [docs/glossary.md](docs/glossary.md) |
| Prototype-first golden path | [docs/prototype-golden-path.md](docs/prototype-golden-path.md) |
| Top-level agent contract | [AGENTS.md](AGENTS.md) |
| Per-domain instruction files | [.github/instructions/](.github/instructions/) |
| Forking guide | [FORKING.md](FORKING.md) |
| Migration guide | [MIGRATION.md](MIGRATION.md) |
| Troubleshooting | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Security policy | [SECURITY.md](SECURITY.md) |
| Hosted docs site | <https://martycarreras-psnl.github.io/PAppsCAFoundations> |

---

## License

MIT — see [LICENSE](LICENSE).
