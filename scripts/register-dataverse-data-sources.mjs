#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import path from 'node:path';

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

if (dataverseTables.length === 0) {
  fail(`no Dataverse tables were found in ${planPath}`);
}

console.log(`Using PAC CLI: ${pacBin}`);
console.log(`Registration plan: ${planPath}`);

for (const table of dataverseTables) {
  console.log(`>>> Registering Dataverse table: ${table}`);
  execFileSync(pacBin, ['code', 'add-data-source', '-a', 'dataverse', '-t', table], { stdio: 'inherit' });
}

console.log('>>> Regenerating TypeScript SDK');
execFileSync(pacBin, ['code', 'generate'], { stdio: 'inherit' });
console.log('Dataverse data sources registered successfully.');
