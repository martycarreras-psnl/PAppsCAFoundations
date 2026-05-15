// Step 4 - Auth Setup. Browser-native credential persistence and PAC profile setup.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { platform } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getSecret, hasUsableSecret, recoverSecret, setSecret, persistSecretToCache, clearSecretCache } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// PACKAGE_DIR locates sibling @pacaf/wizard lib files (must stay __dirname-relative).
// PROJECT_DIR is the user's working directory (profile names, env files, git hooks, cwd).
const PACKAGE_DIR = resolve(__dirname, '..', '..', '..');
const PROJECT_DIR = process.cwd();
const SHELL = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const CRYPTO = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'crypto.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);
const SCRUB = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'scrub.mjs')).href);

function hasCommand(name) {
  try {
    execFileSync(platform() === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove any PP_CLIENT_SECRET=... line from .env.local. Called when the
 * user picks 1Password storage so an encrypted blob from a previous run
 * doesn't linger inside the (possibly cloud-synced) project folder.
 */
function removeSecretFromEnvLocal() {
  const envLocalPath = join(PROJECT_DIR, '.env.local');
  if (!existsSync(envLocalPath)) return;
  const original = readFileSync(envLocalPath, 'utf-8');
  if (!/^PP_CLIENT_SECRET=/m.test(original)) return;
  const cleaned = original.replace(/^PP_CLIENT_SECRET=.*\r?\n?/m, '');
  writeFileSync(envLocalPath, cleaned, 'utf-8');
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

function warnOnUrlDrift(log, key, stateUrl, credentialUrl) {
  if (!credentialUrl || normalizeUrl(stateUrl) === normalizeUrl(credentialUrl)) return;
  log.warn(`${key} in your credential source (${credentialUrl}) differs from wizard state (${stateUrl}). Update the credential source so downstream scripts stay in sync.`);
}

function formatPacAuthCreateError(profileName, url, output = '') {
  const scrubbed = SCRUB.scrubSecrets(String(output || ''));
  const lines = scrubbed.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const detail = lines.find((line) => /^Error:/i.test(line)) || lines.at(-1) || 'pac auth create failed without a readable error message.';
  return [
    `${profileName} profile failed to create for ${url}.`,
    `PAC reported: ${detail}`,
    'Check that the app registration is added as an Application User, the client secret is current, and the credential source points at the intended environment.',
  ].join('\n');
}

function createPacProfile(log, pac, targetKey, url, appId, secret, tenantId) {
  const profileName = PAC_TARGET.buildPacProfileName({ rootDir: PROJECT_DIR, targetKey, profileType: 'spn', url });
  const result = SHELL.runSafeCapture(pac, [
    'auth', 'create', '--name', profileName, '--environment', url,
    '--applicationId', appId, '--clientSecret', secret, '--tenant', tenantId,
  ]);
  if (!result.ok) throw new Error(formatPacAuthCreateError(profileName, url, result.stderr || result.stdout));
  log.ok(`${profileName} profile created`);
}

function createProfiles(log, pac, credentialValues, state) {
  const tenantId = credentialValues.PP_TENANT_ID;
  const clientId = credentialValues.PP_APP_ID;
  const secret = credentialValues.PP_CLIENT_SECRET;
  const devUrl = String(state.PP_ENV_DEV || '').trim();
  const testUrl = String(state.PP_ENV_TEST || '').trim();
  const prodUrl = String(state.PP_ENV_PROD || '').trim();
  if (!tenantId || !clientId || !secret || !devUrl) {
    throw new Error('Resolved credentials are incomplete. Expected tenant ID, app ID, client secret, and Dev environment URL.');
  }
  warnOnUrlDrift(log, 'PP_ENV_DEV', devUrl, credentialValues.PP_ENV_DEV);
  if (testUrl) warnOnUrlDrift(log, 'PP_ENV_TEST', testUrl, credentialValues.PP_ENV_TEST);
  if (prodUrl) warnOnUrlDrift(log, 'PP_ENV_PROD', prodUrl, credentialValues.PP_ENV_PROD);
  log.info('Creating PAC SPN auth profiles...');
  createPacProfile(log, pac, 'dev', devUrl, clientId, secret, tenantId);
  if (testUrl) createPacProfile(log, pac, 'test', testUrl, clientId, secret, tenantId);
  if (prodUrl) createPacProfile(log, pac, 'prod', prodUrl, clientId, secret, tenantId);
}

function installPreCommitHook(log) {
  const hookDir = join(PROJECT_DIR, '.git', 'hooks');
  const hookPath = join(hookDir, 'pre-commit');
  const hookSource = join(PROJECT_DIR, 'scripts', 'pre-commit-hook.sh');
  if (!existsSync(join(PROJECT_DIR, '.git')) || !existsSync(hookSource)) return;
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf-8');
    if (!existing.includes('papps-secret-guard')) return;
  }
  try {
    mkdirSync(hookDir, { recursive: true });
    copyFileSync(hookSource, hookPath);
    if (platform() !== 'win32') chmodSync(hookPath, 0o755);
    log.ok('Installed pre-commit hook');
  } catch {
    log.warn('Could not install pre-commit hook. Install scripts/pre-commit-hook.sh manually if desired.');
  }
}

function runLivePac(log, pac, args, opts = {}) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${SCRUB.scrubSecrets(SHELL.formatCommandForLog(pac, args))}`);
    const child = SHELL.spawnSafe(pac, args, { cwd: PROJECT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    const timeout = opts.timeoutMs
      ? setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill('SIGINT'); } catch { /* best effort */ }
        log.warn(`${args.slice(0, 2).join(' ')} timed out.`);
        resolvePromise(false);
      }, opts.timeoutMs)
      : null;
    timeout?.unref?.();
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => log.info(String(chunk).trimEnd()));
    child.stderr.on('data', (chunk) => log.warn(String(chunk).trimEnd()));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      log.fail(`Failed to start PAC: ${error.message}`);
      resolvePromise(false);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolvePromise(code === 0);
    });
  });
}

export default {
  meta: {
    number: 4,
    title: 'PAC Auth Profiles',
    description: 'The PAC CLI needs its own auth profiles to communicate with your Power Platform environment. This step creates those profiles using the credentials from Step 3, writes configuration files, and verifies the connection works.',
    canRunInBrowser: true,
  },

  questions(state) {
    const authProfileType = state.AUTH_PROFILE_TYPE || 'user';
    const isUser = authProfileType === 'user';
    const hasOp = hasCommand('op') || state.HAS_OP === true;
    const defaultAuthMode = state.AUTH_MODE === '1password' && hasOp ? '1password' : 'envlocal';
    const questions = [];

    // ── User credentials flow ──
    if (isUser) {
      questions.push(
        {
          id: 'USER_SIGN_IN_METHOD',
          type: 'select',
          label: 'Sign-in method',
          help: 'This opens a one-time interactive sign-in so the PAC CLI can run commands (pac code init, pac code push, etc.) against your environment. Your browser or a device code will authenticate you — no passwords are stored.',
          defaultValue: 'deviceCode',
          options: [
            { value: 'deviceCode', label: 'Device code — most reliable' },
            { value: 'browser', label: 'Browser — fastest when callback works' },
          ],
        },
      );
      return questions;
    }

    // ── Service Principal flow ──
    if (!hasUsableSecret()) {
      questions.push({
        id: 'PP_CLIENT_SECRET',
        type: 'secret',
        label: 'Client secret',
        help: 'Only needed if WizardUX cannot recover it from this session, .env.local, or 1Password.',
        defaultValue: '',
      });
    }
    questions.push(
      {
        id: 'AUTH_MODE',
        type: 'select',
        label: 'Credential storage mode',
        help: 'Controls how the PAC CLI retrieves your Service Principal credentials. 1Password uses op:// references (safe to commit). Local file encrypts the secret on disk (gitignored).',
        defaultValue: defaultAuthMode,
        options: [
          ...(hasOp ? [{ value: '1password', label: '1Password references in .env' }] : []),
          { value: 'envlocal', label: '.env.local file (encrypted secret, gitignored)' },
        ],
        help: state.AUTH_MODE ? `Currently set to ${state.AUTH_MODE} from Step 3.` : undefined,
      },
      {
        id: 'OP_VAULT',
        type: 'text',
        label: '1Password vault name',
        defaultValue: state.OP_VAULT || 'Engineering',
        hideIf: [{ id: 'AUTH_MODE', equals: 'envlocal' }],
        help: state.OP_VAULT ? `Using "${state.OP_VAULT}" from Step 3.` : undefined,
      },
      {
        id: 'OP_ITEM',
        type: 'text',
        label: '1Password item name',
        defaultValue: state.OP_ITEM || `PowerApps CodeApps - ${state.APP_NAME || 'My App'}`,
        hideIf: [{ id: 'AUTH_MODE', equals: 'envlocal' }],
        help: state.OP_ITEM ? `Using "${state.OP_ITEM}" from Step 3.` : undefined,
      },
      {
        id: 'CREATE_USER_PROFILE',
        type: 'confirm',
        label: 'Create the interactive user auth profile now',
        help: 'Required once for pac code run, pac code push, and pac code add-data-source.',
        defaultValue: true,
      },
      {
        id: 'USER_SIGN_IN_METHOD',
        type: 'select',
        label: 'User sign-in method',
        defaultValue: 'deviceCode',
        options: [
          { value: 'deviceCode', label: 'Device code — most reliable' },
          { value: 'browser', label: 'Browser — fastest when callback works' },
        ],
        hideIf: { id: 'CREATE_USER_PROFILE', equals: false },
      },
    );
    return questions;
  },

  async apply(answers, state, log) {
    const pac = SHELL.pacPath();
    if (!pac) throw new Error('PAC CLI was not found. Install it before creating auth profiles.');

    const authProfileType = state.AUTH_PROFILE_TYPE || 'user';
    const devUrl = String(state.PP_ENV_DEV || '').trim();
    const testUrl = String(state.PP_ENV_TEST || '').trim();
    const prodUrl = String(state.PP_ENV_PROD || '').trim();
    const dateStr = new Date().toISOString().slice(0, 10);
    const targetKey = state.WIZARD_TARGET_ENV || 'dev';

    if (!devUrl) throw new Error('Dev environment URL must be set (Step 2) before auth setup.');

    // ── User credentials flow ──
    if (authProfileType === 'user') {
      const method = answers.USER_SIGN_IN_METHOD === 'browser' ? 'browser' : 'deviceCode';
      const userProfileName = PAC_TARGET.buildPacProfileName({ rootDir: PROJECT_DIR, targetKey, profileType: 'user', url: devUrl });

      log.info('Creating user auth profile via interactive sign-in...');
      const userArgs = ['auth', 'create', '--name', userProfileName, '--environment', devUrl];
      if (method === 'deviceCode') userArgs.push('--deviceCode');

      let userOk = await runLivePac(log, pac, userArgs, { timeoutMs: method === 'browser' ? 180000 : 0 });

      // Fallback to device code if browser timed out
      if (!userOk && method === 'browser') {
        log.warn('Browser sign-in did not complete. Falling back to device code...');
        userOk = await runLivePac(log, pac, [
          'auth', 'create', '--name', userProfileName, '--environment', devUrl, '--deviceCode',
        ]);
      }

      if (!userOk) throw new Error(`Could not create user profile. Run later: ${pac} auth create --name ${userProfileName} --environment ${devUrl} --deviceCode`);
      log.ok(`User profile ${userProfileName} created`);

      // Write .env — with op:// references if 1Password, or plain URLs otherwise
      const authMode = state.AUTH_MODE || '';
      if (authMode === '1password' && state.OP_VAULT && state.OP_ITEM) {
        const vault = state.OP_VAULT;
        const itemName = state.OP_ITEM;
        // 1Password mode: ensure no encrypted PP_CLIENT_SECRET lingers in .env.local
        // and remove the out-of-tree secret cache.
        try { removeSecretFromEnvLocal(); } catch { /* best-effort */ }
        try { clearSecretCache(); } catch { /* best-effort */ }
        const envContent = [
          '# .env - Safe to commit. Contains 1Password references, not secrets.',
          `# Generated by setup wizard on ${dateStr}`,
          '',
          `PP_ENV_DEV=op://${vault}/${itemName}/env-dev`,
          testUrl ? `PP_ENV_TEST=op://${vault}/${itemName}/env-test` : '',
          prodUrl ? `PP_ENV_PROD=op://${vault}/${itemName}/env-prod` : '',
          '',
        ].filter((line) => line !== '').join('\n');
        writeFileSync(join(PROJECT_DIR, '.env'), `${envContent}\n`, 'utf-8');
        log.ok('Wrote .env with 1Password references');
      } else {
        const envContent = [
          '# .env - Environment URLs for Power Platform.',
          `# Generated by setup wizard on ${dateStr}`,
          '',
          `PP_ENV_DEV=${devUrl}`,
          testUrl ? `PP_ENV_TEST=${testUrl}` : '',
          prodUrl ? `PP_ENV_PROD=${prodUrl}` : '',
          '',
        ].filter((line) => line !== '').join('\n');
        writeFileSync(join(PROJECT_DIR, '.env'), `${envContent}\n`, 'utf-8');
        log.ok('Wrote .env with environment URLs');
      }

      installPreCommitHook(log);

      // Verify the user profile
      const verification = PAC_TARGET.selectAndVerifyPacProfile({
        pac,
        rootDir: PROJECT_DIR,
        wizardState: { WIZARD_TARGET_ENV: targetKey, PP_ENV_DEV: devUrl, PP_ENV_TEST: testUrl, PP_ENV_PROD: prodUrl },
        targetKey,
        profileType: 'user',
        credentialValues: null,
        powerConfigPath: join(PROJECT_DIR, 'power.config.json'),
        requireCredentialMatch: false,
        requirePowerConfig: false,
        requirePowerConfigTarget: false,
      });
      log.ok(`Verified ${verification.profileName}`);
      log.info(verification.whoInfo.raw.split('\n').map((line) => `  ${line}`).join('\n'));

      return {
        stateUpdate: { AUTH_MODE: authMode },
        completedStep: 4,
      };
    }

    // ── Service Principal flow (existing behavior) ──
    const enteredSecret = String(answers.PP_CLIENT_SECRET || '').trim();
    if (enteredSecret) setSecret(enteredSecret);
    const secret = getSecret() || recoverSecret();
    if (!secret) throw new Error('Client secret is required. Enter it in this step or complete Step 3 first.');

    const authMode = String(answers.AUTH_MODE || state.AUTH_MODE || 'envlocal');
    const tenantId = String(state.PP_TENANT_ID || '').trim();
    const clientId = String(state.PP_APP_ID || '').trim();

    if (!tenantId || !clientId) throw new Error('Step 3 must be complete with Tenant ID and Client ID before auth setup.');

    if (authMode === '1password') {
      const vault = String(answers.OP_VAULT || state.OP_VAULT || '').trim();
      const itemName = String(answers.OP_ITEM || state.OP_ITEM || '').trim();
      if (!hasCommand('op')) throw new Error('1Password storage was selected, but op CLI is not available.');
      if (!vault || !itemName) throw new Error('1Password vault and item name are required.');
      // 1Password mode: scrub any prior PP_CLIENT_SECRET line and OS-temp cache.
      try { removeSecretFromEnvLocal(); } catch { /* best-effort */ }
      try { clearSecretCache(); } catch { /* best-effort */ }
      const envContent = [
        '# .env - Safe to commit. Contains 1Password references, not secrets.',
        `# Generated by setup wizard on ${dateStr}`,
        '',
        `PP_TENANT_ID=op://${vault}/${itemName}/tenant-id`,
        `PP_APP_ID=op://${vault}/${itemName}/app-id`,
        `PP_CLIENT_SECRET=op://${vault}/${itemName}/client-secret`,
        `PP_ENV_DEV=op://${vault}/${itemName}/env-dev`,
        testUrl ? `PP_ENV_TEST=op://${vault}/${itemName}/env-test` : '',
        prodUrl ? `PP_ENV_PROD=op://${vault}/${itemName}/env-prod` : '',
        '',
      ].filter((line) => line !== '').join('\n');
      writeFileSync(join(PROJECT_DIR, '.env'), `${envContent}\n`, 'utf-8');
      log.ok('Wrote .env with 1Password references');
    } else {
      const gitignorePath = join(PROJECT_DIR, '.gitignore');
      if (existsSync(gitignorePath)) {
        const gitignore = readFileSync(gitignorePath, 'utf-8');
        if (!gitignore.includes('.env.local')) appendFileSync(gitignorePath, '\n.env.local\n');
      } else {
        writeFileSync(gitignorePath, '.env.local\n', 'utf-8');
      }
      const envLocalContent = [
        '# .env.local - DO NOT commit to Git.',
        `# Generated by setup wizard on ${dateStr}`,
        '',
        `PP_TENANT_ID=${tenantId}`,
        `PP_APP_ID=${clientId}`,
        `PP_CLIENT_SECRET=${CRYPTO.encrypt(secret)}`,
        `PP_ENV_DEV=${devUrl}`,
        testUrl ? `PP_ENV_TEST=${testUrl}` : '',
        prodUrl ? `PP_ENV_PROD=${prodUrl}` : '',
        '',
      ].filter((line) => line !== '').join('\n');
      writeFileSync(join(PROJECT_DIR, '.env.local'), `${envLocalContent}\n`, 'utf-8');
      if (platform() !== 'win32') {
        try { chmodSync(join(PROJECT_DIR, '.env.local'), 0o600); } catch { /* best effort */ }
      }
      // Mirror the encrypted secret to the OS-temp cache so a wizard restart
      // can recover without prompting (and without touching .env.local).
      try { persistSecretToCache(secret); } catch { /* best-effort */ }
      log.ok('Wrote .env.local');
    }

    const opBin = hasCommand('op') ? 'op' : null;
    const credentialValues = PAC_TARGET.resolveCredentialValues({ rootDir: PROJECT_DIR, opBin, source: authMode });
    createProfiles(log, pac, credentialValues, state);
    installPreCommitHook(log);

    const envTemplate = [
      '# .env.template - Copy to .env.local and fill in values',
      '# DO NOT commit .env.local to Git',
      '',
      'PP_TENANT_ID=',
      'PP_APP_ID=',
      'PP_CLIENT_SECRET=',
      `PP_ENV_DEV=${devUrl}`,
      testUrl ? `PP_ENV_TEST=${testUrl}` : '',
      prodUrl ? `PP_ENV_PROD=${prodUrl}` : '',
      '',
    ].filter((line) => line !== '').join('\n');
    writeFileSync(join(PROJECT_DIR, '.env.template'), `${envTemplate}\n`, 'utf-8');
    log.ok('Wrote .env.template');

    const wizardState = {
      WIZARD_TARGET_ENV: targetKey,
      PP_ENV_DEV: devUrl,
      PP_ENV_TEST: testUrl,
      PP_ENV_PROD: prodUrl,
    };
    const verification = PAC_TARGET.selectAndVerifyPacProfile({
      pac,
      rootDir: PROJECT_DIR,
      wizardState,
      targetKey,
      profileType: 'spn',
      credentialValues,
      powerConfigPath: join(PROJECT_DIR, 'power.config.json'),
      requireCredentialMatch: true,
      requirePowerConfig: false,
      requirePowerConfigTarget: false,
    });
    log.ok(`Verified ${verification.profileName}`);
    log.info(verification.whoInfo.raw.split('\n').map((line) => `  ${line}`).join('\n'));

    if (answers.CREATE_USER_PROFILE === true) {
      const userProfileName = PAC_TARGET.buildPacProfileName({ rootDir: PROJECT_DIR, targetKey, profileType: 'user', url: devUrl });
      const method = answers.USER_SIGN_IN_METHOD === 'browser' ? 'browser' : 'deviceCode';
      log.warn('PAC code commands require a user auth profile. Starting user sign-in now.');
      const userArgs = ['auth', 'create', '--name', userProfileName, '--environment', devUrl];
      if (method === 'deviceCode') userArgs.push('--deviceCode');
      const userOk = await runLivePac(log, pac, userArgs, { timeoutMs: method === 'browser' ? 180000 : 0 });
      if (userOk) {
        log.ok(`User profile ${userProfileName} created`);
        const spnProfileName = PAC_TARGET.buildPacProfileName({ rootDir: PROJECT_DIR, targetKey, profileType: 'spn', url: devUrl });
        SHELL.runSafeCapture(pac, ['auth', 'select', '--name', spnProfileName]);
        log.ok('Switched back to SPN profile for the next setup steps');
      } else {
        log.warn(`Could not create user profile. Run later: ${pac} auth create --name ${userProfileName} --environment ${devUrl} --deviceCode`);
      }
    }

    return {
      stateUpdate: {
        AUTH_MODE: authMode,
        HAS_OP: opBin !== null,
        OP_VAULT: authMode === '1password' ? answers.OP_VAULT : state.OP_VAULT,
        OP_ITEM: authMode === '1password' ? answers.OP_ITEM : state.OP_ITEM,
      },
      completedStep: 4,
    };
  },
};
