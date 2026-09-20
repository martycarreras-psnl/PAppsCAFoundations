#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir, platform } from 'node:os';

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log('Usage: pacaf-pac <pac command...>\nRun PAC with 1Password references from .env. Use PAC for solution ALM/admin; Power Apps CLI authentication is separate.');
  process.exit(0);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function resolveCommand(commandName, envVarName) {
  if (process.env[envVarName]) {
    return process.env[envVarName];
  }

  try {
    const lookup = platform() === 'win32' ? 'where' : 'which';
    return execFileSync(lookup, [commandName], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
  } catch {
    return null;
  }
}

function resolvePacBin() {
  if (process.env.PAC_BIN) {
    return process.env.PAC_BIN;
  }

  const ext = platform() === 'win32' ? '.exe' : '';
  const dotnetPac = path.join(homedir(), '.dotnet', 'tools', `pac${ext}`);
  if (fs.existsSync(dotnetPac)) {
    return dotnetPac;
  }

  return resolveCommand('pac', 'PAC_BIN');
}

const opBin = resolveCommand('op', 'OP_BIN');
if (!opBin) {
  fail('1Password CLI (op) not found. Install it or set OP_BIN.');
}

if (!fs.existsSync(path.resolve('.env'))) {
  fail('.env file with op:// references not found.');
}

const envFile = fs.readFileSync(path.resolve('.env'), 'utf8');
if (!/^PP_.*=op:\/\//m.test(envFile)) {
  fail('.env does not contain op:// references. For .env.local usage, run pac commands directly.');
}

const pacBin = resolvePacBin();
if (!pacBin) {
  fail('pac CLI not found. Install it or set PAC_BIN.');
}

const args = process.argv.slice(2);
execFileSync(opBin, ['run', '--env-file=.env', '--', pacBin, ...args], { stdio: 'inherit' });
