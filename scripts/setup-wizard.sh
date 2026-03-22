#!/bin/bash
# scripts/setup-wizard.sh — Complete guided setup for Power Apps Code Apps
#
# This is the ONLY thing a new developer needs to run. It walks through:
#   1. Machine prerequisites (Node, Git, PAC CLI, .NET)
#   2. Project identity (publisher prefix, solution name, etc.)
#   3. Power Apps Maker Portal guidance (publisher, environments, solution creation)
#   4. Environment URLs
#   5. App Registration + Application User guidance
#   6. Authentication setup (1Password or .env.local)
#   7. Code App scaffolding
#   8. Build, verify, and optionally deploy
#
# Progress is saved to .wizard-state.json so you can quit and resume.
#
# Usage:
#   bash scripts/setup-wizard.sh
#   bash scripts/setup-wizard.sh --reset   # Start over from scratch

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATE_FILE="$ROOT_DIR/.wizard-state.json"
TOTAL_STEPS=8

# ============================================================
# Utilities
# ============================================================

print_banner() {
  echo ""
  echo "════════════════════════════════════════════════════"
  echo "  Power Apps Code Apps — Setup Wizard"
  echo "════════════════════════════════════════════════════"
  echo ""
  echo "  This wizard walks you through everything needed"
  echo "  to create and deploy a Power Apps Code App."
  echo ""
  echo "  You'll need:"
  echo "    • A browser (for Power Apps Maker Portal & Admin Center steps)"
  echo "    • Your Azure AD credentials"
  echo "    • Access to Power Platform admin center"
  echo ""
  echo "  You can quit anytime with Ctrl+C and re-run later."
  echo "  The wizard remembers where you left off."
  echo ""
}

print_step_header() {
  local step_num="$1"
  local title="$2"
  echo ""
  echo "═══ Step ${step_num} of ${TOTAL_STEPS}: ${title} ═══"
  echo ""
}

print_divider() {
  echo "  ──────────────────────────────────────"
}

ask_yes_no() {
  local prompt="$1"
  local default="${2:-Y}"
  local answer
  while true; do
    if [ "$default" = "Y" ]; then
      read -r -p "  $prompt [Y/n]: " answer
      answer="${answer:-Y}"
    else
      read -r -p "  $prompt [y/N]: " answer
      answer="${answer:-N}"
    fi
    case "$answer" in
      Y|y) return 0 ;;
      N|n) return 1 ;;
      *) echo "  Please answer y or n." ;;
    esac
  done
}

ask_input() {
  local prompt="$1"
  local default="${2:-}"
  local value
  if [ -n "$default" ]; then
    read -r -p "  ${prompt} [${default}]: " value
    value="${value:-$default}"
  else
    read -r -p "  ${prompt}: " value
  fi
  echo "$value"
}

ask_input_required() {
  local prompt="$1"
  local value=""
  while [ -z "$value" ]; do
    read -r -p "  ${prompt}: " value
    if [ -z "$value" ]; then
      echo "  This field is required. Please enter a value."
    fi
  done
  echo "$value"
}

ask_secret() {
  local prompt="$1"
  local value=""
  while [ -z "$value" ]; do
    read -r -s -p "  ${prompt}: " value
    echo ""
    if [ -z "$value" ]; then
      echo "  This field is required."
    fi
  done
  echo "$value"
}

press_enter() {
  local msg="${1:-Press Enter to continue...}"
  read -r -p "  ${msg}" _unused
}

# ============================================================
# Validation helpers
# ============================================================

validate_prefix() {
  local prefix="$1"
  if [[ ! "$prefix" =~ ^[a-z]{2,8}$ ]]; then
    return 1
  fi
  return 0
}

validate_uuid() {
  local uuid="$1"
  if [[ "$uuid" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
    return 0
  fi
  return 1
}

validate_dataverse_url() {
  local url="$1"
  if [[ "$url" =~ ^https://.*\.crm[0-9]*\.dynamics\.com/?$ ]] || [[ "$url" =~ ^https://.*\.crm\.dynamics\.com/?$ ]]; then
    return 0
  fi
  return 1
}

validate_choice_prefix() {
  local val="$1"
  if [[ "$val" =~ ^[0-9]{4,6}$ ]]; then
    return 0
  fi
  return 1
}

# ============================================================
# State persistence (JSON via simple key=value for portability)
# ============================================================

state_set() {
  local key="$1"
  local value="$2"
  # Use a simple key=value file format for maximum bash portability
  if [ -f "$STATE_FILE" ]; then
    # Remove existing key if present
    grep -v "^${key}=" "$STATE_FILE" > "${STATE_FILE}.tmp" 2>/dev/null || true
    mv "${STATE_FILE}.tmp" "$STATE_FILE"
  fi
  echo "${key}=${value}" >> "$STATE_FILE"
}

state_get() {
  local key="$1"
  local default="${2:-}"
  if [ -f "$STATE_FILE" ]; then
    local val
    val=$(grep "^${key}=" "$STATE_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2-)
    if [ -n "$val" ]; then
      echo "$val"
      return
    fi
  fi
  echo "$default"
}

state_has() {
  local key="$1"
  if [ -f "$STATE_FILE" ] && grep -q "^${key}=" "$STATE_FILE" 2>/dev/null; then
    return 0
  fi
  return 1
}

state_get_step() {
  state_get "COMPLETED_STEP" "0"
}

state_set_step() {
  state_set "COMPLETED_STEP" "$1"
}

# ============================================================
# Step 1: Machine Prerequisites
# ============================================================

step_prerequisites() {
  print_step_header 1 "Checking Your Machine"

  local all_ok=true
  local has_op=false

  # Node.js
  if command -v node >/dev/null 2>&1; then
    local node_ver
    node_ver=$(node --version 2>/dev/null)
    local node_major
    node_major=$(echo "$node_ver" | sed 's/^v//' | cut -d. -f1)
    if [ "$node_major" -ge 20 ] 2>/dev/null; then
      echo "  ✓ Node.js ${node_ver}"
    else
      echo "  ✗ Node.js ${node_ver} — version 20+ required"
      echo "    Install: https://nodejs.org/"
      all_ok=false
    fi
  else
    echo "  ✗ Node.js — not found"
    echo "    Install: https://nodejs.org/"
    all_ok=false
  fi

  # Git
  if command -v git >/dev/null 2>&1; then
    echo "  ✓ Git $(git --version 2>/dev/null | sed 's/git version //')"
  else
    echo "  ✗ Git — not found"
    echo "    Install: https://git-scm.com/"
    all_ok=false
  fi

  # .NET SDK
  if command -v dotnet >/dev/null 2>&1; then
    echo "  ✓ .NET SDK $(dotnet --version 2>/dev/null)"
  else
    echo "  ✗ .NET SDK — not found (required for PAC CLI)"
    echo "    Install: https://dotnet.microsoft.com/download"
    all_ok=false
  fi

  # PAC CLI
  local pac_path=""
  if [ -f "$HOME/.dotnet/tools/pac" ]; then
    pac_path="$HOME/.dotnet/tools/pac"
  elif command -v pac >/dev/null 2>&1; then
    pac_path="$(command -v pac)"
  fi

  if [ -n "$pac_path" ]; then
    local pac_ver
    pac_ver=$("$pac_path" 2>&1 | grep -i "Version" | head -1 | sed 's/.*Version: *//' || echo "unknown")
    if echo "$pac_ver" | grep -q "2\.3\.2"; then
      echo "  ✗ PAC CLI ${pac_ver} — this version has a known bug"
      echo "    Fix: dotnet tool uninstall -g Microsoft.PowerApps.CLI.Tool"
      echo "         dotnet tool install -g Microsoft.PowerApps.CLI.Tool --version 2.2.1"
      all_ok=false
    else
      echo "  ✓ PAC CLI (${pac_ver})"
    fi
  else
    echo "  ✗ PAC CLI — not found"
    if command -v dotnet >/dev/null 2>&1; then
      if ask_yes_no "Install PAC CLI now? (dotnet tool install -g Microsoft.PowerApps.CLI.Tool)" "Y"; then
        echo ""
        echo "  Installing..."
        dotnet tool install -g Microsoft.PowerApps.CLI.Tool
        echo "  ✓ PAC CLI installed"
        echo ""
        echo "  NOTE: You may need to restart your terminal or add ~/.dotnet/tools to PATH."
        echo "  Add this to your shell profile (~/.zshrc or ~/.bashrc):"
        echo "    export PATH=\"\$HOME/.dotnet/tools:\$PATH\""
        echo ""
      else
        echo "  Skipping PAC CLI install. You'll need it for later steps."
        all_ok=false
      fi
    else
      echo "    Install .NET SDK first, then: dotnet tool install -g Microsoft.PowerApps.CLI.Tool"
      all_ok=false
    fi
  fi

  # 1Password CLI (optional)
  if command -v op >/dev/null 2>&1; then
    echo "  ✓ 1Password CLI (op) — available"
    has_op=true
  else
    echo "  · 1Password CLI (op) — not found (optional)"
  fi

  state_set "HAS_OP" "$has_op"

  echo ""
  if [ "$all_ok" = true ]; then
    echo "  Everything required is installed."
  else
    echo "  Some required tools are missing (marked with ✗ above)."
    echo "  Install them and re-run this wizard."
    echo ""
    if ! ask_yes_no "Continue anyway?" "N"; then
      echo ""
      echo "  Re-run: bash scripts/setup-wizard.sh"
      exit 1
    fi
  fi

  state_set_step 1
  press_enter
}

# ============================================================
# Step 2: Project Identity
# ============================================================

step_project_identity() {
  print_step_header 2 "Project Identity"

  echo "  These names become permanent identifiers in Power Platform."
  echo "  Choose carefully — they cannot be changed after data exists."
  echo ""

  # App name
  local app_name
  if state_has "APP_NAME"; then
    app_name=$(state_get "APP_NAME")
    echo "  App name (from previous run): ${app_name}"
    if ! ask_yes_no "Keep this?" "Y"; then
      app_name=""
    fi
  fi
  if [ -z "${app_name:-}" ]; then
    echo "  What is your app called?"
    echo "  (A display name, e.g. \"My Brain\", \"Project Tracker\")"
    echo ""
    app_name=$(ask_input_required "App name")
  fi
  state_set "APP_NAME" "$app_name"

  echo ""
  print_divider
  echo ""

  # Publisher prefix
  local prefix=""
  if state_has "PUBLISHER_PREFIX"; then
    prefix=$(state_get "PUBLISHER_PREFIX")
    echo "  Publisher prefix (from previous run): ${prefix}"
    if ! ask_yes_no "Keep this?" "Y"; then
      prefix=""
    fi
  fi
  while [ -z "$prefix" ]; do
    echo "  Publisher prefix — a short namespace (2–8 lowercase letters)."
    echo "  This prefixes EVERY table, column, and choice in Dataverse."
    echo "  Examples: mybrn, contso, hr, fin"
    echo ""
    prefix=$(ask_input_required "Publisher prefix")
    if ! validate_prefix "$prefix"; then
      echo ""
      echo "  ✗ Invalid: must be 2–8 lowercase letters only (no numbers,"
      echo "    hyphens, or underscores)."
      echo ""
      prefix=""
    else
      echo "  ✓ Valid: \"${prefix}\" (${#prefix} lowercase letters)"
    fi
  done
  state_set "PUBLISHER_PREFIX" "$prefix"

  echo ""
  print_divider
  echo ""

  # Publisher display name
  local pub_display
  local default_pub_display="${app_name} Engineering"
  pub_display=$(ask_input "Publisher display name (human-readable owner)" "$default_pub_display")
  state_set "PUBLISHER_DISPLAY_NAME" "$pub_display"

  # Publisher internal name
  local default_pub_name
  default_pub_name=$(echo "$pub_display" | tr '[:upper:]' '[:lower:]' | tr -d ' -')
  local pub_name
  pub_name=$(ask_input "Publisher internal name (lowercase, no spaces)" "$default_pub_name")
  state_set "PUBLISHER_NAME" "$pub_name"

  echo ""

  # Solution display name
  local sol_display
  sol_display=$(ask_input "Solution display name" "$app_name")
  state_set "SOLUTION_DISPLAY_NAME" "$sol_display"

  # Solution unique name
  local default_sol_name
  default_sol_name=$(echo "$sol_display" | tr -d ' -')
  local sol_name
  sol_name=$(ask_input "Solution unique name (no spaces, used in CLI)" "$default_sol_name")
  state_set "SOLUTION_UNIQUE_NAME" "$sol_name"

  echo ""
  print_divider
  echo ""
  echo "  Here's what we've got:"
  echo ""
  echo "    App name:              ${app_name}"
  echo "    Publisher prefix:      ${prefix}"
  echo "    Publisher display:     ${pub_display}"
  echo "    Publisher name:        ${pub_name}"
  echo "    Solution display:      ${sol_display}"
  echo "    Solution unique name:  ${sol_name}"
  echo ""

  if ! ask_yes_no "Look right?" "Y"; then
    echo ""
    echo "  Let's redo it."
    # Clear identity values and recurse
    state_set "APP_NAME" ""
    state_set "PUBLISHER_PREFIX" ""
    step_project_identity
    return
  fi

  state_set_step 2
}

# ============================================================
# Step 3: Power Apps Maker Portal — Create Publisher
# ============================================================

step_create_publisher() {
  print_step_header 3 "Create Your Publisher in Power Platform"

  local prefix
  prefix=$(state_get "PUBLISHER_PREFIX")
  local pub_display
  pub_display=$(state_get "PUBLISHER_DISPLAY_NAME")
  local pub_name
  pub_name=$(state_get "PUBLISHER_NAME")

  echo "  This step happens in the Power Apps Maker Portal. The wizard can't do it"
  echo "  for you — but it tells you exactly what to click and type."
  echo ""
  print_divider
  echo "  1. Open the Power Apps Maker Portal: https://make.powerapps.com"
  echo "  2. Select your DEVELOPMENT environment (top-right dropdown)"
  echo "     (If you haven't created it yet, do that first — see Step 4)"
  echo "  3. Click: Solutions (left nav) → Publishers → + New Publisher"
  echo "  4. Fill in EXACTLY:"
  echo ""
  echo "     Display name:      ${pub_display}"
  echo "     Name:              ${pub_name}"
  echo "     Prefix:            ${prefix}"
  echo ""
  echo "  5. Note the \"Choice value prefix\" number that auto-populates"
  echo "     (usually something like 10000 or 27182)"
  echo "  6. Click Save"
  print_divider
  echo ""

  local choice_prefix=""
  while [ -z "$choice_prefix" ]; do
    echo "  What was the Choice value prefix number?"
    echo "  (The 4–5 digit number shown next to \"Choice value prefix\")"
    echo ""
    choice_prefix=$(ask_input_required "Choice value prefix")
    if ! validate_choice_prefix "$choice_prefix"; then
      echo "  ✗ Expected a 4–6 digit number (e.g. 10000). Try again."
      choice_prefix=""
    else
      echo "  ✓ Saved. Your option set values will start at ${choice_prefix}0000."
    fi
  done
  state_set "CHOICE_VALUE_PREFIX" "$choice_prefix"

  echo ""
  if ! ask_yes_no "Did you complete the publisher creation?" "Y"; then
    echo ""
    echo "  No problem — complete it in the Power Apps Maker Portal and re-run the wizard."
    echo "  Your progress is saved. Re-run: bash scripts/setup-wizard.sh"
    exit 0
  fi

  state_set_step 3
}

# ============================================================
# Step 4: Environments
# ============================================================

step_environments() {
  print_step_header 4 "Power Platform Environments"

  local app_name
  app_name=$(state_get "APP_NAME")

  echo "  You need at least a Development environment."
  echo "  Test and Production are optional for now."
  echo ""
  print_divider
  echo "  If you haven't created environments yet:"
  echo "  1. Open the Power Platform Admin Center: https://admin.powerplatform.microsoft.com"
  echo "  2. Click: Environments → + New"
  echo "  3. Name it: ${app_name} - Dev"
  echo "  4. Type: Developer or Sandbox"
  echo "  5. IMPORTANT: Toggle \"Add Dataverse\" to YES"
  echo "  6. Click Save, wait for provisioning to finish"
  echo "  7. Open the environment → copy the Environment URL"
  echo "     (looks like: https://org-name.crm.dynamics.com)"
  print_divider
  echo ""

  # Dev URL (required)
  local dev_url=""
  if state_has "PP_ENV_DEV"; then
    dev_url=$(state_get "PP_ENV_DEV")
    echo "  Dev URL (from previous run): ${dev_url}"
    if ! ask_yes_no "Keep this?" "Y"; then
      dev_url=""
    fi
  fi
  while [ -z "$dev_url" ]; do
    dev_url=$(ask_input_required "Dev environment URL (required)")
    # Strip trailing slash
    dev_url="${dev_url%/}"
    if ! validate_dataverse_url "$dev_url"; then
      echo "  ✗ Doesn't look like a Dataverse URL."
      echo "    Expected format: https://org-name.crm.dynamics.com"
      dev_url=""
    else
      echo "  ✓ Looks like a valid Dataverse URL"
    fi
  done
  state_set "PP_ENV_DEV" "$dev_url"

  echo ""
  # Test URL (optional)
  echo "  Test environment URL (press Enter to skip):"
  local test_url
  test_url=$(ask_input "Test environment URL" "")
  if [ -n "$test_url" ]; then
    test_url="${test_url%/}"
    if validate_dataverse_url "$test_url"; then
      echo "  ✓ Valid"
    else
      echo "  ⚠ Doesn't look standard, but saving anyway."
    fi
    state_set "PP_ENV_TEST" "$test_url"
  fi

  echo ""
  # Prod URL (optional)
  echo "  Production environment URL (press Enter to skip):"
  local prod_url
  prod_url=$(ask_input "Prod environment URL" "")
  if [ -n "$prod_url" ]; then
    prod_url="${prod_url%/}"
    if validate_dataverse_url "$prod_url"; then
      echo "  ✓ Valid"
    else
      echo "  ⚠ Doesn't look standard, but saving anyway."
    fi
    state_set "PP_ENV_PROD" "$prod_url"
  fi

  state_set_step 4
  echo ""
  press_enter
}

# ============================================================
# Step 5: Power Apps Maker Portal + Azure Portal + Admin Center — Solution + App Registration + Application User
# ============================================================

step_solution_and_app_reg() {
  print_step_header 5 "Solution, App Registration & Application User"

  local app_name
  app_name=$(state_get "APP_NAME")
  local sol_display
  sol_display=$(state_get "SOLUTION_DISPLAY_NAME")
  local pub_display
  pub_display=$(state_get "PUBLISHER_DISPLAY_NAME")
  local dev_url
  dev_url=$(state_get "PP_ENV_DEV")

  echo "  Three things to do in the Power Apps Maker Portal, Azure Portal,"
  echo "  and Power Platform Admin Center — then we automate the rest."
  echo ""

  # ── A. Create Solution ──
  echo "  ── A. Create the Solution (Power Apps Maker Portal) ──"
  echo ""
  echo "  1. Open the Power Apps Maker Portal: https://make.powerapps.com"
  echo "  2. Select your Dev environment (top-right)"
  echo "  3. Click: Solutions (left nav) → + New Solution"
  echo "  4. Fill in:"
  echo "     Display name:  ${sol_display}"
  echo "     Publisher:     ${pub_display}  (select from dropdown)"
  echo "     Version:       1.0.0.0"
  echo "  5. Click Create"
  echo ""
  if ! ask_yes_no "Done creating the solution?" "Y"; then
    echo "  Complete it in the Power Apps Maker Portal and re-run the wizard."
    exit 0
  fi

  echo ""
  print_divider
  echo ""

  # ── B. App Registration ──
  echo "  ── B. Create the Azure App Registration (Azure Portal) ──"
  echo ""
  echo "  1. Open the Azure Portal: https://portal.azure.com"
  echo "  2. Go to: Microsoft Entra ID → App registrations → + New"
  echo "  3. Name: PowerApps-CodeApps-${app_name// /-}"
  echo "  4. Supported account types: Single tenant"
  echo "  5. Redirect URI: Leave blank"
  echo "  6. Click Register"
  echo ""
  echo "  On the Overview page, copy these two values:"
  echo ""

  # Tenant ID
  local tenant_id=""
  while [ -z "$tenant_id" ]; do
    tenant_id=$(ask_input_required "Tenant ID (Directory ID)")
    if ! validate_uuid "$tenant_id"; then
      echo "  ✗ Not a valid UUID. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      tenant_id=""
    else
      echo "  ✓ Valid UUID"
    fi
  done
  state_set "PP_TENANT_ID" "$tenant_id"

  # Client ID
  local client_id=""
  while [ -z "$client_id" ]; do
    client_id=$(ask_input_required "Client ID (Application ID)")
    if ! validate_uuid "$client_id"; then
      echo "  ✗ Not a valid UUID. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      client_id=""
    else
      echo "  ✓ Valid UUID"
    fi
  done
  state_set "PP_APP_ID" "$client_id"

  echo ""
  echo "  Now create a client secret:"
  echo "  7. In the App Registration → Certificates & secrets"
  echo "  8. + New client secret → Description: \"Power Platform CLI\""
  echo "  9. Expiration: 12 months (set a calendar reminder!)"
  echo "  10. Click Add → COPY THE SECRET VALUE NOW (shown only once!)"
  echo ""

  local client_secret
  client_secret=$(ask_secret "Client Secret (hidden input)")
  # Don't persist secret to state file — only use in memory for this session
  echo "  ✓ Got it (not saved to disk in plain text)"

  echo ""
  echo "  Finally, grant API permissions:"
  echo "  11. API permissions → + Add a permission"
  echo "  12. APIs my organization uses → search \"Dataverse\""
  echo "  13. Delegated permissions → check \"user_impersonation\""
  echo "  14. Click Add permissions"
  echo "  15. Click \"Grant admin consent for [Your Org]\""
  echo ""
  press_enter

  echo ""
  print_divider
  echo ""

  # ── C. Application User ──
  echo "  ── C. Register as Application User (Power Platform Admin Center) ──"
  echo ""
  echo "  For EACH environment, do this:"
  echo "  1. Open the Power Platform Admin Center: https://admin.powerplatform.microsoft.com"
  echo "  2. Select the environment → Settings"
  echo "  3. Users + permissions → Application users"
  echo "  4. + New app user → Add an app"
  echo "  5. Search: PowerApps-CodeApps-${app_name// /-}"
  echo "  6. Select it → assign Security Role:"
  echo "     • Dev/Test: System Administrator"
  echo "     • Production: Least-privilege custom role"
  echo "  7. Click Create"
  echo ""
  echo "  Do this for your Dev environment at minimum."
  echo "  (Test and Prod can be done later.)"
  echo ""

  if ! ask_yes_no "Done registering the Application User in Dev?" "Y"; then
    echo "  Complete it and re-run the wizard."
    exit 0
  fi

  # Store secret in a temporary env var for use in step 6 (current session only)
  export _WIZARD_CLIENT_SECRET="$client_secret"

  state_set_step 5
}

# ============================================================
# Step 6: Authentication Setup
# ============================================================

step_auth_setup() {
  print_step_header 6 "Setting Up Authentication"

  local has_op
  has_op=$(state_get "HAS_OP" "false")
  local tenant_id
  tenant_id=$(state_get "PP_TENANT_ID")
  local client_id
  client_id=$(state_get "PP_APP_ID")
  local dev_url
  dev_url=$(state_get "PP_ENV_DEV")
  local test_url
  test_url=$(state_get "PP_ENV_TEST" "")
  local prod_url
  prod_url=$(state_get "PP_ENV_PROD" "")

  # If we don't have the secret in memory (resumed session), ask again
  if [ -z "${_WIZARD_CLIENT_SECRET:-}" ]; then
    echo "  We need your Client Secret again (it's not stored on disk)."
    _WIZARD_CLIENT_SECRET=$(ask_secret "Client Secret (hidden input)")
    export _WIZARD_CLIENT_SECRET
    echo ""
  fi

  local auth_mode=""
  echo "  How do you want to store credentials?"
  if [ "$has_op" = "true" ]; then
    echo "    1) 1Password (secrets never touch disk) — RECOMMENDED"
  else
    echo "    1) 1Password — UNAVAILABLE (op CLI not found)"
  fi
  echo "    2) .env.local file (secrets on disk, gitignored)"
  echo ""

  while true; do
    local choice
    choice=$(ask_input "Choice" "2")
    case "$choice" in
      1)
        if [ "$has_op" = "true" ]; then
          auth_mode="1password"
          break
        else
          echo "  1Password CLI not found. Choose option 2, or install op and re-run."
        fi
        ;;
      2) auth_mode="envlocal"; break ;;
      *) echo "  Enter 1 or 2." ;;
    esac
  done

  state_set "AUTH_MODE" "$auth_mode"

  echo ""

  if [ "$auth_mode" = "1password" ]; then
    # 1Password setup
    local app_name
    app_name=$(state_get "APP_NAME")
    local vault_name
    vault_name=$(ask_input "1Password vault name" "Engineering")
    local item_name
    item_name=$(ask_input "1Password item name" "PowerApps CodeApps - ${app_name}")
    state_set "OP_VAULT" "$vault_name"
    state_set "OP_ITEM" "$item_name"

    echo ""
    echo "  Make sure the 1Password item \"${item_name}\" exists in"
    echo "  vault \"${vault_name}\" with these EXACT field labels:"
    echo "    • tenant-id     (Text)"
    echo "    • app-id        (Text)"
    echo "    • client-secret (Password)"
    echo "    • env-dev       (Text)"
    if [ -n "$test_url" ]; then
      echo "    • env-test      (Text)"
    fi
    if [ -n "$prod_url" ]; then
      echo "    • env-prod      (Text)"
    fi
    echo ""
    echo "  Or create it now with the CLI:"
    echo ""
    echo "    op item create \\"
    echo "      --vault \"${vault_name}\" \\"
    echo "      --category \"API Credential\" \\"
    echo "      --title \"${item_name}\" \\"
    echo "      \"tenant-id[text]=${tenant_id}\" \\"
    echo "      \"app-id[text]=${client_id}\" \\"
    echo "      \"client-secret[password]=YOUR_SECRET\" \\"
    echo "      \"env-dev[text]=${dev_url}\""
    echo ""

    press_enter "Press Enter after the 1Password item is ready..."

    # Write .env with op:// references
    cat > "$ROOT_DIR/.env" << EOF
# .env — Safe to commit. Contains 1Password references, not secrets.
# Generated by setup-wizard.sh on $(date +%Y-%m-%d)

PP_TENANT_ID=op://${vault_name}/${item_name}/tenant-id
PP_APP_ID=op://${vault_name}/${item_name}/app-id
PP_CLIENT_SECRET=op://${vault_name}/${item_name}/client-secret
PP_ENV_DEV=op://${vault_name}/${item_name}/env-dev
EOF
    if [ -n "$test_url" ]; then
      echo "PP_ENV_TEST=op://${vault_name}/${item_name}/env-test" >> "$ROOT_DIR/.env"
    fi
    if [ -n "$prod_url" ]; then
      echo "PP_ENV_PROD=op://${vault_name}/${item_name}/env-prod" >> "$ROOT_DIR/.env"
    fi
    echo "  ✓ Wrote .env with 1Password references"

    # Create auth profiles via op
    echo ""
    echo "  Creating PAC auth profiles via 1Password..."
    op run --env-file="$ROOT_DIR/.env" -- pac auth create \
      --name "Dev" \
      --environment "$dev_url" \
      --applicationId "$client_id" \
      --clientSecret "$_WIZARD_CLIENT_SECRET" \
      --tenant "$tenant_id" && echo "  ✓ Dev profile created" || echo "  ✗ Dev profile failed — check credentials"

    if [ -n "$test_url" ]; then
      op run --env-file="$ROOT_DIR/.env" -- pac auth create \
        --name "Test" --environment "$test_url" \
        --applicationId "$client_id" --clientSecret "$_WIZARD_CLIENT_SECRET" \
        --tenant "$tenant_id" && echo "  ✓ Test profile created" || echo "  ✗ Test profile failed"
    fi
    if [ -n "$prod_url" ]; then
      op run --env-file="$ROOT_DIR/.env" -- pac auth create \
        --name "Prod" --environment "$prod_url" \
        --applicationId "$client_id" --clientSecret "$_WIZARD_CLIENT_SECRET" \
        --tenant "$tenant_id" && echo "  ✓ Prod profile created" || echo "  ✗ Prod profile failed"
    fi

  else
    # .env.local setup
    echo "  Writing .env.local..."
    cat > "$ROOT_DIR/.env.local" << EOF
# .env.local — DO NOT commit to Git. Generated by setup-wizard.sh on $(date +%Y-%m-%d)

PP_TENANT_ID=${tenant_id}
PP_APP_ID=${client_id}
PP_CLIENT_SECRET=${_WIZARD_CLIENT_SECRET}
PP_ENV_DEV=${dev_url}
EOF
    if [ -n "$test_url" ]; then
      echo "PP_ENV_TEST=${test_url}" >> "$ROOT_DIR/.env.local"
    fi
    if [ -n "$prod_url" ]; then
      echo "PP_ENV_PROD=${prod_url}" >> "$ROOT_DIR/.env.local"
    fi
    echo "  ✓ Wrote .env.local"

    # Verify .gitignore has .env.local
    if grep -q "\.env\.local" "$ROOT_DIR/.gitignore" 2>/dev/null; then
      echo "  ✓ .env.local is in .gitignore"
    else
      echo ".env.local" >> "$ROOT_DIR/.gitignore"
      echo "  ✓ Added .env.local to .gitignore"
    fi

    # Create auth profiles directly
    echo ""
    echo "  Creating PAC auth profiles..."

    # Determine pac path
    local pac_cmd="pac"
    if [ -f "$HOME/.dotnet/tools/pac" ]; then
      pac_cmd="$HOME/.dotnet/tools/pac"
    fi

    "$pac_cmd" auth create \
      --name "Dev" \
      --environment "$dev_url" \
      --applicationId "$client_id" \
      --clientSecret "$_WIZARD_CLIENT_SECRET" \
      --tenant "$tenant_id" && echo "  ✓ Dev profile created" || echo "  ✗ Dev profile failed — check credentials"

    if [ -n "$test_url" ]; then
      "$pac_cmd" auth create \
        --name "Test" --environment "$test_url" \
        --applicationId "$client_id" --clientSecret "$_WIZARD_CLIENT_SECRET" \
        --tenant "$tenant_id" && echo "  ✓ Test profile created" || echo "  ✗ Test profile failed"
    fi
    if [ -n "$prod_url" ]; then
      "$pac_cmd" auth create \
        --name "Prod" --environment "$prod_url" \
        --applicationId "$client_id" --clientSecret "$_WIZARD_CLIENT_SECRET" \
        --tenant "$tenant_id" && echo "  ✓ Prod profile created" || echo "  ✗ Prod profile failed"
    fi
  fi

  # Write .env.template (no secrets, always safe)
  echo ""
  echo "  Writing .env.template (no secrets, safe to commit)..."
  cat > "$ROOT_DIR/.env.template" << 'EOF'
# .env.template — Copy to .env.local and fill in values
# DO NOT commit .env.local to Git
#
# For 1Password users: use the .env file (already in the repo) instead.

PP_TENANT_ID=
PP_APP_ID=
PP_CLIENT_SECRET=
EOF
  echo "PP_ENV_DEV=${dev_url}" >> "$ROOT_DIR/.env.template"
  if [ -n "$test_url" ]; then
    echo "PP_ENV_TEST=${test_url}" >> "$ROOT_DIR/.env.template"
  else
    echo "PP_ENV_TEST=" >> "$ROOT_DIR/.env.template"
  fi
  if [ -n "$prod_url" ]; then
    echo "PP_ENV_PROD=${prod_url}" >> "$ROOT_DIR/.env.template"
  else
    echo "PP_ENV_PROD=" >> "$ROOT_DIR/.env.template"
  fi
  echo "  ✓ Wrote .env.template"

  # Clear secret from memory
  unset _WIZARD_CLIENT_SECRET

  # Verify connection
  echo ""
  echo "  Verifying connection..."
  local pac_cmd="pac"
  if [ -f "$HOME/.dotnet/tools/pac" ]; then
    pac_cmd="$HOME/.dotnet/tools/pac"
  fi

  "$pac_cmd" auth select --name "Dev" 2>/dev/null || true

  if "$pac_cmd" org who 2>/dev/null; then
    echo "  ✓ Connected successfully!"
  else
    echo ""
    echo "  ⚠ Connection verification failed."
    echo "  Common causes:"
    echo "    • App Registration not registered as Application User in this environment"
    echo "    • Incorrect Tenant ID, Client ID, or Client Secret"
    echo "    • Environment URL is wrong"
    echo ""
    echo "  You can re-run this wizard after fixing the issue."
    echo "  Your progress through Step 5 is saved."
    if ! ask_yes_no "Continue to scaffolding anyway?" "N"; then
      exit 0
    fi
  fi

  # Check solution exists
  echo ""
  echo "  Checking for your solution..."
  local sol_name
  sol_name=$(state_get "SOLUTION_UNIQUE_NAME")
  if "$pac_cmd" solution list 2>/dev/null | grep -qi "$sol_name"; then
    echo "  ✓ Found solution: ${sol_name}"
  else
    echo "  ⚠ Solution \"${sol_name}\" not found in solution list."
    echo "    Make sure you created it in Step 5a and you're connected"
    echo "    to the right environment."
  fi

  state_set_step 6
  echo ""
  press_enter
}

# ============================================================
# Step 7: Scaffold
# ============================================================

step_scaffold() {
  print_step_header 7 "Scaffolding Your Code App"

  local app_name
  app_name=$(state_get "APP_NAME")
  local prefix
  prefix=$(state_get "PUBLISHER_PREFIX")
  local default_dir
  # Default: sibling to this foundations repo, kebab-case
  default_dir="../$(echo "$app_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

  echo "  Where should the app project live?"
  echo "  Default: ${default_dir} (sibling to this foundations repo)"
  echo ""
  local project_dir
  project_dir=$(ask_input "Project path" "$default_dir")

  # Resolve to absolute path
  if [[ ! "$project_dir" = /* ]]; then
    project_dir="$(cd "$ROOT_DIR" && cd "$(dirname "$project_dir")" 2>/dev/null && pwd)/$(basename "$project_dir")" || \
    project_dir="$ROOT_DIR/$project_dir"
  fi

  state_set "PROJECT_DIR" "$project_dir"

  if [ -d "$project_dir" ] && [ "$(ls -A "$project_dir" 2>/dev/null)" ]; then
    echo ""
    echo "  ⚠ Directory ${project_dir} already exists and is not empty."
    if ! ask_yes_no "Continue anyway? (existing files may be overwritten)" "N"; then
      echo "  Choose a different path and re-run the wizard."
      exit 0
    fi
  fi

  echo ""
  echo "  Downloading starter template..."
  mkdir -p "$project_dir"

  if npx --yes degit microsoft/PowerAppsCodeApps/templates/starter "$project_dir" 2>/dev/null; then
    echo "  ✓ Template downloaded"
  else
    echo "  ⚠ Template download failed (network issue or repo changed)."
    echo "    Creating minimal project structure instead..."
    mkdir -p "$project_dir/src" "$project_dir/public"

    # Minimal index.html
    cat > "$project_dir/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Code App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTMLEOF

    # Minimal package.json
    cat > "$project_dir/package.json" << PKGEOF
{
  "name": "$(echo "$app_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"vite --port 3000\" \"pac code run\"",
    "dev:local": "VITE_USE_MOCK=true vite --port 3000",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/ --ext .ts,.tsx --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "deploy": "npm run build && pac code push",
    "generate": "pac code generate"
  }
}
PKGEOF
    echo "  ✓ Minimal structure created"
  fi

  echo ""
  echo "  Installing dependencies..."
  cd "$project_dir"
  npm install 2>/dev/null && echo "  ✓ Base dependencies installed" || true

  echo "  Installing required packages..."
  npm install react react-dom @fluentui/react-components @tanstack/react-query \
    react-router-dom @microsoft/power-apps concurrently 2>/dev/null \
    && echo "  ✓ React + Fluent UI + TanStack Query + SDK installed" || echo "  ⚠ Some packages failed to install"

  npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react \
    vitest @testing-library/react @testing-library/jest-dom jsdom \
    eslint prettier 2>/dev/null \
    && echo "  ✓ Dev dependencies installed" || echo "  ⚠ Some dev packages failed to install"

  # Write tsconfig.json
  echo "  Writing tsconfig.json..."
  cat > "$project_dir/tsconfig.json" << 'TSEOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "verbatimModuleSyntax": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "rootDir": ".",
    "outDir": "./dist",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*", ".power/**/*"],
  "exclude": ["node_modules", "dist"]
}
TSEOF
  echo "  ✓ tsconfig.json"

  # Write vite.config.ts
  echo "  Writing vite.config.ts..."
  cat > "$project_dir/vite.config.ts" << 'VITEEOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  server: { port: 3000 },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}));
VITEEOF
  echo "  ✓ vite.config.ts (port 3000)"

  # Write .prettierrc
  echo '{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }' > "$project_dir/.prettierrc"
  echo "  ✓ .prettierrc"

  # Create folder structure
  echo "  Creating folder structure..."
  mkdir -p "$project_dir/src/components" \
           "$project_dir/src/pages" \
           "$project_dir/src/hooks" \
           "$project_dir/src/generated" \
           "$project_dir/src/utils" \
           "$project_dir/src/types" \
           "$project_dir/src/constants" \
           "$project_dir/src/mockData" \
           "$project_dir/tests/e2e" \
           "$project_dir/tests/setup" \
           "$project_dir/tests/fixtures" \
           "$project_dir/.github/instructions" \
           "$project_dir/.github/workflows" \
           "$project_dir/solution"
  echo "  ✓ Folder structure created"

  # Write starter files
  echo "  Writing starter files..."

  cat > "$project_dir/src/main.tsx" << 'MAINEOF'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={webLightTheme}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </FluentProvider>
    </QueryClientProvider>
  </StrictMode>,
);
MAINEOF
  echo "  ✓ src/main.tsx"

  cat > "$project_dir/src/App.tsx" << APPEOF
import { makeStyles, Title1, Text, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXL,
  },
});

export function App() {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Title1>${app_name}</Title1>
      <Text>Your Code App is ready. Start building!</Text>
    </div>
  );
}
APPEOF
  echo "  ✓ src/App.tsx"

  # Write .gitignore for the new project
  cat > "$project_dir/.gitignore" << 'GIEOF'
# Secrets
.env.local
.env.*.local

# Power Platform
.pac/
auth.json

# Dependencies
node_modules/

# Build
dist/

# Tests
coverage/
test-results/
playwright-report/

# IDE
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db

# Solution zips
solution/*.zip

# Wizard state (contains no secrets, but is machine-specific)
.wizard-state.json

# Temp
*.tmp
*.log
GIEOF
  echo "  ✓ .gitignore"

  # Copy instruction files
  echo "  Copying instruction files..."
  if [ -d "$ROOT_DIR/.github/instructions" ]; then
    cp "$ROOT_DIR/.github/instructions/"*.md "$project_dir/.github/instructions/" 2>/dev/null && \
      echo "  ✓ Instruction files copied" || echo "  ⚠ Some instruction files failed to copy"
  else
    echo "  ⚠ No instruction files found in foundations repo"
  fi

  # Copy helper scripts
  if [ -d "$ROOT_DIR/scripts" ]; then
    mkdir -p "$project_dir/scripts"
    cp "$ROOT_DIR/scripts/setup-auth.sh" "$project_dir/scripts/" 2>/dev/null || true
    cp "$ROOT_DIR/scripts/op-pac.sh" "$project_dir/scripts/" 2>/dev/null || true
    echo "  ✓ Helper scripts copied"
  fi

  # Copy credential files
  if [ -f "$ROOT_DIR/.env.local" ]; then
    cp "$ROOT_DIR/.env.local" "$project_dir/.env.local"
    echo "  ✓ .env.local copied"
  fi
  if [ -f "$ROOT_DIR/.env" ]; then
    cp "$ROOT_DIR/.env" "$project_dir/.env"
    echo "  ✓ .env copied"
  fi
  if [ -f "$ROOT_DIR/.env.template" ]; then
    cp "$ROOT_DIR/.env.template" "$project_dir/.env.template"
    echo "  ✓ .env.template copied"
  fi

  # Register Code App with Power Platform
  echo ""
  echo "  Registering Code App in Power Platform..."
  local pac_cmd="pac"
  if [ -f "$HOME/.dotnet/tools/pac" ]; then
    pac_cmd="$HOME/.dotnet/tools/pac"
  fi

  cd "$project_dir"
  if "$pac_cmd" code init --displayName "$app_name" --buildPath "./dist" --fileEntryPoint "index.html" 2>/dev/null; then
    echo "  ✓ power.config.json created"
  else
    echo "  ⚠ pac code init failed. You can run it manually later:"
    echo "    cd ${project_dir}"
    echo "    pac code init --displayName \"${app_name}\" --buildPath \"./dist\" --fileEntryPoint \"index.html\""
  fi

  # Data sources
  echo ""
  print_divider
  echo ""
  echo "  Add data sources now? (You can always add more later)"
  echo ""
  echo "  Common connectors:"
  echo "    • Dataverse (tables you created)"
  echo "    • Office 365 Users (people picker, org chart)"
  echo "    • SharePoint (documents, lists)"
  echo "    • SQL Server (external databases)"
  echo ""
  if ask_yes_no "Add a data source now?" "N"; then
    echo ""
    echo "  Running interactive data source picker..."
    "$pac_cmd" code add-data-source 2>/dev/null || \
      echo "  ⚠ pac code add-data-source failed. Run it manually later."

    echo ""
    echo "  Generating TypeScript SDK from data source..."
    "$pac_cmd" code generate 2>/dev/null || \
      echo "  ⚠ pac code generate failed. Run it manually later."
  else
    echo "  Skipping data sources for now."
    echo "  To add later: pac code add-data-source && pac code generate"
  fi

  # Git initialization
  echo ""
  print_divider
  echo ""
  echo "  Your project files are ready. Let's put them under version control."
  echo ""

  cd "$project_dir"

  if [ -d ".git" ]; then
    echo "  ✓ Git repo already initialized"
  else
    echo "  Initializing Git repo..."
    git init -b main >/dev/null 2>&1 && echo "  ✓ Git repo initialized (branch: main)" || echo "  ⚠ git init failed"
  fi

  echo ""
  echo "  Do you have a remote repository URL?"
  echo "  (e.g. https://github.com/your-org/my-app.git)"
  echo "  Press Enter to skip — you can add one later with:"
  echo "    git remote add origin <url>"
  echo ""

  # Detect existing origin — skip prompt if it already points to user's repo
  local existing_origin remote_url=""
  existing_origin=$(git remote get-url origin 2>/dev/null || echo "")

  if [ -n "$existing_origin" ] && ! echo "$existing_origin" | grep -qi "PAppsCAFoundations"; then
    # User came via "Use this template" — origin already points to their repo
    echo "  ✓ Remote 'origin' already set to ${existing_origin}"
    state_set "GIT_REMOTE" "$existing_origin"
    remote_url="$existing_origin"
  else
    if [ -n "$existing_origin" ] && echo "$existing_origin" | grep -qi "PAppsCAFoundations"; then
      echo "  ⚠ Current origin points to the PAppsCAFoundations template repo."
      echo "  You need to set origin to your own repository."
      git remote remove origin 2>/dev/null || true
    fi

    remote_url=$(ask_input "Remote URL (Enter to skip)" "")
    if [ -n "$remote_url" ]; then
      git remote remove origin 2>/dev/null || true
      git remote add origin "$remote_url"
      echo "  ✓ Remote 'origin' set to ${remote_url}"
      state_set "GIT_REMOTE" "$remote_url"
    fi
  fi

  echo ""
  echo "  Making initial commit..."
  git add -A >/dev/null 2>&1
  git commit -m "Initial scaffold from PAppsCAFoundations wizard" --quiet 2>/dev/null && \
    echo "  ✓ Initial commit created" || echo "  ⚠ Commit failed (git user.name/user.email may not be configured)"

  if [ -n "$remote_url" ]; then
    if ask_yes_no "Push to remote now?" "Y"; then
      if git push -u origin main 2>/dev/null; then
        echo "  ✓ Pushed to origin/main"
      else
        echo "  ⚠ Push failed. You can push later: git push -u origin main"
      fi
    fi
  fi

  cd "$ROOT_DIR"
  state_set_step 7
  echo ""
  press_enter
}

# ============================================================
# Step 8: Build, Verify, Deploy
# ============================================================

step_verify_and_deploy() {
  print_step_header 8 "Build, Verify & Deploy"

  local project_dir
  project_dir=$(state_get "PROJECT_DIR")
  local app_name
  app_name=$(state_get "APP_NAME")
  local prefix
  prefix=$(state_get "PUBLISHER_PREFIX")
  local sol_name
  sol_name=$(state_get "SOLUTION_UNIQUE_NAME")
  local dev_url
  dev_url=$(state_get "PP_ENV_DEV")
  local test_url
  test_url=$(state_get "PP_ENV_TEST" "")
  local prod_url
  prod_url=$(state_get "PP_ENV_PROD" "")
  local auth_mode
  auth_mode=$(state_get "AUTH_MODE")

  cd "$project_dir"

  echo "  Building project..."
  if npm run build 2>/dev/null; then
    if [ -f "dist/index.html" ]; then
      echo "  ✓ Build succeeded — dist/index.html exists"
    else
      echo "  ⚠ Build ran but dist/index.html not found"
    fi
  else
    echo "  ⚠ Build failed. This is normal if the template needs adjustments."
    echo "    You can fix build errors and run 'npm run build' later."
  fi

  # Final auth check
  echo ""
  echo "  Final auth check..."
  local pac_cmd="pac"
  if [ -f "$HOME/.dotnet/tools/pac" ]; then
    pac_cmd="$HOME/.dotnet/tools/pac"
  fi

  "$pac_cmd" auth select --name "Dev" 2>/dev/null || true
  "$pac_cmd" org who 2>/dev/null && echo "  ✓ Auth verified" || echo "  ⚠ Auth check failed"

  # Offer to deploy
  echo ""
  if [ -f "dist/index.html" ]; then
    if ask_yes_no "Push to Power Platform now?" "Y"; then
      echo ""
      echo "  Deploying..."
      if "$pac_cmd" code push 2>/dev/null; then
        echo "  ✓ Deployed! Your app is live."
      else
        echo "  ⚠ Deploy failed. Try manually: cd ${project_dir} && pac code push"
      fi
    else
      echo "  Skipped. Deploy later: cd ${project_dir} && pac code push"
    fi
  fi

  # ── Summary ──
  cd "$ROOT_DIR"

  echo ""
  echo "════════════════════════════════════════════════════"
  echo "  Setup Complete!"
  echo "════════════════════════════════════════════════════"
  echo ""
  echo "  Project:        ${app_name}"
  echo "  Location:       ${project_dir}"
  echo "  Prefix:         ${prefix}"
  echo "  Solution:       ${sol_name}"
  echo "  Dev env:        ${dev_url}"
  if [ -n "$test_url" ]; then
    echo "  Test env:       ${test_url}"
  fi
  if [ -n "$prod_url" ]; then
    echo "  Prod env:       ${prod_url}"
  fi
  echo "  Auth:           ${auth_mode}"
  echo ""
  echo "  Saved to:       .wizard-state.json"
  echo ""
  echo "  What's next:"
  echo "    cd ${project_dir}"
  echo "    npm run dev:local    <- prototype with mock data (no auth needed)"
  echo "    npm run dev          <- connected mode (Vite + pac code run)"
  echo "    pac code push        <- deploy changes to Power Platform"
  echo ""
  echo "  To add a data source later:"
  echo "    pac code add-data-source"
  echo "    pac code generate"
  echo ""
  echo "  To set up CI/CD:"
  echo "    See .github/instructions/04-deployment.instructions.md"
  echo "    Add GitHub secrets: PP_APP_ID, PP_CLIENT_SECRET, PP_TENANT_ID"
  echo "    Add env variable per environment: POWER_PLATFORM_URL"
  echo ""
  echo "════════════════════════════════════════════════════"

  state_set_step 8
}

# ============================================================
# Main — orchestrate all steps with resume support
# ============================================================

main() {
  # Handle --reset flag
  if [ "${1:-}" = "--reset" ]; then
    rm -f "$STATE_FILE"
    echo "  Wizard state reset. Starting fresh."
    echo ""
  fi

  print_banner

  local completed_step
  completed_step=$(state_get_step)

  if [ "$completed_step" -gt 0 ] && [ "$completed_step" -lt "$TOTAL_STEPS" ]; then
    local app_name
    app_name=$(state_get "APP_NAME" "your project")
    echo "  Welcome back! You left off after Step ${completed_step}."
    echo "  Project: ${app_name}"
    echo ""
    if ask_yes_no "Resume from Step $((completed_step + 1))?" "Y"; then
      echo ""
    else
      if ask_yes_no "Start over from the beginning?" "N"; then
        rm -f "$STATE_FILE"
        completed_step=0
      else
        echo "  OK, exiting. Re-run anytime: bash scripts/setup-wizard.sh"
        exit 0
      fi
    fi
  else
    press_enter
  fi

  # Run each step, skipping already-completed ones
  if [ "$completed_step" -lt 1 ]; then step_prerequisites; fi
  if [ "$completed_step" -lt 2 ]; then step_project_identity; fi
  if [ "$completed_step" -lt 3 ]; then step_create_publisher; fi
  if [ "$completed_step" -lt 4 ]; then step_environments; fi
  if [ "$completed_step" -lt 5 ]; then step_solution_and_app_reg; fi
  if [ "$completed_step" -lt 6 ]; then step_auth_setup; fi
  if [ "$completed_step" -lt 7 ]; then step_scaffold; fi
  if [ "$completed_step" -lt 8 ]; then step_verify_and_deploy; fi
}

main "$@"
