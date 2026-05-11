#!/bin/bash
# scripts/op-pac.sh — Wrapper that runs pac commands with 1Password-injected credentials
#
# Usage:
#   ./scripts/op-pac.sh org who
#   ./scripts/op-pac.sh code push
#   ./scripts/op-pac.sh solution export --path ./solution.zip --name YourSolution
#
# Or via npm:
#   npm run pac -- org who
#   npm run pac -- code push

set -euo pipefail

if [ ! -f .env ] || ! grep -q "^PP_.*=op://" .env 2>/dev/null; then
  echo "ERROR: .env file with op:// references not found."
  echo "This wrapper requires 1Password. For .env.local usage, run pac commands directly."
  exit 1
fi

if ! command -v op &>/dev/null; then
  echo "ERROR: 1Password CLI (op) not found."
  echo "Install it: https://developer.1password.com/docs/cli/get-started"
  exit 1
fi

op run --env-file=.env -- pac "$@"
