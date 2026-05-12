---
paths:
  - "packages/**"
  - ".changeset/**"
  - ".github/workflows/release.yml"
---
<!-- Generated from .github/instructions/10-publishing.instructions.md — do not edit directly -->
# Publishing Discipline — Every Fix Must Ship

Releases are gated on **changesets**. A fix merged to `main` without a `.changeset/*.md` entry will never be published to npm and users on `npx @pacaf/<pkg>@latest` will keep hitting the bug (see issue #19 for a real example).

## The Rule

When you touch publishable source (`packages/*/src/**`, `packages/*/server/**`, `packages/*/bin/**`, `packages/*/lib/**`), add a changeset entry **in the same commit/PR**.

CI enforces this via the `changeset-required` job. No changeset = red CI = blocked merge.

Exempt changes (CI tolerates these):
- `*.md` inside a package
- `*.test.ts` / `*.test.mjs`
- Files under `scripts/` at repo root
- Changes that don't touch any publish surface

## How

Interactive:
```bash
npx changeset
```

Non-interactive (use this from an agent commit flow):
```bash
cat > .changeset/fix-issue-NNN.md <<'EOF'
---
'@pacaf/wizard-ux': patch
---

Short user-facing summary. Closes #NNN.
EOF
```

Pick `patch` for bug fixes, `minor` for features, `major` only after discussion.

## Post-merge agent checklist

After your fix lands on `main`:

1. Confirm the release workflow opened/updated the "Version Packages" PR.
2. Tell the maintainer that PR is ready — merging it triggers `pnpm release`.
3. After the release PR merges, verify with `npm view @pacaf/<pkg> version`.
4. Comment back on the original issue with the published version.

## "Fix exists in main but not on npm" recovery

If a user reports a published version still has a bug that was fixed in `main`:

1. Check `.changeset/` for an entry covering the fix.
2. If missing, create one **now** (back-dated is fine), commit it, and push.
3. The release workflow will re-open the "Version Packages" PR with this entry.
4. Merge that PR. Verify on npm. Comment back.

Never publish manually from a dev machine — the release workflow is the only authorized publisher.
