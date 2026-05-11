#!/usr/bin/env node
// pacaf-update — refresh agent guidance and helper scripts in the current repo.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

const cwd = process.cwd();
const pm = detectPM(cwd);

if (checkOnly) {
  run('npx', ['--yes', '@pacaf/agent-instructions', 'check']);
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
