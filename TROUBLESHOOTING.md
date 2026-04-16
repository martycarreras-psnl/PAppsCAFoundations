# Troubleshooting

Common issues and their solutions, organized by symptom.

---

## PAC CLI

### `pac code push` fails with "TypeError: Cannot read properties of undefined"

**Cause:** PAC CLI v2.3.2 has a known bug.

**Fix:** Downgrade to v2.2.1:
```bash
dotnet tool uninstall -g Microsoft.PowerApps.CLI.Tool
dotnet tool install -g Microsoft.PowerApps.CLI.Tool --version 2.2.1
```

### `pac code push` fails with auth/permission error

**Cause:** All `pac code` subcommands (`push`, `add-data-source`, `run`) require a **user** auth profile. The BAP checkAccess API rejects service principal (SPN) tokens.

**Fix:** Create a user profile once:
```bash
~/.dotnet/tools/pac auth create --name my-dev-profile --environment https://your-org-dev.crm.dynamics.com --deviceCode
```
Follow the device-code prompt in your browser. After this one-time setup, `pac code push` works silently — the cached refresh token auto-renews (~90 days).

SPN auth still works for `pac solution export/import`, `pac org who`, etc.

### `pac org who` shows the wrong environment

**Cause:** Multiple PAC auth profiles exist and the wrong one is selected.

**Fix:**
```bash
~/.dotnet/tools/pac auth list          # See all profiles
~/.dotnet/tools/pac auth select --name <correct-profile>
~/.dotnet/tools/pac org who            # Verify
```

### `pac` runs the VS Code extension version instead of the dotnet tool

**Cause:** macOS VS Code extension installs its own PAC at `~/Library/Application Support/Code/User/globalStorage/...`.

**Fix:** Always use the explicit path: `~/.dotnet/tools/pac`. The wizard and helper scripts do this automatically.

---

## Authentication & Secrets

### App Registration client secret expired — CI/CD silently fails

**Cause:** Azure App Registration secrets expire (default 12 months). There is no automatic warning.

**Fix:**
1. Go to Azure Portal → Entra ID → App registrations → your app → Certificates & secrets
2. Create a new client secret
3. Update the secret in your credential store:
   - **1Password:** Update the vault item; all developers get it immediately
   - **GitHub Actions:** Update `PP_CLIENT_SECRET` in repository secrets
   - **.env.local:** Replace the old value
4. **Set a calendar reminder** 30 days before the next expiry

**Prevention:** When creating the secret, note the expiry date and set a recurring reminder.

### 1Password: all resolved values show as 24-character strings

**Symptom:** Running `op run --env-file .env -- pac org who` and every value (including URLs) appears as `<concealed by 1Password>` (exactly 24 characters).

**Cause:** 1Password CLI's secret-concealment feature replaces ALL resolved values in subprocess output — including non-secret URLs and UUIDs.

**Fix:** Use `op read` per field instead of `op run --env-file`:
```bash
export PP_ENV_DEV=$(op read "op://YourVault/YourItem/PP_ENV_DEV")
export PP_APP_ID=$(op read "op://YourVault/YourItem/PP_APP_ID")
# etc.
```
The `op read` command returns raw values without concealment.

**Diagnosis:** If every resolved value has length 24, you're hitting this issue.

### `pac auth create` fails with unhelpful error

**Common causes:**
1. The App Registration is not registered as an Application User in the target environment (see `00-before-you-start.instructions.md` Step 6)
2. The environment URL has a trailing slash or typo
3. The tenant ID doesn't match the environment's tenant

**Fix:** Verify each value independently:
```bash
# Check the environment URL resolves
curl -s -o /dev/null -w "%{http_code}" https://your-org-dev.crm.dynamics.com/api/data/v9.2/

# Check the App Registration exists in the right tenant
az ad app show --id <your-app-id>
```

---

## Connections & Connectors

### "Connection not found" when running `pac code add-data-source`

**Cause:** The connection must exist in the environment before the connector reference can be created.

**Fix:**
1. Go to [make.powerapps.com](https://make.powerapps.com) → select the target environment
2. Navigate to Connections → New connection
3. Create the required connection (e.g., Dataverse, Office 365 Users)
4. Re-run the `pac code add-data-source` command

### Connector registration fails for some tables but not others

**Cause:** Transient PAC CLI errors or table names that don't match the Dataverse schema.

**Fix:** The registration script now collects failures and continues. Check the error summary at the end, fix the issues, and re-run for the failed tables only.

---

## Scaffold & Build

### `npm run lint` fails immediately on a fresh scaffold

**Cause (fixed):** Earlier versions didn't generate an ESLint config. Current scaffold generates `eslint.config.mjs` with ESLint v9 flat config.

**Fix:** If you scaffolded with an older version, sync foundations:
```bash
npm run sync:foundations
```

### `npm run test:e2e` fails — no Playwright config found

**Cause (fixed):** Earlier versions didn't generate `playwright.config.ts`. Current scaffold includes it.

**Fix:** Sync foundations, or manually create `playwright.config.ts` from the template in `05-testing.instructions.md`.

After syncing, install Playwright browsers:
```bash
npx playwright install chromium
```

### Build produces blank screen in Power Apps

**Cause:** Vite uses absolute asset paths by default, which 404 in the Power Apps iframe.

**Fix:** Ensure `vite.config.ts` uses relative base for builds:
```typescript
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  // ...
}));
```
Current scaffold includes this automatically.

---

## Wizard

### Wizard hangs or fails mid-step

**Fix:** The wizard saves progress automatically. Re-run it and it resumes:
```bash
cd wizard && node index.mjs
```

To start a specific step:
```bash
node wizard/index.mjs --from 7
```

To reset completely:
```bash
node wizard/index.mjs --reset
```

### `power.config.json` points to wrong environment after re-running wizard

**Cause:** A stale `power.config.json` from a previous run doesn't match the current PAC auth profile.

**Fix:** The wizard now detects this and quarantines the stale file before re-running `pac code init`. If you need to fix it manually:
```bash
rm power.config.json
~/.dotnet/tools/pac auth select --name <correct-profile>
~/.dotnet/tools/pac code init --displayName "Your App" --buildPath "./dist" --fileEntryPoint "index.html"
```

---

## Solution & Deployment

### How to recover from a failed `pac code push`

`pac code push` is idempotent — re-running it overwrites the previous upload. Just fix the issue and push again.

### How to rollback a bad solution import

1. In the Power Apps Maker Portal, go to Solutions
2. Find the solution → click the three dots → Delete
3. Re-import the previous version from your `solution/` directory or Git history

**Note:** Deleting a managed solution in a downstream environment removes all its components. In dev (unmanaged), deletion only removes the solution wrapper — the components remain.

### Solution export shows no changes

**Cause:** `pac code push` was done but the solution wasn't re-exported.

**Fix:** After pushing code changes, always re-export:
```bash
npm run solution:export
```
