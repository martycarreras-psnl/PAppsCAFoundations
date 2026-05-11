# Forking the Power Apps Code App Foundations

This repo is designed to be forked by organizations that want to own and brand their own copy of the Power Apps Code App Foundations toolchain. Forking is a first-class workflow: every brandable string is read from a single config file, and a built-in tool rewrites every reference.

## Choose your path before you fork

Forking has three distinct flavors. Pick one **before** you run `pacaf-rebrand`, because they differ in what you need to set up externally (npm accounts, GitHub Packages, tokens).

| | Path A — Public npm scope | Path B — Private GitHub Packages | Path C — No publishing |
|---|---|---|---|
| **You publish packages?** | Yes, to public npmjs.com | Yes, to GitHub Packages (private) | No |
| **What your users run** | `npx @contoso/wizard-ux@latest` | `npx @contoso/wizard-ux@latest` (+ `.npmrc` config) | `npx @pacaf/wizard-ux@latest` (upstream's packages) |
| **npm account needed** | Yes (free) | No — uses GitHub auth | No |
| **GitHub PAT setup for end users** | No | Yes — every user needs a PAT in `.npmrc` | No |
| **Your name on the packages** | Yes, you publish under `@contoso` | Yes, under your GitHub org | n/a — upstream `@pacaf` still shows |
| **Tooling updates** | You control the cadence (you ship `@contoso/*` versions) | Same as Path A | Whenever upstream `@pacaf/*` updates |
| **Best for** | Most orgs that want to own and rebrand the foundations | Regulated industries, proprietary instruction files, internal-only tooling | Small teams who just want a customized template, not a release pipeline |
| **Rebrand step required** | Yes — `pacaf-rebrand` | Yes — `pacaf-rebrand` + `--registry` | No |
| **Release workflow needed** | Yes — keep `.github/workflows/release.yml` | Yes — with `registry-url:` swapped | No — delete the workflow |

If you're not sure, **start with Path C**. You can graduate to Path A later by running the rebrand and adding an `NPM_TOKEN` — no rework of existing forks needed.

---

## Path A — Publish under your own public npm scope

This is the standard "we want our own toolchain" flow. The fork is fully independent from upstream after first publish.

### A.1. Create an npm account and reserve your scope

1. Sign up at <https://www.npmjs.com> (free). Pick either a personal username or create an npm Organization (recommended for company-owned scopes like `@contoso`).
2. **Reserve nothing.** npm scopes are claimed automatically the first time you publish a package under them. The first `npm publish @contoso/wizard` claims `@contoso` for your account/org.
3. If you created an npm Organization, add anyone who needs publish access as a member.

### A.2. Create a Granular Access Token

1. Go to <https://www.npmjs.com> → your avatar → **Access Tokens** → **Generate New Token** → **Granular Access Token**.
2. Configure:
   - **Token name**: `<fork-name>-ci` (e.g. `contoso-pacaf-ci`)
   - **Expiration**: 1 year (rotate on a schedule you can stick to)
   - **Packages and scopes**: **Read and write**, scoped to your scope only (e.g. `@contoso`)
   - **Organizations**: pick your npm org if you have one; otherwise leave blank
   - **IP allowlist**: leave empty — GitHub Actions runners use rotating IPs
3. Click **Generate Token**. Copy the `npm_…` value — it's shown only once. If you lose it, generate a new one.

> **Use a Granular token, not Classic Automation.** Granular tokens are scoped to your packages only; if leaked, blast radius is minimized.

### A.3. Fork on GitHub

Click **Fork** at the top right of upstream. Choose your organization as the owner.

### A.4. Add the token as a Repository Secret

In your fork's repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

- **Name**: `NPM_TOKEN`
- **Secret**: paste the `npm_…` token from A.2

Click **Add secret**. The token is encrypted at rest in GitHub and masked in logs.

> **Repository** secret (not Environment or Organization) is the right tier here — it's scoped to this one repo's workflows, which is what `release.yml` consumes.

### A.5. Clone, install, and rebrand

```bash
git clone https://github.com/<your-org>/PAppsCAFoundations.git
cd PAppsCAFoundations
git checkout -b chore/rebrand-for-<your-org>

corepack enable
pnpm install

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

### A.6. Update README references manually

The rebrand tool intentionally does **not** touch READMEs or prose (those are content, not metadata). Search-and-replace yourself:

```bash
grep -rln "pacaf" README.md FORKING.md docs/ | xargs sed -i '' 's/pacaf/cpcaf/g'
grep -rln "@pacaf" README.md FORKING.md docs/ | xargs sed -i '' 's|@pacaf|@contoso|g'
```

### A.7. Reinstall and verify

```bash
pnpm install
pnpm -r --if-present run build
node packages/agent-instructions/bin/cpcaf-instructions.mjs list  # adjust prefix to yours
```

### A.8. Commit, push, merge

```bash
git add -A
git commit -m "chore: rebrand foundations to @contoso scope"
git push -u origin chore/rebrand-for-<your-org>
```

Open a PR, merge to `main`. The `release.yml` workflow opens a **Version Packages** PR; merging that PR publishes `@contoso/wizard`, `@contoso/wizard-ux`, etc. to npm.

### A.9. Enable "Use this template" on your fork

Settings → General → **Template repository** (check the box). Your users now click **Use this template** on your fork and run `npx @contoso/wizard-ux@latest` in the resulting repo.

---

## Path B — Publish privately to GitHub Packages

If your org doesn't want the packages publicly readable (regulated industry, proprietary instruction set, etc.), publish to **GitHub Packages** instead of public npm.

### B.1. No npm account needed

GitHub Packages authenticates with GitHub Personal Access Tokens (classic, with `read:packages` and `write:packages` scopes). Your CI uses the built-in `GITHUB_TOKEN` for publishing.

### B.2. Cost: your end users need an `.npmrc`

This is the catch. Public npm `npx @contoso/wizard-ux` works for anyone. GitHub Packages requires every consumer to authenticate. Each user's machine needs:

```ini
# ~/.npmrc
@contoso:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_<their_pat>
```

For a closed team this is fine — you onboard the PAT once. For a wider audience it adds friction. Worth it only when privacy outweighs convenience.

### B.3. Rebrand with `--registry`

```bash
node packages/rebrand/bin/pacaf-rebrand.mjs \
  --scope @contoso \
  --bin-prefix cpcaf \
  --template-repo your-org/PAppsCAFoundations
# pacaf.config.json has a "registry" field — edit it manually to:
# "registry": "https://npm.pkg.github.com"
```

### B.4. Swap the release workflow

In `.github/workflows/release.yml`, change:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://npm.pkg.github.com'   # was: https://registry.npmjs.org
    scope: '@contoso'
```

And remove `NPM_TOKEN` from `env:` — `GITHUB_TOKEN` (already provided by Actions) is enough for GitHub Packages.

### B.5. Test the consumer experience

Create a fresh dir on a teammate's machine, add the `.npmrc` from B.2, then run `npx @contoso/wizard-ux@latest`. If it works, you're done.

---

## Path C — Customize the template but use upstream's packages

The lightest-weight option. You get your own template repo with your own instructions, but you never publish anything. Your users consume the official `@pacaf/*` packages from public npm.

### C.1. Fork and skip the rebrand entirely

```bash
git clone https://github.com/<your-org>/PAppsCAFoundations.git
cd <fork>

# Optional: customize the agent guidance to your org's conventions
edit .github/instructions/06-security.instructions.md
edit templates/starter/README.md
edit templates/starter/.github/copilot-instructions.md
```

### C.2. Disable the release workflow

```bash
rm .github/workflows/release.yml
git commit -am "chore: disable upstream's release workflow (we don't publish)"
```

### C.3. Enable "Use this template"

Same as A.9: Settings → General → **Template repository**.

### C.4. Document for your users

Update your fork's `README.md` to say:

> "Click **Use this template**, then run `npx @pacaf/wizard-ux@latest`."

The wizard pulls the upstream `@pacaf` packages from public npm. Your customizations to `templates/starter/` and `.github/instructions/` will be present in every project created from your template.

### C.5. Tradeoff

You don't control the version of the tooling your users get. When upstream ships a `@pacaf/wizard@2.0.0`, every new project from your template gets it. If you want a steadier cadence, upgrade to Path A later.

---

## Keeping your fork synced with upstream

Drop `templates/fork-workflows/upstream-sync.yml` into your fork's `.github/workflows/` to get a weekly sync PR from upstream. Documented inline in that file.

When the PR opens, review carefully — most upstream changes will apply cleanly because branding lives only in `pacaf.config.json`. Conflicts almost always indicate someone manually edited a package name outside the rebrand flow.

## What stays branded as `pacaf` after a rebrand

The rebrand tool rewrites:
- `pacaf.config.json` field values
- Package names in `packages/*/package.json`
- Bin keys in `packages/*/package.json`

It does **not** rewrite:
- Imports inside source files referring to `@pacaf/*` — your test suite catches them on the next `pnpm install`
- README / docs prose (intentional — humans review these)
- The file `pacaf.config.json` itself (the filename stays the same; only values change)

## Reverting a rebrand

```bash
git checkout main -- pacaf.config.json packages/*/package.json
pnpm install
```

Or simply revert the rebrand commit.

## Publishing checklist for the first fork release (Path A)

- [ ] npm account created; npm Organization set up if `@contoso` is org-owned
- [ ] `NPM_TOKEN` Repository Secret set with publish access to your scope
- [ ] `pacaf.config.json` reflects your scope, bin-prefix, template repo, docs URL
- [ ] Every `packages/*/package.json` has `@<your-scope>/...` name
- [ ] `pnpm install && pnpm -r --if-present run build` succeeds locally
- [ ] You can run `<your-prefix>-instructions list` and `<your-prefix>-rebrand` (smoke test)
- [ ] At least one changeset entry exists describing v1.0.0 of your fork
- [ ] README / FORKING badges updated
