import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertNoPaOverrides, codeAppAccount, codeAppAuthFailure, codeAppCloud, codeAppInitArgs, codeAppUserEnv, localCodeAppTool, parseCodeAppAuthStatus, persistCodeAppTarget, readExistingCodeApp, verifyCodeAppResourceTenant } from '../lib/code-app-target.mjs';
import { buildRequiredDevPackages, buildRequiredScripts, createMinimalProject, dependencyInstallPasses, dependencyLockfileArgs, REQUIRED_RUNTIME_PACKAGES, restoreDependencySpecs } from '../lib/scaffold-foundations.mjs';

const environmentId = '11111111-1111-1111-1111-111111111111';
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const tenantId = '22222222-2222-2222-2222-222222222222';
const solutionId = '33333333-3333-3333-3333-333333333333';
const appId = '44444444-4444-4444-4444-444444444444';
const authStatus = { success: true, signedIn: true, activeAccount: { username: 'maker@example.test', homeAccountId: `55555555-5555-5555-5555-555555555555.${tenantId}` } };
const solutions = { success: true, items: [{ solutionid: solutionId, uniquename: 'ExampleSolution' }] };

function project(t, config = { environmentId, appId, connectionReferences: { untouched: true } }) {
  const dir = resolve(`.wizard-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'power.config.json'), JSON.stringify(config));
  return dir;
}
function target(projectDir, overrides = {}) {
  return { projectDir, environmentId, environmentUrl: 'https://example.crm.dynamics.com', tenantId, authStatus, solutions, solutionId, solutionName: 'ExampleSolution', ...overrides };
}

test('scaffold pins SDK/CLI independently and keeps the two-server topology and mock mode', (t) => {
  const dir = project(t);
  createMinimalProject(dir, 'Example');
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json')));
  assert.equal(pkg.engines.node, '^22.0.0 || ^24.0.0');
  assert.equal(pkg.dependencies['@microsoft/power-apps'], '1.4.0');
  assert.equal(pkg.devDependencies['@microsoft/power-apps-cli'], '1.0.2');
  assert.equal(REQUIRED_RUNTIME_PACKAGES['@microsoft/power-apps-cli'], undefined);
  assert.equal(buildRequiredDevPackages()['@microsoft/power-apps'], undefined);
  assert.match(pkg.scripts.dev, /^concurrently --kill-others-on-fail "vite --port 3000 --strictPort" "pacaf-pa app run --config-only --port 8080 --local-app-url http:\/\/localhost:3000"$/);
  assert.match(pkg.scripts['dev:mock'], /VITE_USE_MOCK=true/);
  assert.doesNotMatch(pkg.scripts['dev:mock'], /\bpa\b|pacaf-pa/);
  assert.equal(pkg.scripts.deploy, 'pacaf-deploy --target dev');
  assert.equal(buildRequiredScripts({ binPrefix: 'contoso' }).pa, 'contoso-pa');
  assert.match(buildRequiredScripts({ binPrefix: 'contoso' }).dev, /contoso-pa app run/);
});

test('init translates options without legacy PAC flags', () => {
  assert.deepEqual(codeAppInitArgs('Example', environmentId), ['app', 'init', '--display-name', 'Example', '--environment-id', environmentId, '--build-path', './dist', '--file-entry-point', 'index.html', '--app-url', 'http://localhost:3000']);
  assert.throws(() => codeAppInitArgs('Example', 'not-a-guid'), /verified environment GUID/);
  assert.ok(codeAppInitArgs('Example', `Default-${environmentId}`).includes(`Default-${environmentId}`));
});

test('both package managers retain exact Power Apps pins during later dependency additions', () => {
  assert.deepEqual(dependencyInstallPasses({ packages: ['react@^18.3.1', '@microsoft/power-apps@1.4.0'] }),
    [['install', 'react@^18.3.1'], ['install', '--save-exact', '@microsoft/power-apps@1.4.0']]);
  assert.deepEqual(dependencyInstallPasses({ pnpm: true, dev: true, workspaceRoot: true, packages: ['vite@^5.4.0', '@microsoft/power-apps-cli@1.0.2'] }),
    [['add', '-D', '-w', 'vite@^5.4.0'], ['add', '--save-exact', '-D', '-w', '@microsoft/power-apps-cli@1.0.2']]);
  assert.deepEqual(dependencyLockfileArgs(), ['install', '--package-lock-only']);
  assert.deepEqual(dependencyLockfileArgs(true), ['install', '--lockfile-only']);
});

test('dependency restoration preserves declared ranges and unrelated package policy', (t) => {
  const dir = project(t);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    engines: { node: '^24' }, dependencies: { react: '18.3.1', custom: '~2.0.0' },
    devDependencies: { '@microsoft/power-apps-cli': '^1.0.2' },
  }));
  restoreDependencySpecs(dir, ['react@^18.3.1', '@fluentui/react-components@^9.56.0']);
  restoreDependencySpecs(dir, ['@microsoft/power-apps-cli@1.0.2'], { dev: true });
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.dependencies, { react: '^18.3.1', custom: '~2.0.0', '@fluentui/react-components': '^9.56.0' });
  assert.equal(pkg.devDependencies['@microsoft/power-apps-cli'], '1.0.2');
  assert.equal(pkg.engines.node, '^24');
});

test('Default-GUID environments and optional durable fields survive reruns', (t) => {
  const defaultEnvironment = `Default-${environmentId}`;
  const dir = project(t, { environmentId: defaultEnvironment, appId });
  persistCodeAppTarget(target(dir, { environmentId: defaultEnvironment }));
  const path = join(dir, '.power-apps-targets.json');
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  saved.targets.dev.cloud = 'public';
  saved.targets.dev.accountId = authStatus.activeAccount.homeAccountId;
  writeFileSync(path, JSON.stringify(saved));
  persistCodeAppTarget(target(dir, { environmentId: defaultEnvironment }));
  const result = JSON.parse(readFileSync(path, 'utf8')).targets.dev;
  assert.equal(result.environmentId, defaultEnvironment.toLowerCase());
  assert.equal(result.cloud, 'public');
  assert.equal(result.accountId, authStatus.activeAccount.homeAccountId);
});

test('existing config and connector bindings are never modified on matching or mismatching targets', (t) => {
  const dir = project(t);
  const before = readFileSync(join(dir, 'power.config.json'), 'utf8');
  assert.equal(readExistingCodeApp(dir, environmentId).appId, appId);
  assert.throws(() => readExistingCodeApp(dir, solutionId), /preserved/);
  persistCodeAppTarget(target(dir));
  persistCodeAppTarget(target(dir, { solutionId: '' }));
  assert.equal(readFileSync(join(dir, 'power.config.json'), 'utf8'), before);
  const saved = JSON.parse(readFileSync(join(dir, '.power-apps-targets.json')));
  assert.deepEqual(saved.targets.dev, { environmentId, environmentUrl: 'https://example.crm.dynamics.com', tenantId, account: 'maker@example.test', cloud: 'public', appId, solutionId, solutionName: 'ExampleSolution' });
  persistCodeAppTarget(target(dir));
  assert.throws(() => persistCodeAppTarget(target(dir, { solutionName: 'OtherSolution' })), /could not be verified/);
});

test('new app identity requires explicit consent and existing durable identity cannot drift', (t) => {
  const dir = project(t, { environmentId, appId: '' });
  assert.throws(() => persistCodeAppTarget(target(dir)), /explicit first-publish consent/);
  persistCodeAppTarget(target(dir, { allowCreate: true }));
  const before = readFileSync(join(dir, '.power-apps-targets.json'), 'utf8');
  assert.throws(() => persistCodeAppTarget(target(dir, { allowCreate: true, authStatus: { ...authStatus, activeAccount: { ...authStatus.activeAccount, username: 'other@example.test' } } })), /Existing target preserved/);
  assert.equal(readFileSync(join(dir, '.power-apps-targets.json'), 'utf8'), before);
});

test('missing, malformed, unauthenticated, invalid tenant and unverified solution inputs fail closed', (t) => {
  const dir = project(t);
  assert.throws(() => codeAppAccount(null, tenantId), /no active account/);
  assert.throws(() => codeAppAccount(authStatus, 'not-a-tenant'), /selected resource tenant must be a GUID/);
  assert.throws(() => codeAppAccount(authStatus, tenantId, 'different@example.test'), /selected account/);
  assert.equal(codeAppAccount(authStatus, tenantId, 'MAKER@example.test').account, 'maker@example.test');
  assert.throws(() => persistCodeAppTarget(target(dir, { solutionId: 'ExampleSolution' })), /GUIDs/);
  assert.throws(() => persistCodeAppTarget(target(dir, { solutions: { success: true, items: [] } })), /could not be verified/);
  assert.throws(() => persistCodeAppTarget(target(dir, { solutions: { success: false, items: solutions.items } })), /could not be verified/);
  assert.throws(() => localCodeAppTool(dir), /Missing project-local/);
  assert.throws(() => assertNoPaOverrides({ PA_CLI_ENVIRONMENT_ID: environmentId }), /ambient/);
  assertNoPaOverrides({});
});

test('both wizard frontends preserve initialization identity and delegate deployment to the guarded helper', () => {
  for (const path of ['packages/wizard/steps/07-scaffold.mjs', 'packages/wizard-ux/server/steps/08-scaffold.mjs']) {
    const source = readFileSync(join(repoRoot, path), 'utf8');
    assert.match(source, /readExistingCodeApp/);
    assert.match(source, /if \(!existing &&/);
    assert.match(source, /persistCodeAppTarget/);
    for (const stage of ['Base', 'Runtime', 'Dev']) assert.match(source, new RegExp(`throw new Error\\(\\x60\\[[123]\\/3\\] ${stage} dependency install failed`));
    assert.doesNotMatch(source, /tolerateIgnoredBuilds|continuing to merge required packages|Some (?:runtime|dev )?packages failed to install/);
    assert.match(source, /'auth', 'login', '--account', paAccount/);
    assert.match(source, /codeAppAccount\(authStatus, (?:stateGet\('PP_TENANT_ID'\)|state\.PP_TENANT_ID), paAccount\)/);
    assert.doesNotMatch(source, /quarantinePowerConfig|--displayName|--buildPath|--fileEntryPoint|\['code', 'init'/);
  }
  for (const path of ['packages/wizard/steps/08-verify-deploy.mjs', 'packages/wizard-ux/server/steps/09-verify-deploy.mjs']) {
    const source = readFileSync(join(repoRoot, path), 'utf8');
    assert.match(source, /localCodeAppTool\(projectDir, 'deploy'\)/);
    assert.match(source, /--allow-create/);
    assert.doesNotMatch(source, /selectAndVerifyPacProfile|\['code', 'push'|quarantinePowerConfig/);
    assert.match(source, /throw new Error\('Guarded deployment failed/);
  }
});

test('native auth failures surface dependency-build review, never a false unsigned-in or success result', () => {
  for (const stderr of [
    "Cannot find module '../build/Release/keytar.node'",
    'ERR_DLOPEN_FAILED loading @azure/msal-node-runtime',
    'Could not locate the bindings file for msal-node-extensions',
  ]) {
    assert.throws(() => parseCodeAppAuthStatus({ ok: false, stdout: '', stderr }), (error) => {
      assert.match(error.message, /could not load a native dependency/);
      assert.match(error.message, /pnpm approve-builds or npm approve-scripts/);
      assert.doesNotMatch(error.message, /has no active account/);
      return true;
    });
  }
  assert.throws(() => parseCodeAppAuthStatus({ ok: true, stdout: 'not JSON' }), /unreadable authentication status/);
  assert.throws(() => parseCodeAppAuthStatus({ ok: true, stdout: '{"success":false}' }), /sign-in was not verified/);
  assert.deepEqual(parseCodeAppAuthStatus({ ok: true, stdout: JSON.stringify(authStatus) }), authStatus);
  assert.match(codeAppAuthFailure('network error'), /sign-in was not verified/);
});

test('wizard user environment rejects all case-insensitive PA overrides and CI authentication selection', () => {
  for (const name of ['PA_CLI_USE_NOOP_AUTH', 'pa_cli_environment_id', 'Pa_Cli_Use_Sp_Auth', 'PA_CLI_UNKNOWN_FUTURE_OVERRIDE']) {
    assert.throws(() => codeAppUserEnv({ [name]: 'true' }), /Remove ambient Power Apps CLI overrides/);
    assert.throws(() => codeAppUserEnv({ [name]: '' }), /Remove ambient Power Apps CLI overrides/);
  }
  for (const value of ['true', '1', 'yes']) assert.throws(() => codeAppUserEnv({ CI: value }), /CI=true is incompatible/);
  assert.throws(() => codeAppUserEnv({ ci: 'true' }), /CI=true is incompatible/);
  const original = { PATH: '/test/bin', CI: 'false' };
  assert.deepEqual(codeAppUserEnv(original), { PATH: '/test/bin' });
  assert.equal(original.CI, 'false');
});

test('homeAccountId is not resource-tenant proof; wizard independently verifies GDS before auth/init', () => {
  const selected = codeAppAccount(authStatus, environmentId);
  assert.equal(selected.tenantId, environmentId, 'Account formatting must not infer the resource tenant from homeAccountId.');
  const intended = { environmentId, tenantId, environmentUrl: 'https://example.crm.dynamics.com', cloud: 'public' };
  const row = { EnvironmentId: environmentId, TenantId: tenantId, Url: intended.environmentUrl };
  verifyCodeAppResourceTenant(intended, { discovery: () => ({ value: [row] }) });
  for (const response of [{ value: [] }, { value: [{ ...row, TenantId: environmentId }] }, { value: [{ ...row, Url: 'https://other.crm.dynamics.com' }] }]) {
    assert.throws(() => verifyCodeAppResourceTenant(intended, { discovery: () => response }), /did not prove/);
  }
  assert.throws(() => verifyCodeAppResourceTenant(intended, { discovery: () => { throw new Error('Azure CLI is not signed in'); } }), /not signed in/);
  for (const path of ['packages/wizard/steps/07-scaffold.mjs', 'packages/wizard-ux/server/steps/08-scaffold.mjs']) {
    const source = readFileSync(join(repoRoot, path), 'utf8');
    assert.ok(source.indexOf('verifyCodeAppResourceTenant({') < source.indexOf("['auth', 'login', '--account'"));
    assert.ok(source.indexOf('verifyCodeAppResourceTenant({') < source.indexOf('codeAppInitArgs(appName'));
  }
  assert.equal(codeAppCloud({ region: 'gcchigh' }), 'usgovhigh');
  assert.equal(codeAppCloud({}), 'public');
  assert.throws(() => codeAppCloud({ region: 'unknown' }), /Unsupported Code App cloud/);
});
