#!/bin/bash
# scripts/pre-commit-hook.sh — papps-secret-guard
# Prevents accidental commit of plaintext secrets.
# Installed to .git/hooks/pre-commit by the setup wizard.
#
# Manual install:
#   cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BLOCKED=false

# ── 1. Block .env.local from being committed ──
if git diff --cached --name-only | grep -qE '(^|/)\.env\.local$'; then
  echo -e "${RED}BLOCKED:${NC} .env.local is staged for commit."
  echo "  This file contains secrets and must never be committed."
  echo "  Run: git reset HEAD .env.local"
  BLOCKED=true
fi

if git diff --cached --name-only | grep -qE '(^|/)\.env\.[^.]+\.local$'; then
  echo -e "${RED}BLOCKED:${NC} An .env.*.local file is staged for commit."
  echo "  These files contain secrets and must never be committed."
  BLOCKED=true
fi

# ── 2. Block plaintext PP_CLIENT_SECRET in any staged file ──
# Allowed patterns: empty value, op:// reference, ENC: encrypted value
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
if [ -n "$STAGED_FILES" ]; then
  while IFS= read -r file; do
    # Skip binary files
    if git diff --cached --numstat -- "$file" | grep -q "^-"; then
      continue
    fi
    # Check for plaintext PP_CLIENT_SECRET=<value> where value is not empty, not op://, not ENC:
    if git show ":$file" 2>/dev/null | grep -qE '^PP_CLIENT_SECRET=.+' ; then
      VALUE=$(git show ":$file" 2>/dev/null | sed -n 's/^PP_CLIENT_SECRET=//p' | head -1)
      if [ -n "$VALUE" ] && [[ "$VALUE" != op://* ]] && [[ "$VALUE" != ENC:* ]]; then
        echo -e "${RED}BLOCKED:${NC} Plaintext client secret found in ${file}"
        echo "  PP_CLIENT_SECRET must be encrypted (ENC:...) or an op:// reference."
        echo "  The setup wizard encrypts secrets automatically."
        BLOCKED=true
      fi
    fi
  done <<< "$STAGED_FILES"
fi

# ── 3. Warn about common secret patterns ──
if [ -n "$STAGED_FILES" ]; then
  while IFS= read -r file; do
    # Skip binary, generated, and lock files
    case "$file" in
      *.lock|*.png|*.jpg|*.ico|*.woff*|node_modules/*|.power/*|src/generated/*) continue ;;
    esac
    # Look for values that resemble Azure client secrets (long base64-ish strings after known keys)
    if git show ":$file" 2>/dev/null | grep -qEi '(client.?secret|password|token)\s*[:=]\s*["\x27]?[A-Za-z0-9+/~_.-]{20,}' ; then
      echo -e "${YELLOW}WARNING:${NC} Possible secret pattern detected in ${file}"
      echo "  Review this file before committing to ensure no plaintext secrets are included."
    fi
  done <<< "$STAGED_FILES"
fi

if [ "$BLOCKED" = true ]; then
  echo ""
  echo -e "${RED}Commit blocked by papps-secret-guard.${NC}"
  echo "Fix the issues above, then try again."
  exit 1
fi
