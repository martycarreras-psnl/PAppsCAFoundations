#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required to run the setup wizard." >&2
  echo "Install Node.js, then run: node wizard/index.mjs" >&2
  exit 1
fi

echo "Delegating to the Node setup wizard so PAC target guardrails remain enforced."
exec node "$ROOT_DIR/wizard/index.mjs" "$@"
