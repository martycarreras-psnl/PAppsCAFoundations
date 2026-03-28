#!/bin/bash

set -euo pipefail

PLAN_PATH="${1:-dataverse/register-datasources.plan.json}"

if [ ! -f "$PLAN_PATH" ]; then
  echo "ERROR: registration plan not found at $PLAN_PATH" >&2
  echo "Run: node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json" >&2
  exit 1
fi

if [ -n "${PAC_BIN:-}" ]; then
  :
elif [ -x "${HOME}/.dotnet/tools/pac" ]; then
  PAC_BIN="${HOME}/.dotnet/tools/pac"
elif command -v pac >/dev/null 2>&1; then
  PAC_BIN="$(command -v pac)"
else
  echo "ERROR: pac CLI not found. Install it or set PAC_BIN." >&2
  exit 1
fi

if [ ! -x "$PAC_BIN" ]; then
  echo "ERROR: PAC_BIN does not point to an executable: $PAC_BIN" >&2
  exit 1
fi

if [ ! -f "power.config.json" ]; then
  echo "ERROR: power.config.json not found in $(pwd)" >&2
  echo "Run this script from the Code App project root after pac code init." >&2
  exit 1
fi

DATAVERSE_TABLES=()
while IFS= read -r table; do
  [ -n "$table" ] && DATAVERSE_TABLES+=("$table")
done < <(
  node -e 'const fs=require("node:fs"); const plan=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); for (const table of plan.dataverseTables || []) console.log(table);' "$PLAN_PATH"
)

if [ "${#DATAVERSE_TABLES[@]}" -eq 0 ]; then
  echo "ERROR: no Dataverse tables were found in $PLAN_PATH" >&2
  exit 1
fi

echo "Using PAC CLI: $PAC_BIN"
echo "Registration plan: $PLAN_PATH"

for table in "${DATAVERSE_TABLES[@]}"; do
  echo ">>> Registering Dataverse table: $table"
  "$PAC_BIN" code add-data-source -a dataverse -t "$table"
done

echo "Dataverse data sources registered successfully. Generated connector output was refreshed during registration."