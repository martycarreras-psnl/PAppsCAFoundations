# Forking the Power Apps Code App Foundations

This repo is designed to be forked by organizations that want to own and brand their own copy of the Power Apps Code App Foundations toolchain. Forking is a first-class workflow: every brandable string is read from a single config file, and a built-in tool rewrites every reference.

## When to fork

Fork when you want to:

- Publish the wizard, scripts, and instruction set under your own npm scope (e.g. `@contoso/wizard`, `@contoso/scripts`).
- Tailor the agent guidance (`.github/instructions/`) to your organization's conventions, security boundaries, or approved connectors.
- Host the docs site at your own URL.
- Control the release cadence and what makes it into "stable" for your users.

If you only want to use the upstream foundations as-is, you don't need a fork — your users can just `npx @pacaf/wizard-ux@latest` from a thin starter repo.

## One-time fork setup

### 1. Fork on GitHub

Click **Fork** at the top right of the upstream repository. Choose your organization as the owner.

### 2. Clone and create a working branch

```bash
git clone https://github.com/<your-org>/PAppsCAFoundations.git
cd PAppsCAFoundations
git checkout -b chore/rebrand-for-<your-org>
```

### 3. Install dependencies

```bash
corepack enable
pnpm install
```

### 4. Run the rebrand tool

```bash
# Dry run first — review what would change
node packages/rebrand/bin/pacaf-rebrand.mjs \
  --scope @contoso \
  --bin-prefix cpcaf \
  --template-repo your-org/PAppsCAFoundations \
  --docs-url https://your-org.github.io/PAppsCAFoundations \
  --dry-run

# When you're happy, run it for real (drop --dry-run)
node packages/rebrand/bin/pacaf-rebrand.mjs \
  --scope @contoso \
  --bin-prefix cpcaf \
  --template-repo your-org/PAppsCAFoundations \
  --docs-url https://your-org.github.io/PAppsCAFoundations
```

This rewrites:
- `pacaf.config.json`
- Every `packages/*/package.json` — names (`@pacaf/X` → `@contoso/X`) and bin keys (`pacaf-X` → `cpcaf-X`)

### 5. Update README references manually

The rebrand tool intentionally does **not** touch READMEs or docs (those are prose, not metadata). Search-and-replace yourself:

```bash
grep -rln "pacaf" README.md FORKING.md docs/ | xargs sed -i '' 's/pacaf/cpcaf/g'  # adjust for your prefix
grep -rln "@pacaf" README.md FORKING.md docs/ | xargs sed -i '' 's|@pacaf|@contoso|g'
```

### 6. Add your npm publish token as a secret

GitHub → Settings → Secrets and variables → Actions → New repository secret:

- `NPM_TOKEN` — an automation token from <https://www.npmjs.com> with publish scope for `@contoso`.

### 7. Reinstall and verify

```bash
pnpm install
pnpm -r --if-present run build
node packages/agent-instructions/bin/cpcaf-instructions.mjs list
```

### 8. Commit and publish

```bash
git add -A
git commit -m "chore: rebrand foundations to @contoso scope"
git push -u origin chore/rebrand-for-<your-org>
```

Merge to `main`. The `release.yml` workflow opens a Version Packages PR; merging it publishes `@contoso/wizard`, `@contoso/wizard-ux`, `@contoso/scripts`, `@contoso/agent-instructions`, and `@contoso/rebrand` to npm.

### 9. Enable "Use this template" on your fork

Settings → General → Template repository. Your users can now click **Use this template** on your fork and run `npx @contoso/wizard-ux@latest` in the resulting repo.

## Keeping your fork synced with upstream

We recommend an automated upstream-sync workflow. Drop this into `.github/workflows/upstream-sync.yml`:

```yaml
name: Sync from upstream

on:
  schedule:
    - cron: '0 6 * * 1'  # Mondays at 06:00 UTC
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Add upstream remote
        run: git remote add upstream https://github.com/martycarreras-psnl/PAppsCAFoundations.git
      - name: Fetch upstream
        run: git fetch upstream main
      - name: Create rebase PR
        uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/sync-upstream
          title: 'chore: sync from upstream'
          body: |
            Automated sync from `martycarreras-psnl/PAppsCAFoundations:main`.
            Re-run `node packages/rebrand/bin/<prefix>-rebrand.mjs` if upstream
            added new packages or changed branding-sensitive defaults.
          commit-message: 'chore: sync upstream changes'
```

When the PR opens, review carefully — most upstream changes will apply cleanly because branding lives only in `pacaf.config.json`. Conflicts almost always indicate someone manually edited a package name outside the rebrand flow.

## What stays branded as `pacaf` after a rebrand

The rebrand tool rewrites:
- `pacaf.config.json` field values
- Package names in `packages/*/package.json`
- Bin keys in `packages/*/package.json`

It does **not** rewrite:
- Imports inside source files referring to `@pacaf/*` — those should be fixed by your test suite catching them on the next `pnpm install`
- README / docs prose (intentional — humans review these)
- The file `pacaf.config.json` itself (the filename stays the same; only the values change)
- Internal source code in `packages/wizard/lib/scaffold-foundations.mjs` and similar that hardcode strings — fix these by reading from `pacaf.config.json` at runtime (a follow-up improvement)

## Reverting a rebrand

```bash
git checkout main -- pacaf.config.json packages/*/package.json
pnpm install
```

Or simply revert the rebrand commit.

## Publishing checklist for the first fork release

- [ ] `pacaf.config.json` reflects your scope, bin-prefix, template repo, docs URL
- [ ] Every `packages/*/package.json` has `@<your-scope>/...` name
- [ ] `NPM_TOKEN` secret is set with publish access to your scope
- [ ] `pnpm install && pnpm -r --if-present run build` succeeds locally
- [ ] You can run `<your-prefix>-instructions list` and `<your-prefix>-rebrand` (smoke test)
- [ ] At least one changeset entry exists describing v1.0.0 of your fork
- [ ] README front matter / badges updated
