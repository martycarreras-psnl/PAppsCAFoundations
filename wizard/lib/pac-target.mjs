import { existsSync, readFileSync, renameSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { decrypt, isEncrypted } from './crypto.mjs';
import { runSafe } from './shell.mjs';

export const TARGET_ENV_KEYS = ['dev', 'test', 'prod'];

const TARGET_STATE_KEYS = {
  dev: 'PP_ENV_DEV',
  test: 'PP_ENV_TEST',
  prod: 'PP_ENV_PROD',
};

const PROFILE_SCOPES = new Set(['spn', 'user']);
const REPO_SCOPED_PROFILE_RE = /^pp-[a-z0-9]{1,8}-[dtp]-[su]-[a-f0-9]{8}$/;
const TARGET_CODES = { dev: 'd', test: 't', prod: 'p' };
const PROFILE_CODES = { spn: 's', user: 'u' };
const MAX_PAC_PROFILE_NAME_LENGTH = 30;

export function normalizeUrl(url = '') {
  return String(url || '').trim().replace(/\/+$/, '').toLowerCase();
}

export function getTargetStateKey(targetKey) {
  return TARGET_STATE_KEYS[targetKey] || null;
}

export function sanitizeRepoSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.git$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'repo';
}

export function deriveRepoSlug(rootDir) {
  return sanitizeRepoSlug(basename(rootDir || process.cwd()));
}

export function deriveEnvHost(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return normalizeUrl(url)
      .replace(/^https?:\/\//, '')
      .split('/')[0] || 'unknown-host';
  }
}

export function isRepoScopedProfileName(profileName) {
  return REPO_SCOPED_PROFILE_RE.test(String(profileName || ''));
}

function hashFragment(value, length = 8) {
  return createHash('sha1').update(String(value || '')).digest('hex').slice(0, length);
}

function buildRepoToken(rootDir) {
  const compactSlug = deriveRepoSlug(rootDir).replace(/-/g, '') || 'repo';
  if (compactSlug.length <= 8) {
    return compactSlug;
  }

  return `${compactSlug.slice(0, 5)}${hashFragment(compactSlug, 3)}`;
}

export function buildPacProfileName({ rootDir, targetKey, profileType, url }) {
  if (!TARGET_ENV_KEYS.includes(targetKey)) {
    throw new Error(`Unsupported target environment key: ${targetKey}`);
  }
  if (!PROFILE_SCOPES.has(profileType)) {
    throw new Error(`Unsupported PAC profile scope: ${profileType}`);
  }

  const name = [
    'pp',
    buildRepoToken(rootDir),
    TARGET_CODES[targetKey],
    PROFILE_CODES[profileType],
    hashFragment(deriveEnvHost(url), 8),
  ].join('-');

  if (name.length > MAX_PAC_PROFILE_NAME_LENGTH) {
    throw new Error(`Generated PAC profile name exceeds ${MAX_PAC_PROFILE_NAME_LENGTH} characters: ${name}`);
  }

  return name;
}

export function parseEnvFile(filePath) {
  const values = {};
  const contents = readFileSync(filePath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }

  return values;
}

export function hasOpReferences(rootDir) {
  const envPath = join(rootDir, '.env');
  return existsSync(envPath) && /^PP_.*=op:\/\//m.test(readFileSync(envPath, 'utf8'));
}

export function resolveCredentialValues({ rootDir, opBin }) {
  if (hasOpReferences(rootDir)) {
    if (!opBin) {
      throw new Error('1Password references exist in .env, but the op CLI is not available to resolve them.');
    }

    // Parse .env and resolve each op:// reference individually via `op read`.
    // We avoid `op run --env-file` because 1Password's secret-concealment
    // feature replaces values with "<concealed by 1Password>" in subprocess
    // output, which silently breaks credential resolution.
    const envPath = join(rootDir, '.env');
    const rawValues = parseEnvFile(envPath);
    const out = {};

    for (const key of ['PP_TENANT_ID', 'PP_APP_ID', 'PP_CLIENT_SECRET', 'PP_ENV_DEV', 'PP_ENV_TEST', 'PP_ENV_PROD']) {
      const ref = rawValues[key];
      if (!ref) continue;

      if (/^op:\/\//.test(ref)) {
        try {
          out[key] = execFileSync(opBin, ['read', ref], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: rootDir,
          }).trim();
        } catch {
          // Field not found in 1Password — skip optional fields (TEST/PROD)
        }
      } else {
        out[key] = ref;
      }
    }

    return out;
  }

  const envLocalPath = join(rootDir, '.env.local');
  if (!existsSync(envLocalPath)) {
    throw new Error('Neither .env.local nor resolvable 1Password-backed .env could be found.');
  }

  const values = parseEnvFile(envLocalPath);
  if (values.PP_CLIENT_SECRET && isEncrypted(values.PP_CLIENT_SECRET)) {
    values.PP_CLIENT_SECRET = decrypt(values.PP_CLIENT_SECRET);
  }
  return values;
}

export function getWizardTarget(wizardState = {}, explicitTargetKey = '') {
  const targetKey = String(explicitTargetKey || wizardState.WIZARD_TARGET_ENV || 'dev').toLowerCase();
  const stateKey = getTargetStateKey(targetKey);
  if (!stateKey) {
    throw new Error(`Wizard target environment is invalid: ${targetKey}`);
  }

  const url = normalizeUrl(wizardState[stateKey]);
  if (!url) {
    throw new Error(`Wizard target ${targetKey} does not have a resolved environment URL in state key ${stateKey}.`);
  }

  return { targetKey, stateKey, url };
}

export function parsePacOrgWho(output = '') {
  const text = String(output || '');
  const urlMatch = text.match(/https:\/\/[^\s]+\.crm[0-9]*\.dynamics\.com\/?/i);
  const environmentIdMatch = text.match(/Environment\s*Id\s*[:=]\s*([0-9a-f-]{36})/i)
    || text.match(/Environment\s*ID\s*[:=]\s*([0-9a-f-]{36})/i)
    || text.match(/\/e\/([0-9a-f-]{36})\//i);

  return {
    raw: text,
    url: urlMatch ? normalizeUrl(urlMatch[0]) : '',
    environmentId: environmentIdMatch ? environmentIdMatch[1].toLowerCase() : '',
  };
}

export function extractPowerConfigTargetMetadata(config = {}) {
  const environmentUrl = normalizeUrl(
    config.environmentUrl
    || config.environment?.url
    || config.targetEnvironmentUrl
    || config.orgUrl
    || config.dataverseUrl
    || '',
  );

  const appUrl = String(
    config.localAppUrl
    || config.appUrl
    || config.playUrl
    || config.urls?.localAppUrl
    || config.urls?.appUrl
    || '',
  ).trim();

  const directEnvironmentId = String(
    config.environmentId
    || config.environment?.id
    || config.targetEnvironmentId
    || '',
  ).trim().toLowerCase();

  const appUrlEnvironmentIdMatch = appUrl.match(/\/play\/e\/([0-9a-f-]{36})\/app\//i);
  const environmentId = directEnvironmentId || (appUrlEnvironmentIdMatch ? appUrlEnvironmentIdMatch[1].toLowerCase() : '');

  return {
    appId: String(config.appId || '').trim(),
    environmentId,
    environmentUrl,
    appUrl,
    hasTargetMetadata: Boolean(environmentId || environmentUrl),
  };
}

export function loadPowerConfigInfo(powerConfigPath) {
  const info = {
    exists: existsSync(powerConfigPath),
    path: powerConfigPath,
    appId: '',
    environmentId: '',
    environmentUrl: '',
    appUrl: '',
    hasTargetMetadata: false,
    parseError: '',
  };

  if (!info.exists) {
    return info;
  }

  try {
    const config = JSON.parse(readFileSync(powerConfigPath, 'utf8'));
    return { ...info, ...extractPowerConfigTargetMetadata(config) };
  } catch (error) {
    return { ...info, parseError: error.message };
  }
}

export function formatConsistencyError(errors, details) {
  const lines = [
    'PAC target verification failed.',
    ...errors.map((entry) => `- ${entry}`),
    'Diagnostic values:',
    `- Wizard target: ${details.wizardUrl || '(missing)'}`,
    `- Credential source: ${details.credentialUrl || '(missing)'}`,
    `- Active pac org URL: ${details.activeOrgUrl || '(missing)'}`,
    `- Active pac org environment ID: ${details.activeOrgEnvironmentId || '(missing)'}`,
    `- power.config.json URL: ${details.powerConfigUrl || '(missing)'}`,
    `- power.config.json environment ID: ${details.powerConfigEnvironmentId || '(missing)'}`,
    `- power.config.json appId: ${details.powerConfigAppId || '(missing)'}`,
  ];

  return lines.join('\n');
}

export function verifyTargetConsistency({
  wizardState,
  credentialValues,
  whoInfo,
  powerConfigInfo,
  targetKey,
  requireCredentialMatch = true,
  requirePowerConfig = false,
  requirePowerConfigTarget = false,
}) {
  const wizardTarget = getWizardTarget(wizardState, targetKey);
  const credentialUrl = normalizeUrl(credentialValues?.[wizardTarget.stateKey] || '');
  const errors = [];

  if (requireCredentialMatch) {
    if (!credentialUrl) {
      errors.push(`Credential source did not resolve ${wizardTarget.stateKey} for wizard target ${wizardTarget.targetKey}.`);
    } else if (credentialUrl !== wizardTarget.url) {
      errors.push(`Credential source URL ${credentialUrl} does not match wizard target ${wizardTarget.url}.`);
    }
  }

  if (!whoInfo?.url) {
    errors.push('pac org who did not return an environment URL.');
  } else if (normalizeUrl(whoInfo.url) !== wizardTarget.url) {
    errors.push(`Active PAC org URL ${normalizeUrl(whoInfo.url)} does not match wizard target ${wizardTarget.url}.`);
  }

  if (requirePowerConfig && !powerConfigInfo?.exists) {
    errors.push('power.config.json is required for this command, but the file does not exist.');
  }

  // Only compare power.config.json metadata when the caller explicitly requires it.
  // Steps that don't depend on power.config.json (like auth setup) should not fail
  // because a stale power.config.json happens to exist from a previous run.
  const checkPowerConfig = powerConfigInfo?.exists && (requirePowerConfig || requirePowerConfigTarget);

  if (checkPowerConfig) {
    if (powerConfigInfo.parseError) {
      errors.push(`power.config.json could not be parsed: ${powerConfigInfo.parseError}`);
    }
    if (requirePowerConfigTarget && !powerConfigInfo.hasTargetMetadata) {
      errors.push('power.config.json exists but does not expose environment metadata, so the target cannot be verified safely.');
    }
    if (powerConfigInfo.environmentUrl && normalizeUrl(powerConfigInfo.environmentUrl) !== wizardTarget.url) {
      errors.push(`power.config.json URL ${normalizeUrl(powerConfigInfo.environmentUrl)} does not match wizard target ${wizardTarget.url}.`);
    }
    if (powerConfigInfo.environmentId) {
      if (!whoInfo?.environmentId) {
        errors.push('power.config.json exposes an environment ID, but pac org who did not return one to compare against.');
      } else if (powerConfigInfo.environmentId !== whoInfo.environmentId.toLowerCase()) {
        errors.push(`power.config.json environment ID ${powerConfigInfo.environmentId} does not match pac org who environment ID ${whoInfo.environmentId.toLowerCase()}.`);
      }
    }
    if (powerConfigInfo.appId && !powerConfigInfo.hasTargetMetadata) {
      errors.push('power.config.json contains an appId but no environment metadata; the app binding cannot be verified safely.');
    }
  }

  if (errors.length > 0) {
    throw new Error(formatConsistencyError(errors, {
      wizardUrl: wizardTarget.url,
      credentialUrl,
      activeOrgUrl: whoInfo?.url || '',
      activeOrgEnvironmentId: whoInfo?.environmentId || '',
      powerConfigUrl: powerConfigInfo?.environmentUrl || '',
      powerConfigEnvironmentId: powerConfigInfo?.environmentId || '',
      powerConfigAppId: powerConfigInfo?.appId || '',
    }));
  }

  return wizardTarget;
}

export function quarantinePowerConfig(powerConfigPath) {
  const dir = dirname(powerConfigPath);
  const quarantinePath = join(dir, `power.config.quarantine-${Date.now()}.json`);
  renameSync(powerConfigPath, quarantinePath);
  return quarantinePath;
}

export function getWizardStateSnapshot(getValue) {
  return {
    WIZARD_TARGET_ENV: getValue('WIZARD_TARGET_ENV', 'dev'),
    PP_ENV_DEV: getValue('PP_ENV_DEV', ''),
    PP_ENV_TEST: getValue('PP_ENV_TEST', ''),
    PP_ENV_PROD: getValue('PP_ENV_PROD', ''),
  };
}

export function selectAndVerifyPacProfile({
  pac,
  rootDir,
  wizardState,
  targetKey,
  profileType,
  credentialValues,
  powerConfigPath,
  requireCredentialMatch = true,
  requirePowerConfig = false,
  requirePowerConfigTarget = false,
  runSafeImpl = runSafe,
}) {
  const wizardTarget = getWizardTarget(wizardState, targetKey);
  const profileName = buildPacProfileName({
    rootDir,
    targetKey: wizardTarget.targetKey,
    profileType,
    url: wizardTarget.url,
  });

  if (!isRepoScopedProfileName(profileName)) {
    throw new Error(`Refusing to use a non-repo-scoped PAC profile name: ${profileName}`);
  }

  const selected = runSafeImpl(pac, ['auth', 'select', '--name', profileName]);
  if (selected === null) {
    throw new Error(`Required repo-scoped PAC profile does not exist: ${profileName}`);
  }

  const whoOutput = runSafeImpl(pac, ['org', 'who']);
  if (!whoOutput) {
    throw new Error(`pac org who failed after selecting ${profileName}.`);
  }

  const whoInfo = parsePacOrgWho(whoOutput);
  const powerConfigInfo = loadPowerConfigInfo(powerConfigPath);
  verifyTargetConsistency({
    wizardState,
    credentialValues,
    whoInfo,
    powerConfigInfo,
    targetKey: wizardTarget.targetKey,
    requireCredentialMatch,
    requirePowerConfig,
    requirePowerConfigTarget,
  });

  return {
    profileName,
    wizardTarget,
    whoInfo,
    powerConfigInfo,
  };
}