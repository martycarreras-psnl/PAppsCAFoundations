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
let solutionName = '';
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
  if (arg === '--solution-name') {
    solutionName = String(args[index + 1] || '').trim();
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
  fail('No pac command was provided. Example: node scripts/pac-safe.mjs --target dev --profile-type user --mutating code push');
}

// ── Code App push hardening (see issue #81) ───────────────────────────────
// `pac code push` is the only step that creates the Dataverse canvasapps
// record. Solution membership is established ONLY on that first push, and ONLY
// when the solution UNIQUE name is passed via -s/--solutionName. A bare push
// silently creates the app outside any solution and cannot be retroactively
// fixed by a later -s re-push. We therefore (1) force a user auth profile
// (BAP rejects SPN tokens for code push) and (2) guarantee -s is present with
// the solution's unique name, refusing to run a bare push.
const isCodePush = pacArgs[0] === 'code' && pacArgs[1] === 'push';
if (isCodePush) {
  if (profileType === 'spn') {
    console.warn('WARNING: pac code push requires a user auth profile (BAP rejects service principal tokens). Overriding --profile-type to "user".');
    profileType = 'user';
  }

  const hasSolutionFlag = pacArgs.some((a) => a === '-s' || a === '--solutionName');
  if (!hasSolutionFlag) {
    const loadedForSolution = loadState();
    const resolvedSolution =
      solutionName ||
      process.env.PP_SOLUTION_UNIQUE_NAME ||
      loadedForSolution.SOLUTION_UNIQUE_NAME ||
      '';
    if (!resolvedSolution) {
      fail(
        'Refusing to run a bare `pac code push` — it would create the Code App OUTSIDE any solution ' +
        '(a silent failure that a later -s re-push cannot fix). Pass --solution-name "<SolutionUniqueName>" ' +
        '(the solution UNIQUE name, not its friendly display name) or set PP_SOLUTION_UNIQUE_NAME.'
      );
    }
    pacArgs.push('-s', resolvedSolution);
    console.log(`pac code push: associating app with solution "${resolvedSolution}" via -s.`);
  }
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