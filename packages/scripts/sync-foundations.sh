#!/bin/bash
# scripts/sync-foundations.sh — Pull latest foundation updates from PAppsCAFoundations
#
# Usage:
#   bash scripts/sync-foundations.sh [--dry-run] [--yes]
#
# This script fetches the latest versions of shared infrastructure files from the
# PAppsCAFoundations template repo and applies them to your project. It never touches
# your project-specific code (src/, package.json, power.config.json, etc.).
#
# What gets updated:
#   .github/instructions/*     — Copilot instruction files
#   wizard/**                  — Setup wizard & libraries
#   scripts/*                  — Auth, crypto, and utility scripts
#   docs/guide.html            — Interactive visual guide
#   .env.template              — Credential template
#
# What is NEVER touched:
#   src/               .env.local          power.config.json
#   package.json       vite.config.ts      tsconfig.json
#   .wizard-state.json solution/           .env
#   README.md          .gitignore          node_modules/

set -euo pipefail

# ── Configuration ──
TEMPLATE_REPO="martycarreras-psnl/PAppsCAFoundations"
TEMPLATE_BRANCH="main"
DRY_RUN=false
AUTO_YES=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes|-y)  AUTO_YES=true ;;
  esac
done

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
info() { echo -e "${CYAN}ℹ${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; }

echo ""
echo "════════════════════════════════════════════════════════"
echo "  Sync Foundations — Pull latest from template repo"
echo "════════════════════════════════════════════════════════"
echo ""

# ── Ensure we're in a git repo ──
if [ ! -d .git ]; then
  err "Not a git repository. Run this from your project root."
  exit 1
fi

# ── Ensure clean working tree ──
if [ -n "$(git status --porcelain)" ]; then
  err "Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

# ── Download the latest template to a temp directory ──
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

info "Fetching latest foundations from ${TEMPLATE_REPO}..."
if ! npx --yes degit "${TEMPLATE_REPO}#${TEMPLATE_BRANCH}" "$TMPDIR" --force 2>/dev/null; then
  err "Failed to fetch template. Check your network connection."
  exit 1
fi
log "Template downloaded"

# ── Define which paths to sync ──
# Each entry is "source_path:dest_path" (relative to repo root)
# If source_path ends in /, it means sync all files in a directory

SYNC_DIRS=(
  ".github/instructions"
  "wizard"
  "scripts"
  "docs"
)

SYNC_FILES=(
  ".env.template"
  ".foundations-version.json"
)

# ── Compare and collect changes ──
CHANGES=()
NEW_FILES=()
UNCHANGED=0

compare_file() {
  local src="$1"
  local dest="$2"
  local rel="$3"

  if [ ! -f "$dest" ]; then
    NEW_FILES+=("$rel")
  elif ! diff -q "$src" "$dest" &>/dev/null; then
    CHANGES+=("$rel")
  else
    UNCHANGED=$((UNCHANGED + 1))
  fi
}

# Compare directories
for dir in "${SYNC_DIRS[@]}"; do
  if [ -d "$TMPDIR/$dir" ]; then
    while IFS= read -r -d '' file; do
      rel="${file#$TMPDIR/}"
      compare_file "$file" "$rel" "$rel"
    done < <(find "$TMPDIR/$dir" -type f -print0)
  fi
done

# Compare individual files
for f in "${SYNC_FILES[@]}"; do
  if [ -f "$TMPDIR/$f" ]; then
    compare_file "$TMPDIR/$f" "$f" "$f"
  fi
done

# ── Report ──
echo ""
TOTAL=$(( ${#CHANGES[@]} + ${#NEW_FILES[@]} ))
if [ "$TOTAL" -eq 0 ]; then
  log "Already up to date! (${UNCHANGED} files checked)"
  exit 0
fi

info "${#CHANGES[@]} file(s) changed, ${#NEW_FILES[@]} new file(s), ${UNCHANGED} unchanged"
echo ""

if [ ${#CHANGES[@]} -gt 0 ]; then
  echo "  Modified:"
  for f in "${CHANGES[@]}"; do
    echo -e "    ${YELLOW}M${NC}  $f"
  done
fi

if [ ${#NEW_FILES[@]} -gt 0 ]; then
  echo "  New:"
  for f in "${NEW_FILES[@]}"; do
    echo -e "    ${GREEN}A${NC}  $f"
  done
fi
echo ""

# ── Show diffs ──
if [ ${#CHANGES[@]} -gt 0 ]; then
  echo "─── Diffs ───"
  for f in "${CHANGES[@]}"; do
    echo ""
    echo -e "${CYAN}--- $f${NC}"
    diff -u "$f" "$TMPDIR/$f" --label "current/$f" --label "template/$f" || true
  done
  echo ""
  echo "──────────────"
  echo ""
fi

# ── Dry run exits here ──
if [ "$DRY_RUN" = true ]; then
  info "Dry run — no files were changed."
  exit 0
fi

# ── Confirm ──
if [ "$AUTO_YES" != true ]; then
  echo -n "Apply these updates? [y/N] "
  read -r answer
  if [[ ! "$answer" =~ ^[Yy] ]]; then
    info "Cancelled."
    exit 0
  fi
fi

# ── Apply changes ──
echo ""
for f in "${CHANGES[@]}" "${NEW_FILES[@]}"; do
  dir=$(dirname "$f")
  mkdir -p "$dir"
  cp "$TMPDIR/$f" "$f"
done
log "Applied ${TOTAL} file update(s)"

# ── Commit ──
echo ""
echo -n "Commit the updates? [Y/n] "
if [ "$AUTO_YES" = true ]; then
  answer="y"
  echo "y (auto)"
else
  read -r answer
fi

if [[ "$answer" =~ ^[Nn] ]]; then
  info "Files updated but not committed. Review and commit when ready."
else
  git add -A
  COMMIT_MSG="chore: sync foundations from ${TEMPLATE_REPO}

Updated ${#CHANGES[@]} file(s), added ${#NEW_FILES[@]} new file(s).

Files synced:
$(printf '  - %s\n' "${CHANGES[@]}" "${NEW_FILES[@]}")"

  git commit -m "$COMMIT_MSG"
  log "Changes committed"
  echo ""
  info "Review the commit, then push when ready: git push"
fi

echo ""
log "Sync complete!"
