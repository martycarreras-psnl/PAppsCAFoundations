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
const registeredTables = [];

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
    registeredTables.push(table);
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

// ── Update field-metadata-cache.ts with registry entries for newly registered tables ──

const fieldMetadataCachePath = path.resolve('src/services/field-metadata-cache.ts');

if (registeredTables.length > 0 && fs.existsSync(fieldMetadataCachePath)) {
  let cacheSource = fs.readFileSync(fieldMetadataCachePath, 'utf8');
  let modified = false;

  for (const table of registeredTables) {
    // Derive the service class name from the entity set name.
    // The PAC CLI capitalizes the first letter: msfttrp_trips → Msfttrp_tripsService
    const serviceName = `${table.charAt(0).toUpperCase()}${table.slice(1)}Service`;
    const importLine = `import { ${serviceName} } from '@/generated/services/${serviceName}';`;
    const registryEntry = `  ${table}: ${serviceName} as unknown as MetadataServiceEntry,`;

    // Add import if not already present
    if (!cacheSource.includes(importLine)) {
      // Insert after the last existing import or after the data-contracts import
      const lastImportIndex = cacheSource.lastIndexOf('\nimport ');
      if (lastImportIndex >= 0) {
        const endOfLine = cacheSource.indexOf('\n', lastImportIndex + 1);
        cacheSource = cacheSource.slice(0, endOfLine + 1) + importLine + '\n' + cacheSource.slice(endOfLine + 1);
      } else {
        cacheSource = importLine + '\n' + cacheSource;
      }
      modified = true;
    }

    // Add registry entry if not already present
    if (!cacheSource.includes(`${table}:`)) {
      const registryMarker = 'export const metadataServiceRegistry: Record<string, MetadataServiceEntry> = {';
      const markerIndex = cacheSource.indexOf(registryMarker);
      if (markerIndex >= 0) {
        const insertPos = markerIndex + registryMarker.length;
        cacheSource = cacheSource.slice(0, insertPos) + '\n' + registryEntry + cacheSource.slice(insertPos);
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(fieldMetadataCachePath, cacheSource);
    console.log(`Updated field-metadata-cache.ts with registry entries for: ${registeredTables.join(', ')}`);
  }
} else if (registeredTables.length > 0) {
  // File doesn't exist — emit actionable TODOs
  console.warn('\n⚠ src/services/field-metadata-cache.ts not found. Add the following manually:');
  for (const table of registeredTables) {
    const serviceName = `${table.charAt(0).toUpperCase()}${table.slice(1)}Service`;
    console.warn(`    import { ${serviceName} } from '@/generated/services/${serviceName}';`);
    console.warn(`    ${table}: ${serviceName} as unknown as MetadataServiceEntry,`);
  }
}
