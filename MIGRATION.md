# Migrating to the thin foundations layout

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

- `wizard/` and `wizard-ux/` — replaced by `npx @pacaf/wizard@latest` / `npx @pacaf/wizard-ux@latest` (run-on-demand).
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
