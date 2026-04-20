// wizard/steps/03-app-registration.mjs — App Registration + Application User (manual portal steps)
import { input, password, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { isValidUUID } from '../lib/validate.mjs';
import { setSecret } from '../lib/secrets.mjs';
import { hasCommand, runSafe } from '../lib/shell.mjs';

export default async function stepAppRegistration() {
  ui.stepHeader(3, TOTAL_STEPS, 'App Registration & Application User');

  const appName = stateGet('APP_NAME');
  const appRegName = `PowerApps-CodeApps-${appName.replace(/ /g, '-')}`;
  const devUrl = stateGet('PP_ENV_DEV', '');
  const testUrl = stateGet('PP_ENV_TEST', '');
  const prodUrl = stateGet('PP_ENV_PROD', '');

  // ── 1Password detection ──
  const hasOp = hasCommand('op');
  let use1Password = false;
  let vault = '';
  let itemName = '';
  let opTenantId = '';
  let opClientId = '';
  let opSecret = '';

  if (hasOp) {
    ui.line('1Password CLI (op) detected on your system.');
    ui.line('');
    use1Password = await confirm({
      message: 'Do you use 1Password to manage your credentials?',
      default: true,
    });
  }

  if (use1Password) {
    vault = stateGet('OP_VAULT', '') || '';
    itemName = stateGet('OP_ITEM', '') || '';

    vault = await input({ message: '1Password vault name', default: vault || 'Engineering' });
    itemName = await input({
      message: '1Password item name',
      default: itemName || `PowerApps CodeApps - ${appName}`,
    });

    stateSet('AUTH_MODE', '1password');
    stateSet('HAS_OP', true);
    stateSet('OP_VAULT', vault);
    stateSet('OP_ITEM', itemName);

    ui.line('');
    ui.line(`Looking up credentials in "${vault}" → "${itemName}"...`);
    ui.line('');

    opTenantId = (runSafe('op', ['read', `op://${vault}/${itemName}/tenant-id`]) || '').trim();
    opClientId = (runSafe('op', ['read', `op://${vault}/${itemName}/app-id`]) || '').trim();
    opSecret = (runSafe('op', ['read', `op://${vault}/${itemName}/client-secret`]) || '').trim();

    // Validate UUIDs from 1Password
    if (opTenantId && !isValidUUID(opTenantId)) {
      ui.warn(`Tenant ID from 1Password ("${opTenantId}") is not a valid UUID — will prompt.`);
      opTenantId = '';
    }
    if (opClientId && !isValidUUID(opClientId)) {
      ui.warn(`Client ID from 1Password ("${opClientId}") is not a valid UUID — will prompt.`);
      opClientId = '';
    }

    const found = [opTenantId && 'Tenant ID', opClientId && 'Client ID', opSecret && 'Client Secret'].filter(Boolean);
    const missing = [!opTenantId && 'tenant-id', !opClientId && 'app-id', !opSecret && 'client-secret'].filter(Boolean);

    if (found.length === 3) {
      ui.ok('All credentials found in 1Password!');
      ui.line(`  Tenant ID:     ${opTenantId}`);
      ui.line(`  Client ID:     ${opClientId}`);
      ui.line(`  Client Secret: ${'*'.repeat(12)}`);
    } else if (found.length > 0) {
      ui.ok(`Found: ${found.join(', ')}`);
      ui.warn(`Missing fields: ${missing.join(', ')}`);
      ui.line('  You can add them to the 1Password item later, or enter them now.');
    } else {
      ui.warn(`Could not read from "${vault}" → "${itemName}".`);
      ui.line('  The item may not exist yet, or field names may differ.');
      ui.line('  Expected field labels: tenant-id, app-id, client-secret');
      ui.line('');
      ui.line('  We\'ll collect the values below and offer to save them.');
    }
    ui.line('');
  }

  // ── Collect credentials (skip what 1Password already provided) ──

  const needManualInstructions = !opTenantId || !opClientId || !opSecret;

  if (needManualInstructions) {
    ui.line('── A. Create the Azure App Registration (Azure Portal) ──');
    ui.line('');
    ui.line('1. Open the Azure Portal: https://portal.azure.com');
    ui.line('2. Go to: Microsoft Entra ID → App registrations → + New');
    ui.line(`3. Name: ${appRegName}`);
    ui.line('4. Supported account types: Single tenant');
    ui.line('5. Redirect URI: Leave blank');
    ui.line('6. Click Register');
    ui.line('');
    if (!opTenantId || !opClientId) {
      ui.line('On the Overview page, copy these values:');
      ui.line('');
    }
  }

  // Tenant ID
  let tenantId = opTenantId;
  if (!tenantId && stateHas('PP_TENANT_ID')) {
    tenantId = stateGet('PP_TENANT_ID');
    ui.line(`Tenant ID (from previous run): ${tenantId}`);
    const keep = await confirm({ message: 'Keep this?', default: true });
    if (!keep) tenantId = '';
  }
  if (!tenantId) {
    tenantId = await input({
      message: 'Tenant ID (Directory ID)',
      validate: (v) => {
        if (!v.trim()) return 'Required';
        if (!isValidUUID(v.trim())) return 'Not a valid UUID. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        return true;
      },
    });
  }
  stateSet('PP_TENANT_ID', tenantId.trim());
  if (!opTenantId) ui.ok('Valid UUID');

  // Client ID
  let clientId = opClientId;
  if (!clientId && stateHas('PP_APP_ID')) {
    clientId = stateGet('PP_APP_ID');
    ui.line(`Client ID (from previous run): ${clientId}`);
    const keep = await confirm({ message: 'Keep this?', default: true });
    if (!keep) clientId = '';
  }
  if (!clientId) {
    clientId = await input({
      message: 'Client ID (Application ID)',
      validate: (v) => {
        if (!v.trim()) return 'Required';
        if (!isValidUUID(v.trim())) return 'Not a valid UUID. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        return true;
      },
    });
  }
  stateSet('PP_APP_ID', clientId.trim());
  if (!opClientId) ui.ok('Valid UUID');

  // Client Secret
  if (!opSecret && needManualInstructions) {
    ui.line('');
    ui.line('Now create a client secret:');
    ui.line('7. In the App Registration → Certificates & secrets');
    ui.line('8. + New client secret → Description: "Power Platform CLI"');
    ui.line('9. Expiration: 12 months (set a calendar reminder!)');
    ui.line('10. Click Add → COPY THE SECRET VALUE NOW (shown only once!)');
    ui.line('');
  }

  let clientSecret = opSecret;
  if (!clientSecret) {
    clientSecret = await password({
      message: 'Client Secret (hidden input)',
      validate: (v) => v ? true : 'Required',
    });
    ui.ok('Got it (not saved to disk in plain text)');
  }
  setSecret(clientSecret);

  // ── Offer to save to 1Password if values were collected manually ──
  if (use1Password && (!opTenantId || !opClientId || !opSecret)) {
    ui.line('');
    const saveTo1P = await confirm({
      message: `Save credentials to 1Password ("${vault}" → "${itemName}")?`,
      default: true,
    });
    if (saveTo1P) {
      save1PasswordItem(vault, itemName, tenantId.trim(), clientId.trim(), clientSecret, devUrl, testUrl, prodUrl,
        { hadTenant: !!opTenantId, hadClient: !!opClientId, hadSecret: !!opSecret });
    }
  } else if (use1Password && (devUrl || testUrl || prodUrl)) {
    // Credentials already came from 1Password — but the env-* fields on the
    // existing item may be stale (e.g. left over from a previous project).
    // These are non-secret environment URLs; keep them aligned with wizard
    // state so Step 04's resolveCredentialValues returns current URLs.
    syncEnv1PasswordFields(vault, itemName, devUrl, testUrl, prodUrl);
  }

  // ── API permissions instructions ──
  if (needManualInstructions) {
    ui.line('');
    ui.line('Finally, grant API permissions:');
    ui.line('11. API permissions → + Add a permission');
    ui.line('12. APIs my organization uses → search "Dataverse"');
    ui.line('13. Delegated permissions → check "user_impersonation"');
    ui.line('14. Click Add permissions');
    ui.line('15. Click "Grant admin consent for [Your Org]"');
  }

  ui.line('');
  ui.divider();
  ui.line('');

  // ── B. Application User (Power Platform Admin Center) ──
  ui.line('── B. Register as Application User (Power Platform Admin Center) ──');
  ui.line('');
  ui.line('For EACH environment, do this:');
  ui.line('1. Open the Power Platform Admin Center:');
  ui.line('   https://admin.powerplatform.microsoft.com');
  ui.line('2. Select the environment → Settings');
  ui.line('3. Users + permissions → Application users');
  ui.line('4. + New app user → Add an app');
  ui.line(`5. Search: ${appRegName}`);
  ui.line('6. Select it → assign Security Role:');
  ui.line('   • Dev/Test: System Administrator');
  ui.line('   • Production: Least-privilege custom role');
  ui.line('7. Click Create');
  ui.line('');
  ui.line('Do this for your Dev environment at minimum.');
  ui.line('(Test and Prod can be done later.)');
  ui.line('');

  const done = await confirm({ message: 'Done registering the Application User in Dev?', default: true });
  if (!done) {
    ui.line('Complete it and re-run the wizard. Your progress is saved.');
    ui.line('Re-run: node wizard/index.mjs');
    process.exit(0);
  }

  setCompletedStep(3);
}

// ─────────── 1Password Item Create / Update ───────────

function save1PasswordItem(vault, itemName, tenantId, clientId, clientSecret, devUrl, testUrl, prodUrl, had) {
  // Check if item already exists
  const existing = runSafe('op', ['item', 'get', itemName, '--vault', vault, '--format', 'json']);

  if (existing) {
    // Update existing item — only set fields that were newly collected
    ui.line('  Updating existing 1Password item...');
    const editArgs = ['item', 'edit', itemName, '--vault', vault];
    if (!had.hadTenant) editArgs.push(`tenant-id[text]=${tenantId}`);
    if (!had.hadClient) editArgs.push(`app-id[text]=${clientId}`);
    if (!had.hadSecret) editArgs.push(`client-secret[password]=${clientSecret}`);
    if (devUrl) editArgs.push(`env-dev[text]=${devUrl}`);
    if (testUrl) editArgs.push(`env-test[text]=${testUrl}`);
    if (prodUrl) editArgs.push(`env-prod[text]=${prodUrl}`);
    const ok = runSafe('op', editArgs);
    if (ok !== null) {
      ui.ok('1Password item updated');
    } else {
      ui.warn('Could not update 1Password item. Save these fields manually:');
      printFieldList(tenantId, clientId, devUrl, testUrl, prodUrl);
    }
  } else {
    // Create new item
    ui.line('  Creating new 1Password item...');
    const createArgs = [
      'item', 'create',
      '--vault', vault,
      '--category', 'Secure Note',
      '--title', itemName,
      `tenant-id[text]=${tenantId}`,
      `app-id[text]=${clientId}`,
      `client-secret[password]=${clientSecret}`,
    ];
    if (devUrl) createArgs.push(`env-dev[text]=${devUrl}`);
    if (testUrl) createArgs.push(`env-test[text]=${testUrl}`);
    if (prodUrl) createArgs.push(`env-prod[text]=${prodUrl}`);
    const ok = runSafe('op', createArgs);
    if (ok !== null) {
      ui.ok('1Password item created');
    } else {
      ui.warn('Could not create 1Password item. Create it manually with these fields:');
      printFieldList(tenantId, clientId, devUrl, testUrl, prodUrl);
    }
  }
}

function printFieldList(tenantId, clientId, devUrl, testUrl, prodUrl) {
  ui.line(`    tenant-id      (Text):     ${tenantId}`);
  ui.line(`    app-id         (Text):     ${clientId}`);
  ui.line('    client-secret  (Password): <your secret>');
  if (devUrl) ui.line(`    env-dev        (Text):     ${devUrl}`);
  if (testUrl) ui.line(`    env-test       (Text):     ${testUrl}`);
  if (prodUrl) ui.line(`    env-prod       (Text):     ${prodUrl}`);
}

// Keep env-dev/env-test/env-prod on an existing 1Password item aligned with
// wizard state. Only updates fields that differ; silent on mismatch failure
// because the user may not have edit permissions on the vault.
function syncEnv1PasswordFields(vault, itemName, devUrl, testUrl, prodUrl) {
  const norm = (v) => String(v || '').trim().replace(/\/+$/, '').toLowerCase();
  const readField = (field) => (runSafe('op', ['read', `op://${vault}/${itemName}/${field}`]) || '').trim();

  const updates = [];
  if (devUrl && norm(readField('env-dev')) !== norm(devUrl)) updates.push(`env-dev[text]=${devUrl}`);
  if (testUrl && norm(readField('env-test')) !== norm(testUrl)) updates.push(`env-test[text]=${testUrl}`);
  if (prodUrl && norm(readField('env-prod')) !== norm(prodUrl)) updates.push(`env-prod[text]=${prodUrl}`);

  if (updates.length === 0) return;

  ui.line('');
  ui.line(`Updating 1Password item env-* fields to match wizard state...`);
  const ok = runSafe('op', ['item', 'edit', itemName, '--vault', vault, ...updates]);
  if (ok !== null) {
    ui.ok(`Synced ${updates.length} environment URL field(s) in 1Password`);
  } else {
    ui.warn('Could not update 1Password env-* fields. Edit them manually so they match:');
    if (devUrl) ui.line(`    env-dev:  ${devUrl}`);
    if (testUrl) ui.line(`    env-test: ${testUrl}`);
    if (prodUrl) ui.line(`    env-prod: ${prodUrl}`);
  }
}
