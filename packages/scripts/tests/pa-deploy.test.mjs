import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deploy, parseDeployArgs, discoveryCommand, discoverEnvironment } from '../lib/pa-deploy.mjs';
import { PA_VERSION, TARGETS_FILE, resolveLocalPa, runPa, runBuild, packageManager } from '../lib/pa.mjs';
import { runIntegration, parseIntegrationArgs } from './integration-pa.mjs';

const ids = Array.from({ length: 6 }, (_, i) => `${i + 1}1111111-1111-4111-8111-111111111111`);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'pacaf-pa-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => writeFileSync(join(root, file), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  const target = { environmentId: ids[0], environmentUrl: 'https://example.crm.dynamics.com', tenantId: ids[1], solutionId: ids[2], solutionName: 'Dedicated', appId: ids[3], account: 'maker@example.com', spnClientId: ids[4] };
  const config = { environmentId: target.environmentId, appId: target.appId, region: 'prod', buildPath: './dist', buildEntryPoint: 'index.html', localAppUrl: 'http://localhost:3000' };
  const pkg = { scripts: { build: 'vite build' }, devDependencies: { '@microsoft/power-apps-cli': PA_VERSION } };
  const installed = { name: '@microsoft/power-apps-cli', version: PA_VERSION, bin: { pa: './dist/Bin.js' } };
  mkdirSync(join(root, 'node_modules/@microsoft/power-apps-cli/dist'), { recursive: true });
  mkdirSync(join(root, 'dist'));
  mkdirSync(join(root, 'src'));
  write('package.json', pkg);
  write('node_modules/@microsoft/power-apps-cli/package.json', installed);
  write('node_modules/@microsoft/power-apps-cli/dist/Bin.js', '');
  write('power.config.json', config);
  write(TARGETS_FILE, { version: 1, targets: { dev: target } });
  write('dist/index.html', '<script type="module" src="./assets/index.js"></script>');
  write('src/main.tsx', "import { HashRouter } from 'react-router-dom';");
  const status = { success: true, signedIn: true, activeAccount: { username: target.account, homeAccountId: `${ids[5]}.${target.tenantId}` }, accounts: [] };
  const solutions = { success: true, items: [{ solutionid: target.solutionId, uniquename: target.solutionName, ismanaged: false }] };
  const calls = [];
  const pa = (args, options) => {
    calls.push({ args, options });
    if (args[0] === 'auth') return JSON.stringify(status);
    if (args[0] === 'solution') return JSON.stringify(solutions);
    return '';
  };
  const build = (_root, env) => calls.push({ build: true, env });
  const discovery = () => ({ value: [{ EnvironmentId: target.environmentId, TenantId: target.tenantId, Url: target.environmentUrl }] });
  const options = parseDeployArgs([]);
  const run = (extra = {}) => deploy({ root, env: {}, options, pa, build, discovery, ...extra });
  return { root, write, target, config, pkg, installed, status, solutions, calls, pa, build, discovery, options, run };
}

test('offline preflight validates target/local pin without build, auth or cloud calls', t => {
  const f = fixture(t);
  const result = f.run({ options: { ...f.options, preflight: true } });
  assert.equal(result.preflight, true);
  assert.deepEqual(result.args, ['app', 'push', '--solution-id', f.target.solutionId, '--non-interactive']);
  assert.deepEqual(f.calls, []);
});

test('user deployment builds then checks real CLI JSON envelope/account/solution and pushes without environment override', t => {
  const f = fixture(t);
  f.run();
  assert.equal(f.calls[0].build, true);
  assert.deepEqual(f.calls.slice(1).map(call => call.args.slice(0, 2)), [['auth', 'status'], ['solution', 'list'], ['auth', 'status'], ['app', 'push']]);
  assert.ok(!f.calls.at(-1).args.includes('--environment-id'));
});

test('local CLI resolves exact declared and installed version only, never PATH/npx', t => {
  const f = fixture(t);
  const bin = resolveLocalPa(f.root);
  assert.equal(bin.command, process.execPath);
  assert.equal(bin.args[0], join(f.root, 'node_modules/@microsoft/power-apps-cli/dist/Bin.js'));
  f.pkg.devDependencies['@microsoft/power-apps-cli'] = '^1.0.2';
  f.write('package.json', f.pkg);
  assert.throws(() => resolveLocalPa(f.root), /Pin/);
  f.pkg.devDependencies['@microsoft/power-apps-cli'] = PA_VERSION;
  f.write('package.json', f.pkg);
  f.installed.version = '1.0.3';
  f.write('node_modules/@microsoft/power-apps-cli/package.json', f.installed);
  assert.throws(() => resolveLocalPa(f.root), /does not match/);
  rmSync(join(f.root, 'node_modules/@microsoft/power-apps-cli/package.json'));
  assert.throws(() => resolveLocalPa(f.root), /Missing project-local.*lockfile/);
});

for (const [field, value] of [
  ['environmentId', 'bad'], ['environmentId', ''], ['tenantId', 'invalid'], ['solutionId', 'Dedicated'],
  ['appId', 'bad'], ['account', ''], ['solutionName', 'Default'], ['environmentUrl', 'http://example.com'],
  ['environmentUrl', 'https://user:password@example.com'], ['cloud', 'test'],
]) {
  test(`malformed target ${field} is rejected before build`, t => {
    const f = fixture(t);
    f.target[field] = value;
    f.write(TARGETS_FILE, { version: 1, targets: { dev: f.target } });
    assert.throws(() => f.run());
    assert.deepEqual(f.calls, []);
  });
}

for (const [field, value] of [['environmentId', ids[5]], ['appId', ids[5]], ['region', 'test'], ['appType', 'MobileApp'], ['localAppUrl', 'http://localhost:8080'], ['buildPath', '../outside'], ['buildEntryPoint', '../outside']]) {
  test(`mismatched config ${field} cannot reach build/push`, t => {
    const f = fixture(t);
    f.config[field] = value;
    f.write('power.config.json', f.config);
    assert.throws(() => f.run());
    assert.deepEqual(f.calls, []);
  });
}

for (const key of ['PA_CLI_ENVIRONMENT_ID', 'PA_CLI_SOLUTION_ID', 'PA_CLI_CLOUD', 'PA_CLI_ACCOUNT', 'PA_CLI_APP_BUILD_PATH', 'PA_CLI_USE_NOOP_AUTH', 'PA_CLI_UNKNOWN', 'PA_CLI_USE_SP_AUTH', 'PA_CLI_SP_CLIENT_SECRET', 'pa_cli_use_noop_auth']) {
  test(`ambient ${key} cannot override user deployment`, t => {
    const f = fixture(t);
    assert.throws(() => f.run({ env: { [key]: 'arbitrary' } }), /ambient/);
    assert.deepEqual(f.calls, []);
  });
}

test('implicit CI service principal selection is refused for user auth', t => {
  const f = fixture(t);
  assert.throws(() => f.run({ env: { CI: 'true' } }), /implicitly/);
  assert.deepEqual(f.calls, []);
});

test('SPN is explicit, existing-app-only, target-bound and secrets never reach build', t => {
  const f = fixture(t);
  const options = { ...f.options, auth: 'spn' };
  const env = { PA_CLI_USE_SP_AUTH: 'true', PA_CLI_SP_TENANT_ID: f.target.tenantId, PA_CLI_SP_CLIENT_ID: f.target.spnClientId, PA_CLI_SP_CLIENT_SECRET: 'test-only-secret' };
  f.run({ options, env });
  assert.equal(f.calls[0].env.PA_CLI_SP_CLIENT_SECRET, undefined);
  assert.equal(f.calls.some(call => call.args?.[0] === 'auth'), false);
  assert.equal(f.calls.at(-1).args[1], 'push');
  for (const key of Object.keys(env)) {
    const incomplete = { ...env };
    delete incomplete[key];
    assert.throws(() => f.run({ options, env: incomplete }));
  }
  assert.throws(() => f.run({ options, env: { ...env, PA_CLI_SP_CLIENT_ID: ids[5] } }), /identity/);
  assert.throws(() => parseDeployArgs(['--auth', 'spn', '--allow-create']), /existing/);
});

for (const mutation of [
  status => { status.success = false; },
  status => { status.signedIn = false; },
  status => { status.activeAccount = null; },
  status => { status.activeAccount.username = 'other@example.com'; },
  status => { delete status.activeAccount.homeAccountId; },
]) {
  test('missing/wrong account or tenant does not reach publish', t => {
    const f = fixture(t);
    mutation(f.status);
    assert.throws(() => f.run(), /account|tenant/);
    assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
  });
}

test('home tenant equality never substitutes for authoritative environment resource tenant evidence', t => {
  const f = fixture(t);
  assert.throws(() => f.run({ discovery: () => ({ value: [{
    EnvironmentId: f.target.environmentId, TenantId: ids[5], Url: f.target.environmentUrl,
  }] }) }), /resource tenant/);
  assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
});

test('pa home tenant is not treated as resource tenant when discovery proves target binding', t => {
  const f = fixture(t);
  f.status.activeAccount.homeAccountId = `${ids[5]}.${ids[5]}`;
  f.run();
  assert.equal(f.calls.at(-1).args[1], 'push');
});

test('missing, duplicate or wrong organization discovery records fail closed', t => {
  const f = fixture(t);
  for (const response of [
    {}, { value: [] },
    { value: [f.discovery().value[0], f.discovery().value[0]] },
    { value: [{ ...f.discovery().value[0], Url: 'https://wrong.crm.dynamics.com' }] },
  ]) assert.throws(() => f.run({ discovery: () => response }), /Global Discovery/);
  assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
});

test('discovery uses a fixed cloud endpoint/resource and string-quoted OData identity', t => {
  const f = fixture(t);
  const args = discoveryCommand(f.target);
  assert.equal(args[args.indexOf('--url') + 1], 'https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances');
  assert.equal(args[args.indexOf('--resource') + 1], 'https://globaldisco.crm.dynamics.com');
  assert.ok(args.includes(`$filter=EnvironmentId eq '${f.target.environmentId}'`));
  assert.ok(args.includes('$select=EnvironmentId,TenantId,Url'));
  assert.throws(() => discoveryCommand({ ...f.target, cloud: 'https://attacker.invalid' }), /Unsupported/);
  assert.throws(() => discoveryCommand({ ...f.target, environmentId: "' or true" }), /valid/);
});

test('discovery failures distinguish missing CLI, denied access, timeout and malformed JSON without secrets', t => {
  const f = fixture(t);
  const failures = [
    { phase: 0, error: Object.assign(new Error('SECRET'), { code: 'ENOENT' }), expected: /not found on PATH/ },
    { phase: 1, error: Object.assign(new Error('SECRET'), { status: 1, stderr: 'HTTP 403 SECRET' }), expected: /HTTP 403.*exit 1/ },
    { phase: 1, error: Object.assign(new Error('SECRET'), { code: 'ETIMEDOUT', signal: 'SIGTERM' }), expected: /timed out.*ETIMEDOUT/ },
    { phase: 1, text: 'SECRET invalid json', expected: /invalid JSON/ },
  ];
  for (const failure of failures) {
    let phase = 0;
    const discovery = target => discoverEnvironment(target, { execute: () => {
      if (phase++ === failure.phase) {
        if (failure.error) throw failure.error;
        return failure.text;
      }
      return '/test/az';
    } });
    assert.throws(() => f.run({ discovery }), error => {
      assert.match(error.message, failure.expected);
      assert.doesNotMatch(error.message, /SECRET/);
      return true;
    });
  }
  assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
});

test('paired target edits during discovery fail before solution lookup or publish', t => {
  const f = fixture(t);
  assert.throws(() => f.run({ discovery: () => {
    const response = f.discovery();
    f.write('power.config.json', { ...f.config, appId: ids[5] });
    f.write(TARGETS_FILE, { version: 1, targets: { dev: { ...f.target, appId: ids[5] } } });
    return response;
  } }), /changed/);
  assert.equal(f.calls.some(call => call.args?.[0] === 'solution' || call.args?.[1] === 'push'), false);
});

test('solution GUID/name must exist in configured environment', t => {
  const f = fixture(t);
  f.solutions.items[0].solutionid = ids[5];
  assert.throws(() => f.run(), /solution GUID/);
  assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
});

for (const response of [
  { success: false, items: [] },
  { success: true },
  [],
  { success: true, items: [{ solutionid: ids[2], uniquename: 'Different' }] },
  { success: true, items: [{ solutionid: ids[2], uniquename: 'Dedicated', ismanaged: true }] },
]) {
  test('unsupported/failed solution JSON cannot be mistaken for verified access', t => {
    const f = fixture(t);
    assert.throws(() => f.run({ pa: (args, opts) => args[0] === 'solution' ? JSON.stringify(response) : f.pa(args, opts) }), /solution GUID/);
    assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
  });
}

test('account changed after solution lookup aborts before push', t => {
  const f = fixture(t);
  assert.throws(() => f.run({ pa: (args, opts) => {
    const result = f.pa(args, opts);
    if (args[0] === 'solution') f.status.activeAccount.username = 'different@example.com';
    return result;
  } }), /active pa account/);
  assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
});

test('real local CLI child failure preserves exit status without leaking captured auth output', t => {
  const f = fixture(t);
  f.write('node_modules/@microsoft/power-apps-cli/dist/Bin.js', "console.error('SECRET_TEST_SENTINEL'); process.exit(7);");
  assert.throws(() => runPa(['auth', 'status'], { root: f.root, capture: true }), error => {
    assert.equal(error.exitCode, 7);
    assert.doesNotMatch(error.message, /SECRET_TEST_SENTINEL/);
    return true;
  });
});

test('config is reread after build and auth; concurrent edits refuse push', t => {
  const f = fixture(t);
  assert.throws(() => f.run({ build: () => f.write('power.config.json', { ...f.config, appId: ids[5] }) }), /changed/);
  f.write('power.config.json', f.config);
  assert.throws(() => f.run({ pa: (args, opts) => {
    const result = f.pa(args, opts);
    if (args[0] === 'auth') f.write(TARGETS_FILE, { version: 1, targets: { dev: { ...f.target, solutionId: ids[5] } } });
    return result;
  } }), /changed/);
  assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
});

test('paired identity mutation during local CLI validation cannot establish a new baseline', t => {
  const f = fixture(t);
  assert.throws(() => f.run({ resolveCli: root => {
    const cli = resolveLocalPa(root);
    const changed = { ...f.target, environmentId: ids[5], appId: ids[4] };
    f.write(TARGETS_FILE, { version: 1, targets: { dev: changed } });
    f.write('power.config.json', { ...f.config, environmentId: changed.environmentId, appId: changed.appId });
    return cli;
  } }), /changed/);
  assert.deepEqual(f.calls, []);
});

test('first publish is opt-in and durably saves only returned app identity', t => {
  const f = fixture(t);
  f.target.appId = '';
  f.config.appId = '';
  f.write(TARGETS_FILE, { version: 1, targets: { dev: f.target } });
  f.write('power.config.json', f.config);
  assert.throws(() => f.run(), /allow-create/);
  f.run({ options: { ...f.options, allowCreate: true }, pa: (args, opts) => {
    if (args[1] === 'push') f.write('power.config.json', { ...f.config, appId: ids[3] });
    return f.pa(args, opts);
  } });
  const persisted = JSON.parse(readFileSync(join(f.root, TARGETS_FILE), 'utf8')).targets.dev;
  assert.deepEqual(persisted, { ...f.target, appId: ids[3] });
});

test('build and every CLI subprocess failure aborts without success fallback', t => {
  const f = fixture(t);
  assert.throws(() => f.run({ build: () => { throw new Error('build failed'); } }), /build failed/);
  assert.equal(f.calls.length, 0);
  assert.throws(() => f.run({ pa: () => { throw new Error('secret error'); } }), /Unable to verify/);
  assert.throws(() => f.run({ pa: (args, opts) => {
    if (args[1] === 'push') throw new Error('push failed');
    return f.pa(args, opts);
  } }), /push failed/);
});

test('HashRouter and relative build assets remain guards independent of old generator patch', t => {
  const f = fixture(t);
  f.write('dist/index.html', '<script src="/assets/index.js"></script>');
  assert.throws(() => f.run(), /root-relative/);
  f.write('dist/index.html', '<script src="./assets/index.js"></script>');
  f.write('src/main.tsx', "import { BrowserRouter } from 'react-router-dom';");
  assert.throws(() => f.run(), /HashRouter/);
  assert.equal(f.calls.some(call => call.args), false);
});

test('unsupported/duplicate deployment options fail closed', () => {
  for (const args of [['--environment-id', ids[0]], ['--solution-id', ids[2]], ['--target'], ['--auth', 'implicit'], ['--target', 'dev', '--target', 'prod'], ['--', 'app', 'push']]) {
    assert.throws(() => parseDeployArgs(args));
  }
});

test('package manager resolution respects npm/pnpm and refuses conflicting lockfiles', t => {
  const f = fixture(t);
  f.write('pnpm-lock.yaml', '');
  assert.equal(packageManager(f.root), 'pnpm');
  f.write('package-lock.json', '{}');
  assert.throws(() => packageManager(f.root), /Multiple/);
});

test('npm run deploy works for pnpm-managed projects without changing the lockfile or installing', t => {
  const f = fixture(t);
  f.write('pnpm-lock.yaml', 'lockfileVersion: "9.0"\n');
  f.write('npm-cli.js', '');
  const previous = process.env.npm_execpath;
  t.after(() => {
    if (previous === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = previous;
  });
  process.env.npm_execpath = join(f.root, 'npm-cli.js');
  let command;
  runBuild(f.root, {}, (executable, args) => { command = { executable, args }; });
  assert.deepEqual(command, { executable: process.execPath, args: [process.env.npm_execpath, 'run', 'build'] });
  assert.equal(readFileSync(join(f.root, 'pnpm-lock.yaml'), 'utf8'), 'lockfileVersion: "9.0"\n');
});

test('pa runner uses exact local executable with argument arrays', t => {
  const f = fixture(t);
  let seen;
  runPa(['app', 'run', '--config-only', '--port', '8080', '--local-app-url', 'http://localhost:3000'], {
    root: f.root, execute: (command, args) => { seen = { command, args }; },
  });

  assert.equal(seen.command, process.execPath);
  assert.deepEqual(seen.args.slice(1), ['app', 'run', '--config-only', '--port', '8080', '--local-app-url', 'http://localhost:3000']);
});

test('integration harness is offline by default and explicit confirmations gate all cloud calls', t => {
    const f = fixture(t);
    f.write('integration.json', { target: 'dev' });
    const options = parseIntegrationArgs(['--plan', 'integration.json']);
    const input = { root: f.root, options, env: {}, pa: f.pa, build: f.build };
    assert.equal(runIntegration(input).executed, false);
    assert.deepEqual(f.calls, []);
    assert.throws(() => runIntegration({ ...input, options: { ...options, execute: true } }), /exact --confirm/);
    assert.deepEqual(f.calls, []);
    assert.throws(() => parseIntegrationArgs(['--plan', 'integration.json', '--phase', 'grant']), /Unsupported/);
  });

test('integration harness executes through a package directory symlink', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t);
  const link = join(f.root, 'linked-integration.mjs');
  symlinkSync(fileURLToPath(new URL('./integration-pa.mjs', import.meta.url)), link);
  const result = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Default is offline/);
});

  test('integration harness validates generation for both sources without claiming runtime validation', t => {
    const f = fixture(t);
    f.write('integration.json', {
      target: 'dev',
      dataverse: { table: 'contact', generatedFiles: ['src/contact.ts'] },
      connector: { connector: 'shared_office365users', connectionId: 'test-connection', generatedFiles: ['src/office.ts'] },
    });
    mkdirSync(join(f.root, 'node_modules/@microsoft/power-apps'), { recursive: true });
    f.write('node_modules/@microsoft/power-apps/package.json', { version: '1.4.0' });
    const options = parseIntegrationArgs(['--plan', 'integration.json', '--execute', '--confirm-environment', f.target.environmentId, '--confirm-app', f.target.appId]);
    const result = runIntegration({ root: f.root, options, env: {}, build: f.build, discovery: f.discovery, pa: (args, opts) => {
      if (args[1] === 'add') {
        f.write('src/contact.ts', 'export const metadata = {};');
        f.write('src/office.ts', 'export const profile = {};');
      }
      return f.pa(args, opts);
    } });
    assert.equal(result.generatedFilesVerified, 2);
    assert.match(result.message, /still require explicit integration evidence/);
    assert.equal(f.calls.filter(call => call.args?.[1] === 'add').length, 2);
    assert.equal(f.calls.some(call => call.args?.[1] === 'push'), false);
  });
