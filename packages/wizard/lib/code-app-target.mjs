import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { binName, loadPacafConfig } from './pacaf-config.mjs';
import { assertEnvironmentDiscovery, discoverEnvironment } from '@pacaf/scripts/lib/pa-deploy.mjs';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENVIRONMENT_ID = /^(?:Default-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '').toLowerCase();
export const PA_AUTH_BUILD_GUIDANCE = 'If dependency build scripts were blocked, review pnpm approve-builds or npm approve-scripts according to your package-manager policy. Approve only reviewed dependencies, then reinstall/rebuild as that policy requires. CLI --version/help and app builds do not verify native authentication dependencies.';

export function codeAppAuthFailure(output = '') {
  const native = /keytar|msal-node-(?:extensions|runtime)|ERR_DLOPEN_FAILED|Cannot find module|native.*(?:module|binding)|Could not locate.*bindings/i.test(String(output));
  return `${native ? 'Power Apps CLI authentication could not load a native dependency.' : 'Power Apps CLI authentication command failed; sign-in was not verified.'} ${PA_AUTH_BUILD_GUIDANCE}`;
}

export function parseCodeAppAuthStatus(result) {
  if (!result?.ok) throw new Error(codeAppAuthFailure(`${result?.stdout || ''}\n${result?.stderr || ''}`));
  let status;
  try { status = JSON.parse(result.stdout); } catch {
    throw new Error(`Power Apps CLI returned unreadable authentication status; sign-in was not verified. ${PA_AUTH_BUILD_GUIDANCE}`);
  }
  if (status?.success !== true) throw new Error(codeAppAuthFailure(result.stdout));
  return status;
}

export function localCodeAppTool(projectDir, suffix = 'pa', config = loadPacafConfig()) {
  const executable = join(projectDir, 'node_modules', '.bin', `${binName(suffix, config)}${process.platform === 'win32' ? '.cmd' : ''}`);
  if (!existsSync(executable)) throw new Error(`Missing project-local ${binName(suffix, config)}. Install the project dependencies; no global or npx fallback is used.`);
  return executable;
}

export function assertNoPaOverrides(env = process.env) {
  const overrides = Object.keys(env).filter((key) => /^PA_CLI_/i.test(key) && env[key] !== undefined);
  if (overrides.length) throw new Error(`Remove ambient Power Apps CLI overrides before wizard setup: ${overrides.join(', ')}. Deployment SPN authentication is a separate opt-in workflow.`);
  if (Object.keys(env).some((key) => /^CI$/i.test(key) && env[key] && !/^(?:false|0)$/i.test(String(env[key])))) {
    throw new Error('CI=true is incompatible with the wizard user-auth path: the Power Apps CLI can select SPN authentication automatically. Unset CI for interactive setup; use guarded deployment for intentional automation.');
  }
}

export function codeAppUserEnv(env = process.env) {
  assertNoPaOverrides(env);
  const userEnv = { ...env };
  for (const key of Object.keys(userEnv)) if (/^CI$/i.test(key)) delete userEnv[key];
  return userEnv;
}

export function codeAppCloud(config = {}) {
  const regions = { public: 'prod', usgov: 'gccmoderate', usgovhigh: 'gcchigh', usgovdod: 'dod', china: 'mooncake' };
  const cloud = Object.keys(regions).find((name) => regions[name] === (config.region || 'prod'));
  if (!cloud) throw new Error('Unsupported Code App cloud; existing configuration was preserved.');
  return cloud;
}

export function verifyCodeAppResourceTenant(target, { root, env, discovery = discoverEnvironment } = {}) {
  assertEnvironmentDiscovery(discovery(target, { root, env }), target);
}

export function codeAppInitArgs(appName, environmentId) {
  if (!ENVIRONMENT_ID.test(environmentId)) throw new Error('A verified environment GUID (or Default-GUID) is required to initialize a Code App.');
  return ['app', 'init', '--display-name', appName, '--environment-id', environmentId,
    '--build-path', './dist', '--file-entry-point', 'index.html', '--app-url', 'http://localhost:3000'];
}

export function readExistingCodeApp(projectDir, environmentId) {
  if (!ENVIRONMENT_ID.test(environmentId || '')) throw new Error('A verified environment GUID (or Default-GUID) is required; existing Code App configuration was preserved.');
  const path = join(projectDir, 'power.config.json');
  if (!existsSync(path)) return null;
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (!ENVIRONMENT_ID.test(config.environmentId || '') || config.environmentId.toLowerCase() !== environmentId.toLowerCase()) {
    throw new Error('Existing power.config.json does not match the verified environment. It was preserved; correct the selected target instead of reinitializing the app.');
  }
  if (config.appId && !GUID.test(config.appId)) throw new Error('Existing power.config.json has an invalid appId; it was preserved.');
  return config;
}

export function codeAppAccount(authStatus, expectedTenantId, expectedAccount = '') {
  const active = authStatus?.activeAccount;
  if (authStatus?.success !== true || !authStatus?.signedIn || typeof active?.username !== 'string' || !active.username.trim() || typeof active?.homeAccountId !== 'string') {
    throw new Error('Power Apps CLI has no active account. Run npm run pa -- auth login, then npm run pa -- auth status --json. PAC auth profiles do not sign in pa.');
  }
  if (!GUID.test(expectedTenantId || '')) throw new Error('The selected resource tenant must be a GUID; account status does not verify this tenant.');
  if (expectedAccount && active.username.toLowerCase() !== expectedAccount.trim().toLowerCase()) {
    throw new Error('Power Apps CLI active account does not match the selected account. Run npm run pa -- auth switch --account <email>, or sign in again.');
  }
  // This is the intended target tenant, not a claim about the account's token.
  return { account: active.username, tenantId: expectedTenantId.toLowerCase() };
}

export function persistCodeAppTarget({ projectDir, targetKey = 'dev', environmentId, environmentUrl, tenantId, authStatus, solutions, solutionId, solutionName, allowCreate = false }) {
  if (!['dev', 'test', 'prod'].includes(targetKey)) throw new Error('Unsupported deployment target.');
  if (!ENVIRONMENT_ID.test(environmentId || '') || (solutionId && !GUID.test(solutionId)) || !solutionName) throw new Error('Verified environment and solution GUIDs and solution unique name are required.');
  const url = normalizeUrl(environmentUrl);
  if (!/^https:\/\/[a-z0-9.-]+$/.test(url)) throw new Error('An HTTPS environment URL is required.');
  const config = readExistingCodeApp(projectDir, environmentId);
  if (!config) throw new Error('power.config.json is required before recording the deployment target.');
  if (!config.appId && !allowCreate) throw new Error('An unpublished app requires explicit first-publish consent.');
  const rows = solutions?.success === true ? solutions.items : null;
  const matches = Array.isArray(rows) ? rows.filter((entry) => entry.uniquename === solutionName) : [];
  const solution = matches.length === 1 ? matches[0] : null;
  if (!solution || !GUID.test(solution.solutionid || '') || (solutionId && solution.solutionid.toLowerCase() !== solutionId.toLowerCase())) {
    throw new Error('The selected solution GUID/name could not be verified in the configured environment. Refusing to record a deployment target.');
  }
  const identity = codeAppAccount(authStatus, tenantId);
  const target = { environmentId: environmentId.toLowerCase(), environmentUrl: url, ...identity, cloud: codeAppCloud(config),
    appId: config.appId || '', solutionId: solution.solutionid.toLowerCase(), solutionName };
  const path = join(projectDir, '.power-apps-targets.json');
  const saved = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { version: 1, targets: {} };
  if (saved.version !== 1 || !saved.targets || Array.isArray(saved.targets)) throw new Error('Unsupported .power-apps-targets.json format; existing file preserved.');
  const previous = saved.targets[targetKey];
  if (previous && Object.keys(target).some((key) => (key === 'cloud' ? previous[key] || 'public' : previous[key]) !== target[key])) {
    throw new Error('Durable deployment target differs from the selected identity. Existing target preserved; review the target file explicitly.');
  }
  saved.targets[targetKey] = { ...previous, ...target };
  writeFileSync(path, `${JSON.stringify(saved, null, 2)}\n`);
  return target;
}
