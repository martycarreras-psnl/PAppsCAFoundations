#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import { loadState } from '../wizard/lib/state.mjs';
import {
  getWizardStateSnapshot,
  resolveCredentialValues,
  selectAndVerifyPacProfile,
} from '../wizard/lib/pac-target.mjs';

const planPath = path.resolve(process.argv[2] || 'dataverse/register-datasources.plan.json');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
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

  try {
    const lookup = platform() === 'win32' ? 'where' : 'which';
    return execFileSync(lookup, ['pac'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
  } catch {
    fail('pac CLI not found. Install it or set PAC_BIN.');
  }
}

if (!fs.existsSync(planPath)) {
  fail(`registration plan not found at ${planPath}\nRun: node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json`);
}

if (!fs.existsSync(path.resolve('power.config.json'))) {
  fail(`power.config.json not found in ${process.cwd()}\nRun this script from the Code App project root after pac code init.`);
}

const pacBin = resolvePacBin();
if (!fs.existsSync(pacBin)) {
  fail(`PAC_BIN does not point to an executable: ${pacBin}`);
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const dataverseTables = Array.isArray(plan.dataverseTables) ? plan.dataverseTables.filter(Boolean) : [];

const loadedState = loadState();
const credentialValues = resolveCredentialValues({ rootDir: process.cwd(), opBin: process.env.OP_BIN });

if (dataverseTables.length === 0) {
  fail(`no Dataverse tables were found in ${planPath}`);
}

console.log(`Using PAC CLI: ${pacBin}`);
console.log(`Registration plan: ${planPath}`);

const failures = [];

for (const table of dataverseTables) {
  selectAndVerifyPacProfile({
    pac: pacBin,
    rootDir: process.cwd(),
    wizardState: getWizardStateSnapshot((key, fallback) => ({
      WIZARD_TARGET_ENV: process.env.WIZARD_TARGET_ENV || loadedState.WIZARD_TARGET_ENV || 'dev',
      PP_ENV_DEV: loadedState.PP_ENV_DEV || credentialValues.PP_ENV_DEV || '',
      PP_ENV_TEST: loadedState.PP_ENV_TEST || credentialValues.PP_ENV_TEST || '',
      PP_ENV_PROD: loadedState.PP_ENV_PROD || credentialValues.PP_ENV_PROD || '',
    }[key] ?? fallback)),
    targetKey: process.env.WIZARD_TARGET_ENV || loadedState.WIZARD_TARGET_ENV || 'dev',
    profileType: 'user',
    credentialValues,
    powerConfigPath: path.resolve('power.config.json'),
    requireCredentialMatch: true,
    requirePowerConfig: true,
    requirePowerConfigTarget: true,
    runSafeImpl: (file, args) => {
      try {
        return execFileSync(file, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      } catch {
        return null;
      }
    },
  });
  console.log(`>>> Registering Dataverse table: ${table}`);
  try {
    execFileSync(pacBin, ['code', 'add-data-source', '-a', 'dataverse', '-t', table], { stdio: 'inherit' });
  } catch (err) {
    console.error(`FAILED to register table: ${table} — ${err.message}`);
    failures.push(table);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} table(s) failed to register: ${failures.join(', ')}`);
  process.exit(1);
} else {
  console.log('Dataverse data sources registered successfully. Generated connector output was refreshed during registration.');
}
