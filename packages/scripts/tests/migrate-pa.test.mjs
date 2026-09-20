import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { migrationMain } from '../bin/pacaf-migrate-pa.mjs';

const cli = fileURLToPath(new URL('../bin/pacaf-migrate-pa.mjs', import.meta.url));
const guid = (n) => `${n.toString().padStart(8, '0')}-1111-4111-8111-111111111111`;
const target = {
  environmentId: guid(1), environmentUrl: 'https://example.crm.dynamics.com',
  tenantId: guid(2), account: 'maker@example.com', appId: guid(3),
  solutionId: guid(4), solutionName: 'ExampleSolution',
};
const originalPackage = (prefix = 'pacaf') => ({
  name: 'existing-code-app', private: true, packageManager: 'pnpm@10.11.0',
  scripts: {
    dev: 'concurrently "vite --port 3000" "pac code run"',
    deploy: `npm run build && ${prefix}-pac-safe --target dev --profile-type user --mutating --solution-name "ExampleSolution" code push`,
    'setup:auth': `${prefix}-setup-auth`, pac: `${prefix}-pac`,
    prebuild: `${prefix}-patch-datasources`, build: 'tsc && vite build',
    'dev:local': 'VITE_USE_MOCK=true vite --port 3000', custom: 'node custom.mjs',
  },
  dependencies: { '@microsoft/power-apps': '^1.0.0', react: '^18.3.0' },
  devDependencies: { '@pacaf/scripts': '4.0.2', concurrently: '^9.0.0' },
  pnpm: { onlyBuiltDependencies: ['esbuild'] },
});

function fixture(t, { prefix = 'pacaf', npm = false } = {}) {
  const cwd = path.resolve(`.test-pa-migrate-${randomUUID()}`);
  fs.mkdirSync(cwd);
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const write = (name, value) => {
    fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
    fs.writeFileSync(path.join(cwd, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  };
  const read = (name) => fs.readFileSync(path.join(cwd, name), 'utf8');
  const pkg = originalPackage(prefix);
  if (npm) pkg.packageManager = 'npm@10.0.0';
  write('package.json', pkg);
  write(npm ? 'package-lock.json' : 'pnpm-lock.yaml', 'original lockfile\n');
  write('power.config.json', { appId: target.appId, environmentId: target.environmentId, buildPath: './dist',
    localAppUrl: 'http://localhost:3000', connectionReferences: { existing: { id: guid(5) } } });
  write('.power-apps-targets.json', { version: 1, targets: { dev: target } });
  write('.env', 'PA_CLI_SP_CLIENT_SECRET=do-not-read-or-print\n');
  write('.npmrc', 'registry=https://registry.example.com\n');
  write('src/generated/ExistingService.ts', '// preserved generated binding\n');
  write('.wizard/state.json', { appId: guid(99), environmentId: guid(98) });
  if (prefix !== 'pacaf') write('pacaf.config.json', { binPrefix: prefix });
  const run = (...args) => {
    const output = [];
    const status = migrationMain(args, cwd, (text) => output.push(text));
    return { status, output: output.join('\n') };
  };
  return { cwd, write, read, run, pkg };
}

test('default check is reviewable and never writes or executes a subprocess', (t) => {
  const f = fixture(t);
  const before = f.read('package.json');
  const result = spawnSync(process.execPath, [cli], {
    cwd: f.cwd, encoding: 'utf8', env: { ...process.env, PATH: '' },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Proposed: scripts.dev.*--config-only/);
  assert.match(result.stdout, /pnpm install/);
  assert.equal(f.read('package.json'), before);
  assert.equal(fs.existsSync(path.join(f.cwd, '.pacaf-pa-migration.json')), false);
  assert.doesNotMatch(result.stdout, /do-not-read-or-print/);
});

test('package-directory symlink invocation executes help and check instead of silently succeeding', (t) => {
  const f = fixture(t);
  const scopedModules = path.join(f.cwd, 'node_modules', '@pacaf');
  fs.mkdirSync(scopedModules, { recursive: true });
  fs.symlinkSync(path.dirname(path.dirname(cli)), path.join(scopedModules, 'scripts'),
    process.platform === 'win32' ? 'junction' : 'dir');
  const linkedCli = path.join(scopedModules, 'scripts', 'bin', 'pacaf-migrate-pa.mjs');
  for (const flag of ['--help', '--check']) {
    const result = spawnSync(process.execPath, [linkedCli, flag],
      { cwd: f.cwd, encoding: 'utf8', env: { ...process.env, PATH: '' } });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, flag === '--help' ? /Usage: pacaf-migrate-pa/ : /Check only; no files changed/);
  }
});

test('npm .bin symlink executes check, apply, and rollback', { skip: process.platform === 'win32' }, (t) => {
  const f = fixture(t);
  const bin = path.join(f.cwd, 'node_modules', '.bin', 'pacaf-migrate-pa');
  fs.mkdirSync(path.dirname(bin), { recursive: true });
  fs.symlinkSync(cli, bin);
  const before = f.read('package.json');
  for (const flag of ['--check', '--apply', '--rollback']) {
    const result = spawnSync(process.execPath, [bin, flag],
      { cwd: f.cwd, encoding: 'utf8', env: { ...process.env, PATH: '' } });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    if (flag === '--check') {
      assert.match(result.stdout, /Check only; no files changed/);
      assert.equal(f.read('package.json'), before);
    } else if (flag === '--apply') {
      assert.match(result.stdout, /Applied local manifest changes only/);
      assert.equal(JSON.parse(f.read('package.json')).scripts.deploy, 'pacaf-deploy --target dev');
    } else {
      assert.match(result.stdout, /Restored package.json only/);
      assert.equal(f.read('package.json'), before);
    }
  }
});

test('apply preserves identities, bindings, secrets, registry, lockfile, mock and PAC scripts', (t) => {
  const f = fixture(t);
  const protectedFiles = ['power.config.json', '.power-apps-targets.json', '.env', '.npmrc',
    'src/generated/ExistingService.ts', 'pnpm-lock.yaml', '.wizard/state.json'];
  const originals = Object.fromEntries(protectedFiles.map((name) => [name, f.read(name)]));
  const result = f.run('--apply');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /separate required step: pnpm install/);
  const pkg = JSON.parse(f.read('package.json'));
  assert.equal(pkg.scripts.dev, 'concurrently --kill-others-on-fail "vite --port 3000 --strictPort" "pacaf-pa app run --config-only --port 8080 --local-app-url http://localhost:3000"');
  assert.equal(pkg.scripts.deploy, 'pacaf-deploy --target dev');
  assert.equal(pkg.scripts['setup:pa-auth'], 'pacaf-pa auth login');
  for (const name of ['setup:auth', 'pac', 'prebuild', 'build', 'dev:local', 'custom']) {
    assert.equal(pkg.scripts[name], f.pkg.scripts[name]);
  }
  assert.equal(pkg.dependencies['@microsoft/power-apps'], '1.4.0');
  assert.equal(pkg.devDependencies['@microsoft/power-apps-cli'], '1.0.2');
  assert.deepEqual(pkg.pnpm, f.pkg.pnpm);
  for (const name of protectedFiles) assert.equal(f.read(name), originals[name], name);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(path.join(f.cwd, '.pacaf-pa-migration.json')).mode & 0o777, 0o600);
  }
  assert.doesNotMatch(result.output, /do-not-read-or-print/);
});

test('repeat apply/check is idempotent and preserves original backup', (t) => {
  const f = fixture(t);
  assert.equal(f.run('--apply').status, 0);
  const after = f.read('package.json');
  const receipt = f.read('.pacaf-pa-migration.json');
  assert.equal(f.run('--apply').status, 0);
  assert.equal(f.run('--check').status, 0);
  assert.equal(f.read('package.json'), after);
  assert.equal(f.read('.pacaf-pa-migration.json'), receipt);
});

test('rollback restores exact bytes and mode, preserving post-install lockfile', (t) => {
  const f = fixture(t, { npm: true });
  const before = f.read('package.json').replace(/\n/g, '\r\n');
  f.write('package.json', before);
  fs.chmodSync(path.join(f.cwd, 'package.json'), 0o640);
  assert.equal(f.run('--apply').status, 0);
  assert.match(f.read('package.json'), /\r\n/);
  f.write('package-lock.json', 'user-reviewed installed lockfile\n');
  const result = f.run('--rollback');
  assert.equal(result.status, 0, result.output);
  assert.equal(f.read('package.json'), before);
  assert.equal(f.read('package-lock.json'), 'user-reviewed installed lockfile\n');
  assert.match(result.output, /npm install/);
  assert.equal(fs.existsSync(path.join(f.cwd, '.pacaf-pa-migration.json')), false);
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(f.cwd, 'package.json')).mode & 0o777, 0o640);
  assert.equal(f.run('--rollback').status, 0);
});

test('rollback refuses later manifest edits without overwriting or deleting backup', (t) => {
  const f = fixture(t);
  assert.equal(f.run('--apply').status, 0);
  const changed = f.read('package.json') + '\n';
  f.write('package.json', changed);
  const result = f.run('--rollback');
  assert.equal(result.status, 1);
  assert.match(result.output, /changed after migration/);
  assert.equal(f.read('package.json'), changed);
  assert.ok(fs.existsSync(path.join(f.cwd, '.pacaf-pa-migration.json')));
});

test('missing reviewed target fails closed without falling back to wizard state', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.cwd, '.power-apps-targets.json'));
  const original = f.read('package.json');
  for (const flag of ['--check', '--apply']) {
    const result = f.run(flag);
    assert.equal(result.status, 1);
    assert.match(result.output, /Create and review/);
    assert.match(result.output, /tenantId, account, appId, solutionId/);
  }
  assert.equal(f.read('package.json'), original);
});

for (const field of ['environmentId', 'environmentUrl', 'tenantId', 'account', 'appId', 'solutionId', 'solutionName']) {
  test(`missing target ${field} refuses apply`, (t) => {
    const f = fixture(t);
    const dev = { ...target };
    delete dev[field];
    f.write('.power-apps-targets.json', { version: 1, targets: { dev } });
    const before = f.read('package.json');
    const result = f.run('--apply');
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, new RegExp(field));
    assert.equal(f.read('package.json'), before);
  });
}

test('mismatched config identities and legacy solution fail closed', (t) => {
  const f = fixture(t);
  f.write('power.config.json', { appId: guid(7), environmentId: guid(8), tenantId: guid(9) });
  f.write('.power-apps-targets.json', { version: 1, targets: { dev: { ...target, solutionName: 'WrongSolution' } } });
  const result = f.run('--apply');
  assert.equal(result.status, 1);
  for (const text of [/appId must match/, /environmentId must match/, /tenantId conflicts/, /Legacy deploy solution/]) {
    assert.match(result.output, text);
  }
});

test('Default-GUID environment identities are preserved without allowing empty app IDs', (t) => {
  const f = fixture(t);
  const environmentId = `Default-${target.environmentId}`;
  f.write('power.config.json', { appId: target.appId, environmentId, region: 'prod' });
  f.write('.power-apps-targets.json', { version: 1, targets: { dev: { ...target, environmentId, cloud: 'public' } } });
  const before = f.read('power.config.json');
  assert.equal(f.run('--apply').status, 0);
  assert.equal(f.read('power.config.json'), before);
  f.write('.power-apps-targets.json', { version: 1, targets: { dev: { ...target, environmentId, appId: '' } } });
  assert.match(f.run('--check').output, /appId must be a nonzero GUID/);
});

for (const solutionName of ['Default', 'CommonDataServiceDefaultSolution', '_Name']) {
  test(`runtime-invalid solution ${solutionName} cannot migrate`, (t) => {
    const f = fixture(t);
    f.pkg.scripts.deploy = 'npm run build && pacaf-pac-safe --target dev --profile-type user --mutating code push';
    f.write('package.json', f.pkg);
    f.write('.power-apps-targets.json', { version: 1, targets: { dev: { ...target, solutionName } } });
    const before = f.read('package.json');
    const result = f.run('--apply');
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /solutionName must identify a dedicated solution/);
    assert.equal(f.read('package.json'), before);
  });
}

for (const cloud of ['usgov', 'unsupported']) {
  test(`runtime-invalid cloud ${cloud} cannot migrate a public-region app`, (t) => {
    const f = fixture(t);
    f.write('.power-apps-targets.json', { version: 1, targets: { dev: { ...target, cloud } } });
    const before = f.read('package.json');
    const result = f.run('--apply');
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /cloud/);
    assert.equal(f.read('package.json'), before);
  });
}

for (const override of [
  { localAppUrl: 'http://localhost:5173' }, { buildPath: '../outside' },
  { buildEntryPoint: '../outside.html' }, { appType: 'CanvasApp' },
]) {
  test(`runtime config validation refuses ${Object.keys(override)[0]}`, (t) => {
    const f = fixture(t);
    f.write('power.config.json', { appId: target.appId, environmentId: target.environmentId, ...override });
    const before = f.read('package.json');
    const result = f.run('--apply');
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Deployment target validation/);
    assert.equal(f.read('package.json'), before);
  });
}

for (const name of ['dev', 'deploy', 'setup:pa-auth']) {
  test(`custom ${name} script refuses all writes`, (t) => {
    const f = fixture(t);
    f.pkg.scripts[name] = 'custom command --preserve-user-choice';
    f.write('package.json', f.pkg);
    const original = f.read('package.json');
    const result = f.run('--apply');
    assert.equal(result.status, 1);
    assert.match(result.output, /Customized or unsupported/);
    assert.equal(f.read('package.json'), original);
    assert.equal(fs.existsSync(path.join(f.cwd, '.pacaf-pa-migration.json')), false);
  });
}

test('project custom bin prefix is respected', (t) => {
  const f = fixture(t, { prefix: 'contoso' });
  assert.equal(f.run('--apply').status, 0);
  const pkg = JSON.parse(f.read('package.json'));
  assert.equal(pkg.scripts.deploy, 'contoso-deploy --target dev');
  assert.match(pkg.scripts.dev, /contoso-pa app run/);
  assert.equal(pkg.scripts['setup:pa-auth'], 'contoso-pa auth login');
});

test('additional legacy Code App scripts block migration while PAC ALM remains supported', (t) => {
  const f = fixture(t);
  f.pkg.scripts.alm = 'pac solution export --name ExampleSolution';
  f.pkg.scripts.connector = 'pac code add-data-source -a dataverse -t account';
  f.write('package.json', f.pkg);
  const original = f.read('package.json');
  const result = f.run('--apply');
  assert.equal(result.status, 1);
  assert.match(result.output, /Remaining legacy Code App command in scripts.connector/);
  assert.equal(f.read('package.json'), original);
  delete f.pkg.scripts.connector;
  f.write('package.json', f.pkg);
  assert.equal(f.run('--apply').status, 0);
  assert.equal(JSON.parse(f.read('package.json')).scripts.alm, f.pkg.scripts.alm);
});

test('CLI already in runtime dependencies moves to exact devDependency readiness marker', (t) => {
  const f = fixture(t);
  f.pkg.dependencies['@microsoft/power-apps-cli'] = '1.0.2';
  f.write('package.json', f.pkg);
  const result = f.run('--apply');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Move @microsoft\/power-apps-cli from dependencies to devDependencies/);
  const pkg = JSON.parse(f.read('package.json'));
  assert.equal(pkg.dependencies['@microsoft/power-apps-cli'], undefined);
  assert.equal(pkg.devDependencies['@microsoft/power-apps-cli'], '1.0.2');
});

for (const wrapper of [
  'node scripts/op-pac.mjs', 'node scripts/pac-safe.mjs --target dev',
  'acme-pac-safe --target test', 'acme-pac --profile user',
  '"C:\\Program Files\\PAC\\pac.exe"', '"C:\\Program Files\\PAC\\pac.cmd"',
]) {
  test(`leftover ${wrapper} Code App wrapper blocks policy migration`, (t) => {
    const f = fixture(t);
    f.pkg.scripts.connector = `${wrapper} code add-data-source -a dataverse -t account`;
    f.write('package.json', f.pkg);
    const result = f.run('--apply');
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /Remaining legacy Code App command in scripts.connector/);
  });
}

test('legacy policy detection does not join separate PAC ALM and editor commands', (t) => {
  const f = fixture(t);
  f.pkg.scripts.alm = 'acme-pac-safe --target dev solution list && code .';
  f.write('package.json', f.pkg);
  const result = f.run('--apply');
  assert.equal(result.status, 0, result.output);
  assert.equal(JSON.parse(f.read('package.json')).scripts.alm, f.pkg.scripts.alm);
});

test('installed scripts-package bin metadata supplies prefix without project config', (t) => {
  const f = fixture(t, { prefix: 'acme' });
  fs.unlinkSync(path.join(f.cwd, 'pacaf.config.json'));
  f.write('tool/bin/pacaf-migrate-pa.mjs', fs.readFileSync(cli, 'utf8'));
  for (const helper of ['pa.mjs', 'pa-deploy.mjs', 'shell.mjs']) {
    f.write(`tool/lib/${helper}`, fs.readFileSync(new URL(`../lib/${helper}`, import.meta.url), 'utf8'));
  }
  f.write('tool/package.json', { type: 'module', bin: { 'acme-migrate-pa': './bin/pacaf-migrate-pa.mjs' } });
  const result = spawnSync(process.execPath, [path.join(f.cwd, 'tool/bin/pacaf-migrate-pa.mjs'), '--apply'],
    { cwd: f.cwd, encoding: 'utf8', env: { ...process.env, PATH: '' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(f.read('package.json')).scripts.deploy, 'acme-deploy --target dev');
});

test('legacy deploy without solution argument and in-tree wrapper are supported', (t) => {
  const f = fixture(t);
  f.pkg.scripts.deploy = 'npm run build && node scripts/pac-safe.mjs --target dev --profile-type user --mutating code push';
  f.write('package.json', f.pkg);
  assert.equal(f.run('--apply').status, 0);
});

test('package-manager ambiguity and unsupported dependency versions refuse writes', (t) => {
  const f = fixture(t);
  f.write('package-lock.json', '{}');
  assert.match(f.run('--apply').output, /Multiple package-manager lockfiles/);
  fs.unlinkSync(path.join(f.cwd, 'package-lock.json'));
  f.pkg.devDependencies['@microsoft/power-apps-cli'] = '2.0.0';
  f.pkg.dependencies['@microsoft/power-apps'] = 'workspace:*';
  f.write('package.json', f.pkg);
  const result = f.run('--apply');
  assert.equal(result.status, 1);
  assert.match(result.output, /Unsupported or newer @microsoft\/power-apps-cli/);
  assert.match(result.output, /Unsupported or newer @microsoft\/power-apps version/);
});

test('symbolic-link manifest and malformed target JSON are refused safely', (t) => {
  const f = fixture(t);
  f.write('.power-apps-targets.json', '{"secret": "do-not-print", invalid }');
  const invalid = f.run('--check');
  assert.equal(invalid.status, 1);
  assert.doesNotMatch(invalid.output, /do-not-print/);
  assert.match(invalid.output, /Invalid JSON object/);
  if (process.platform !== 'win32') {
    fs.renameSync(path.join(f.cwd, 'package.json'), path.join(f.cwd, 'original.json'));
    fs.symlinkSync('original.json', path.join(f.cwd, 'package.json'));
    assert.match(f.run('--apply').output, /Expected a regular file: package.json/);
  }
});

test('existing backup is not overwritten and invalid CLI options are rejected', (t) => {
  const f = fixture(t);
  f.write('.pacaf-pa-migration.json', '{}');
  assert.match(f.run('--apply').output, /Existing .pacaf-pa-migration.json/);
  assert.equal(f.read('.pacaf-pa-migration.json'), '{}');
  assert.equal(f.run('--rollback').status, 1);
  assert.equal(f.run('--apply', '--rollback').status, 1);
  assert.equal(f.run('--target-file').status, 1);
  assert.equal(f.run('--help').status, 0);
});
