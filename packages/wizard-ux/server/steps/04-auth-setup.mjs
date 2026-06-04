// Step 4 - Sign In. Authenticate at the tenant level (no environment URL yet) so
// Step 5 can discover environments via `pac env list`. Environment-scoped PAC
// profiles and .env files are created in Step 5 once the environment is chosen.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { platform } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getSecret, hasUsableSecret, recoverSecret, setSecret, persistSecretToCache } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// PACKAGE_DIR locates sibling @pacaf/wizard lib files (must stay __dirname-relative).
// PROJECT_DIR is the user's working directory (cwd for interactive sign-in).
const PACKAGE_DIR = resolve(__dirname, '..', '..', '..');
const PROJECT_DIR = process.cwd();
const SHELL = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const SCRUB = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'scrub.mjs')).href);

// Transient tenant-level profile created here purely so Step 5 can run
// `pac env list`. Step 5 renames it (user) or replaces it (SPN).
const DISCOVERY_PROFILE_NAME = 'pacaf-discovery';

function hasCommand(name) {
  try {
    execFileSync(platform() === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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
    title: 'Sign In',
    description: 'Sign in to Power Platform once. The next step uses this sign-in to list your environments so you can pick Dev, Test, and Prod — no URLs to paste.',
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
      },
      {
        id: 'OP_VAULT',
        type: 'text',
        label: '1Password vault name',
        defaultValue: state.OP_VAULT || 'Engineering',
        hideIf: [{ id: 'AUTH_MODE', equals: 'envlocal' }],
      },
      {
        id: 'OP_ITEM',
        type: 'text',
        label: '1Password item name',
        defaultValue: state.OP_ITEM || `PowerApps CodeApps - ${state.APP_NAME || 'My App'}`,
        hideIf: [{ id: 'AUTH_MODE', equals: 'envlocal' }],
      },
    );
    return questions;
  },

  async apply(answers, state, log) {
    const pac = SHELL.pacPath();
    if (!pac) throw new Error('PAC CLI was not found. Install it before signing in.');

    const authProfileType = state.AUTH_PROFILE_TYPE || 'user';

    // Remove any stale discovery profile from a previous run so the create below
    // doesn't fail with "profile already exists".
    SHELL.runSafeCapture(pac, ['auth', 'delete', '--name', DISCOVERY_PROFILE_NAME]);

    // ── User credentials flow ──
    if (authProfileType === 'user') {
      const method = answers.USER_SIGN_IN_METHOD === 'browser' ? 'browser' : 'deviceCode';
      log.info('Signing in interactively (tenant level)...');
      const args = ['auth', 'create', '--name', DISCOVERY_PROFILE_NAME];
      if (method === 'deviceCode') args.push('--deviceCode');

      let ok = await runLivePac(log, pac, args, { timeoutMs: method === 'browser' ? 180000 : 0 });
      if (!ok && method === 'browser') {
        log.warn('Browser sign-in did not complete. Falling back to device code...');
        ok = await runLivePac(log, pac, ['auth', 'create', '--name', DISCOVERY_PROFILE_NAME, '--deviceCode']);
      }
      if (!ok) throw new Error('Sign-in did not complete. Re-run this step and finish the device-code or browser prompt.');

      log.ok('Signed in. Pick your environments in the next step.');
      return {
        stateUpdate: { WIZARD_DISCOVERY_PROFILE: DISCOVERY_PROFILE_NAME },
        completedStep: 4,
      };
    }

    // ── Service Principal flow ──
    const enteredSecret = String(answers.PP_CLIENT_SECRET || '').trim();
    if (enteredSecret) setSecret(enteredSecret);
    const secret = getSecret() || recoverSecret();
    if (!secret) throw new Error('Client secret is required. Enter it in this step or complete Step 3 first.');

    const tenantId = String(state.PP_TENANT_ID || '').trim();
    const clientId = String(state.PP_APP_ID || '').trim();
    if (!tenantId || !clientId) throw new Error('Step 3 must be complete with Tenant ID and Client ID before signing in.');

    const authMode = String(answers.AUTH_MODE || state.AUTH_MODE || 'envlocal');
    if (authMode === '1password' && !hasCommand('op')) {
      throw new Error('1Password storage was selected, but the op CLI is not available.');
    }

    // Carry the secret to Step 5, where .env.local / env-scoped profiles are written.
    try { persistSecretToCache(secret); } catch { /* best-effort */ }

    log.info('Authenticating service principal (tenant level)...');
    const created = SHELL.runSafeCapture(pac, [
      'auth', 'create', '--name', DISCOVERY_PROFILE_NAME,
      '--applicationId', clientId, '--clientSecret', secret, '--tenant', tenantId,
    ]);
    if (!created.ok) {
      throw new Error(formatPacAuthCreateError(DISCOVERY_PROFILE_NAME, 'your tenant', created.stderr || created.stdout));
    }
    log.ok('Service principal authenticated. Pick your environments in the next step.');

    return {
      stateUpdate: {
        WIZARD_DISCOVERY_PROFILE: DISCOVERY_PROFILE_NAME,
        AUTH_MODE: authMode,
        HAS_OP: hasCommand('op'),
        OP_VAULT: authMode === '1password' ? answers.OP_VAULT : state.OP_VAULT,
        OP_ITEM: authMode === '1password' ? answers.OP_ITEM : state.OP_ITEM,
      },
      completedStep: 4,
    };
  },
};
