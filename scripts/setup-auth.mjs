#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { decrypt, isEncrypted } from '../wizard/lib/crypto.mjs';

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

function parseEnvFile(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }

  return values;
}

function hasOpReferences() {
  const envPath = path.resolve('.env');
  return fs.existsSync(envPath) && /^PP_.*=op:\/\//m.test(fs.readFileSync(envPath, 'utf8'));
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

function resolveValuesWithOp(opBin) {
  const script = [
    'const required = ["PP_TENANT_ID", "PP_APP_ID", "PP_CLIENT_SECRET", "PP_ENV_DEV", "PP_ENV_TEST", "PP_ENV_PROD"];',
    'const resolved = {};',
    'for (const key of required) { if (process.env[key]) resolved[key] = process.env[key]; }',
    'for (const key of ["PP_TENANT_ID", "PP_APP_ID", "PP_CLIENT_SECRET", "PP_ENV_DEV"]) {',
    '  if (!resolved[key]) { process.stderr.write(`Missing ${key}\\n`); process.exit(1); }',
    '}',
    'process.stdout.write(JSON.stringify(resolved));',
  ].join(' ');

  const output = execFileSync(opBin, ['run', '--env-file=.env', '--', process.execPath, '-e', script], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  return JSON.parse(output);
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
const use1Password = Boolean(opBin) && hasOpReferences();
let resolvedValues = null;

if (use1Password) {
  console.log('[1Password] Detected op:// secret references in .env');
  resolvedValues = resolveValuesWithOp(opBin);
} else if (fs.existsSync(path.resolve('.env.local'))) {
  console.log('[.env.local] Using credentials from .env.local');
  resolvedValues = parseEnvFile(path.resolve('.env.local'));
  if (resolvedValues.PP_CLIENT_SECRET && isEncrypted(resolvedValues.PP_CLIENT_SECRET)) {
    resolvedValues.PP_CLIENT_SECRET = decrypt(resolvedValues.PP_CLIENT_SECRET);
    console.log('  (client secret decrypted from encrypted storage)');
  }
} else {
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

console.log('');
console.log('Validating credentials...');

requireKeys(resolvedValues, ['PP_TENANT_ID', 'PP_APP_ID', 'PP_CLIENT_SECRET', 'PP_ENV_DEV']);
console.log(`  Tenant: ${resolvedValues.PP_TENANT_ID.slice(0, 8)}... App: ${resolvedValues.PP_APP_ID.slice(0, 8)}...`);

console.log('');
console.log('Creating PAC auth profiles...');

function createProfile(name, environment) {
  runPacDirect(
    pacBin,
    ['auth', 'create', '--name', name, '--environment', environment, '--applicationId', resolvedValues.PP_APP_ID, '--clientSecret', resolvedValues.PP_CLIENT_SECRET, '--tenant', resolvedValues.PP_TENANT_ID],
    resolvedValues,
  );

  console.log(`  OK ${name} profile created`);
}

createProfile('Dev', resolvedValues.PP_ENV_DEV);
if (resolvedValues.PP_ENV_TEST) {
  createProfile('Test', resolvedValues.PP_ENV_TEST);
}
if (resolvedValues.PP_ENV_PROD) {
  createProfile('Prod', resolvedValues.PP_ENV_PROD);
}

console.log('');
console.log('Verifying connection...');
runPacDirect(pacBin, ['auth', 'select', '--name', 'Dev']);
runPacDirect(pacBin, ['org', 'who']);

console.log('');
console.log('================================================');
console.log('  Setup complete!');
console.log('================================================');
console.log('');
console.log('Daily usage:');
if (use1Password) {
  console.log("  Profiles are ready - 'pac code push' works without op run.");
  console.log('  For ephemeral mode: npm run pac -- code push');
  console.log('  Re-run this script after secret rotation.');
} else {
  console.log("  'pac code push' works directly - no browser popup.");
}
console.log('');
console.log('  Switch environments:  pac auth select --name <Dev|Test|Prod>');
console.log('  Check connection:     pac org who');
console.log('  List profiles:        pac auth list');
console.log('');
