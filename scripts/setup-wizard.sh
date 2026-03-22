#!/bin/bash
# scripts/setup-wizard.sh — local guided setup for new developers

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

print_header() {
  echo "================================================"
  echo "  Power Apps Code Apps — Local Setup Wizard"
  echo "================================================"
  echo ""
}

check_command() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    echo "  [OK] $name"
  else
    echo "  [MISSING] $name"
  fi
}

ask_yes_no() {
  local prompt="$1"
  local default="${2:-Y}"
  local answer
  while true; do
    if [ "$default" = "Y" ]; then
      read -r -p "$prompt [Y/n]: " answer
      answer="${answer:-Y}"
    else
      read -r -p "$prompt [y/N]: " answer
      answer="${answer:-N}"
    fi
    case "$answer" in
      Y|y) return 0 ;;
      N|n) return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

choose_auth_mode() {
  local choice
  echo ""
  echo "Choose auth setup mode:"
  echo "  1) 1Password (.env with op:// references)"
  echo "  2) .env.local (manual secrets)"
  echo "  3) Skip auth setup for now"
  while true; do
    read -r -p "Enter 1, 2, or 3: " choice
    case "$choice" in
      1|2|3) echo "$choice"; return 0 ;;
      *) echo "Invalid selection. Please enter 1, 2, or 3." ;;
    esac
  done
}

setup_env_local_if_needed() {
  if [ -f ".env.local" ]; then
    echo "  [OK] .env.local already exists"
    return 0
  fi
  if [ -f ".env.template" ]; then
    cp .env.template .env.local
    echo "  [OK] Created .env.local from .env.template"
    echo "  [NEXT] Fill .env.local with team-provided credentials."
  else
    echo "  [WARN] .env.template not found; create .env.local manually."
  fi
}

run_auth_setup() {
  echo ""
  if [ ! -x "scripts/setup-auth.sh" ]; then
    chmod +x scripts/setup-auth.sh
  fi
  echo "Running scripts/setup-auth.sh..."
  bash scripts/setup-auth.sh
}

main() {
  print_header
  echo "Step 1: Checking required tools"
  check_command git
  check_command npm
  check_command pac
  check_command op

  echo ""
  echo "Step 2: Repository checks"
  if [ -f ".env" ]; then
    echo "  [OK] .env found"
  else
    echo "  [WARN] .env not found (needed for 1Password mode)"
  fi
  if [ -f ".env.template" ]; then
    echo "  [OK] .env.template found"
  else
    echo "  [WARN] .env.template not found"
  fi

  if ask_yes_no "Install npm dependencies now?" "Y"; then
    npm install
  else
    echo "Skipping npm install."
  fi

  local auth_choice
  auth_choice="$(choose_auth_mode)"
  case "$auth_choice" in
    1)
      echo "You selected 1Password mode."
      run_auth_setup
      ;;
    2)
      echo "You selected .env.local mode."
      setup_env_local_if_needed
      if ask_yes_no "Run auth profile setup now?" "Y"; then
        run_auth_setup
      fi
      ;;
    3)
      echo "Skipping auth setup."
      ;;
  esac

  if ask_yes_no "Run 'pac org who' to verify connection?" "Y"; then
    pac org who || true
  fi

  echo ""
  echo "Done. Next steps:"
  echo "  1) If needed, fill .env.local or verify .env op:// references"
  echo "  2) Run: npm run setup:auth"
  echo "  3) Run: pac org who"
  echo "  4) Start building from README instructions"
}

main "$@"
