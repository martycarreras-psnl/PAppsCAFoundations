---
applyTo: "packages/**,.changeset/**,.github/workflows/release.yml,.github/instructions/**,.claude/rules/**,.cursor/rules/**,agent-guidance.config.json,AGENTS.md,CLAUDE.md,.github/copilot-instructions.md"
---

# Publishing Discipline — Every Fix Must Ship

This template publishes its own tooling to npm under the `@pacaf/*` scope. The release flow is **changesets + GitHub Actions** (`.github/workflows/release.yml`). The action runs on every push to `main`, opens a "Version Packages" PR when changesets are present, and on merge of that PR runs `pnpm release` to publish.

Because publication is gated on a changeset file, **a bug fix that lands without a changeset will never reach users.** Issue #19 documented exactly that: the #17 and #18 fixes were merged into `main` in commit `24b9423` but `npx @pacaf/wizard-ux@latest` continued to serve the buggy `3.0.2` build for users.

This file is the agent-facing rule that prevents a recurrence.

## The Non-Negotiable Rule

When you touch source code inside any package under `packages/` that is published (currently `@pacaf/wizard`, `@pacaf/wizard-ux`, `@pacaf/scripts`, `@pacaf/agent-instructions`, `@pacaf/rebrand`), and the change is a bug fix, feature, or any other user-visible behavior change, you **must** add a changeset entry in the same PR/commit.

If you skip the changeset:

- CI will fail (see `changeset-required` job in `.github/workflows/ci.yml`).
- The release workflow will not publish anything for that fix.
- Users on `npx @pacaf/<pkg>@latest` will not see your fix.

Trivial changes that do not need a changeset (and that the CI guard tolerates):

- Internal-only files: tests, docs (`*.md` inside the package), `*.test.ts`, fixtures.
- Files outside the runtime/publish surface (`scripts/`, `CHANGELOG.md`, `README.md` of the package).
- Repo-wide changes that don't touch any `packages/*/src/**`, `packages/*/server/**`, `packages/*/bin/**`, `packages/*/lib/**`, or `packages/*/package.json` `version` field.

## How To Add A Changeset

From the repo root:

```bash
npx changeset
```

The CLI walks you through:

1. **Which packages changed.** Pick the affected ones (use the spacebar). For a `@pacaf/wizard-ux` Step 3 bug fix, that's just `@pacaf/wizard-ux`.
2. **Bump type.** Use `patch` for bug fixes, `minor` for backward-compatible features, `major` for breaking changes (rare on this template — discuss before choosing).
3. **Summary.** Write a one-line, user-facing description. Reference the issue number with `#NNN` so the changelog and the issue cross-link.

This produces a file like `.changeset/fix-maker-url-and-1password-ux.md`. Commit it alongside your fix.

### One-liner template for an agent

When an agent fixes an issue, the commit sequence looks like:

```bash
# 1. Make the code change
# 2. Add a changeset (non-interactive form):
cat > .changeset/fix-issue-NNN.md <<'EOF'
---
'@pacaf/wizard-ux': patch
---

Short summary referencing the issue. Closes #NNN.
EOF
git add .changeset/fix-issue-NNN.md <changed files>
git commit -m "fix(wizard-ux): short summary

Closes #NNN.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

The release workflow handles the rest: it opens a "Version Packages" PR aggregating any pending changesets, and merging that PR triggers the actual `pnpm release`.

## After Merging A Fix To `main`

Once a bug-fix PR with a changeset is merged:

1. **Check that the release workflow opened (or updated) the "Version Packages" PR.** Look at `https://github.com/<owner>/<repo>/pulls?q=is%3Apr+title%3A%22chore%28release%29%3A+version+packages%22`.
2. **Tell the maintainer the release PR is ready.** Merging it triggers the publish.
3. **After the release PR is merged, verify the new version on npm:**
   ```bash
   npm view @pacaf/wizard-ux version
   ```
   It should match the new version in `packages/wizard-ux/package.json`.
4. **Comment back on the original issue** with the published version number so the reporter knows when the fix is actually consumable via `npx`.

## When You Are Re-Opening A "Fix Not Published" Issue

If a user reports (as in #19) that a fix is in `main` but not on npm, the recovery procedure is:

1. Check `.changeset/` for an entry covering the fix.
2. If missing, create a back-dated changeset *now* and commit it. The commit summary should reference both the original fix commit hash and the "not published" issue.
3. Push to `main`. The release workflow re-opens the "Version Packages" PR with the new changeset rolled in.
4. Merge the release PR. Verify on npm. Comment back on the issue.

Never publish manually from a developer machine. The workflow is the only authorized publisher because it pins the pnpm version, validates the lockfile, and uses repo-scoped npm credentials.

## Editing Agent Instructions Is Also Publishing

The `.github/instructions/`, `.claude/rules/`, `.cursor/rules/` trees at the **repo root** are not just developer documentation — they are the **payload of the `@pacaf/agent-instructions` npm package**. Every fork of this template, and every new repo scaffolded by `@pacaf/wizard` / `@pacaf/wizard-ux`, installs those files via `pacaf-instructions sync`. If you edit them and don't follow the steps below, the wider PACAF user base will not get the change.

This applies whenever you create, modify, or delete any of:

- `.github/instructions/*.instructions.md` (canonical Copilot instructions)
- `.claude/rules/*.md` (Claude Code projections)
- `.cursor/rules/*.mdc` (Cursor projections)
- `.github/copilot-instructions.md`
- Top-level `AGENTS.md` or `CLAUDE.md`
- `agent-guidance.config.json` (the projection manifest)

### The complete agent-instructions publishing flow

```bash
# 1. Edit the canonical file(s) at the repo root.
#    .github/instructions/<NN>-<topic>.instructions.md is the source of truth.

# 2. If you ADDED a brand-new instruction file, also add a manifest entry to
#    agent-guidance.config.json and (in the same change) author the matching
#    projection files at:
#      .claude/rules/<slug>.md         (with paths: frontmatter)
#      .cursor/rules/<NN>-<slug>.mdc   (with globs frontmatter)
#    Both projections must include the marker:
#      <!-- Generated from .github/instructions/<file>.instructions.md — do not edit directly -->

# 3. Verify the projection set is complete and marked.
node packages/scripts/generate-agent-guidance.mjs --check
#    Ignore "MISSING" lines for nested AGENTS.md files that only exist in
#    derived repos (e.g. scripts/AGENTS.md, src/AGENTS.md). They are expected
#    to be missing in the template.

# 4. Sync the canonical sources into the npm package payload.
#    Without this, the published @pacaf/agent-instructions tarball will not
#    contain your change and downstream `pacaf-instructions sync` users will
#    not receive it.
node packages/agent-instructions/scripts/sync-from-root.mjs

# 5. Add a changeset that bumps @pacaf/agent-instructions:
#      minor — new instruction file or significant behavior change
#      patch — wording, typo, or small clarification
cat > .changeset/agent-instructions-<short-slug>.md <<'EOF'
---
"@pacaf/agent-instructions": minor
---

One-paragraph user-facing summary of what changed and why downstream
agents should care. Reference any issue with #NNN.
EOF

# 6. Commit canonical + projections + manifest + package payload mirror +
#    changeset together so the change is atomic.
git add .github/instructions/ .claude/rules/ .cursor/rules/ \
        agent-guidance.config.json \
        packages/agent-instructions/ \
        .changeset/agent-instructions-<short-slug>.md
git commit -m "feat(instructions): <short title>\n\n<body>"
git push origin main

# 7. The Release workflow opens a "chore(release): version packages" PR.
#    Merge it. A second workflow run publishes @pacaf/agent-instructions
#    (and any transitive bumps to @pacaf/wizard / @pacaf/wizard-ux) to npm.

# 8. Verify.
npm view @pacaf/agent-instructions version
```

### Mandatory checks before pushing

- The new instruction file exists at **both** `.github/instructions/<file>` (canonical) **and** `packages/agent-instructions/instructions/<file>` (mirror produced by step 4).
- If a new file was added, `agent-guidance.config.json` has a matching `instructions[]` entry with `projections.claude`, `projections.cursor`, and (where relevant) `projections.codex`.
- The Claude projection has a `paths:` YAML frontmatter and the Cursor projection has a `globs:` YAML frontmatter.
- Both projections contain the line `<!-- Generated from .github/instructions/<file> — do not edit directly -->`.
- A changeset exists with the right bump type and a user-facing summary.
- `node packages/scripts/generate-agent-guidance.mjs --check` returns exit 0 for every file other than the template-only nested `AGENTS.md` files.

### How downstream actually picks up the change

| Audience | Pickup mechanism | Action required |
|---|---|---|
| Fresh repos via `npx @pacaf/wizard-ux@latest` | The wizard installs `@pacaf/agent-instructions@latest` automatically | None — they get it on first scaffold |
| Existing forks of this template | `pacaf-instructions sync` from the published package | Maintainer runs `npx @pacaf/agent-instructions pacaf-instructions sync` |
| This template repo itself | The canonical files at `.github/instructions/` are already the source of truth | None — you just edited them |
| Cloned but not-yet-scaffolded forks | Pulling from upstream | `git pull upstream main` |

A `.foundations-version.json` stamp in each consumer repo records which `@pacaf/agent-instructions` version is installed. `pacaf-instructions check` reports drift.

### What NOT to do

- Do **not** edit files under `packages/agent-instructions/instructions/`, `packages/agent-instructions/claude/`, or `packages/agent-instructions/cursor/` directly. They are **overwritten** by `sync-from-root.mjs`. Always edit at the repo root.
- Do **not** edit `.claude/rules/<file>.md` or `.cursor/rules/<file>.mdc` as your primary source — they are projections of `.github/instructions/`. If you want different content in them, the canonical file is still the source of truth for what the rule means; the projections may be shorter summaries linking back to the canonical.
- Do **not** skip the changeset on the assumption that "it's just documentation." Anything inside `.github/instructions/`, `.claude/rules/`, `.cursor/rules/`, or `agent-guidance.config.json` is **shipped behavior** for every consumer.
- Do **not** publish manually. Always go through the changeset PR.

## Why This Rule Exists

A fix merged but not published is worse than no fix at all — the source code says "fixed", the issue says "fixed", but the user still hits the bug. They have no signal that something is wrong, and the maintainers have no signal either until a user notices. Closing that gap is cheap (one changeset file) and the cost of not closing it is repeated bug reports against already-fixed code.
