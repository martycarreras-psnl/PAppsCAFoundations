import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('isolated installed tarballs resolve every helper CLI without the wizard or workspace', (t) => {
  const work = fs.mkdtempSync(path.join(repo, '.tarball-test-'));
  t.after(() => fs.rmSync(work, { recursive: true, force: true }));
  const consumer = path.join(work, 'consumer');
  fs.mkdirSync(consumer);
  const env = { ...process.env, npm_config_cache: path.join(work, 'npm-cache'), TMPDIR: work, TMP: work, TEMP: work };
  function run(command, args, cwd = consumer) {
    const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 120000, shell: process.platform === 'win32' });
    assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stderr}\n${result.stdout}`);
    return result.stdout;
  }
  const tarballs = [];
  for (const name of ['scripts', 'agent-instructions']) {
    const output = run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', work], path.join(repo, 'packages', name));
    tarballs.push(path.join(work, JSON.parse(output)[0].filename));
  }
  fs.writeFileSync(path.join(consumer, 'package.json'), '{"name":"isolated-cli-smoke","version":"1.0.0","private":true}');
  run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs]);
  assert.equal(fs.existsSync(path.join(consumer, 'node_modules/@pacaf/wizard')), false);
  const emptyProject = path.join(work, 'empty-project');
  fs.mkdirSync(emptyProject);
  const loader = path.join(work, 'isolation-loader.mjs');
  const allowed = pathToFileURL(path.join(consumer, 'node_modules') + path.sep).href;
  fs.writeFileSync(loader, `export async function resolve(specifier, context, next) {
    const result = await next(specifier, context);
    if (result.url.startsWith('file:') && !result.url.startsWith(${JSON.stringify(allowed)})) {
      throw new Error('Package escaped isolated installation: ' + result.url);
    }
    return result;
  }\n`);
  const binPath = (name) => path.join(consumer, 'node_modules/.bin', `${name}${process.platform === 'win32' ? '.cmd' : ''}`);
  const binEnv = {
    PATH: path.dirname(process.execPath), HOME: emptyProject, USERPROFILE: emptyProject,
    SystemRoot: process.env.SystemRoot,
    NODE_OPTIONS: `--no-warnings --experimental-loader=${JSON.stringify(loader)}`,
  };
  function invokeBin(name, args, cwd = emptyProject) {
    const command = binPath(name);
    return spawnSync(process.platform === 'win32' ? `"${command}"` : command, args, {
      cwd, encoding: 'utf8', timeout: 10000, env: binEnv, shell: process.platform === 'win32',
    });
  }
  const linkedFailures = [];
  for (const name of ['scripts', 'agent-instructions']) {
    const root = path.join(consumer, 'node_modules/@pacaf', name);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
    for (const [bin, entry] of Object.entries(pkg.bin)) {
      const result = spawnSync(process.execPath, ['--no-warnings', '--experimental-loader', loader, path.join(root, entry), '--help'], {
        cwd: emptyProject, encoding: 'utf8', timeout: 10000,
        env: { PATH: emptyProject, HOME: emptyProject, USERPROFILE: emptyProject, SystemRoot: process.env.SystemRoot },
      });
      assert.equal(result.status, 0, `${bin}: ${result.stderr}\n${result.stdout}`);
      assert.match(result.stdout, /Usage:|pacaf-instructions <command>/i, bin);
      assert.deepEqual(fs.readdirSync(emptyProject), [], `${bin} --help mutated the project`);
      const linked = invokeBin(bin, ['--help']);
      if (linked.status !== 0 || !/Usage:|pacaf-instructions <command>/i.test(linked.stdout || '')) {
        linkedFailures.push(`${bin}: status=${linked.status}; ${linked.error || ''} ${linked.stderr || ''} ${linked.stdout || '(no help)'}`);
      }
      assert.deepEqual(fs.readdirSync(emptyProject), [], `${bin} linked --help mutated the project`);
    }
  }
  const check = invokeBin('pacaf-update', ['--check']);
  assert.equal(check.status, 1, `${check.stderr}\n${check.stdout}`);
  assert.match(check.stderr, /agent-instructions is not installed locally/, 'linked update --check must execute, not silently exit');
  assert.deepEqual(fs.readdirSync(emptyProject), [], 'linked update --check mutated the project');

  const versions = Object.fromEntries(['scripts', 'agent-instructions'].map((name) => [
    `@pacaf/${name}`, JSON.parse(fs.readFileSync(path.join(consumer, 'node_modules/@pacaf', name, 'package.json'))).version,
  ]));
  const npmStub = process.platform === 'win32'
    ? `@echo off\r\nif "%~2"=="@pacaf/scripts" (echo ${versions['@pacaf/scripts']}) else (echo ${versions['@pacaf/agent-instructions']})\r\n`
    : `#!${process.execPath}\nconsole.log(${JSON.stringify(versions)}[process.argv[3]]);\n`;
  fs.writeFileSync(binPath('npm'), npmStub);
  if (process.platform !== 'win32') fs.chmodSync(binPath('npm'), 0o755);
  binEnv.PATH = `${path.join(consumer, 'node_modules/.bin')}${path.delimiter}${path.dirname(process.execPath)}`;
  const manifestBefore = fs.readFileSync(path.join(consumer, 'package.json'), 'utf8');
  const lockBefore = fs.readFileSync(path.join(consumer, 'package-lock.json'), 'utf8');
  const installedCheck = invokeBin('pacaf-update', ['--check'], consumer);
  assert.equal(installedCheck.status, 1, `${installedCheck.stderr}\n${installedCheck.stdout}`);
  assert.match(installedCheck.stdout, /No \.foundations-version\.json/, 'check must invoke installed instruction CLI');
  assert.match(installedCheck.stdout, /@pacaf\/scripts: up to date/);
  assert.match(installedCheck.stdout, /@pacaf\/agent-instructions: up to date/);
  assert.equal(fs.readFileSync(path.join(consumer, 'package.json'), 'utf8'), manifestBefore);
  assert.equal(fs.readFileSync(path.join(consumer, 'package-lock.json'), 'utf8'), lockBefore);
  assert.equal(fs.existsSync(path.join(consumer, '.foundations-version.json')), false);
  assert.deepEqual(linkedFailures, [], 'installed .bin entrypoints must execute and print help');
});
