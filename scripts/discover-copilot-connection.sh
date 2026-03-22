#!/bin/bash
# discover-copilot-connection.sh
# Resolve the Microsoft Copilot Studio connectionId in the current environment.
#
# Output contract:
#   - Human-facing messages go to stderr
#   - Final machine-readable line goes to stdout:
#       COPILOT_CONNECTION_ID=<connectionId>

set -euo pipefail

COPILOT_API_ID="shared_microsoftcopilotstudio"
MAX_RETRIES=5

info() { echo -e "$*" >&2; }
hr() { info "──────────────────────────────────────────────────────────"; }

get_matching_connections() {
  pac connection list 2>/dev/null | tail -n +2 | grep "$COPILOT_API_ID" | grep -v '^$' || true
}

if ! command -v pac >/dev/null 2>&1; then
  info "❌ PAC CLI not found in PATH."
  exit 1
fi

hr
info "🔍 Resolving Microsoft Copilot Studio connection..."
hr

connection_id=""
attempt=0

while [[ $attempt -lt $MAX_RETRIES ]]; do
  attempt=$(( attempt + 1 ))
  info ""
  info "   Running: pac connection list  (attempt $attempt / $MAX_RETRIES)"

  matching="$(get_matching_connections)"
  count=$(echo "$matching" | grep -c '.' 2>/dev/null || echo 0)

  if [[ $count -eq 0 ]]; then
    info ""
    info "⚠️  No Microsoft Copilot Studio connection was found in your environment."
    info ""
    info "🙋 ACTION REQUIRED — Please create one manually:"
    info "   1. Open https://make.powerapps.com"
    info "   2. Go to Data → Connections"
    info "   3. Click 'New connection'"
    info "   4. Search for 'Microsoft Copilot Studio'"
    info "   5. Authenticate and save the connection"
    info ""
    read -r -p "   ➜ Press [Enter] when done, or type 'q' to quit: " user_input </dev/tty
    if [[ "${user_input,,}" == "q" ]]; then
      info "❌ Aborted by user."
      exit 1
    fi
    continue
  fi

  if [[ $count -eq 1 ]]; then
    connection_id=$(echo "$matching" | awk '{print $1}')
    info "✅ Single Copilot Studio connection found: $connection_id"
    break
  fi

  info ""
  info "Found multiple Copilot Studio connections:"
  ids=()
  i=1
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    conn_id=$(echo "$line" | awk '{print $1}')
    conn_name=$(echo "$line" | awk '{$1=""; $NF=""; print}' | xargs)
    ids+=("$conn_id")
    info "   [$i] Id   : $conn_id"
    info "       Name : $conn_name"
    info ""
    i=$(( i + 1 ))
  done <<< "$matching"

  read -r -p "   ➜ Reply with a number or paste the full Id: " user_choice </dev/tty
  if [[ "$user_choice" =~ ^[0-9]+$ ]]; then
    idx=$(( user_choice - 1 ))
    if [[ $idx -lt 0 || $idx -ge ${#ids[@]} ]]; then
      info "❌ Invalid number."
      exit 1
    fi
    connection_id="${ids[$idx]}"
  else
    for id in "${ids[@]}"; do
      if [[ "$id" == "$user_choice" ]]; then
        connection_id="$id"
        break
      fi
    done
  fi

  if [[ -n "$connection_id" ]]; then
    info "✅ Selected: $connection_id"
    break
  fi

  info "❌ The value you entered was not in the list."
  exit 1
done

if [[ -z "$connection_id" ]]; then
  info "❌ Maximum retries reached without resolving a connection."
  exit 1
fi

hr
info "✅ Connection resolved. Returning connectionId to the caller."
hr

echo "COPILOT_CONNECTION_ID=$connection_id"
