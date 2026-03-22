#!/bin/bash
# scripts/setup-auth.sh — Run once after cloning the repo
# Supports both 1Password (op CLI) and .env.local credential sources
#
# Usage:
#   npm run setup:auth
#   — or —
#   bash scripts/setup-auth.sh

set -euo pipefail

echo "================================================"
echo "  Power Apps Code Apps — Auth Profile Setup"
echo "================================================"
echo ""

# ---- Detect credential source ----
USE_1PASSWORD=false

if command -v op &>/dev/null && [ -f .env ] && grep -q "^PP_.*=op://" .env 2>/dev/null; then
  echo "[1Password] Detected op:// secret references in .env"
  USE_1PASSWORD=true
elif [ -f .env.local ]; then
  echo "[.env.local] Using credentials from .env.local"
  source .env.local
  # Decrypt encrypted client secret (written by wizard with AES-256-GCM)
  if [[ "${PP_CLIENT_SECRET:-}" == ENC:* ]]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    PP_CLIENT_SECRET=$(node "$SCRIPT_DIR/decrypt-secret.mjs" "$PP_CLIENT_SECRET")
    echo "  (client secret decrypted from encrypted storage)"
  fi
else
  echo "ERROR: No credential source found."
  echo ""
  echo "Option 1 (1Password — recommended):"
  echo "  1. Install 1Password CLI: https://developer.1password.com/docs/cli/get-started"
  echo "  2. Enable CLI integration: 1Password → Settings → Developer → Integrate with 1Password CLI"
  echo "  3. Ensure .env file contains op:// references (should already be in the repo)"
  echo ""
  echo "Option 2 (.env.local):"
  echo "  1. Copy .env.template to .env.local"
  echo "  2. Fill in your credentials (get them from your team lead)"
  echo ""
  exit 1
fi

# ---- Helper to run pac with credentials ----
run_pac() {
  if [ "$USE_1PASSWORD" = true ]; then
    op run --env-file=.env -- pac "$@"
  else
    pac "$@"
  fi
}

# ---- Validate credentials are resolvable ----
echo ""
echo "Validating credentials..."
if [ "$USE_1PASSWORD" = true ]; then
  # Test that op can resolve the references (will prompt for biometric/password)
  op run --env-file=.env -- bash -c 'echo "  Tenant: ${PP_TENANT_ID:0:8}... App: ${PP_APP_ID:0:8}..."'
else
  for var in PP_TENANT_ID PP_APP_ID PP_CLIENT_SECRET PP_ENV_DEV; do
    if [ -z "${!var:-}" ]; then
      echo "ERROR: $var is not set in .env.local"
      exit 1
    fi
  done
  echo "  Tenant: ${PP_TENANT_ID:0:8}... App: ${PP_APP_ID:0:8}..."
fi

# ---- Create PAC auth profiles ----
echo ""
echo "Creating PAC auth profiles..."

run_pac auth create \
  --name "Dev" \
  --environment "$PP_ENV_DEV" \
  --applicationId "$PP_APP_ID" \
  --clientSecret "$PP_CLIENT_SECRET" \
  --tenant "$PP_TENANT_ID"
echo "  ✓ Dev profile created"

if [ -n "${PP_ENV_TEST:-}" ]; then
  run_pac auth create \
    --name "Test" \
    --environment "$PP_ENV_TEST" \
    --applicationId "$PP_APP_ID" \
    --clientSecret "$PP_CLIENT_SECRET" \
    --tenant "$PP_TENANT_ID"
  echo "  ✓ Test profile created"
fi

if [ -n "${PP_ENV_PROD:-}" ]; then
  run_pac auth create \
    --name "Prod" \
    --environment "$PP_ENV_PROD" \
    --applicationId "$PP_APP_ID" \
    --clientSecret "$PP_CLIENT_SECRET" \
    --tenant "$PP_TENANT_ID"
  echo "  ✓ Prod profile created"
fi

# ---- Verify ----
echo ""
echo "Verifying connection..."
pac auth select --name "Dev"
pac org who

echo ""
echo "================================================"
echo "  Setup complete!"
echo "================================================"
echo ""
echo "Daily usage:"
if [ "$USE_1PASSWORD" = true ]; then
  echo "  Profiles are ready — 'pac code push' works without op run."
  echo "  For ephemeral mode: npm run pac -- code push"
  echo "  Re-run this script after secret rotation."
else
  echo "  'pac code push' works directly — no browser popup."
fi
echo ""
echo "  Switch environments:  pac auth select --name <Dev|Test|Prod>"
echo "  Check connection:     pac org who"
echo "  List profiles:        pac auth list"
echo ""
