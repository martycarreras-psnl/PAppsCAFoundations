// Step 3 - App Registration. Browser-native collection with optional 1Password sync.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { platform } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setSecret, hasUsableSecret } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const VALIDATE = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'validate.mjs')).href);

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
    return execFileSync(file, args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], cwd: ROOT_DIR }).trim();
  } catch {
    return null;
  }
}

function readOpField(vault, itemName, field) {
  return (runSafe('op', ['read', `op://${vault}/${itemName}/${field}`]) || '').trim();
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
    title: 'App Registration',
    description: 'Create or reuse an Entra ID App Registration and confirm it is registered as an Application User.',
    canRunInBrowser: true,
  },

  questions(state) {
    const appName = state.APP_NAME || 'My App';
    const appRegName = `PowerApps-CodeApps-${String(appName).replace(/ /g, '-')}`;
    const hasOp = hasCommand('op') || state.HAS_OP === true;
    return [
      {
        id: 'USE_1PASSWORD',
        type: 'confirm',
        label: 'Use 1Password for these credentials',
        help: hasOp ? 'WizardUX can read existing fields and optionally save missing values.' : '1Password CLI was not detected. Leave this off unless op is available in your shell.',
        defaultValue: hasOp && state.AUTH_MODE === '1password',
      },
      {
        id: 'OP_VAULT',
        type: 'text',
        label: '1Password vault name',
        defaultValue: state.OP_VAULT || 'Engineering',
        hideIf: { id: 'USE_1PASSWORD', equals: false },
      },
      {
        id: 'OP_ITEM',
        type: 'text',
        label: '1Password item name',
        defaultValue: state.OP_ITEM || `PowerApps CodeApps - ${appName}`,
        hideIf: { id: 'USE_1PASSWORD', equals: false },
      },
      {
        id: 'PP_TENANT_ID',
        type: 'text',
        label: 'Tenant ID (Directory ID)',
        help: 'Leave blank if your 1Password item already has a tenant-id field.',
        defaultValue: state.PP_TENANT_ID || '',
        hideIf: { id: 'USE_1PASSWORD', equals: true },
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
        help: 'Leave blank if your 1Password item already has an app-id field.',
        defaultValue: state.PP_APP_ID || '',
        hideIf: { id: 'USE_1PASSWORD', equals: true },
      },
      {
        id: 'PP_CLIENT_SECRET',
        type: 'secret',
        label: 'Client secret value',
        help: hasUsableSecret()
          ? 'A secret is already held in memory from a previous run. Leave blank to keep it.'
          : 'Create this under Certificates & secrets.',
        defaultValue: '',
        savedHint: hasUsableSecret() ? 'Secret saved from previous run' : undefined,
        hideIf: { id: 'USE_1PASSWORD', equals: true },
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
    const use1Password = answers.USE_1PASSWORD === true;
    const vault = String(answers.OP_VAULT || state.OP_VAULT || '').trim();
    const itemName = String(answers.OP_ITEM || state.OP_ITEM || '').trim();
    const devUrl = state.PP_ENV_DEV || '';
    const testUrl = state.PP_ENV_TEST || '';
    const prodUrl = state.PP_ENV_PROD || '';

    let tenantId = String(answers.PP_TENANT_ID || '').trim();
    let clientId = String(answers.PP_APP_ID || '').trim();
    let clientSecret = String(answers.PP_CLIENT_SECRET || '').trim();
    const had = { tenantId: false, clientId: false, clientSecret: false };

    if (use1Password) {
      if (!hasCommand('op')) throw new Error('1Password was selected, but the op CLI is not available to the WizardUX server process.');
      if (!vault || !itemName) throw new Error('1Password vault and item name are required.');
      log.info(`Looking for credentials in 1Password item "${itemName}"...`);
      const opTenantId = readOpField(vault, itemName, 'tenant-id');
      const opClientId = readOpField(vault, itemName, 'app-id');
      const opSecret = readOpField(vault, itemName, 'client-secret');
      if (opTenantId) { tenantId = opTenantId; had.tenantId = true; }
      if (opClientId) { clientId = opClientId; had.clientId = true; }
      if (opSecret) { clientSecret = opSecret; had.clientSecret = true; }
      const found = [had.tenantId && 'tenant-id', had.clientId && 'app-id', had.clientSecret && 'client-secret'].filter(Boolean);
      if (found.length > 0) log.ok(`Found ${found.join(', ')} in 1Password`);
      if (found.length < 3) log.warn('Some 1Password fields were missing; using the values entered in WizardUX for the rest.');
    }

    if (!VALIDATE.isValidUUID(tenantId)) throw new Error('Tenant ID must be a valid UUID.');
    if (!VALIDATE.isValidUUID(clientId)) throw new Error('Client ID must be a valid UUID.');
    if (!clientSecret) throw new Error('Client secret is required.');
    if (answers.APPLICATION_USER_DONE !== true) throw new Error('Register the App Registration as an Application User in Dev before continuing.');

    setSecret(clientSecret);

    // Persist encrypted secret to .env.local so it survives server restarts
    try {
      const CRYPTO = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'crypto.mjs')).href);
      const envLocalPath = join(ROOT_DIR, '.env.local');
      let envContent = existsSync(envLocalPath) ? readFileSync(envLocalPath, 'utf-8') : '';
      const encrypted = CRYPTO.encrypt(clientSecret);
      if (envContent.match(/^PP_CLIENT_SECRET=.*$/m)) {
        envContent = envContent.replace(/^PP_CLIENT_SECRET=.*$/m, `PP_CLIENT_SECRET=${encrypted}`);
      } else {
        envContent += `${envContent.endsWith('\n') || !envContent ? '' : '\n'}PP_CLIENT_SECRET=${encrypted}\n`;
      }
      writeFileSync(envLocalPath, envContent, 'utf-8');
      log.ok('Secret encrypted and saved to .env.local');
    } catch (err) {
      log.warn(`Could not persist secret to .env.local: ${err.message}`);
    }

    log.ok('Credential values captured');

    if (use1Password) {
      const values = { tenantId, clientId, clientSecret, devUrl, testUrl, prodUrl };
      if (had.tenantId && had.clientId && had.clientSecret) sync1PasswordEnvFields(log, vault, itemName, values);
      else save1PasswordItem(log, vault, itemName, values, had);
    }

    return {
      stateUpdate: {
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
