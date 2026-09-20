import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { updateFoundations } from '../bin/pacaf-update.mjs';
import { loadState, getRootDir, stateSet } from '../lib/state.mjs';
import { encrypt, decrypt } from '../lib/crypto.mjs';
import { buildPacProfileName, selectAndVerifyPacProfile, parsePacOrgWho, extractPowerConfigTargetMetadata } from '../lib/pac-target.mjs';
import { syncGuidance, checkGuidance, assertCodeAppPolicyReady } from '../../agent-instructions/bin/guidance-files.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const instructionRoot = path.join(repo, 'packages/agent-instructions');
const pkg = { name: '@pacaf/agent-instructions', version: '99.0.0' };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(repo, '.packaging-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(root, name, value) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
function overlay(root, text = 'Explicit project-local policy\n') {
  write(root, '.pacaf/policy/AGENTS.md', text);
  write(root, '.pacaf/policy-overlays.json', JSON.stringify({ version: 1, files: { 'AGENTS.md': '.pacaf/policy/AGENTS.md' } }));
  return text;
}
function installed(t) {
  const root = fixture(t);
  fs.cpSync(instructionRoot, path.join(root, 'node_modules/@pacaf/agent-instructions'), { recursive: true });
  write(root, 'node_modules/@pacaf/scripts/package.json', '{"version":"99.0.0"}');
  return root;
}

test('shared state belongs to the consumer and does not leak across projects', (t) => {
  const one = fixture(t);
  const two = fixture(t);
  loadState(one);
  stateSet('SOLUTION_UNIQUE_NAME', 'TestSolution');
  assert.equal(getRootDir(), one);
  assert.equal(JSON.parse(fs.readFileSync(path.join(one, '.wizard-state.json'))).SOLUTION_UNIQUE_NAME, 'TestSolution');
  assert.deepEqual(loadState(two), {});
  assert.equal(loadState(one).SOLUTION_UNIQUE_NAME, 'TestSolution');
  assert.equal(decrypt(encrypt('fixture-secret')), 'fixture-secret');
});

test('PAC ALM selection and target verification remain intact', (t) => {
  const rootDir = fixture(t);
  const url = 'https://example.crm.dynamics.com';
  const expected = buildPacProfileName({ rootDir, targetKey: 'dev', profileType: 'spn', url });
  const calls = [];
  const result = selectAndVerifyPacProfile({
    pac: 'fixture-pac', rootDir,
    wizardState: { PP_ENV_DEV: url }, targetKey: 'dev', profileType: 'spn',
    credentialValues: { PP_ENV_DEV: url },
    powerConfigPath: path.join(rootDir, 'power.config.json'),
    requirePowerConfig: false, requirePowerConfigTarget: false,
    runSafeImpl: (file, args) => {
      calls.push([file, ...args]);
      return args[0] === 'org' ? `Environment URL: ${url}` : '';
    },
  });
  assert.equal(result.whoInfo.url, url);
  assert.deepEqual(calls[0], ['fixture-pac', 'auth', 'select', '--name', expected]);
  assert.deepEqual(calls[1], ['fixture-pac', 'org', 'who']);
});

test('PAC targeting recognizes both GUID and Default-GUID environment IDs', () => {
  const id = '01234567-89ab-cdef-0123-456789abcdef';
  for (const value of [id, `Default-${id}`]) {
    assert.equal(parsePacOrgWho(`Environment ID: ${value}`).environmentId, value.toLowerCase());
    assert.equal(parsePacOrgWho(`https://apps.powerapps.com/play/e/${value}/app/id`).environmentId, value.toLowerCase());
    assert.equal(extractPowerConfigTargetMetadata({ appUrl: `https://apps.powerapps.com/play/e/${value}/app/id` }).environmentId, value.toLowerCase());
  }
  assert.equal(parsePacOrgWho(`Environment ID: Default-${id}-extra`).environmentId, '');
});

test('published PAC wrappers execute ALM and auth against the explicit consumer project', { skip: process.platform === 'win32' }, (t) => {
  const root = fixture(t);
  const project = path.join(root, 'project');
  fs.mkdirSync(project);
  const log = path.join(root, 'pac-calls.jsonl');
  const pac = path.join(root, 'fixture-pac.mjs');
  write(root, 'fixture-pac.mjs', `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
if (args[0] === 'org' && args[1] === 'who') console.log('Environment URL: https://example.crm.dynamics.com');
`);
  fs.chmodSync(pac, 0o755);
  write(project, '.env.local', 'PP_ENV_DEV=https://example.crm.dynamics.com\nPP_TENANT_ID=fixture-tenant\nPP_APP_ID=fixture-app\nPP_CLIENT_SECRET=fixture-secret\n');
  write(project, '.wizard-state.json', JSON.stringify({ AUTH_PROFILE_TYPE: 'spn', PP_ENV_DEV: 'https://example.crm.dynamics.com' }));
  const env = { ...process.env, PAC_BIN: pac, OP_BIN: pac };
  const result = spawnSync(process.execPath, [path.join(repo, 'packages/scripts/pac-safe.mjs'), '--cwd', project, 'solution', 'list'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  let calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.at(-1), ['solution', 'list']);
  assert.equal(calls[0][3], buildPacProfileName({ rootDir: project, targetKey: 'dev', profileType: 'spn', url: 'https://example.crm.dynamics.com' }));
  fs.writeFileSync(log, '');
  const auth = spawnSync(process.execPath, [path.join(repo, 'packages/scripts/setup-auth.mjs')], { cwd: project, env, encoding: 'utf8' });
  assert.equal(auth.status, 0, auth.stderr);
  calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls[0].slice(0, 3), ['auth', 'create', '--name']);
  assert.ok(calls[0].includes('--clientSecret'));
  assert.deepEqual(calls.at(-1), ['org', 'who']);
});

test('sync preserves overlays and check detects edits even with matching version', (t) => {
  const target = fixture(t);
  const options = { target, packageRoot: instructionRoot, pkg };
  const policy = overlay(target);
  syncGuidance(options);
  assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), policy);
  assert.equal(checkGuidance(options).status, 0);
  write(target, '.github/copilot-instructions.md', 'Unregistered local edit');
  assert.equal(checkGuidance(options).status, 2);
  assert.throws(() => syncGuidance(options), /Local guidance edits/);
  assert.equal(fs.readFileSync(path.join(target, '.github/copilot-instructions.md'), 'utf8'), 'Unregistered local edit');
});

test('hashless legacy sync refuses local changes; force backs them up', (t) => {
  const target = fixture(t);
  write(target, 'AGENTS.md', 'Existing business policy');
  assert.throws(() => syncGuidance({ target, packageRoot: instructionRoot, pkg }), /Local guidance edits/);
  syncGuidance({ target, packageRoot: instructionRoot, pkg, force: true });
  const backup = fs.readdirSync(path.join(target, '.pacaf/guidance-backups'))[0];
  assert.equal(fs.readFileSync(path.join(target, '.pacaf/guidance-backups', backup, 'AGENTS.md'), 'utf8'), 'Existing business policy');
});

test('partial sync failure restores prior guidance and reapplies explicit overlay', (t) => {
  const target = fixture(t);
  const options = { target, packageRoot: instructionRoot, pkg };
  syncGuidance(options);
  const prior = fs.readFileSync(path.join(target, '.foundations-version.json'), 'utf8');
  const policy = overlay(target, 'Updated explicit policy');
  const original = fs.writeFileSync;
  let writes = 0;
  const mock = t.mock.method(fs, 'writeFileSync', (...args) => {
    if (++writes === 3) throw new Error('Injected copy failure');
    return original(...args);
  });
  assert.throws(() => syncGuidance(options), /Previous guidance restored/);
  mock.mock.restore();
  assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), policy);
  assert.equal(fs.readFileSync(path.join(target, '.foundations-version.json'), 'utf8'), prior);
});

test('overlay traversal is rejected before writes', (t) => {
  const target = fixture(t);
  write(target, '.pacaf/policy-overlays.json', JSON.stringify({ version: 1, files: { 'AGENTS.md': '.pacaf/policy/../../private.md' } }));
  assert.throws(() => syncGuidance({ target, packageRoot: instructionRoot, pkg }), /escapes/);
  assert.equal(fs.existsSync(path.join(target, 'AGENTS.md')), false);
});

test('new CLI guidance refuses unmigrated Code Apps even under --force', (t) => {
  const target = fixture(t);
  const options = { target, packageRoot: instructionRoot, pkg };
  for (const command of [
    'pac code push',
    '"C:\\\\Tools\\\\pac.exe" code push',
    'npm run build && pacaf-pac-safe --target dev --mutating code push',
    'node scripts/pac-safe.mjs --target dev code push',
    'concurrently "vite" "contoso-pac code run"',
  ]) {
    write(target, 'package.json', JSON.stringify({
      scripts: { deploy: command },
      devDependencies: { '@microsoft/power-apps-cli': '1.0.2' },
    }));
    assert.throws(() => syncGuidance({ ...options, force: true }), /Legacy PAC Code App scripts remain: deploy/);
    assert.equal(fs.existsSync(path.join(target, 'AGENTS.md')), false);
  }
  write(target, 'power.config.json', '{}');
  write(target, 'package.json', JSON.stringify({ scripts: { deploy: 'pacaf-deploy --target dev' } }));
  assert.throws(() => syncGuidance(options), /exact devDependency/);
  for (const version of ['^1.0.2', '1.0.1', 'latest']) {
    write(target, 'package.json', JSON.stringify({ devDependencies: { '@microsoft/power-apps-cli': version } }));
    assert.throws(() => syncGuidance(options), /exact devDependency/);
  }
  write(target, 'package.json', JSON.stringify({
    scripts: { deploy: 'pacaf-deploy --target dev', alm: 'pac solution export --name Example' },
    devDependencies: { '@microsoft/power-apps-cli': '1.0.2' },
  }));
  syncGuidance(options);
  assert.equal(checkGuidance(options).status, 0);
});

test('reviewed policy exception requires explicit marker and every CLI-policy overlay', (t) => {
  const target = fixture(t);
  write(target, 'package.json', JSON.stringify({ scripts: { dev: 'pac code run' } }));
  const files = new Map([
    ['AGENTS.md', Buffer.from('Use @microsoft/power-apps-cli')],
    ['.github/instructions/deployment.md', Buffer.from('Use pa app push')],
    ['.github/instructions/unrelated.md', Buffer.from('Use React')],
  ]);
  const overlays = new Map([['AGENTS.md', Buffer.from('Reviewed local PAC policy')]]);
  write(target, '.pacaf/policy-overlays.json', JSON.stringify({ version: 1, files: {}, codeAppCliPolicy: 'reviewed-local' }));
  assert.throws(() => assertCodeAppPolicyReady(target, files, overlays), /Refusing to replace legacy/);
  overlays.set('.github/instructions/deployment.md', Buffer.from('Reviewed local deployment policy'));
  assert.doesNotThrow(() => assertCodeAppPolicyReady(target, files, overlays));
  write(target, '.pacaf/policy-overlays.json', '{"version":1,"files":{}}');
  assert.throws(() => assertCodeAppPolicyReady(target, files, overlays), /Refusing to replace legacy/);
});

test('update refuses policy switch in untouched legacy consumer', async (t) => {
  const cwd = installed(t);
  write(cwd, 'package.json', JSON.stringify({ scripts: { dev: 'pac code run' } }));
  let calls = 0;
  await assert.rejects(updateFoundations({
    cwd, log: () => {}, spawn: () => { calls++; return { status: 0 }; },
  }), /explicit migration/);
  assert.equal(calls, 1, 'package update only; instruction sync must not start');
  assert.equal(fs.existsSync(path.join(cwd, 'AGENTS.md')), false);
});

test('update failure stops before sync and does not claim completion', async (t) => {
  const cwd = installed(t);
  const calls = [];
  const logs = [];
  assert.equal(await updateFoundations({ cwd, log: (s) => logs.push(s), spawn: (...args) => { calls.push(args); return { status: 7 }; } }), 1);
  assert.equal(calls.length, 1);
  assert.equal(logs.some((s) => s.startsWith('Done.')), false);
});

test('update restores policy after a partially failing instruction subprocess', async (t) => {
  const cwd = installed(t);
  const policy = overlay(cwd);
  write(cwd, 'AGENTS.md', policy);
  let calls = 0;
  const logs = [];
  const status = await updateFoundations({
    cwd, log: (s) => logs.push(s),
    spawn: () => {
      if (++calls === 1) return { status: 0 };
      write(cwd, 'AGENTS.md', 'Partially copied upstream policy');
      return { status: 1 };
    },
  });
  assert.equal(status, 1);
  assert.equal(fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8'), policy);
  assert.equal(logs.some((s) => s.startsWith('Done.')), false);
});

test('update does not discard edits to an overlay destination on sync refusal', async (t) => {
  const cwd = installed(t);
  overlay(cwd);
  write(cwd, 'AGENTS.md', 'Unregistered additional change');
  let calls = 0;
  await assert.rejects(updateFoundations({ cwd, log: () => {}, spawn: () => { calls++; return { status: 0 }; } }), /Local guidance edits/);
  assert.equal(calls, 1);
  assert.equal(fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8'), 'Unregistered additional change');
});

test('check propagates guidance drift, scripts drift, registry failure, and spawn errors', async (t) => {
  const cwd = installed(t);
  const instructionVersion = JSON.parse(fs.readFileSync(path.join(cwd, 'node_modules/@pacaf/agent-instructions/package.json'))).version;
  for (const [guidanceStatus, latestScripts, registryStatus, expected] of [
    [0, '99.0.0', 0, 0], [2, '99.0.0', 0, 2], [0, '100.0.0', 0, 2], [1, '99.0.0', 0, 1], [0, '', 1, 1], [null, '99.0.0', 0, 1],
  ]) {
    const status = await updateFoundations({
      cwd, args: ['--check'], log: () => {},
      spawn: (cmd, args) => cmd === process.execPath
        ? { status: guidanceStatus }
        : { status: registryStatus, stdout: args[1] === '@pacaf/scripts' ? latestScripts : instructionVersion },
    });
    assert.equal(status, expected);
  }
});

test('CLI help is read-only without credentials or tools', (t) => {
  const cwd = fixture(t);
  for (const file of ['pac-safe.mjs', 'setup-auth.mjs', 'decrypt-secret.mjs', 'op-pac.mjs']) {
    const result = spawnSync(process.execPath, [path.join(repo, 'packages/scripts', file), '--help'], {
      cwd, encoding: 'utf8', env: { PATH: cwd, HOME: cwd }, timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
  }
  assert.deepEqual(fs.readdirSync(cwd), []);
});
