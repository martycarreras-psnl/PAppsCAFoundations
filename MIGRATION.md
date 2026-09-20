# Foundations migrations

## Code App CLI migration: `pac code` to local `pa`

This migration changes **local tooling**, not the cloud app. It is separate from the older thin-layout migration below. Existing app/environment IDs, solution association, connector bindings, generated files, custom scripts, secrets, and browser/runtime architecture must survive unchanged.

### Supported boundary and release baseline

- Code App init/local host/publish/data-source generation: exact-pinned **`@microsoft/power-apps-cli@1.0.2`** as a local devDependency, invoked through `pacaf-pa`.
- Runtime SDK: **`@microsoft/power-apps@1.4.0`**, a different package.
- Solution export/import/pack/unpack and environment/admin: **PAC**, with its own auth profiles.
- Dataverse schema/data/security: **Dataverse-skills**, unchanged.

The baseline and mappings were verified on 2026-09-19 against Microsoft's [CLI reference](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli), [CLI environment variables](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/environment-variables), and [SPN publishing guide](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/use-service-principal). The installed 1.0.2 help additionally exposes `app run --config-only`, required with a separate Vite process.

### Review, then apply

Start on a clean branch or checkpoint your own work. Install the released migration-capable `@pacaf/scripts` and `@pacaf/agent-instructions` using your existing package manager and approved registry. Keep the chosen lockfile and dependency-build allowlist; do not switch to public npm to bypass a mirror/CFS failure.

**Migrate tooling before syncing the new policy.** Instruction sync/update refuses to install the `pa` guidance into an existing Code App that still has legacy PAC lifecycle scripts or lacks the exact local devDependency `@microsoft/power-apps-cli: "1.0.2"`. This prevents new guidance from contradicting old executable scripts. Install the tooling packages without treating guidance sync as complete, review/apply the migration below, reconcile dependencies, then rerun sync/update. Fresh empty scaffolds may sync bootstrap guidance. Do not bypass this gate with force or assume an undeclared local customization is an exception.

An exceptional, explicitly reviewed local policy may set `codeAppCliPolicy: "reviewed-local"` in `.pacaf/policy-overlays.json`, **only with whole-file overlays for every shipped file carrying the new CLI policy** (canonical instructions, native projections, and root metadata). A single `AGENTS.md` overlay is insufficient. This is ownership of a complete project-specific policy, not automatic migration or a permission/deployment bypass. See the installed instruction-package README; `--force` cannot bypass the migration gate.

Commands below refer to installed local `@pacaf/scripts` bins (use `pnpm exec` or an npm script). Never run bare `npx pa` — it can resolve an unrelated package.

Fresh scaffolds include `pa: "pacaf-pa"`. Existing-consumer migration adds `setup:pa-auth: "pacaf-pa auth login"` and recognized dev/deploy replacements, but **does not add a `pa` npm script**. In a migrated app, invoke `pnpm exec pacaf-pa …` or `npm exec --no -- pacaf-pa …` after installation, or deliberately add the `pa` script without overwriting a custom one. Adapt documentation's `npm run pa -- …` examples accordingly.

```bash
pacaf-migrate-pa --check
# Review changes and resolve refusals; populate/verify .power-apps-targets.json
# using the durable-target section below BEFORE --apply.
pacaf-migrate-pa --apply
git diff
```

`--check` is the default and writes nothing. `--apply` edits **only `package.json`** and requires an existing, reviewed `.power-apps-targets.json`; it does not synthesize deployment identity. There is no `--target-file` option.

Migration uses shared **offline target/config validation** before writing: default/invalid solutions, unsupported clouds, region mismatches, wrong local app URL/type, escaping build paths, and identity mismatches are refused. Unlike deploy preflight, this migration validation does not resolve or install the local CLI and performs no authentication calls.

The helper only translates recognized legacy script shapes. Custom `dev`, `deploy`, or `setup:pa-auth` scripts are refused **before any apply writes**; migrate those deliberately, preserving their behavior, then rerun `--check`. Other custom scripts, PAC `setup:auth`, and mock-only `dev:local` are retained. A recognized legacy deploy's optional `--solution-name` must match the reviewed target. Unknown/newer SDK or CLI specifications are refused, never silently downgraded. Re-running on a migrated app is safe. Custom bin prefixes come from project `pacaf.config.json` or installed scripts-package metadata.

After proposed known replacements, **any remaining legacy Code App command in any package script** also blocks all apply writes, including custom connector commands or PAC-safe wrappers invoking Code App lifecycle operations. Translate these manually using the reviewed connector mappings; the migrator does not guess flags. PAC solution/admin and authentication scripts remain supported and are not indiscriminately rewritten.

The helper never installs dependencies, authenticates, runs init/publish/share, recreates bindings, rewrites `power.config.json`, or changes cloud permissions. `.pacaf-pa-migration.json` is a mode-0600 local rollback receipt containing the **prior package manifest**; keep it local, do not commit it, and retain it until verification is complete. Apart from this receipt, apply writes only `package.json`.

After reviewing dependency changes, run the indicated **install** command with the existing package manager to reconcile the unchanged lockfile (`npm install` or `pnpm install`). Apply alone is not a completed migration. Review and commit the updated lockfile with the manifest; preserve registry settings and build allowlists. CI and later clean installs use `npm ci` or `pnpm install --frozen-lockfile`. A missing local CLI must fail clearly, never trigger an unpinned download.

Native dependency build scripts (including keytar/MSAL extensions used by authentication) require **user review and approval** under the package manager's policy. Do not automatically change the dependency-build allowlist, approve all builds, or disable that protection to make installation pass.

### Durable target identity

Populate/verify `.power-apps-targets.json` using the existing app's verified identities:

```json
{
  "version": 1,
  "targets": {
    "dev": {
      "environmentId": "<environment-id>",
      "environmentUrl": "https://your-org-dev.crm.dynamics.com",
      "cloud": "public",
      "tenantId": "<tenant-guid>",
      "account": "maker@contoso.com",
      "appId": "<existing-code-app-guid>",
      "solutionId": "<solution-guid>",
      "solutionName": "YourSolutionUniqueName"
    }
  }
}
```

This is non-secret structural metadata, not a credential store. Environment IDs can be UUIDs or `Default-<UUID>`. `cloud` defaults to `public`, corresponding to config `region: "prod"`. Preserve both solution identifiers: `pa` requires the **GUID**, whereas PAC ALM uses the **unique name**. Do not infer missing IDs from friendly names or change `power.config.json` to silence a mismatch. Ignored wizard state alone is not a durable target record.

### Verify without deploying

```bash
pacaf-pa --version
pacaf-deploy --target dev --preflight
npm run build
npm run test:smoke
npm run dev:local
```

Preflight is non-mutating: no login, build, publish, or access grant. It is a guard/configuration check, not evidence of live permission or connector success. Keep HashRouter, production `base: './'`, `pacaf-patch-datasources` prebuild checks, and metadata-backed Dataverse field labels. The legacy missing-parameters repair remains compatible with old generated output; removing that repair is not permission to remove routing/build safeguards.

Preflight is **offline**, requires the pinned CLI installed, and does not invoke Azure CLI, inspect ambient authentication, or build. Real deployment builds, validates relative HTML assets/routing, and checks supported auth evidence plus solution GUID/unique name. **CLI 1.0.2's `signedIn`, username, and `homeAccountId` do not prove the resource tenant**, even when the home-tenant suffix matches.

Connected scaffold initialization and user publishing require a **separate, explicit Azure CLI login** (`az login --allow-no-subscriptions --tenant "<expected-tenant-id>"`) with Global Discovery Service access. The helper makes a read-only `az rest` call to its fixed cloud-specific GDS URL/resource, then requires `EnvironmentId`, `TenantId`, and `Url` to match the durable target. This verifies the environment's resource tenant independently; it does not expose or claim to prove the tenant in the opaque `pa` token. `pa` status validates username and stable home-account identity only.

Verify Azure CLI installation with `az version`; if missing, use the [official installation guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli). This extra prerequisite applies to connected scaffold initialization and user publishing, not mock development, offline preflight, or explicit-tenant SPN updates. The connected wizard checks GDS before `pa auth login`/`pa app init`, even when publishing is deferred. The opt-in integration harness's connector phase also requires this evidence. Neither installation nor Azure login is automatic.

No automatic Azure login, arbitrary discovery endpoints, home-account inference, token-cache inspection, or unguarded push fallback is permitted. Missing GDS rows (disabled-user, security-group, or delegated-admin visibility restrictions), auth failures, and mismatches fail closed. Resolve authorized discovery access before retrying. SPN publishing instead uses its explicit tenant/client authority for existing-app updates.

For connected validation, sign in separately (`pacaf-pa auth login --account <maker-email>`), inspect `auth status --json`, and run `npm run dev`. The dev script runs:

```text
concurrently --kill-others-on-fail "vite --port 3000 --strictPort" "pacaf-pa app run --config-only --port 8080 --local-app-url http://localhost:3000"
```

Use the emitted Power Apps local-play URL. `--config-only` prevents the CLI from starting a second Vite process or recursively invoking dev; `--kill-others-on-fail` stops the companion when either process fails. Mock-only dev requires no platform sign-in.

### Publish only when separately intended

`pacaf-deploy --target dev` validates the target, builds, checks generated assets/routing and auth/solution evidence, revalidates config, and invokes `pa app push --solution-id <GUID>`. The general `pacaf-pa` runner refuses `app push`; use the deploy helper. Do **not** append `--environment-id` to push: CLI 1.0.2 uses verified project configuration. Do not reuse `PAC_BIN` or `pacaf-pac-safe` for `pa`.

Migrated existing apps must retain their app ID and must not use `--allow-create`. That option is for an explicitly intended **new** app's first user publish with empty target `appId` (`""`), not migration, and requires the same read-only GDS evidence. After success the helper persists the app ID written to config. SPN publishing is **opt-in existing-app updates only** with `--auth spn`; inject `PA_CLI_USE_SP_AUTH=true`, `PA_CLI_SP_CLIENT_ID`, `PA_CLI_SP_CLIENT_SECRET`, `PA_CLI_SP_TENANT_ID` from a secret store. No secrets in `VITE_*`, source, logs, or `.power-apps-targets.json`.

SPN mode also requires an explicit non-secret `spnClientId` on the selected target, matching `PA_CLI_SP_CLIENT_ID`. It identifies the expected Entra application/client, not the Code App `appId` or the Enterprise Application object ID used for sharing.

Environment access alone is insufficient. An authorized maker must separately grant edit access using the **Enterprise Application object ID**:

```bash
# One-time permission change ONLY after explicit authorization, in user mode:
pacaf-pa app share --principal "<enterprise-application-object-id>" --access edit
```

This is neither the App Registration object ID nor the application/client ID. Never put sharing in migration or recurring deployment; an SPN cannot self-grant. See [deployment guidance](.github/instructions/04-deployment.instructions.md) for the complete flow.

### Roll back local tooling

```bash
pacaf-migrate-pa --rollback
git diff
```

Rollback restores the exact prior **package manifest** from `.pacaf-pa-migration.json`; it refuses if the manifest has since been modified. The receipt is removed only after successful rollback. Lockfiles remain unchanged. Run the same package manager's install command to reconcile the lockfile with the restored manifest, then review the diff. Preserve any work made after migration; if rollback refuses, merge deliberately rather than forcing an overwrite. Never restore credentials from logs or delete `power.config.json`/bindings to roll back.

Rollback does **not** undo a cloud deployment, permission grant, connector mutation, solution import, target metadata change, or guidance update. Any such action needs its own authorized recovery plan. Guidance/package updates are distinct from the migration receipt: preserve project policy overlays across `pacaf-update`, review the update diff, and treat any failed package update/instruction sync as failure, not success.

### Preserve downstream policy across updates

Do not maintain project policy solely by editing shipped `AGENTS.md` or projected instruction files. Declare deliberate **whole-file replacements** in `.pacaf/policy-overlays.json`:

```json
{
  "version": 1,
  "files": {
    "AGENTS.md": ".pacaf/policy/AGENTS.md"
  }
}
```

The source replacement is a complete project-owned document, not a patch or appended fragment. Destinations must be shipped guidance files and sources must live under `.pacaf/policy/`. Keep the overlay manifest and replacement sources under version control, with no secrets. `pacaf-instructions sync` automatically reapplies declared overlays; `pacaf-update` uses the installed sync implementation, refuses older unsafe versions, and preserves overlays after partial subprocess failure.

Unregistered local edits are refused rather than silently discarded. After reviewing those edits and explicitly choosing replacement, `pacaf-instructions sync --force` preserves originals under `.pacaf/guidance-backups/<timestamp>-<pid>/<original-relative-file>` and prints the backup location before replacing them. Do not treat force as the default update path. `pacaf-update` has no `--force` option; unknown options are rejected.

Whole-file replacement means **you own merging future upstream policy improvements into that file**. Before migrating, remove obsolete PAC-only rules from replacements too: local pinned `pa` for Code Apps, PAC for ALM/admin, Dataverse-skills unchanged. Preserve target guards, secret handling, HashRouter, relative assets, and metadata-backed forms. An old overlay must not silently restore the policy this migration replaces.

Run `pacaf-instructions check` after updates and inspect the diff. It compares actual files, overlay content, and version: exit **0** means current, **2** means drift, and **1** means an error. `pacaf-update --check` uses the same exit codes and additionally compares both installed package versions with the configured npm registry; registry failures return **1**, not a false current result. A nonzero package-update or instruction-sync exit is failure; do not continue as if the migration succeeded. See the installed `@pacaf/agent-instructions` and `@pacaf/scripts` READMEs for further details.

### Evidence limits

Unit/fixture and tarball tests cannot establish live connector access or SPN edit permission. Before claiming connected readiness, record controlled Dataverse and non-Dataverse connector tests (including adapter and metadata form behavior) and any separately authorized SPN update. Report unperformed cloud checks explicitly.

### Optional controlled integration harness

The published scripts package includes `tests/integration-pa.mjs`. It defaults to **offline validation**: no cloud calls, authentication changes, publishing, or sharing. Use an already-published **disposable** app with reviewed target metadata; the harness never creates an app or grants access.

Create a local `pa-integration.json` plan, replacing every placeholder with reviewed values:

```json
{
  "target": "dev",
  "dataverse": {
    "table": "contact",
    "generatedFiles": ["<project-relative-expected-Dataverse-generated-file>"]
  },
  "connector": {
    "connector": "shared_office365users",
    "connectionId": "<existing-connection-id>",
    "generatedFiles": ["<project-relative-expected-connector-generated-file>"]
  }
}
```

`generatedFiles` must list actual expected project-relative output paths, not the example placeholders. Verify output conventions for the selected table/connector rather than guessing a service filename. The non-Dataverse connector must be a `shared_*` connector; add its optional `table` and `dataset` fields when tabular. Keep credentials out of the plan.

```bash
# Default: offline only, no cloud calls
node node_modules/@pacaf/scripts/tests/integration-pa.mjs --plan pa-integration.json
```

Only after explicit authorization for the disposable environment/app, choose a phase and supply both identity confirmations:

```bash
# Mutates local bindings/generated files and accesses the selected connectors
node node_modules/@pacaf/scripts/tests/integration-pa.mjs --plan pa-integration.json --phase connectors --execute --confirm-environment "<exact-environment-id>" --confirm-app "<exact-existing-app-id>"

# Actual existing-app updates; never run merely to check installation
node node_modules/@pacaf/scripts/tests/integration-pa.mjs --plan pa-integration.json --phase user-publish --execute --confirm-environment "<exact-environment-id>" --confirm-app "<exact-existing-app-id>"
node node_modules/@pacaf/scripts/tests/integration-pa.mjs --plan pa-integration.json --phase spn-publish --execute --confirm-environment "<exact-environment-id>" --confirm-app "<exact-existing-app-id>"
```

The connector phase requires the pinned SDK `1.4.0`, generates one Dataverse table and one non-Dataverse connector, verifies the expected files, then builds. Publishing phases call the guarded existing-app deployment path. **User-publish requires separate Azure CLI login and matching GDS environment/tenant/URL evidence; a home-account match is not sufficient.** SPN prerequisites and secret-store injection still apply; missing edit access must fail, never trigger sharing or another identity.

**Harness success is generation/build/publish evidence only for the selected phase.** It does not prove runtime CRUD, provider behavior, metadata-backed labels, string/numeric required-level mapping, required-field submission guards, or consent behavior. Validate those separately through the Power Apps local-play/runtime path. No cloud execution is implied by a plan or offline result.

---

## Migrating to the thin foundations layout

If your repo was generated from the Power Apps Code App Foundations template **before** the `@pacaf/*` npm packages existed, you have `wizard/`, `wizard-ux/`, `scripts/`, and `docs/` directories at your repo root. They were copied in at scaffold time and have been periodically re-copied via `npm run sync:foundations`.

The new "thin" layout keeps all of that tooling in published `@pacaf/*` packages and adds only two devDependencies plus a `.github/instructions/` directory to your repo. Net footprint goes from ~470 MB of overhead to ~300 KB.

## Quick migration

```bash
# In your derived repo (one with wizard/, scripts/, etc. at root)
npx --yes @pacaf/scripts pacaf-migrate-thin
```

This will:

1. Archive `wizard/`, `wizard-ux/`, `scripts/`, and `docs/` to `.pacaf-archive/` (recoverable for one rollback).
2. Rewrite `package.json` scripts:
   - `node scripts/seed-prototype-assets.mjs` → `pacaf-seed`
   - `node scripts/sync-foundations.mjs` → `pacaf-update`
   - ...and the other helper script references.
3. Add `@pacaf/scripts` and `@pacaf/agent-instructions` as devDependencies (`^1.0.0`).
4. Run `npm install` (or `pnpm install` if you have `pnpm-lock.yaml`).
5. Run `npx @pacaf/agent-instructions sync` to refresh `.github/instructions/`, `.claude/rules/`, `.cursor/rules/`, `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`.

## Preview mode

```bash
npx --yes @pacaf/scripts pacaf-migrate-thin --dry-run
```

Prints every change without writing anything. Recommended for the first run.

## Manual verification after migration

```bash
git diff                    # review every change
npm run build               # confirm the build still works
npm run dev:local           # smoke test mock data path
git status                  # see .pacaf-archive/ has the old trees
```

If anything is broken, restore from the archive:

```bash
rm -rf wizard wizard-ux scripts docs
mv .pacaf-archive/* .
git checkout -- package.json package-lock.json
```

## What's preserved

- `src/`, `public/`, `tests/`, `dataverse/`, `solution/` — your application code, untouched.
- `vite.config.ts`, `tsconfig.json`, `package.json` (deps unchanged; only `scripts` rewritten and 2 devDeps added).
- `.env`, `.env.template`, `power.config.json`, `.foundations-version.json` — untouched (the version file is bumped by `pacaf-instructions sync` to record the new layout).
- `.github/instructions/` content stays where it is; `pacaf-instructions sync` refreshes it to match `@pacaf/agent-instructions@latest`.

## What's removed

- `wizard/` and `wizard-ux/` — replaced by `npx @pacaf/wizard-ux@latest` (run-on-demand).
- `scripts/*.mjs` — every script is now a `pacaf-*` bin from `@pacaf/scripts`.
- `docs/` — hosted at <https://martycarreras-psnl.github.io/PAppsCAFoundations>.

## After migration, when do I update?

The wizard is no longer regularly invoked, so the way you "get updates" is now `pnpm update` (or `npm update`).

```bash
npx pacaf-update          # update @pacaf/scripts + @pacaf/agent-instructions and re-sync instruction files
npx pacaf-update --check  # only show drift; don't write
```

Add `pacaf-update --check` to your CI if you want a continuously-monitored drift signal.

## Troubleshooting

### `npx pacaf-migrate-thin` reports "No legacy directories detected"

Your repo is already on the thin layout. Nothing to do.

### Some custom scripts I added to `scripts/` are gone

They were archived to `.pacaf-archive/scripts/`. If they were yours (not from the foundations bundle), move them somewhere safe — perhaps into a new `tools/` directory — and re-add them as `package.json` script entries pointing at the new path.

### The wizard rewrote one of my package.json scripts that I had customized

The migration tool uses a literal-string replacement for each known shipped script. If you had wrapped one of them or added flags, the original wrapping is preserved but the underlying call is rewritten. Inspect `git diff package.json` and adjust as needed.

### CI is failing because `node scripts/foo.mjs` no longer exists

Your CI workflow probably has a hardcoded reference. Search-and-replace:

```bash
grep -rln "node scripts/" .github/workflows/ | xargs sed -i '' 's|node scripts/seed-prototype-assets.mjs|npx pacaf-seed|g'
# ...repeat for each script
```

## Reporting issues

Open an issue at <https://github.com/martycarreras-psnl/PAppsCAFoundations/issues> with the output of `pacaf-migrate-thin --dry-run` and the resulting `git diff`.
