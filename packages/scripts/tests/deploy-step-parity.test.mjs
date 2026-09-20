// Issue #81 shipped solution safety in only one wizard. Issue #129 moves that
// safety into one pa deployment helper. Both frontends must call it: the first
// publish must use the verified dedicated solution GUID, never a bare push or
// the PAC-era unique-name flag. A later republish is not membership evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { deploy, parseDeployArgs } from '../lib/pa-deploy.mjs';
import { TARGETS_FILE } from '../lib/pa.mjs';

const packages = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const frontends = [
  join(packages, 'wizard/steps/08-verify-deploy.mjs'),
  join(packages, 'wizard-ux/server/steps/09-verify-deploy.mjs'),
];

for (const file of frontends) {
  test(`${file}: delegates guarded deployment and preserves failure evidence`, () => {
    assert.ok(existsSync(file));
    const source = readFileSync(file, 'utf8');
    assert.match(source, /localCodeAppTool\(projectDir, 'deploy'\)/, 'Use the shared, project-local deployment helper.');
    assert.match(source, /'--target'/);
    assert.match(source, /'--auth', 'user'/);
    assert.match(source, /--allow-create/, 'First publish must remain an explicit opt-in.');
    assert.match(source, /!config\.appId/);
    assert.match(source, /throw new Error\('Guarded deployment failed/, 'Nonzero helper exits must fail the wizard step.');
    assert.match(source, /throw new Error\('(?:Build verification failed|Build did not produce)/, 'Build-only failures must not be reported as completed builds.');
    assert.doesNotMatch(source, /selectAndVerifyPacProfile|quarantinePowerConfig/, 'PAC profile selection or reinitialization cannot replace PA identity checks.');
    assert.doesNotMatch(source, /['"]code['"]\s*,\s*['"]push['"]|['"]app['"]\s*,\s*['"]push['"]/, 'Neither wizard may bypass the shared helper to push directly.');
    assert.doesNotMatch(source, /ensureAppInSolution|['"]add-solution-component['"]/, 'No automatic permission or solution membership repair.');
  });
}

const ids = Array.from({ length: 5 }, (_, i) => `${i + 1}1111111-1111-4111-8111-111111111111`);
function fixture(t, { firstPublish = false } = {}) {
  const root = resolve(`.deploy-parity-${randomUUID()}`);
  mkdirSync(join(root, 'dist'), { recursive: true });
  mkdirSync(join(root, 'src'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  const target = { environmentId: ids[0], environmentUrl: 'https://example.crm.dynamics.com', tenantId: ids[1], solutionId: ids[2], solutionName: 'Dedicated', appId: firstPublish ? '' : ids[3], account: 'maker@example.test' };
  const config = { environmentId: target.environmentId, appId: target.appId, region: 'prod', buildPath: './dist', buildEntryPoint: 'index.html', localAppUrl: 'http://localhost:3000' };
  write('package.json', { scripts: { build: 'vite build' } });
  write('power.config.json', config);
  write(TARGETS_FILE, { version: 1, targets: { dev: target } });
  write('dist/index.html', '<script type="module" src="./assets/index.js"></script>');
  write('src/main.tsx', "import { HashRouter } from 'react-router-dom';");
  const calls = [];
  const solutions = { success: true, items: [{ solutionid: target.solutionId, uniquename: target.solutionName, ismanaged: false }] };
  const pa = (args) => {
    calls.push(args);
    if (args[0] === 'auth') return JSON.stringify({ success: true, signedIn: true, activeAccount: { username: target.account, homeAccountId: `${ids[4]}.${target.tenantId}` } });
    if (args[0] === 'solution') return JSON.stringify(solutions);
    if (args[0] === 'app' && args[1] === 'push' && firstPublish) write('power.config.json', { ...config, appId: ids[3] });
    return '';
  };
  const run = (overrides = {}) => deploy({
    root, env: {}, options: parseDeployArgs([]), resolveCli() {},
    build: () => calls.push(['build']), pa,
    discovery: () => ({ value: [{ EnvironmentId: target.environmentId, TenantId: target.tenantId, Url: target.environmentUrl }] }),
    ...overrides,
  });
  return { root, write, target, config, calls, solutions, pa, run };
}

test('shared helper refuses first publish without creation consent before any child operation', (t) => {
  const f = fixture(t, { firstPublish: true });
  assert.throws(() => f.run(), /--allow-create/);
  assert.deepEqual(f.calls, []);
});

test('shared helper requires a solution GUID, not the old PAC solution name', (t) => {
  const f = fixture(t);
  f.target.solutionId = f.target.solutionName;
  f.write(TARGETS_FILE, { version: 1, targets: { dev: f.target } });
  assert.throws(() => f.run(), /solutionId.*GUID/);
  assert.deepEqual(f.calls, []);
});

test('first publish verifies solution GUID/name before push and persists the returned app identity', (t) => {
  const f = fixture(t, { firstPublish: true });
  f.run({ options: parseDeployArgs(['--allow-create']) });
  assert.equal(f.calls[0][0], 'build');
  assert.ok(f.calls.findIndex((args) => args[0] === 'solution') < f.calls.findIndex((args) => args[0] === 'app'));
  assert.deepEqual(f.calls.at(-1), ['app', 'push', '--solution-id', f.target.solutionId, '--non-interactive']);
  assert.equal(JSON.parse(readFileSync(join(f.root, TARGETS_FILE), 'utf8')).targets.dev.appId, ids[3]);
});

test('missing or mismatched solution discovery never becomes a bare first push', (t) => {
  const f = fixture(t, { firstPublish: true });
  f.solutions.items[0].uniquename = 'DifferentSolution';
  assert.throws(() => f.run({ options: parseDeployArgs(['--allow-create']) }), /solution GUID\/name/);
  assert.equal(f.calls.some((args) => args[0] === 'app'), false);
  assert.equal(JSON.parse(readFileSync(join(f.root, TARGETS_FILE), 'utf8')).targets.dev.appId, '');
});

test('build failure preserves failure evidence and prevents every PA operation', (t) => {
  const f = fixture(t);
  assert.throws(() => f.run({ build: () => { throw new Error('fixture build failed: exit 7'); } }), /fixture build failed: exit 7/);
  assert.deepEqual(f.calls, []);
});

test('push failure propagates unchanged and cannot claim a first-publish app identity', (t) => {
  const f = fixture(t, { firstPublish: true });
  assert.throws(() => f.run({
    options: parseDeployArgs(['--allow-create']),
    pa: (args) => {
      if (args[0] === 'app') throw new Error('fixture push failed: exit 9');
      return f.pa(args);
    },
  }), /fixture push failed: exit 9/);
  assert.equal(JSON.parse(readFileSync(join(f.root, TARGETS_FILE), 'utf8')).targets.dev.appId, '');
});
