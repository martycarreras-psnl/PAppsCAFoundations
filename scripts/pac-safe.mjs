#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { homedir, platform } from 'node:os';
import fs from 'node:fs';
import { loadState, getRootDir } from '../wizard/lib/state.mjs';
import {
  getWizardStateSnapshot,
  resolveCredentialValues,
  selectAndVerifyPacProfile,
} from '../wizard/lib/pac-target.mjs';

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

const args = process.argv.slice(2);
let targetKey = 'dev';
let profileType = 'spn';
let mutating = false;
let cwd = process.cwd();
const pacArgs = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--target') {
    targetKey = String(args[index + 1] || '').toLowerCase();
    index += 1;
    continue;
  }
  if (arg === '--profile-type') {
    profileType = String(args[index + 1] || '').toLowerCase();
    index += 1;
    continue;
  }
  if (arg === '--cwd') {
    cwd = path.resolve(args[index + 1] || '.');
    index += 1;
    continue;
  }
  if (arg === '--mutating') {
    mutating = true;
    continue;
  }
  pacArgs.push(arg);
}

if (pacArgs.length === 0) {
  fail('No pac command was provided. Example: node scripts/pac-safe.mjs --target dev --profile-type spn --mutating code push');
}

const pacBin = resolvePacBin();
if (!pacBin) {
  fail('pac CLI not found. Install it or set PAC_BIN.');
}

const loadedState = loadState();
const rootDir = getRootDir();
const opBin = resolveCommand('op', 'OP_BIN');
const credentialValues = resolveCredentialValues({ rootDir, opBin });

const mergedWizardState = {
  WIZARD_TARGET_ENV: process.env.WIZARD_TARGET_ENV || loadedState.WIZARD_TARGET_ENV || targetKey || 'dev',
  PP_ENV_DEV: process.env.PP_ENV_DEV || loadedState.PP_ENV_DEV || credentialValues.PP_ENV_DEV || '',
  PP_ENV_TEST: process.env.PP_ENV_TEST || loadedState.PP_ENV_TEST || credentialValues.PP_ENV_TEST || '',
  PP_ENV_PROD: process.env.PP_ENV_PROD || loadedState.PP_ENV_PROD || credentialValues.PP_ENV_PROD || '',
};

try {
  selectAndVerifyPacProfile({
    pac: pacBin,
    rootDir,
    wizardState: mergedWizardState,
    targetKey,
    profileType,
    credentialValues,
    powerConfigPath: path.join(cwd, 'power.config.json'),
    requireCredentialMatch: true,
    requirePowerConfig: mutating,
    requirePowerConfigTarget: mutating,
  });
} catch (error) {
  fail(error.message);
}

execFileSync(pacBin, pacArgs, { stdio: 'inherit', cwd });