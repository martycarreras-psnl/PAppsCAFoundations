import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readJson, projectPath, resolveLocalPa, runPa, runBuild, packageManager, TARGETS_FILE } from './pa.mjs';
import { firstCommandPath, prepareFileCommand } from './shell.mjs';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENVIRONMENT = /^(?:Default-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOUDS = { public: 'prod', usgov: 'gccmoderate', usgovhigh: 'gcchigh', usgovdod: 'dod', china: 'mooncake' };
const DISCOVERY = {
  public: 'https://globaldisco.crm.dynamics.com',
  usgov: 'https://globaldisco.crm9.dynamics.com',
  usgovhigh: 'https://globaldisco.crm.microsoftdynamics.us',
  usgovdod: 'https://globaldisco.crm.appsplatform.us',
  china: 'https://globaldisco.crm.dynamics.cn',
};
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

export function parseDeployArgs(args) {
  const options = { target: 'dev', auth: 'user', preflight: false, allowCreate: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (seen.has(key)) throw new Error(`Duplicate argument: ${key}`);
    seen.add(key);
    if (key === '--preflight') options.preflight = true;
    else if (key === '--allow-create') options.allowCreate = true;
    else if (key === '--target' || key === '--auth') {
      const value = args[++i];
      if (!value || value.startsWith('-')) throw new Error(`Missing value for ${key}`);
      options[key.slice(2)] = value;
    } else throw new Error(`Unsupported deployment argument: ${key}`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(options.target)) throw new Error('Invalid target name.');
  if (!['user', 'spn'].includes(options.auth)) throw new Error('Auth must be user or spn.');
  if (options.auth === 'spn' && options.allowCreate) throw new Error('SPN publishing can only update an existing app.');
  return options;
}

function requireId(value, name, pattern = GUID) {
  if (typeof value !== 'string' || !pattern.test(value) || /^(?:Default-)?0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(value)) {
    throw new Error(`${name} must be a valid nonzero ${pattern === ENVIRONMENT ? 'environment ID' : 'GUID'}.`);
  }
}

function targetSnapshot(root) {
  return {
    config: readFileSync(join(root, 'power.config.json'), 'utf8'),
    targets: readFileSync(join(root, TARGETS_FILE), 'utf8'),
  };
}

export function loadTarget(root, options, snapshot = targetSnapshot(root)) {
  if (!['user', 'spn'].includes(options.auth)) throw new Error('Auth must be explicitly user or spn.');
  if (options.auth === 'spn' && options.allowCreate) throw new Error('SPN publishing can only update an existing app.');
  let document, config;
  try {
    document = JSON.parse(snapshot.targets);
    config = JSON.parse(snapshot.config);
  } catch {
    throw new Error('Deployment targets and power.config.json must contain valid JSON.');
  }
  if (document.version !== 1 || !document.targets || !Object.hasOwn(document.targets, options.target)) {
    throw new Error(`Missing version 1 deployment target "${options.target}" in ${TARGETS_FILE}.`);
  }
  const target = document.targets[options.target];
  if (!target || typeof target !== 'object') throw new Error('Deployment target must be an object.');
  requireId(target.environmentId, 'environmentId', ENVIRONMENT);
  requireId(target.tenantId, 'tenantId');
  requireId(target.solutionId, 'solutionId');
  if (!/^[a-z][a-z0-9_]*$/i.test(target.solutionName || '') || /^(default|commondataservicedefaultsolution)$/i.test(target.solutionName)) {
    throw new Error('solutionName must identify a dedicated solution, not the Default solution.');
  }
  let url;
  try { url = new URL(target.environmentUrl); } catch { throw new Error('environmentUrl must be a valid HTTPS organization URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('environmentUrl must be an HTTPS organization origin without credentials or query.');
  }
  if (!Object.hasOwn(CLOUDS, target.cloud || 'public')) throw new Error('Unsupported target cloud.');
  if (options.auth === 'user' && !/^[^\s@]+@[^\s@]+$/.test(target.account || '')) throw new Error('User publishing requires an explicit expected account.');
  if (target.appId) requireId(target.appId, 'appId');
  else if (!options.allowCreate) throw new Error('Missing appId: first user publish requires explicit --allow-create.');
  if (options.auth === 'spn') requireId(target.spnClientId, 'spnClientId');
  if (!equal(config.environmentId, target.environmentId)) throw new Error('power.config.json environment does not match the deployment target.');
  if ((config.appId || '') !== (target.appId || '') && !equal(config.appId, target.appId)) throw new Error('power.config.json app identity does not match the deployment target.');
  if ((config.region || 'prod') !== CLOUDS[target.cloud || 'public']) throw new Error('power.config.json cloud does not match the deployment target.');
  if (config.appType && config.appType !== 'CodeApp') throw new Error('Only CodeApp deployment is supported.');
  if (config.localAppUrl && config.localAppUrl !== 'http://localhost:3000') throw new Error('Code App localAppUrl must use http://localhost:3000.');
  const buildPath = projectPath(root, config.buildPath || './dist', 'buildPath');
  const entryPath = projectPath(buildPath, config.buildEntryPoint || 'index.html', 'buildEntryPoint');
  return { document, target, config, buildPath, entryPath };
}

export function deploymentEnv(target, auth, ambient) {
  const allowed = new Set(['PA_CLI_TELEMETRY']);
  if (auth === 'spn') for (const key of ['PA_CLI_USE_SP_AUTH', 'PA_CLI_SP_TENANT_ID', 'PA_CLI_SP_CLIENT_ID', 'PA_CLI_SP_CLIENT_SECRET']) allowed.add(key);
  for (const [key, value] of Object.entries(ambient)) {
    if (key.toUpperCase().startsWith('PA_CLI_') && value !== undefined && !allowed.has(key)) {
      throw new Error(`Remove ambient ${key}; deployment configuration must be explicit and unambiguous.`);
    }
    if (key.toUpperCase() === 'CI' && key !== 'CI') throw new Error('Use canonical CI casing; mixed-case environment variables are ambiguous on Windows.');
  }
  if (auth === 'user' && ambient.CI === 'true') throw new Error('CI=true implicitly selects SPN in pa; use explicit --auth spn or unset CI for user publishing.');
  if (auth === 'spn') {
    if (ambient.PA_CLI_USE_SP_AUTH !== 'true') throw new Error('SPN publishing requires explicit PA_CLI_USE_SP_AUTH=true.');
    if (!equal(ambient.PA_CLI_SP_TENANT_ID, target.tenantId) || !equal(ambient.PA_CLI_SP_CLIENT_ID, target.spnClientId)) throw new Error('SPN tenant/client identity does not match the reviewed target.');
    if (!ambient.PA_CLI_SP_CLIENT_SECRET?.trim()) throw new Error('PA_CLI_SP_CLIENT_SECRET is required from a secret store.');
  }
  return { ...ambient };
}

export function assertAccount(status, target) {
  const account = status?.activeAccount;
  if (status?.success !== true || !status?.signedIn || !equal(account?.username, target.account)) {
    throw new Error('The active pa account does not match the target. Run project-local pa auth login/switch explicitly, then retry.');
  }
  if (typeof account.homeAccountId !== 'string' || !account.homeAccountId) throw new Error('The pa account has no stable account identity.');
  return account.homeAccountId;
}

export function assertEnvironmentDiscovery(response, target) {
  const matches = Array.isArray(response?.value) ? response.value.filter(instance => equal(instance?.EnvironmentId, target.environmentId)) : [];
  if (matches.length !== 1 || !equal(matches[0].TenantId, target.tenantId) ||
      !equal(String(matches[0].Url || '').replace(/\/$/, ''), target.environmentUrl.replace(/\/$/, ''))) {
    throw new Error('Global Discovery did not prove the expected environment ID, organization URL and resource tenant. Publish refused; verify the target and your separate Azure CLI discovery access. Disabled accounts, security-group exclusions and delegated-admin access can produce no discovery rows.');
  }
}

export function discoveryCommand(target) {
  const resource = DISCOVERY[target.cloud || 'public'];
  if (!resource) throw new Error('Unsupported discovery cloud.');
  requireId(target.environmentId, 'environmentId', ENVIRONMENT);
  const url = new URL(`${resource}/api/discovery/v2.0/Instances`);
  url.searchParams.set('$select', 'EnvironmentId,TenantId,Url');
  url.searchParams.set('$filter', `EnvironmentId eq '${target.environmentId}'`);
  // Let az encode the query. Percent-encoded URLs passed through az.cmd can
  // otherwise be interpreted as Windows environment-variable expansions.
  const query = [...url.searchParams].map(([key, value]) => `${key}=${value}`);
  url.search = '';
  return ['rest', '--method', 'GET', '--url', url.href, '--url-parameters', ...query, '--resource', resource, '--output', 'json', '--only-show-errors'];
}

export function discoverEnvironment(target, { root, env, execute = execFileSync } = {}) {
  const args = discoveryCommand(target);
  let az;
  try {
    az = firstCommandPath(execute(process.platform === 'win32' ? 'where' : 'which', ['az'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch {
    throw new Error('Azure CLI was not found on PATH. Install or repair its PATH before user-publish discovery. No login or publish was attempted.');
  }
  if (!az) throw new Error('Azure CLI lookup returned no executable. Repair PATH before user-publish discovery.');
  const command = prepareFileCommand(az, args);
  let text;
  try {
    text = execute(command.file, command.args, {
      cwd: root, env, shell: command.shell, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000,
    });
  } catch (error) {
    const code = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? `code ${error.code}` : '';
    const exit = Number.isInteger(error.status) ? `exit ${error.status}` : '';
    const signal = typeof error.signal === 'string' && /^SIG[A-Z]+$/.test(error.signal) ? `signal ${error.signal}` : '';
    // Describe known failure classes without reproducing credential-bearing stderr.
    const stderr = String(error.stderr || '');
    const context = error.code === 'ETIMEDOUT' ? 'request timed out'
      : /\b403\b|Forbidden/i.test(stderr) ? 'HTTP 403 / discovery access denied'
        : /\b401\b|Unauthorized/i.test(stderr) ? 'HTTP 401 / Azure authentication rejected'
          : /az login|not logged in|AADSTS/i.test(stderr) ? 'Azure authentication is unavailable or expired'
            : 'Global Discovery request failed';
    throw new Error(`${context}${[code, exit, signal].filter(Boolean).length ? ` (${[code, exit, signal].filter(Boolean).join(', ')})` : ''}. Check separate Azure CLI sign-in, environment discovery access and network connectivity. No login, permission grant or publish was attempted by this check.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Global Discovery returned invalid JSON despite a successful Azure CLI exit. Publish refused; check the Azure CLI output format/version. Response content was not logged.');
  }
}

export function verifyBuild(root, entryPath) {
  if (!existsSync(entryPath)) throw new Error('Build did not produce the configured HTML entry point.');
  const html = readFileSync(entryPath, 'utf8');
  if (/\b(?:src|href)\s*=\s*["']\/(?!\/)/i.test(html)) throw new Error('Built assets use root-relative URLs. Set the production Vite base to "./".');
  const scan = directory => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'generated' || entry.name === 'node_modules') continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (/\.[jt]sx?$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) {
        const code = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
        if (/import\s*\{[^}]*\b(?:BrowserRouter|createBrowserRouter)\b[^}]*\}\s*from\s*['"]react-router-dom['"]/.test(code) || /<\s*BrowserRouter\b|\bcreateBrowserRouter\s*\(/.test(code)) {
          throw new Error('BrowserRouter is not supported in Power Apps. Use HashRouter before publishing.');
        }
      }
    }
  };
  scan(join(root, 'src'));
}

export function deploy({ root = process.cwd(), options, env = process.env, pa = runPa, build = runBuild, resolveCli = resolveLocalPa, discovery = discoverEnvironment }) {
  const snapshot = targetSnapshot(root);
  const initial = loadTarget(root, options, snapshot);
  const unchanged = () => {
    const current = targetSnapshot(root);
    if (current.config !== snapshot.config || current.targets !== snapshot.targets) {
      throw new Error('Deployment identity/configuration changed during preflight/build/auth. Review and retry.');
    }
    loadTarget(root, options, snapshot);
  };
  resolveCli(root);
  packageManager(root);
  if (typeof readJson(join(root, 'package.json')).scripts?.build !== 'string') throw new Error('Missing package.json build script.');
  const childEnv = deploymentEnv(initial.target, options.auth, env);
  unchanged();
  const args = ['app', 'push', '--solution-id', initial.target.solutionId, '--non-interactive'];
  if (options.preflight) return { preflight: true, args, target: options.target, auth: options.auth };
  // Secrets are needed by pa only, not Vite or arbitrary lifecycle scripts.
  const buildEnv = Object.fromEntries(Object.entries(childEnv).filter(([key]) => !key.startsWith('PA_CLI_SP_')));
  build(root, buildEnv);
  unchanged();
  verifyBuild(root, initial.entryPath);
  const invoke = args => pa(args, { root, env: childEnv, capture: true });
  let selectedAccount;
  const account = () => {
    if (options.auth === 'user') {
      let status;
      try { status = JSON.parse(invoke(['auth', 'status', '--json', '--non-interactive'])); } catch { throw new Error('Unable to verify pa authentication status. Run project-local pa auth login explicitly.'); }
      const identity = assertAccount(status, initial.target);
      if (selectedAccount && selectedAccount !== identity) throw new Error('The selected pa account identity changed during deployment.');
      selectedAccount = identity;
    }
    unchanged();
  };
  account();
  if (options.auth === 'user') {
    assertEnvironmentDiscovery(discovery(initial.target, { root, env: childEnv }), initial.target);
    unchanged();
  }
  let solutions;
  try { solutions = JSON.parse(invoke(['solution', 'list', '--json', '--non-interactive'])); } catch { throw new Error('Unable to verify the solution in the configured environment; publish refused.'); }
  if (solutions?.success !== true || !Array.isArray(solutions.items) || !solutions.items.some(solution => equal(solution.solutionid, initial.target.solutionId) && solution.uniquename === initial.target.solutionName && solution.ismanaged !== true)) {
    throw new Error('Expected dedicated unmanaged solution GUID/name was not found in the configured environment.');
  }
  account();
  pa(args, { root, env: childEnv });
  const after = readJson(join(root, 'power.config.json'));
  if (!equal(after.environmentId, initial.target.environmentId)) throw new Error('Publish returned a changed environment. Inspect cloud outcome before retrying.');
  requireId(after.appId, 'published appId');
  if (initial.target.appId && !equal(after.appId, initial.target.appId)) throw new Error('Publish returned an unexpected appId. Inspect cloud outcome before retrying.');
  if (!initial.target.appId) {
    if (readFileSync(join(root, TARGETS_FILE), 'utf8') !== snapshot.targets) throw new Error('Target changed during publish; record the new appId manually after review.');
    initial.document.targets[options.target].appId = after.appId;
    writeFileSync(join(root, TARGETS_FILE), `${JSON.stringify(initial.document, null, 2)}\n`);
  }
  return { preflight: false, appId: after.appId };
}
