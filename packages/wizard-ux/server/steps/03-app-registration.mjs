// Step 3 - Authentication. Browser-native auth method selection with optional 1Password sync.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { platform } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setSecret, hasUsableSecret, persistSecretToCache } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// PACKAGE_DIR locates sibling @pacaf/wizard lib files (must stay __dirname-relative).
// PROJECT_DIR is the user's working directory (where .env, .env.local, etc. live).
const PACKAGE_DIR = resolve(__dirname, '..', '..', '..');
const PROJECT_DIR = process.cwd();
const VALIDATE = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'validate.mjs')).href);

function hasCommand(name) {
  try {
    execFileSync(platform() === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runSafe(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], cwd: PROJECT_DIR }).trim();
  } catch {
    return null;
  }
}

function runSafeWithTimeout(file, args, timeoutMs = 2000) {
  try {
    return execFileSync(file, args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], cwd: PROJECT_DIR, timeout: timeoutMs }).trim();
  } catch {
    return null;
  }
}

function readOpField(vault, itemName, field) {
  return (runSafe('op', ['read', `op://${vault}/${itemName}/${field}`]) || '').trim();
}

const CREATE_NEW_VAULT = '__create_new_vault__';
const CREATE_NEW_ITEM = '__create_new_item__';
const ENTER_MANUALLY = '__enter_manually__';

function listOpVaults() {
  const raw = runSafeWithTimeout('op', ['vault', 'list', '--format=json']);
  if (!raw) return [];
  try {
    return JSON.parse(raw)
      .map((v) => ({ value: v.name, label: `${v.name} (${v.items} item${v.items === 1 ? '' : 's'})` }))
      .sort((a, b) => a.value.localeCompare(b.value));
  } catch { return []; }
}

function listOpItems(vaultName) {
  if (!vaultName) return [];
  const raw = runSafeWithTimeout('op', ['item', 'list', '--vault', vaultName, '--format=json']);
  if (!raw) return [];
  try {
    return JSON.parse(raw)
      .map((i) => ({ value: i.title, label: `${i.title} (${i.category.toLowerCase().replace(/_/g, ' ')})` }))
      .sort((a, b) => a.value.localeCompare(b.value));
  } catch { return []; }
}

// Exported for the API route to call
export { listOpItems, listOpVaults };

function createOpVault(log, name) {
  const result = runSafe('op', ['vault', 'create', name, '--format=json']);
  if (result) { log.ok(`Created 1Password vault "${name}"`); return true; }
  log.warn(`Could not create vault "${name}". Create it manually in 1Password.`);
  return false;
}

function createOpItem(log, vault, title, fields) {
  const args = ['item', 'create', '--vault', vault, '--category', 'Secure Note', '--title', title];
  for (const [key, value] of Object.entries(fields)) {
    if (value) args.push(`${key}=${value}`);
  }
  const result = runSafe('op', args);
  if (result !== null) { log.ok(`Created 1Password item "${title}" in vault "${vault}"`); return true; }
  log.warn(`Could not create item "${title}". Create it manually in 1Password.`);
  return false;
}

function save1PasswordItem(log, vault, itemName, values, had) {
  const existing = runSafe('op', ['item', 'get', itemName, '--vault', vault, '--format', 'json']);
  const envFields = [];
  if (values.devUrl) envFields.push(`env-dev[text]=${values.devUrl}`);
  if (values.testUrl) envFields.push(`env-test[text]=${values.testUrl}`);
  if (values.prodUrl) envFields.push(`env-prod[text]=${values.prodUrl}`);

  if (existing) {
    const editArgs = ['item', 'edit', itemName, '--vault', vault];
    if (!had.tenantId) editArgs.push(`tenant-id[text]=${values.tenantId}`);
    if (!had.clientId) editArgs.push(`app-id[text]=${values.clientId}`);
    if (!had.clientSecret) editArgs.push(`client-secret[password]=${values.clientSecret}`);
    editArgs.push(...envFields);
    if (runSafe('op', editArgs) !== null) log.ok('1Password item updated');
    else log.warn('Could not update 1Password item. Save tenant-id, app-id, client-secret, and env-* fields manually.');
    return;
  }

  const createArgs = [
    'item', 'create',
    '--vault', vault,
    '--category', 'Secure Note',
    '--title', itemName,
    `tenant-id[text]=${values.tenantId}`,
    `app-id[text]=${values.clientId}`,
    `client-secret[password]=${values.clientSecret}`,
    ...envFields,
  ];
  if (runSafe('op', createArgs) !== null) log.ok('1Password item created');
  else log.warn('Could not create 1Password item. Create it manually with tenant-id, app-id, client-secret, and env-* fields.');
}

function sync1PasswordEnvFields(log, vault, itemName, values) {
  const normalize = (value) => String(value || '').trim().replace(/\/+$/, '').toLowerCase();
  const updates = [];
  if (values.devUrl && normalize(readOpField(vault, itemName, 'env-dev')) !== normalize(values.devUrl)) updates.push(`env-dev[text]=${values.devUrl}`);
  if (values.testUrl && normalize(readOpField(vault, itemName, 'env-test')) !== normalize(values.testUrl)) updates.push(`env-test[text]=${values.testUrl}`);
  if (values.prodUrl && normalize(readOpField(vault, itemName, 'env-prod')) !== normalize(values.prodUrl)) updates.push(`env-prod[text]=${values.prodUrl}`);
  if (updates.length === 0) return;
  if (runSafe('op', ['item', 'edit', itemName, '--vault', vault, ...updates]) !== null) {
    log.ok(`Synced ${updates.length} environment URL field(s) in 1Password`);
  } else {
    log.warn('Could not update 1Password env-* fields. Edit the item manually so env URLs match this wizard run.');
  }
}

export default {
  meta: {
    number: 3,
    title: 'Authentication',
    description: 'Choose how to authenticate with your Power Platform environment — user credentials or a service principal.',
    canRunInBrowser: true,
  },

  questions(state) {
    const appName = state.APP_NAME || 'My App';
    const appRegName = `PowerApps-CodeApps-${String(appName).replace(/ /g, '-')}`;
    const hasOp = hasCommand('op') || state.HAS_OP === true;
    const currentAuthType = state.AUTH_PROFILE_TYPE || 'user';

    return [
      {
        id: 'AUTH_PROFILE_TYPE',
        type: 'select',
        label: 'Authentication method',
        help: 'User credentials: sign in interactively — no App Registration needed. Service Principal: headless auth via an App Registration — required for CI/CD but needs tenant admin access to create.',
        defaultValue: currentAuthType,
        options: [
          { value: 'user', label: 'User credentials (interactive sign-in)' },
          { value: 'spn', label: 'Service Principal (App Registration)' },
        ],
      },

      // ── 1Password (available for both auth types) ──
      {
        id: 'USE_1PASSWORD',
        type: 'confirm',
        label: 'Use 1Password to store credentials',
        help: hasOp
          ? 'Store environment URLs and credentials as 1Password references. Secrets never touch disk.'
          : '1Password CLI was not detected. Leave this off unless op is available in your shell.',
        defaultValue: state.USE_1PASSWORD === true || (hasOp && state.AUTH_MODE === '1password'),
      },
      {
        id: 'OP_VAULT',
        type: 'select',
        label: '1Password vault',
        help: 'Select an existing vault, create a new one, or enter a name manually. Vaults load when 1Password is enabled — if the list is empty, ensure the op CLI is signed in (`op signin`) and toggle 1Password off and on to retry.',
        defaultValue: state.OP_VAULT || ENTER_MANUALLY,
        options: [
          { value: ENTER_MANUALLY, label: 'Enter vault name manually' },
          { value: CREATE_NEW_VAULT, label: '+ Create new vault' },
        ],
        dynamicOptions: {
          endpoint: '/api/1password/vaults',
          param: 'enabled',
          dependsOn: 'USE_1PASSWORD',
          responseKey: 'vaults',
        },
        hideIf: { id: 'USE_1PASSWORD', equals: false },
      },
      {
        id: 'OP_VAULT_MANUAL',
        type: 'text',
        label: 'Vault name',
        help: 'Type the exact 1Password vault name. It must already exist in your 1Password account.',
        defaultValue: state.OP_VAULT || '',
        showIf: { id: 'OP_VAULT', equals: ENTER_MANUALLY },
        hideIf: { id: 'USE_1PASSWORD', equals: false },
      },
      {
        id: 'OP_NEW_VAULT_NAME',
        type: 'text',
        label: 'New vault name',
        help: 'Name for the new 1Password vault.',
        defaultValue: 'Power Platform Environments',
        showIf: { id: 'OP_VAULT', equals: CREATE_NEW_VAULT },
        hideIf: { id: 'USE_1PASSWORD', equals: false },
      },
      {
        id: 'OP_ITEM',
        type: 'select',
        label: '1Password item',
        help: 'Items are loaded from the selected vault. Select an existing item, create a new one, or enter a name manually.',
        defaultValue: state.OP_ITEM || ENTER_MANUALLY,
        options: [
          { value: ENTER_MANUALLY, label: 'Enter item name manually' },
          { value: CREATE_NEW_ITEM, label: '+ Create new item' },
        ],
        dynamicOptions: {
          endpoint: '/api/1password/items',
          param: 'vault',
          dependsOn: 'OP_VAULT',
          responseKey: 'items',
        },
        hideIf: [{ id: 'USE_1PASSWORD', equals: false }],
      },
      {
        id: 'OP_ITEM_MANUAL',
        type: 'text',
        label: 'Item name',
        help: 'Type the exact 1Password item name (e.g. the Secure Note title).',
        defaultValue: state.OP_ITEM || `PowerApps CodeApps - ${appName}`,
        showIf: { id: 'OP_ITEM', equals: ENTER_MANUALLY },
        hideIf: { id: 'USE_1PASSWORD', equals: false },
      },
      {
        id: 'OP_NEW_ITEM_NAME',
        type: 'text',
        label: 'New item name',
        help: 'Name for the new 1Password Secure Note.',
        defaultValue: state.OP_ITEM || `PowerApps CodeApps - ${appName}`,
        showIf: { id: 'OP_ITEM', equals: CREATE_NEW_ITEM },
        hideIf: { id: 'USE_1PASSWORD', equals: false },
      },

      // ── SPN-only fields ──
      // These show when: SPN is selected AND (1Password is off, OR creating a new 1Password item).
      // When 1Password is on with an existing item, credentials are read from 1Password automatically.
      {
        id: 'PP_TENANT_ID',
        type: 'text',
        label: 'Tenant ID (Directory ID)',
        help: 'Required for the App Registration. Leave blank only if your existing 1Password item already has a tenant-id field.',
        defaultValue: state.PP_TENANT_ID || '',
        showIf: { id: 'AUTH_PROFILE_TYPE', equals: 'spn' },
        why: [
          'Azure Portal steps:',
          '1. Open https://portal.azure.com',
          '2. Microsoft Entra ID -> App registrations -> New registration',
          `3. Name: ${appRegName}`,
          '4. Supported account types: Single tenant',
          '5. Redirect URI: leave blank, then Register',
          '6. Copy Directory (tenant) ID from Overview',
        ].join('\n'),
      },
      {
        id: 'PP_APP_ID',
        type: 'text',
        label: 'Client ID (Application ID)',
        help: 'Required for the App Registration. Leave blank only if your existing 1Password item already has an app-id field.',
        defaultValue: state.PP_APP_ID || '',
        showIf: { id: 'AUTH_PROFILE_TYPE', equals: 'spn' },
      },
      {
        id: 'PP_CLIENT_SECRET',
        type: 'secret',
        label: 'Client secret value',
        help: hasUsableSecret()
          ? 'A secret is already held in memory from a previous run. Leave blank to keep it.'
          : 'Required for the App Registration. Leave blank only if your existing 1Password item already has a client-secret field.',
        defaultValue: '',
        savedHint: hasUsableSecret() ? 'Secret saved from previous run' : undefined,
        showIf: { id: 'AUTH_PROFILE_TYPE', equals: 'spn' },
        why: [
          'Client secret steps:',
          '1. In the App Registration, open Certificates & secrets',
          '2. New client secret -> Description: Power Platform CLI',
          '3. Expiration: 12 months',
          '4. Copy the secret value immediately; it is shown only once',
        ].join('\n'),
      },
      {
        id: 'APPLICATION_USER_DONE',
        type: 'confirm',
        label: 'Please confirm that the Application User is registered in the Dev environment',
        defaultValue: false,
        showIf: { id: 'AUTH_PROFILE_TYPE', equals: 'spn' },
        why: [
          'Power Platform Admin Center steps:',
          '1. Open https://admin.powerplatform.microsoft.com',
          '2. Select your Dev environment -> Settings',
          '3. Users + permissions -> Application users',
          '4. New app user -> Add an app',
          `5. Search for ${appRegName}`,
          '6. Assign System Administrator for Dev/Test or least privilege for Production',
          '7. Create the app user before continuing',
        ].join('\n'),
      },
    ];
  },

  async apply(answers, state, log) {
    const authProfileType = answers.AUTH_PROFILE_TYPE || 'user';
    const use1Password = answers.USE_1PASSWORD === true;

    // ── Resolve vault and item names (shared by both auth flows) ──
    let vault = '';
    let itemName = '';
    if (use1Password) {
      if (!hasCommand('op')) throw new Error('1Password was selected, but the op CLI is not available to the WizardUX server process.');

      // Vault: existing selection, manual entry, or create new
      if (answers.OP_VAULT === CREATE_NEW_VAULT) {
        vault = String(answers.OP_NEW_VAULT_NAME || '').trim();
        if (!vault) throw new Error('New vault name is required.');
        createOpVault(log, vault);
      } else if (answers.OP_VAULT === ENTER_MANUALLY) {
        vault = String(answers.OP_VAULT_MANUAL || '').trim();
        if (!vault) throw new Error('Vault name is required.');
      } else {
        vault = String(answers.OP_VAULT || state.OP_VAULT || '').trim();
      }

      // Item: existing selection, manual entry, or create new
      if (answers.OP_ITEM === CREATE_NEW_ITEM) {
        itemName = String(answers.OP_NEW_ITEM_NAME || '').trim();
        if (!itemName) throw new Error('New item name is required.');
        // Item creation happens below after we have field values
      } else if (answers.OP_ITEM === ENTER_MANUALLY) {
        itemName = String(answers.OP_ITEM_MANUAL || '').trim();
        if (!itemName) throw new Error('Item name is required.');
      } else {
        itemName = String(answers.OP_ITEM || state.OP_ITEM || '').trim();
      }

      if (!vault || !itemName) throw new Error('1Password vault and item name are required.');
    }

    // ── User credentials + 1Password ──
    if (authProfileType === 'user') {
      if (use1Password) {
        const devUrl = state.PP_ENV_DEV || '';
        const testUrl = state.PP_ENV_TEST || '';
        const prodUrl = state.PP_ENV_PROD || '';

        // Create item if needed (env URLs only — no secrets for user auth)
        if (answers.OP_ITEM === CREATE_NEW_ITEM) {
          const fields = {};
          if (devUrl) fields['env-dev[text]'] = devUrl;
          if (testUrl) fields['env-test[text]'] = testUrl;
          if (prodUrl) fields['env-prod[text]'] = prodUrl;
          createOpItem(log, vault, itemName, fields);
        } else {
          // Sync env URLs on existing item
          sync1PasswordEnvFields(log, vault, itemName, { devUrl, testUrl, prodUrl });
        }

        log.ok(`User credentials with 1Password selected — environment URLs stored in "${vault}" → "${itemName}".`);
        return {
          stateUpdate: {
            AUTH_PROFILE_TYPE: 'user',
            PP_TENANT_ID: '',
            PP_APP_ID: '',
            AUTH_MODE: '1password',
            HAS_OP: true,
            OP_VAULT: vault,
            OP_ITEM: itemName,
          },
          completedStep: 3,
        };
      }

      // User credentials without 1Password
      log.ok('User credentials selected — you will sign in interactively in the next step.');
      return {
        stateUpdate: {
          AUTH_PROFILE_TYPE: 'user',
          PP_TENANT_ID: '',
          PP_APP_ID: '',
          AUTH_MODE: state.AUTH_MODE === '1password' ? '' : (state.AUTH_MODE || ''),
        },
        completedStep: 3,
      };
    }

    // ── Service Principal flow ──
    const devUrl = state.PP_ENV_DEV || '';
    const testUrl = state.PP_ENV_TEST || '';
    const prodUrl = state.PP_ENV_PROD || '';

    let tenantId = String(answers.PP_TENANT_ID || '').trim();
    let clientId = String(answers.PP_APP_ID || '').trim();
    let clientSecret = String(answers.PP_CLIENT_SECRET || '').trim();
    const had = { tenantId: false, clientId: false, clientSecret: false };

    if (use1Password) {
      log.info(`Looking for credentials in 1Password item "${itemName}"...`);
      if (answers.OP_ITEM !== CREATE_NEW_ITEM) {
        // Read from existing item
        const opTenantId = readOpField(vault, itemName, 'tenant-id');
        const opClientId = readOpField(vault, itemName, 'app-id');
        const opSecret = readOpField(vault, itemName, 'client-secret');
        if (opTenantId) { tenantId = opTenantId; had.tenantId = true; }
        if (opClientId) { clientId = opClientId; had.clientId = true; }
        if (opSecret) { clientSecret = opSecret; had.clientSecret = true; }
        const found = [had.tenantId && 'tenant-id', had.clientId && 'app-id', had.clientSecret && 'client-secret'].filter(Boolean);
        if (found.length > 0) log.ok(`Found ${found.join(', ')} in 1Password`);
        if (found.length < 3) log.warn('Some 1Password fields were missing; using the values entered in WizardUX for the rest.');
      } else {
        log.info('New item will be created after validating credentials.');
      }
    }

    if (!VALIDATE.isValidUUID(tenantId)) throw new Error('Tenant ID must be a valid UUID.');
    if (!VALIDATE.isValidUUID(clientId)) throw new Error('Client ID must be a valid UUID.');
    if (!clientSecret) throw new Error('Client secret is required.');
    if (answers.APPLICATION_USER_DONE !== true) throw new Error('Register the App Registration as an Application User in Dev before continuing.');

    setSecret(clientSecret);

    // Persist the encrypted secret to a per-machine OS-temp cache (NOT .env.local)
    // so it survives wizard server restarts without ever placing the value
    // inside the project folder. The project folder may be cloud-synced
    // (OneDrive/Dropbox/iCloud), and content scanners pattern-match
    // "PP_CLIENT_SECRET=" lines regardless of whether the value is encrypted.
    try {
      persistSecretToCache(clientSecret);
      log.ok('Secret cached securely outside the project folder');
    } catch (err) {
      log.warn(`Could not cache secret across restarts: ${err.message}`);
    }

    log.ok('Credential values captured');

    if (use1Password) {
      if (answers.OP_ITEM === CREATE_NEW_ITEM) {
        // Create a brand new item with all fields
        createOpItem(log, vault, itemName, {
          'tenant-id[text]': tenantId,
          'app-id[text]': clientId,
          'client-secret[password]': clientSecret,
          ...(devUrl ? { 'env-dev[text]': devUrl } : {}),
          ...(testUrl ? { 'env-test[text]': testUrl } : {}),
          ...(prodUrl ? { 'env-prod[text]': prodUrl } : {}),
        });
      } else {
        const values = { tenantId, clientId, clientSecret, devUrl, testUrl, prodUrl };
        if (had.tenantId && had.clientId && had.clientSecret) sync1PasswordEnvFields(log, vault, itemName, values);
        else save1PasswordItem(log, vault, itemName, values, had);
      }
    }

    return {
      stateUpdate: {
        AUTH_PROFILE_TYPE: 'spn',
        PP_TENANT_ID: tenantId,
        PP_APP_ID: clientId,
        AUTH_MODE: use1Password ? '1password' : (state.AUTH_MODE || 'envlocal'),
        HAS_OP: hasCommand('op'),
        OP_VAULT: use1Password ? vault : state.OP_VAULT,
        OP_ITEM: use1Password ? itemName : state.OP_ITEM,
      },
      completedStep: 3,
    };
  },
};
