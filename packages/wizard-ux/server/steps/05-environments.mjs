// Step 5 - Environments. Discover environments via `pac env list --json` (using
// the tenant-level sign-in from Step 4), let the user pick Dev (required), Test,
// and Prod, then create the environment-scoped PAC profiles and write .env files.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { platform } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getSecret, recoverSecret, persistSecretToCache, clearSecretCache } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// PACKAGE_DIR locates sibling @pacaf/wizard lib files (must stay __dirname-relative).
// PROJECT_DIR is the user's working directory (profile names, env files, git hooks).
const PACKAGE_DIR = resolve(__dirname, '..', '..', '..');
const PROJECT_DIR = process.cwd();
const SHELL = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const CRYPTO = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'crypto.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);
const SCRUB = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'scrub.mjs')).href);
const VALIDATE = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'validate.mjs')).href);

// Sentinel select values.
const MANUAL_ENTRY = '__manual__';
const NONE = '__none__';
// Transient profile created in Step 4 so this step can run `pac env list`.
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

function createPacProfile(log, pac, targetKey, url, appId, secret, tenantId) {
  const profileName = PAC_TARGET.buildPacProfileName({ rootDir: PROJECT_DIR, targetKey, profileType: 'spn', url });
  const result = SHELL.runSafeCapture(pac, [
    'auth', 'create', '--name', profileName, '--environment', url,
    '--applicationId', appId, '--clientSecret', secret, '--tenant', tenantId,
  ]);
  if (!result.ok) throw new Error(formatPacAuthCreateError(profileName, url, result.stderr || result.stdout));
  log.ok(`${profileName} profile created`);
}

/** Parse `pac env list --json` into a clean [{ url, name }] list. */
function discoverEnvironments(pac) {
  const res = SHELL.runSafeCapture(pac, ['env', 'list', '--json']);
  if (!res.ok) return [];
  const out = String(res.stdout || '');
  const start = out.indexOf('[');
  if (start < 0) return [];
  let arr;
  try { arr = JSON.parse(out.slice(start)); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((e) => e && e.EnvironmentUrl)
    .map((e) => ({ url: VALIDATE.normalizeDataverseUrl(e.EnvironmentUrl), name: e.FriendlyName || e.UniqueName || e.EnvironmentUrl }))
    .filter((e) => e.url)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Find a profile's bracketed index in `pac auth list` output by its name. */
function findProfileIndexByName(pac, name) {
  const res = SHELL.runSafeCapture(pac, ['auth', 'list']);
  if (!res.ok) return null;
  for (const line of String(res.stdout || '').split(/\r?\n/)) {
    const m = line.match(/^\s*\[(\d+)\]/);
    if (m && line.includes(name)) return Number(m[1]);
  }
  return null;
}

/**
 * Parse the raw stdout of `pac auth list` into structured rows. Columns are:
 *   [index] [active*] Kind Name User ...
 * The active flag is a `*` in the second column; it is absent for inactive
 * profiles. Pure (no I/O) so it can be unit-tested against captured fixtures.
 */
export function parseAuthListOutput(stdout) {
  const rows = [];
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const m = line.match(/^\s*\[(\d+)\]\s*(\*?)\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (!m) continue;
    rows.push({
      index: Number(m[1]),
      active: m[2] === '*',
      kind: m[3],
      name: m[4],
      user: m[5].trim(),
    });
  }
  return rows;
}

/**
 * Given parsed profiles and the name we intend to keep, return the stale
 * duplicates: other profiles sharing the same user + kind as the kept profile.
 * Pure so the duplicate-detection rules can be unit-tested directly.
 */
export function selectDuplicateProfiles(profiles, keepName) {
  const keep = profiles.find((p) => p.name === keepName);
  if (!keep) return [];
  return profiles.filter(
    (p) => p.name !== keepName && p.user === keep.user && p.kind === keep.kind,
  );
}

/**
 * Select every profile that must be removed before we finalize the discovery
 * profile into its environment-scoped name. Two categories are unsafe:
 *
 *   1. Same-user + same-kind duplicates of the profile we are keeping. Once the
 *      discovery profile is retargeted onto Dev it shares the (user, env, tenant)
 *      key with these, which is what trips pac's SingleOrDefault crash (#102).
 *   2. Any profile whose name already equals the target name we are about to
 *      rename to. `pac auth name` cannot rename onto a name that is already
 *      taken, and a leftover SPN/user profile from a prior run for the same Dev
 *      environment collides here even though its user/kind differ.
 *
 * Pure (no I/O) so the selection rules can be unit-tested against fixtures.
 */
export function selectProfilesToPrune(profiles, keepName, targetName) {
  const keep = profiles.find((p) => p.name === keepName);
  const out = [];
  const seen = new Set();
  for (const p of profiles) {
    if (p.name === keepName) continue;
    const isUserKindDup = keep && p.user === keep.user && p.kind === keep.kind;
    const isTargetCollision = targetName && p.name === targetName;
    if ((isUserKindDup || isTargetCollision) && !seen.has(p.name)) {
      seen.add(p.name);
      out.push(p);
    }
  }
  return out;
}

/**
 * Detect the signature of the corrupted-auth-store crash so we can surface an
 * actionable remediation instead of the raw pac stack trace. The
 * "Sequence contains..." line lands in pac-log.txt; the console shows the
 * generic non-recoverable error / InvalidOperationException.
 */
export function isDuplicateAuthStoreError(output) {
  const s = String(output || '');
  return /Sequence contains more than one matching element/i.test(s)
    || /non-recoverable error/i.test(s)
    || /InvalidOperationException/i.test(s);
}

/**
 * Extract the most useful error text from a runSafeCapture result. pac writes
 * its real error lines to STDOUT (e.g. "Error: The value 2 of --index is not
 * valid..."), while runSafeCapture puts Node's generic "Command failed: ..."
 * into `stderr` (from err.message). Reading stderr-first therefore shadows the
 * real reason — so prefer an `Error:` line from stdout, then stdout, then
 * stderr. Returns scrubbed text safe for display.
 */
export function extractPacError(result) {
  const stdout = String(result?.stdout || '');
  const stderr = String(result?.stderr || '');
  const errLine = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /^Error:/i.test(l));
  const detail = errLine || stdout.trim() || stderr.trim() || '';
  return SCRUB.scrubSecrets(detail);
}

/** Fetch and parse `pac auth list` into structured rows. */
function parseAuthProfiles(pac) {
  const res = SHELL.runSafeCapture(pac, ['auth', 'list']);
  if (!res.ok) return [];
  return parseAuthListOutput(res.stdout);
}

/**
 * Pre-flight auth hygiene, run BEFORE the discovery profile is retargeted onto
 * Dev. `pac auth name`/`delete` crash with "Sequence contains more than one
 * matching element" when the local auth store holds two profiles that resolve
 * to the same (user, environment, tenant) key — a known pac CLI bug whose
 * AuthProfiles.Update/Delete uses SingleOrDefault.
 *
 * Two leftovers from prior wizard runs trigger this:
 *   - same-user/kind duplicates of the discovery profile, and
 *   - a profile already named exactly `targetName` (the env-scoped name we are
 *     about to rename onto).
 *
 * Crucially this must happen while keys are still DISTINCT — i.e. before
 * `pac env select` points the discovery profile at Dev. Removing them now
 * prevents the ambiguous store from ever forming, which is the actual root
 * cause behind the recurring "Could not finalize the auth profile" failure.
 *
 * Returns the number of profiles removed.
 */
function pruneConflictingAuthProfiles(log, pac, keepName, targetName) {
  const profiles = parseAuthProfiles(pac);
  if (profiles.length === 0) return 0;
  const dupes = selectProfilesToPrune(profiles, keepName, targetName);
  if (dupes.length === 0) return 0;
  log.warn(`Found ${dupes.length} conflicting auth profile(s) from a prior run; removing them to avoid a known pac CLI crash.`);
  let removed = 0;
  for (const d of dupes) {
    const del = SHELL.runSafeCapture(pac, ['auth', 'delete', '--name', d.name]);
    if (del.ok) { log.ok(`Removed stale auth profile ${d.name}`); removed += 1; }
    else log.warn(`Could not remove stale auth profile ${d.name}. If finalize still fails, run \`pac auth clear\` and retry.`);
  }
  return removed;
}

export default {
  meta: {
    number: 5,
    title: 'Environments',
    description: 'Pick your Power Platform environments. We list them automatically using your sign-in from the previous step — choose Dev (required), and optionally Test and Prod. The matching PAC profiles and .env files are created for you.',
    canRunInBrowser: true,
  },

  async questions(state) {
    const pac = SHELL.pacPath();
    const envs = pac ? discoverEnvironments(pac) : [];

    if (envs.length > 0) {
      const baseOptions = envs.map((e) => ({ value: e.url, label: `${e.name} — ${e.url.replace(/^https:\/\//, '')}` }));
      const devOptions = [...baseOptions, { value: MANUAL_ENTRY, label: 'Enter a URL manually…' }];
      const optionalOptions = [{ value: NONE, label: 'None' }, ...baseOptions, { value: MANUAL_ENTRY, label: 'Enter a URL manually…' }];
      const known = (url) => url && baseOptions.some((o) => o.value === url);
      return [
        {
          id: 'DEV_ENV',
          type: 'select',
          label: 'Development environment',
          help: 'Where the app is built, scaffolded, and tested. Required.',
          defaultValue: known(state.PP_ENV_DEV) ? state.PP_ENV_DEV : baseOptions[0].value,
          options: devOptions,
          required: true,
        },
        {
          id: 'DEV_ENV_MANUAL',
          type: 'url',
          label: 'Development environment URL',
          defaultValue: state.PP_ENV_DEV || '',
          validatePattern: 'dataverseUrl',
          required: true,
          showIf: { id: 'DEV_ENV', equals: MANUAL_ENTRY },
        },
        {
          id: 'TEST_ENV',
          type: 'select',
          label: 'Test environment (optional)',
          defaultValue: known(state.PP_ENV_TEST) ? state.PP_ENV_TEST : NONE,
          options: optionalOptions,
        },
        {
          id: 'TEST_ENV_MANUAL',
          type: 'url',
          label: 'Test environment URL',
          defaultValue: state.PP_ENV_TEST || '',
          validatePattern: 'dataverseUrl',
          showIf: { id: 'TEST_ENV', equals: MANUAL_ENTRY },
        },
        {
          id: 'PROD_ENV',
          type: 'select',
          label: 'Production environment (optional)',
          defaultValue: known(state.PP_ENV_PROD) ? state.PP_ENV_PROD : NONE,
          options: optionalOptions,
        },
        {
          id: 'PROD_ENV_MANUAL',
          type: 'url',
          label: 'Production environment URL',
          defaultValue: state.PP_ENV_PROD || '',
          validatePattern: 'dataverseUrl',
          showIf: { id: 'PROD_ENV', equals: MANUAL_ENTRY },
        },
      ];
    }

    // Fallback: discovery returned nothing (e.g. a service principal without
    // environment-list permissions). Fall back to manual URL entry.
    return [
      {
        id: 'DEV_ENV_MANUAL',
        type: 'url',
        label: 'Development environment URL',
        help: 'We could not list environments automatically. Paste the Dev environment URL.',
        defaultValue: state.PP_ENV_DEV || '',
        validatePattern: 'dataverseUrl',
        required: true,
      },
      {
        id: 'TEST_ENV_MANUAL',
        type: 'url',
        label: 'Test environment URL (optional)',
        defaultValue: state.PP_ENV_TEST || '',
        validatePattern: 'dataverseUrl',
      },
      {
        id: 'PROD_ENV_MANUAL',
        type: 'url',
        label: 'Production environment URL (optional)',
        defaultValue: state.PP_ENV_PROD || '',
        validatePattern: 'dataverseUrl',
      },
    ];
  },

  async apply(answers, state, log) {
    const pac = SHELL.pacPath();
    if (!pac) throw new Error('PAC CLI was not found.');

    const authProfileType = state.AUTH_PROFILE_TYPE || 'user';
    const targetKey = state.WIZARD_TARGET_ENV || 'dev';
    const dateStr = new Date().toISOString().slice(0, 10);

    // Resolve each environment from its select value or manual override.
    const resolveUrl = (selectId, manualId) => {
      const sel = answers[selectId];
      if (sel === NONE) return '';
      if (sel === MANUAL_ENTRY || sel === undefined) {
        const raw = String(answers[manualId] || '').trim();
        return raw ? VALIDATE.normalizeDataverseUrl(raw) : '';
      }
      return VALIDATE.normalizeDataverseUrl(String(sel));
    };
    const devUrl = resolveUrl('DEV_ENV', 'DEV_ENV_MANUAL');
    const testUrl = resolveUrl('TEST_ENV', 'TEST_ENV_MANUAL');
    const prodUrl = resolveUrl('PROD_ENV', 'PROD_ENV_MANUAL');

    if (!devUrl) throw new Error('A development environment is required.');
    if (!VALIDATE.isValidDataverseUrl(devUrl)) throw new Error(`"${devUrl}" is not a valid Dataverse URL (expected https://<org>.crm.dynamics.com).`);
    if (testUrl && !VALIDATE.isValidDataverseUrl(testUrl)) throw new Error(`"${testUrl}" is not a valid Dataverse URL.`);
    if (prodUrl && !VALIDATE.isValidDataverseUrl(prodUrl)) throw new Error(`"${prodUrl}" is not a valid Dataverse URL.`);

    log.ok(`Dev: ${devUrl}`);
    if (testUrl) log.ok(`Test: ${testUrl}`);
    if (prodUrl) log.ok(`Prod: ${prodUrl}`);

    // ── User credentials flow ──
    if (authProfileType === 'user') {
      const userProfileName = PAC_TARGET.buildPacProfileName({ rootDir: PROJECT_DIR, targetKey, profileType: 'user', url: devUrl });

      const discoveryIdx = findProfileIndexByName(pac, DISCOVERY_PROFILE_NAME);
      if (discoveryIdx != null) {
        // Pre-flight hygiene FIRST, while auth-store keys are still distinct.
        // Removing same-user/kind duplicates and any existing profile already
        // named `userProfileName` BEFORE we retarget the discovery profile onto
        // Dev prevents the ambiguous (user, env, tenant) store that crashes both
        // `pac auth delete` and `pac auth name` (issues #102 and the recurring
        // "Could not finalize the auth profile" failure). Doing this after
        // `env select` is the original defect — by then the keys already collide.
        pruneConflictingAuthProfiles(log, pac, DISCOVERY_PROFILE_NAME, userProfileName);

        // Retarget the (already-authenticated) discovery profile to Dev, then
        // rename it to the environment-scoped name — no second sign-in.
        SHELL.runSafeCapture(pac, ['auth', 'select', '--name', DISCOVERY_PROFILE_NAME]);
        const sel = SHELL.runSafeCapture(pac, ['env', 'select', '--environment', devUrl]);
        if (!sel.ok) throw new Error(`Could not target ${devUrl}: ${extractPacError(sel)}`);

        // Re-resolve the discovery profile's index against the CURRENT store —
        // never fall back to the pre-prune index, which may now be out of range.
        const renameIdx = findProfileIndexByName(pac, DISCOVERY_PROFILE_NAME);
        if (renameIdx == null) {
          // Idempotent recovery: an interrupted prior run may have already
          // renamed discovery into userProfileName. Accept that and move on.
          if (findProfileIndexByName(pac, userProfileName) != null) {
            SHELL.runSafeCapture(pac, ['auth', 'select', '--name', userProfileName]);
            SHELL.runSafeCapture(pac, ['env', 'select', '--environment', devUrl]);
            log.ok(`Reusing existing profile ${userProfileName} (targeting Dev).`);
          } else {
            throw new Error([
              'Could not finalize the auth profile: the sign-in profile disappeared from the local PAC auth store.',
              'This usually means the store still holds conflicting profiles. Clear them, then click Save & run again:',
              '  pac auth clear',
              '(After clearing you will be asked to sign in once more to recreate a single clean profile.)',
            ].join('\n'));
          }
        } else {
          const renamed = SHELL.runSafeCapture(pac, ['auth', 'name', '--index', String(renameIdx), '--name', userProfileName]);
          // pac writes errors to stdout; check both the result flag and the store.
          const finalized = renamed.ok || findProfileIndexByName(pac, userProfileName) != null;
          if (!finalized) {
            const detail = extractPacError(renamed);
            if (isDuplicateAuthStoreError(detail)) {
              throw new Error([
                'Could not finalize the auth profile: your local PAC auth store has duplicate or dual-active profiles.',
                'This is a known pac CLI bug ("Sequence contains more than one matching element") that crashes `pac auth name`.',
                'Fix it by clearing the local profiles, then click Save & run again:',
                '  pac auth clear',
                '(After clearing you will be asked to sign in once more to recreate a single clean profile.)',
              ].join('\n'));
            }
            throw new Error(`Could not finalize the auth profile: ${detail}`);
          }
          log.ok(`Profile ${userProfileName} ready (targeting Dev).`);
        }
      } else if (findProfileIndexByName(pac, userProfileName) != null) {
        // Re-run after a previous success: discovery was already renamed.
        SHELL.runSafeCapture(pac, ['auth', 'select', '--name', userProfileName]);
        SHELL.runSafeCapture(pac, ['env', 'select', '--environment', devUrl]);
        log.ok(`Reusing existing profile ${userProfileName} (targeting Dev).`);
      } else {
        throw new Error('No sign-in was found. Go back to the previous step, sign in, then return here.');
      }

      // Write .env — 1Password references if configured, otherwise plain URLs.
      const authMode = state.AUTH_MODE || '';
      if (authMode === '1password' && state.OP_VAULT && state.OP_ITEM) {
        const vault = state.OP_VAULT;
        const itemName = state.OP_ITEM;
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
        stateUpdate: { PP_ENV_DEV: devUrl, PP_ENV_TEST: testUrl, PP_ENV_PROD: prodUrl, AUTH_MODE: authMode },
        completedStep: 5,
      };
    }

    // ── Service Principal flow ──
    const secret = getSecret() || recoverSecret();
    if (!secret) throw new Error('Client secret could not be recovered. Go back to the sign-in step and re-enter it.');
    const tenantId = String(state.PP_TENANT_ID || '').trim();
    const clientId = String(state.PP_APP_ID || '').trim();
    if (!tenantId || !clientId) throw new Error('Tenant ID and Client ID are required. Complete the earlier steps first.');
    const authMode = String(state.AUTH_MODE || 'envlocal');

    if (authMode === '1password') {
      const vault = String(state.OP_VAULT || '').trim();
      const itemName = String(state.OP_ITEM || '').trim();
      if (!hasCommand('op')) throw new Error('1Password storage was selected, but the op CLI is not available.');
      if (!vault || !itemName) throw new Error('1Password vault and item name are required.');
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
      try { persistSecretToCache(secret); } catch { /* best-effort */ }
      log.ok('Wrote .env.local');
    }

    log.info('Creating PAC SPN auth profiles...');
    createPacProfile(log, pac, 'dev', devUrl, clientId, secret, tenantId);
    if (testUrl) createPacProfile(log, pac, 'test', testUrl, clientId, secret, tenantId);
    if (prodUrl) createPacProfile(log, pac, 'prod', prodUrl, clientId, secret, tenantId);

    // Remove the transient discovery profile now that env-scoped ones exist.
    SHELL.runSafeCapture(pac, ['auth', 'delete', '--name', DISCOVERY_PROFILE_NAME]);

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

    const opBin = hasCommand('op') ? 'op' : null;
    const credentialValues = PAC_TARGET.resolveCredentialValues({ rootDir: PROJECT_DIR, opBin, source: authMode });
    const verification = PAC_TARGET.selectAndVerifyPacProfile({
      pac,
      rootDir: PROJECT_DIR,
      wizardState: { WIZARD_TARGET_ENV: targetKey, PP_ENV_DEV: devUrl, PP_ENV_TEST: testUrl, PP_ENV_PROD: prodUrl },
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

    return {
      stateUpdate: {
        PP_ENV_DEV: devUrl,
        PP_ENV_TEST: testUrl,
        PP_ENV_PROD: prodUrl,
        AUTH_MODE: authMode,
        HAS_OP: opBin !== null,
      },
      completedStep: 5,
    };
  },
};
