#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { decrypt, isEncrypted } from '../wizard/lib/crypto.mjs';
import { loadState } from '../wizard/lib/state.mjs';
import {
  buildPacProfileName,
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

function requireKeys(values, keys) {
  for (const key of keys) {
    if (!values[key]) {
      fail(`${key} is not set in the resolved credential source.`);
    }
  }
}

function runCommand(file, args, options = {}) {
  execFileSync(file, args, { stdio: 'inherit', ...options });
}

function runPacDirect(pacBin, args, envOverrides) {
  runCommand(pacBin, args, { env: { ...process.env, ...envOverrides } });
}

console.log('================================================');
console.log('  Power Apps Code Apps - Auth Profile Setup');
console.log('================================================');
console.log('');

const pacBin = resolvePacBin();
if (!pacBin) {
  fail('pac CLI not found. Install it or set PAC_BIN.');
}

const opBin = resolveCommand('op', 'OP_BIN');
let resolvedValues = null;
let use1Password = false;

try {
  resolvedValues = resolveCredentialValues({ rootDir: process.cwd(), opBin });
  use1Password = Boolean(opBin) && fs.existsSync(path.resolve('.env')) && /^PP_.*=op:\/\//m.test(fs.readFileSync(path.resolve('.env'), 'utf8'));
  console.log(use1Password ? '[1Password] Detected op:// secret references in .env' : '[.env.local] Using credentials from .env.local');
  if (!use1Password && resolvedValues.PP_CLIENT_SECRET && isEncrypted(resolvedValues.PP_CLIENT_SECRET)) {
    resolvedValues.PP_CLIENT_SECRET = decrypt(resolvedValues.PP_CLIENT_SECRET);
    console.log('  (client secret decrypted from encrypted storage)');
  }
} catch {
  fail([
    'No credential source found.',
    '',
    'Option 1 (1Password - recommended):',
    '  1. Install 1Password CLI: https://developer.1password.com/docs/cli/get-started',
    '  2. Enable CLI integration: 1Password -> Settings -> Developer -> Integrate with 1Password CLI',
    '  3. Ensure .env contains op:// references',
    '',
    'Option 2 (.env.local):',
    '  1. Copy .env.template to .env.local',
    '  2. Fill in your credentials',
  ].join('\n'));
}

const loadedState = loadState();

console.log('');
console.log('Validating credentials...');

requireKeys(resolvedValues, ['PP_TENANT_ID', 'PP_APP_ID', 'PP_CLIENT_SECRET', 'PP_ENV_DEV']);
console.log(`  Tenant: ${resolvedValues.PP_TENANT_ID.slice(0, 8)}... App: ${resolvedValues.PP_APP_ID.slice(0, 8)}...`);

console.log('');
console.log('Creating PAC auth profiles...');

function createProfile(name, environment) {
  const profileName = buildPacProfileName({
    rootDir: process.cwd(),
    targetKey: name,
    profileType: 'spn',
    url: environment,
  });
  runPacDirect(
    pacBin,
    ['auth', 'create', '--name', profileName, '--environment', environment, '--applicationId', resolvedValues.PP_APP_ID, '--clientSecret', resolvedValues.PP_CLIENT_SECRET, '--tenant', resolvedValues.PP_TENANT_ID],
    resolvedValues,
  );

  console.log(`  OK ${profileName} profile created`);
}

createProfile('dev', resolvedValues.PP_ENV_DEV);
if (resolvedValues.PP_ENV_TEST) {
  createProfile('test', resolvedValues.PP_ENV_TEST);
}
if (resolvedValues.PP_ENV_PROD) {
  createProfile('prod', resolvedValues.PP_ENV_PROD);
}

console.log('');
console.log('Verifying connection...');
const wizardState = getWizardStateSnapshot((key, fallback) => ({
  WIZARD_TARGET_ENV: process.env.WIZARD_TARGET_ENV || loadedState.WIZARD_TARGET_ENV || 'dev',
  PP_ENV_DEV: loadedState.PP_ENV_DEV || resolvedValues.PP_ENV_DEV || '',
  PP_ENV_TEST: loadedState.PP_ENV_TEST || resolvedValues.PP_ENV_TEST || '',
  PP_ENV_PROD: loadedState.PP_ENV_PROD || resolvedValues.PP_ENV_PROD || '',
}[key] ?? fallback));
const verification = selectAndVerifyPacProfile({
  pac: pacBin,
  rootDir: process.cwd(),
  wizardState,
  targetKey: wizardState.WIZARD_TARGET_ENV,
  profileType: 'spn',
  credentialValues: resolvedValues,
  powerConfigPath: path.resolve('power.config.json'),
  requireCredentialMatch: true,
  requirePowerConfig: false,
  requirePowerConfigTarget: false,
  runSafeImpl: (file, args) => {
    try {
      return execFileSync(file, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...resolvedValues } }).trim();
    } catch {
      return null;
    }
  },
});
console.log(verification.whoInfo.raw);

console.log('');
console.log('================================================');
console.log('  Setup complete!');
console.log('================================================');
console.log('');
console.log('Daily usage:');
console.log('  SPN profiles are ready for pac solution export/import and pac org who.');
console.log('');
console.log('  ⚠ pac code push requires user (interactive) auth — SPN is rejected.');
console.log('  The wizard creates a user profile automatically during steps 7-9.');
console.log('  Or create one manually:');
console.log('    pac auth create --name <profile> --environment <url> --deviceCode');
if (use1Password) {
  console.log('');
  console.log('  Re-run this script after secret rotation.');
}
console.log('');
console.log('  Switch environments:  pac auth select --name <repo-scoped-profile>');
console.log('  Check connection:     pac org who');
console.log('  List profiles:        pac auth list');
console.log('');
