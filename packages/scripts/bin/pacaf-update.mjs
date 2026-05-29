#!/usr/bin/env node
// pacaf-update — refresh agent guidance and helper scripts in the current repo.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

function detectPM(cwd) {
  if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function run(cmd, cmdArgs) {
  console.log(`\n> ${cmd} ${cmdArgs.join(' ')}`);
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  return result.status === 0;
}

function readInstalledVersion(cwd, pkgName) {
  const pkgJson = path.join(cwd, 'node_modules', ...pkgName.split('/'), 'package.json');
  if (!existsSync(pkgJson)) return null;
  try {
    return JSON.parse(readFileSync(pkgJson, 'utf8')).version || null;
  } catch {
    return null;
  }
}

function readLatestVersion(pkgName) {
  const result = spawnSync('npm', ['view', pkgName, 'version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function checkScriptsDrift(cwd) {
  const installed = readInstalledVersion(cwd, '@pacaf/scripts');
  if (!installed) {
    console.log('@pacaf/scripts: not installed locally — skipping version check.');
    return;
  }
  const latest = readLatestVersion('@pacaf/scripts');
  if (!latest) {
    console.log(`@pacaf/scripts: installed ${installed} (could not reach npm to compare).`);
    return;
  }
  if (installed === latest) {
    console.log(`@pacaf/scripts: up to date (${installed}).`);
  } else {
    console.log(`@pacaf/scripts: drift — installed ${installed}, latest ${latest}.`);
    console.log('Run "npx pacaf-update" to refresh.');
  }
}

const cwd = process.cwd();
const pm = detectPM(cwd);

if (checkOnly) {
  run('npx', ['--yes', '@pacaf/agent-instructions', 'check']);
  checkScriptsDrift(cwd);
  process.exit(0);
}

const updateArgs = pm === 'pnpm'
  ? ['up', '@pacaf/scripts', '@pacaf/agent-instructions']
  : pm === 'yarn'
    ? ['upgrade', '@pacaf/scripts', '@pacaf/agent-instructions']
    : ['update', '@pacaf/scripts', '@pacaf/agent-instructions'];

run(pm, updateArgs);
run('npx', ['--yes', '@pacaf/agent-instructions', 'sync']);

console.log('\nDone. Review changes with: git diff');
