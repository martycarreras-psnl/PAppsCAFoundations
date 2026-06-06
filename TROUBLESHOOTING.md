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

### Project lives inside OneDrive / Dropbox / iCloud — DLP alert on `.env.local`

**Symptom:** OneDrive (or another cloud-sync provider) raises a "secret detected" or DLP alert pointing at your project, even though `.env.local` is gitignored and the wizard encrypted the value (the line starts with `PP_CLIENT_SECRET=ENC:...`).

**Cause:** The project is inside a cloud-sync folder (e.g. `~/Library/CloudStorage/OneDrive-…/…`). `.gitignore` does **not** apply to cloud sync — every file in the folder is uploaded. Cloud-sync content scanners pattern-match the line `PP_CLIENT_SECRET=` regardless of whether the value is AES-256-GCM-encrypted, so they fire a DLP alert on file existence.

**Why this is not an actual key leak:** the value is encrypted with a machine-bound AES-256-GCM key — it cannot be decrypted on any other machine, by the cloud provider, or by anyone with the file. The alert is a true positive on the *file pattern*, not on a recoverable secret.

**Fix (recommended order):**
1. **Move the project out of the cloud-sync folder** (e.g. `~/Code/MyApp`). This is the cleanest fix.
2. Or **use 1Password storage** (Step 4 in the wizard): the secret never lands on disk.
3. Or exclude the project folder from cloud-sync at the OS level (OneDrive Settings → Sync and backup → Manage backup; or rename the file to `.env.local.nosync` on macOS).
4. As a precaution, **rotate the App Registration client secret** in Entra ID since the encrypted blob briefly existed in the cloud-sync provider's content store.

The wizard now detects this scenario at startup and warns you before continuing.

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

### Deployed app shows a 404 on first load (or the moment you navigate)

**Symptom:** `pac code push` reports success, but opening `https://apps.powerapps.com/play/e/<env>/app/<app>/...` returns a 404 page, or the app loads fine until you navigate to a non-index route and then 404s.

**Cause:** `src/main.tsx` (or `src/router.tsx`) is using `react-router-dom`'s `BrowserRouter` / `createBrowserRouter`. The Power Apps host owns the URL path, so any non-root path the router pushes into history does not resolve to a static asset and `index.html` is served from the wrong base. Only the fragment (`#/...`) is reliably owned by the iframe.

**Fix:** Switch to `HashRouter`:
```diff
- import { BrowserRouter } from 'react-router-dom';
+ import { HashRouter } from 'react-router-dom';
…
-        <BrowserRouter>
+        <HashRouter>
           <App />
-        </BrowserRouter>
+        </HashRouter>
```

Rebuild and `pac code push`. Routes now resolve as `…/play/e/<env>/app/<app>/#/<route>` and the deployed app stops 404-ing. The current scaffold uses `HashRouter` automatically, and `npm run build` fails loudly if `main.tsx` / `router.tsx` is still importing `BrowserRouter` / `createBrowserRouter` (see `packages/scripts/patch-datasources-info.mjs` and issue #47).

### `npm run build` fails with "Code App routing guard FAILED" — but my code already uses `HashRouter`

**Symptom:** The `prebuild` hook prints `✗ Code App routing guard FAILED … main.tsx imports BrowserRouter` and the build aborts, but `src/main.tsx` clearly uses `HashRouter` — the only `BrowserRouter` text is inside an explanatory comment. This can happen on a **brand-new** repo straight out of the wizard.

**Cause:** A stale `@pacaf/scripts` (pre-`3.0.2`) whose guard matched the bare word `BrowserRouter` *before* stripping comments. Your app code is not the problem. A new repo can still get the stale package because two machine-global caches survive folder creation:

1. **`npx` wizard cache** (`~/.npm/_npx/<hash>/`) — if it predates `@pacaf/wizard@3.3.5`, the wizard writes a caret range (`"@pacaf/scripts": "^3.0.0"`) into your new `package.json` instead of pinning the `latest` dist-tag.
2. **pnpm warm shared store** — `pnpm install` resolves that caret against cached metadata and lands on a stale `@pacaf/scripts@3.0.1` instead of the newest release.

The two stack: old npx cache writes `^3.0.0` → warm store resolves it to the buggy `3.0.1`.

**Fix (existing repo)** — exact/`latest` pins force past the warm store:
```bash
pnpm add -D @pacaf/scripts@latest @pacaf/agent-instructions@latest
npm run build   # guard now exits 0
```

**Prevent it before scaffolding a new app** — clear both caches first:
```bash
npx clear-npx-cache 2>/dev/null || rm -rf ~/.npm/_npx   # force npx to refetch the wizard
pnpm store prune                                         # drop stale store entries
```

The factory fix is already shipped (`@pacaf/scripts@3.0.5` strips comments before matching; `@pacaf/wizard@3.3.5` / `@pacaf/wizard-ux@3.3.3` pin first-party deps to `latest`), so a scaffold from a refreshed npx cache no longer hits this.

### My app renders but everything is unstyled / no Fluent UI styling / no Tailwind classes work

**Symptom:** `npm run dev` succeeds, the browser opens at `http://localhost:3000`, JS runs and React mounts, the DOM is correct — but the page looks like a 1995 browser: no Fluent UI chrome, no fonts, no colors, no Tailwind utility classes. No build error, no runtime error, no warning in the dev server log.

**Cause:** Two independent scaffold defects, both silent (issue #48). Tailwind v4 split the PostCSS plugin in two — without **both** of the following, `@import "tailwindcss"` in `src/index.css` is treated as a literal CSS import and resolves to nothing:

1. `src/main.tsx` does not import `./index.css` — Vite has no reason to include the stylesheet in the bundle, so it doesn't.
2. `vite.config.ts` does not register the `@tailwindcss/vite` plugin — without it, the `@import "tailwindcss"` directive is dropped silently.

A scaffold from a stale wizard can ship missing either or both pieces. Fixing only one of them produces the same broken result.

**Fix — `src/main.tsx`:**
```diff
  import { HashRouter } from 'react-router-dom';
  import { App } from './App';
+ import './index.css';
```

**Fix — `vite.config.ts`:**
```diff
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
+ import tailwindcss from '@tailwindcss/vite';
  import path from 'path';

  export default defineConfig(({ command }) => ({
    base: command === 'build' ? './' : '/',
-   plugins: [react()],
+   plugins: [react(), tailwindcss()],
```

If `src/index.css` is missing, also create it with the Tailwind v4 entrypoint:
```css
@import "tailwindcss";
```

Make sure `package.json` lists both `tailwindcss` and `@tailwindcss/vite` in `devDependencies` (the current wizard scaffold adds both automatically). After the edits, Vite hot-reloads and the app paints with full Fluent UI + Tailwind styling.

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

### "Could not finalize the auth profile" at the Environments step

**Cause:** Your local `pac` auth store contains **duplicate or dual-active profiles** for the same user/environment — usually leftover `pp-<slug>-*` profiles from running the wizard in other project folders. The wizard renames its discovery profile with `pac auth name`, and that command crashes on a corrupted store. The `pac-log.txt` signature is:

```
FTL | bolt.Session :: Sequence contains more than one matching element
EXCEPTION: System.InvalidOperationException: Sequence contains more than one matching element
   at bolt.authentication.profiles.AuthProfiles.Update(...)
```

This is an upstream `pac` CLI bug (`AuthProfiles.Update` uses `SingleOrDefault` against a store that can hold duplicates).

**Fix:** The wizard now runs a pre-flight hygiene check that removes stale same-user duplicates before renaming, so most users never hit this. If it still fails, clear the local profiles and re-run:
```bash
pac auth clear        # removes ALL local profiles — you'll sign in again
```
Then click **Save & run** again to recreate a single clean profile.

Surgical alternative (delete only the stale duplicate; the dual-active flag may persist):
```bash
pac auth list                 # identify the stale duplicate's index
pac auth delete --index <n>
```

Note: `pac auth select --index <n>` does **not** repair the dual-active flag — the store must be cleared or the duplicates deleted.

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

**Fix:** After pushing code changes, always re-export the solution. Agent-driven export is owned by the Dataverse-skills plugin's `dv-solution` skill; to export directly, use the native PAC CLI:
```bash
pac solution export --name <SolutionUniqueName> --path ./solution/solution-unmanaged.zip --managed false --overwrite
```
