---
applyTo: "**"
---

# Power Apps Code Apps — Environment & Authentication Setup

This instruction file covers the one-time team setup that must happen before anyone writes a line of code. It establishes the Azure App Registration, Power Platform environment connections, and authentication configuration that enables every developer to deploy without browser popups — locally and in CI/CD.

This is the first file a team lead reads. Developers read it to understand how auth works, but the App Registration itself is typically set up once by a team lead or platform admin.

## Why This Matters

Without this setup, every `pac code push`, `pac solution export`, and `pac solution import` triggers an interactive browser window asking the developer to sign in. This breaks CI/CD entirely (no browser in a pipeline) and creates friction for developers who deploy multiple times a day. The fix is a Service Principal (App Registration) that authenticates non-interactively using a client ID and secret.

## Step 1: Create the Azure App Registration

This is done once per team (or per project, depending on your org's security posture). It creates a Service Principal that both developers and CI/CD pipelines use to authenticate with Power Platform.

### In the Azure Portal

1. **Navigate to App Registrations:**
   Azure Portal → Microsoft Entra ID → App registrations → New registration

2. **Register the application:**
   - Name: `PowerApps-CodeApps-<YourTeamOrProject>` (e.g., `PowerApps-CodeApps-ProjectTracker`)
   - Supported account types: "Accounts in this organizational directory only" (single tenant)
   - Redirect URI: Leave blank (not needed for client credentials flow)
   - Click "Register"

3. **Record these values immediately** (you'll need them in every subsequent step):
   - **Application (client) ID** — shown on the Overview page
   - **Directory (tenant) ID** — shown on the Overview page

4. **Create a client secret:**
   - Go to "Certificates & secrets" → "Client secrets" → "New client secret"
   - Description: `Power Platform CLI auth`
   - Expiration: 12 months (set a calendar reminder to rotate before expiry)
   - Click "Add"
   - **Copy the secret Value immediately** — it is only shown once. If you lose it, you must create a new one.

5. **Grant API permissions:**
   - Go to "API permissions" → "Add a permission"
   - Select "APIs my organization uses" → Search for "Dataverse" (or "Common Data Service")
   - Select "Delegated permissions" → Check `user_impersonation`
   - Click "Add permissions"
   - Click "Grant admin consent for [Your Org]" (requires Global Admin or Privileged Role Admin)

### In the Power Platform Admin Center

6. **Register as an Application User in each environment:**

   For every environment your team uses (dev, test, production):

   - Go to [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com)
   - Select the environment → Settings → Users + permissions → Application users
   - Click "New app user" → "Add an app"
   - Search for the App Registration name you created above, select it
   - Select the appropriate Business Unit
   - Assign security roles:
     - **Development environment:** System Administrator (full access for dev work)
     - **Test environment:** System Administrator or a custom deployment role
     - **Production environment:** A custom role with minimum required privileges (principle of least privilege)
   - Click "Create"

   Repeat for each environment. The App Registration now has permission to authenticate non-interactively and perform operations in each environment.

## Step 2: Store Credentials for Developer Use

Developers need the App Registration credentials to authenticate locally without browser popups. Choose the approach that fits your team's security posture. We recommend Option A (1Password) for most teams — it keeps secrets out of files entirely, rotation is instant, and onboarding is a single command.

### Option A: 1Password (Recommended)

1Password CLI (`op`) injects secrets at runtime — they never touch disk, never sit in `.env.local`, and never risk being committed to Git. When a secret is rotated in 1Password, every developer gets the new value immediately with zero manual steps.

**Prerequisites:**
- 1Password desktop app installed and signed in
- 1Password CLI (`op`) installed: https://developer.1password.com/docs/cli/get-started
- CLI integration enabled: 1Password desktop → Settings → Developer → "Integrate with 1Password CLI"

**Step 2a: Team lead stores credentials in 1Password**

After creating the App Registration (Step 1), store the credentials in a 1Password vault shared with your team:

1. Open 1Password → Your shared team vault (e.g., "Engineering" or "Power Platform")
2. Create a new item:
   - Type: **API Credential** (or **Login**)
   - Title: `PowerApps CodeApps - <ProjectName>` (e.g., `PowerApps CodeApps - ProjectTracker`)
   - Add these fields:
     - `tenant-id` → Your Directory (tenant) ID
     - `app-id` → Your Application (client) ID
     - `client-secret` → Your client secret value
     - `env-dev` → `https://your-org-dev.crm.dynamics.com`
     - `env-test` → `https://your-org-test.crm.dynamics.com`
     - `env-prod` → `https://your-org-prod.crm.dynamics.com`
3. Share the vault with the development team

**Step 2b: Create a `.env` file with 1Password secret references**

Commit this file to the repo. It contains no actual secrets — only `op://` references that 1Password resolves at runtime:

```bash
# .env — Safe to commit to Git. Contains 1Password secret references, not actual values.
# 1Password CLI resolves these at runtime via `op run`.

# Power Platform Authentication (Service Principal)
PP_TENANT_ID=op://Engineering/PowerApps CodeApps - ProjectTracker/tenant-id
PP_APP_ID=op://Engineering/PowerApps CodeApps - ProjectTracker/app-id
PP_CLIENT_SECRET=op://Engineering/PowerApps CodeApps - ProjectTracker/client-secret

# Environment URLs
PP_ENV_DEV=op://Engineering/PowerApps CodeApps - ProjectTracker/env-dev
PP_ENV_TEST=op://Engineering/PowerApps CodeApps - ProjectTracker/env-test
PP_ENV_PROD=op://Engineering/PowerApps CodeApps - ProjectTracker/env-prod
```

The `op://` URI format is: `op://<vault-name>/<item-name>/<field-name>`. Adjust the vault and item names to match what you created in step 2a.

**Step 2c: How developers use it**

Any command wrapped with `op run --env-file=.env --` will have its `op://` references resolved to real values at runtime, injected as environment variables for that single command. The secrets exist only in memory for the duration of the command — they are never written to disk.

```bash
# Run any command with secrets injected — secrets never touch disk
op run --env-file=.env -- pac org who

# Deploy with secrets injected
op run --env-file=.env -- pac code push

# Export a solution with secrets injected
op run --env-file=.env -- pac solution export --path ./solution.zip --name YourSolution
```

**Step 2d: Convenience wrapper script**

To avoid typing `op run --env-file=.env --` every time, create a wrapper:

```bash
#!/bin/bash
# scripts/op-pac.sh — Wrapper that runs pac commands with 1Password-injected credentials
# Usage: ./scripts/op-pac.sh auth create --name "Dev" --environment $PP_ENV_DEV ...
#        ./scripts/op-pac.sh code push
#        ./scripts/op-pac.sh solution export ...

set -euo pipefail
op run --env-file=.env -- pac "$@"
```

Add npm scripts that use it:

```json
{
  "scripts": {
    "pac": "bash scripts/op-pac.sh",
    "deploy": "npm run build && bash scripts/op-pac.sh code push",
    "solution:export": "bash scripts/op-pac.sh solution export --path ./solution/solution.zip --name YourSolutionName",
    "solution:import": "bash scripts/op-pac.sh solution import --path ./solution/solution-managed.zip"
  }
}
```

Now developers can run:

```bash
npm run deploy                    # Build + deploy, secrets injected automatically
npm run pac -- org who            # Any pac command with secrets
npm run pac -- auth list          # Check auth profiles
npm run solution:export           # Export solution with secrets
```

**Why `op run` is better than exporting env vars:**

`op run` injects secrets for a single command and then they're gone. They don't linger in your shell session, they don't appear in `env` output, they can't leak into shell history, and they can't be accidentally captured by a misbehaving tool. If you use `export PP_CLIENT_SECRET=$(op read ...)`, the secret lives in your shell environment until you close the terminal — and any process spawned from that terminal inherits it.

### Option B: Shared `.env.local` Template (Simpler, No 1Password Required)

If your team doesn't use 1Password, use a plain `.env.local` file. This is less secure (secrets sit on disk) but requires no additional tooling.

Create a `.env.template` file in the repo (committed to Git — it contains no secrets, just variable names):

```bash
# .env.template — Copy to .env.local and fill in values
# DO NOT commit .env.local to Git

# Power Platform Authentication (Service Principal)
PP_TENANT_ID=
PP_APP_ID=
PP_CLIENT_SECRET=

# Environment URLs
PP_ENV_DEV=https://your-org-dev.crm.dynamics.com
PP_ENV_TEST=https://your-org-test.crm.dynamics.com
PP_ENV_PROD=https://your-org-prod.crm.dynamics.com
```

Each developer copies this to `.env.local` and fills in the values (distributed securely via your team's secret management — e.g., a secure Teams message from the team lead):

```bash
# Developer onboarding step:
cp .env.template .env.local
# Fill in PP_TENANT_ID, PP_APP_ID, PP_CLIENT_SECRET with values from team lead
```

**Ensure `.env.local` is in `.gitignore`** (it should already be if you followed `06-security.instructions.md`).

### Option C: Azure Key Vault (Enterprise / Azure-Native Teams)

For teams that are deeply invested in the Azure ecosystem and cannot distribute secrets outside Azure:

1. Store the App Registration credentials in Azure Key Vault
2. Grant developers "Get" permission on the Key Vault secrets
3. Developers retrieve credentials via:
   ```bash
   az login
   export PP_APP_ID=$(az keyvault secret show --vault-name YourVault --name pp-app-id --query value -o tsv)
   export PP_CLIENT_SECRET=$(az keyvault secret show --vault-name YourVault --name pp-client-secret --query value -o tsv)
   export PP_TENANT_ID=$(az keyvault secret show --vault-name YourVault --name pp-tenant-id --query value -o tsv)
   ```

Note: Unlike 1Password's `op run`, `az keyvault` exports the secrets into your shell environment where they persist. Consider wrapping this in a subshell to limit exposure:
```bash
( source <(az keyvault ...) && pac code push )
```

### Option D: Per-Developer App Registrations (Maximum Isolation)

For teams requiring individual audit trails, each developer gets their own App Registration. This provides per-person traceability but increases setup overhead. Follow the same steps above, once per developer. Each developer stores their own credentials via whichever option above their team prefers (1Password, `.env.local`, or Key Vault).

## Step 3: Configure PAC CLI Authentication (Headless)

With credentials in place, developers authenticate without a browser popup. The approach differs slightly depending on whether you're using 1Password or `.env.local`.

### If Using 1Password (Option A)

With 1Password, you have two strategies. Choose the one that fits your workflow:

**Strategy 1: Create persistent auth profiles via `op run` (recommended for most developers)**

This creates PAC CLI auth profiles that persist across terminal sessions, so you don't need `op run` for every single command after initial setup:

```bash
# One-time setup — creates auth profiles using 1Password-injected secrets
op run --env-file=.env -- pac auth create --name "Dev"  --environment $PP_ENV_DEV  --applicationId $PP_APP_ID --clientSecret $PP_CLIENT_SECRET --tenant $PP_TENANT_ID
op run --env-file=.env -- pac auth create --name "Test" --environment $PP_ENV_TEST --applicationId $PP_APP_ID --clientSecret $PP_CLIENT_SECRET --tenant $PP_TENANT_ID
op run --env-file=.env -- pac auth create --name "Prod" --environment $PP_ENV_PROD --applicationId $PP_APP_ID --clientSecret $PP_CLIENT_SECRET --tenant $PP_TENANT_ID

# After profiles are created, these work WITHOUT op run:
pac auth select --name "Dev"
pac org who
pac code push
```

Once profiles exist, daily commands (`pac code push`, `pac solution export`, etc.) work without `op run`. You only need `op run` again when profiles are recreated — for example, after secret rotation or on a new machine.

**Strategy 2: Use `op run` for every command (maximum security)**

If your security policy requires that credentials never persist in PAC CLI's profile store, wrap every command with `op run`:

```bash
# Every command is wrapped — secrets exist only for the duration of the command
op run --env-file=.env -- pac org who
op run --env-file=.env -- pac code push
op run --env-file=.env -- pac solution export --path ./solution.zip --name YourSolution
```

This is more typing but ensures secrets are truly ephemeral. Use the `npm run pac` wrapper (defined in Step 2d above) to make this painless.

### If Using `.env.local` (Option B)

```bash
# Load credentials into your shell
source .env.local

# Create auth profiles
pac auth create --name "Dev"  --environment $PP_ENV_DEV  --applicationId $PP_APP_ID --clientSecret $PP_CLIENT_SECRET --tenant $PP_TENANT_ID
pac auth create --name "Test" --environment $PP_ENV_TEST --applicationId $PP_APP_ID --clientSecret $PP_CLIENT_SECRET --tenant $PP_TENANT_ID
pac auth create --name "Prod" --environment $PP_ENV_PROD --applicationId $PP_APP_ID --clientSecret $PP_CLIENT_SECRET --tenant $PP_TENANT_ID
```

### Manage Multiple Environments

Once profiles are created, switch between environments:

```bash
# List all profiles
pac auth list

# Switch to a different environment
pac auth select --name "Test"

# Verify which environment you're connected to
pac org who
```

### Helper Script (Supports Both 1Password and .env.local)

Add a setup script that auto-detects whether the developer uses 1Password or `.env.local`:

```bash
#!/bin/bash
# scripts/setup-auth.sh — Run once after cloning the repo
# Supports both 1Password (op CLI) and .env.local credential sources

set -euo pipefail

# ---- Detect credential source ----
USE_1PASSWORD=false

if command -v op &>/dev/null && [ -f .env ] && grep -q "^PP_.*=op://" .env 2>/dev/null; then
  echo "Detected 1Password secret references in .env"
  USE_1PASSWORD=true
elif [ -f .env.local ]; then
  echo "Using credentials from .env.local"
  source .env.local
else
  echo "ERROR: No credential source found."
  echo ""
  echo "Option 1 (1Password): Ensure 'op' CLI is installed and .env contains op:// references"
  echo "Option 2 (.env.local): Copy .env.template to .env.local and fill in your credentials"
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
echo "Validating credentials..."
if [ "$USE_1PASSWORD" = true ]; then
  # Test that op can resolve the references (will prompt for biometric/password)
  op run --env-file=.env -- bash -c 'echo "Tenant: ${PP_TENANT_ID:0:8}... App: ${PP_APP_ID:0:8}..."'
else
  for var in PP_TENANT_ID PP_APP_ID PP_CLIENT_SECRET PP_ENV_DEV; do
    if [ -z "${!var:-}" ]; then
      echo "ERROR: $var is not set in .env.local"
      exit 1
    fi
  done
  echo "Tenant: ${PP_TENANT_ID:0:8}... App: ${PP_APP_ID:0:8}..."
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
echo "Setup complete! Auth profiles created successfully."
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
```

Make it executable and add to `package.json`:

```json
{
  "scripts": {
    "setup:auth": "bash scripts/setup-auth.sh",
    "pac": "bash scripts/op-pac.sh"
  }
}
```

## Step 4: Configure CI/CD with the Same Credentials

The same App Registration is used in GitHub Actions. Store the credentials as repository secrets:

| GitHub Secret | Value |
|---------------|-------|
| `PP_APP_ID` | Application (client) ID from Step 1 |
| `PP_CLIENT_SECRET` | Client secret value from Step 1 |
| `PP_TENANT_ID` | Directory (tenant) ID from Step 1 |

And environment-specific variables:

| GitHub Environment Variable | Value |
|-----------------------------|-------|
| `POWER_PLATFORM_URL` (for `development` env) | `https://your-org-dev.crm.dynamics.com` |
| `POWER_PLATFORM_URL` (for `test` env) | `https://your-org-test.crm.dynamics.com` |
| `POWER_PLATFORM_URL` (for `production` env) | `https://your-org-prod.crm.dynamics.com` |

See `04-deployment.instructions.md` for the full CI/CD pipeline configuration that uses these secrets.

## Step 5: Verify Everything Works

After completing setup, every developer should be able to run these commands without any browser popup:

```bash
# Verify auth works
pac org who
# Expected output: shows org name, environment URL, user = your App Registration name

# Verify solution access
pac solution list
# Expected output: lists solutions in the environment

# Verify Code App deployment works
npm run build
pac code push
# Expected: deploys without browser popup

# Verify solution export works
pac solution export --path ./test-export.zip --name YourSolutionName
# Expected: exports without browser popup
rm ./test-export.zip
```

If any of these prompt a browser window, the auth profile was not created correctly. Re-run `pac auth create` with the `--applicationId`, `--clientSecret`, and `--tenant` flags.

## Client Secret Rotation

Client secrets expire. Plan for rotation:

1. **Set a calendar reminder** 30 days before expiration
2. **Create a new secret** in the App Registration (Azure Portal → your app → Certificates & secrets)
3. **Update the secret in your credential store:**

   **If using 1Password:** Update the `client-secret` field in the 1Password item. That's it — every developer gets the new value automatically on their next `op run` or `npm run setup:auth`. No files to edit, no messages to send.

   **If using `.env.local`:** Notify every developer to update their `.env.local` file. This is the main downside of the `.env.local` approach — rotation requires manual coordination.

   **Always update GitHub:** Update the `PP_CLIENT_SECRET` repository secret in GitHub (Settings → Secrets).

4. **Recreate PAC auth profiles** with the new secret:
   ```bash
   pac auth clear  # Remove old profiles
   npm run setup:auth  # Recreate with new secret (auto-resolves from 1Password or .env.local)
   ```
5. **Delete the old secret** in the Azure Portal once all profiles are updated

## Team Onboarding Checklist

**If using 1Password:**

- [ ] Team lead ensures new developer has access to the shared 1Password vault
- [ ] Developer installs 1Password desktop app + CLI (`op`)
- [ ] Developer enables CLI integration (1Password → Settings → Developer → "Integrate with 1Password CLI")
- [ ] Developer clones the repo (`.env` with `op://` references is already committed)
- [ ] Developer runs `npm install`
- [ ] Developer runs `npm run setup:auth` (1Password prompts for biometric, then creates all profiles)
- [ ] Developer verifies with `pac org who` — no browser popup
- [ ] Developer runs `npm run dev` — ready to code

**If using `.env.local`:**

- [ ] Team lead provides App Registration credentials securely (encrypted message, etc.)
- [ ] Developer clones the repo
- [ ] Developer copies `.env.template` → `.env.local` and fills in credentials
- [ ] Developer runs `npm install`
- [ ] Developer runs `npm run setup:auth` (creates all profiles from `.env.local`)
- [ ] Developer verifies with `pac org who` — no browser popup
- [ ] Developer runs `npm run dev` — ready to code

## Troubleshooting

### General PAC CLI Issues

**"pac auth create succeeded but pac code push still opens a browser"**
→ You may have multiple auth profiles and the wrong one is active. Run `pac auth list` and `pac auth select --name "Dev"` to ensure the SPN profile is active.

**"The application with identifier 'xxx' was not found in the directory"**
→ The App Registration exists but isn't registered as an Application User in the target Power Platform environment. Complete Step 1, substep 6 for that environment.

**"Insufficient privileges" or "403 Forbidden"**
→ The Application User in the target environment doesn't have the right security role. Go to Power Platform Admin Center → Environment → Application users → Edit roles.

**"Client secret expired"**
→ Create a new secret in Azure Portal and follow the rotation steps above.

**"AADSTS7000215: Invalid client secret provided"**
→ The secret value was copied incorrectly or has been rotated. If using 1Password, check the item in 1Password matches. If using `.env.local`, verify the value matches the current secret in Azure Portal.

### 1Password-Specific Issues

**"op: command not found"**
→ 1Password CLI is not installed. Install it from https://developer.1password.com/docs/cli/get-started. On macOS: `brew install 1password-cli`. On Windows: `winget install AgileBits.1Password.CLI`.

**"[ERROR] ... authorization prompt dismissed" or "op run" hangs**
→ 1Password desktop app is not running, or CLI integration is not enabled. Open the 1Password desktop app, go to Settings → Developer → enable "Integrate with 1Password CLI". The desktop app must be running and unlocked for `op` to work.

**"[ERROR] ... isn't a vault in any account" or "item not found"**
→ The `op://` path in `.env` doesn't match your 1Password vault/item/field names. Check that:
  - The vault name matches exactly (case-sensitive)
  - The item title matches exactly
  - The field names (`tenant-id`, `app-id`, `client-secret`) match the labels you created
  Run `op item get "PowerApps CodeApps - ProjectTracker" --vault "Engineering"` to verify the item exists and see its fields.

**"[ERROR] ... you are not signed in"**
→ Sign in to 1Password CLI: `op signin` or `eval $(op signin)`. If you have multiple accounts, specify which: `op signin --account my-team.1password.com`.

**"op run works but environment variables are empty"**
→ The `.env` file may have incorrect syntax. Ensure each line is `KEY=op://vault/item/field` with no spaces around `=` and no quotes around the `op://` reference.

**"I use 1Password but another team member doesn't"**
→ Both approaches coexist cleanly. The `.env` file (with `op://` references) and `.env.template` / `.env.local` (with raw values) can both live in the same repo. The `setup-auth.sh` script auto-detects which one to use. Developers using 1Password just ignore `.env.template`; developers not using 1Password ignore `.env`.
