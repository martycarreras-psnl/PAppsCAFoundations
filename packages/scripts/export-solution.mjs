#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { loadState } from '../wizard/lib/state.mjs';
import {
  getWizardStateSnapshot,
  isRepoScopedProfileName,
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

function hasOpReferences() {
  const envPath = path.resolve('.env');
  return fs.existsSync(envPath) && /^PP_.*=op:\/\//m.test(fs.readFileSync(envPath, 'utf8'));
}

function showHelp() {
  console.log(`Usage:
  node scripts/export-solution.mjs --name <solution-name> [options]

Options:
  --name <name>            Solution unique name or export name used by pac
  --auth-profile <name>    PAC auth profile to select before export (for example: Dev)
  --output-dir <path>      Folder for zip artifacts (default: ./solution)
  --source-dir <path>      Folder for unpacked source (default: ./solution-source)
  --include-managed        Also pack a managed zip (not needed if using Power Platform Pipelines)
  --skip-version-bump      Skip the automatic build-number increment
  --help                   Show this message

Behavior:
  1. Exports unmanaged to solution/solution-unmanaged.zip
  2. Rebuilds solution-source/ from that unmanaged zip
  3. Bumps the solution build version (e.g. 1.0.3.0 → 1.0.4.0) unless --skip-version-bump
  4. Packs solution/solution-managed.zip only if --include-managed is set

Promotion to test/prod:
  Use Power Platform Pipelines (admin center) to deploy managed solutions.
  The pipeline handles the unmanaged → managed conversion automatically.

What to commit:
  Commit solution-source/.
  Do not commit solution/*.zip; those are build artifacts and are gitignored.
`);
}

function parseArgs(argv) {
  const options = {
    outputDir: path.resolve('solution'),
    sourceDir: path.resolve('solution-source'),
    includeManaged: false,
    authProfile: null,
    targetKey: 'dev',
    solutionName: null,
    skipVersionBump: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--include-managed') {
      options.includeManaged = true;
      continue;
    }

    if (arg === '--unmanaged-only') {
      // Legacy flag — unmanaged-only is now the default; accept silently
      continue;
    }

    if (arg === '--skip-version-bump') {
      options.skipVersionBump = true;
      continue;
    }

    if (arg === '--name') {
      options.solutionName = argv[index + 1] || null;
      index += 1;
      continue;
    }

    if (arg === '--auth-profile') {
      options.authProfile = argv[index + 1] || null;
      index += 1;
      continue;
    }

    if (arg === '--target') {
      options.targetKey = String(argv[index + 1] || 'dev').toLowerCase();
      index += 1;
      continue;
    }

    if (arg === '--output-dir') {
      options.outputDir = path.resolve(argv[index + 1] || '');
      index += 1;
      continue;
    }

    if (arg === '--source-dir') {
      options.sourceDir = path.resolve(argv[index + 1] || '');
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  showHelp();
  process.exit(0);
}

if (!options.solutionName) {
  fail('Missing required --name <solution-name>.');
}

const pacBin = resolvePacBin();
if (!pacBin) {
  fail('pac CLI not found. Install it or set PAC_BIN.');
}

const opBin = resolveCommand('op', 'OP_BIN');
const use1PasswordWrapper = Boolean(opBin) && hasOpReferences();
const loadedState = loadState();
const credentialValues = resolveCredentialValues({ rootDir: process.cwd(), opBin });
const wizardState = getWizardStateSnapshot((key, fallback) => ({
  WIZARD_TARGET_ENV: process.env.WIZARD_TARGET_ENV || loadedState.WIZARD_TARGET_ENV || options.targetKey || 'dev',
  PP_ENV_DEV: loadedState.PP_ENV_DEV || credentialValues.PP_ENV_DEV || '',
  PP_ENV_TEST: loadedState.PP_ENV_TEST || credentialValues.PP_ENV_TEST || '',
  PP_ENV_PROD: loadedState.PP_ENV_PROD || credentialValues.PP_ENV_PROD || '',
}[key] ?? fallback));

function runPac(args) {
  if (use1PasswordWrapper) {
    execFileSync(opBin, ['run', '--env-file=.env', '--', pacBin, ...args], { stdio: 'inherit' });
    return;
  }

  execFileSync(pacBin, args, { stdio: 'inherit' });
}

if (options.authProfile) {
  if (!isRepoScopedProfileName(options.authProfile)) {
    fail(`Refusing to use non-repo-scoped PAC profile: ${options.authProfile}`);
  }
  console.log(`Selecting PAC auth profile: ${options.authProfile}`);
  runPac(['auth', 'select', '--name', options.authProfile]);
} else {
  selectAndVerifyPacProfile({
    pac: pacBin,
    rootDir: process.cwd(),
    wizardState,
    targetKey: options.targetKey,
    profileType: 'spn',
    credentialValues,
    powerConfigPath: path.resolve('power.config.json'),
    requireCredentialMatch: true,
    requirePowerConfig: false,
    requirePowerConfigTarget: false,
    runSafeImpl: (file, args) => {
      try {
        return execFileSync(file, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      } catch {
        return null;
      }
    },
  });
}

fs.mkdirSync(options.outputDir, { recursive: true });

const unmanagedZip = path.join(options.outputDir, 'solution-unmanaged.zip');
const managedZip = path.join(options.outputDir, 'solution-managed.zip');

console.log(`Exporting unmanaged solution '${options.solutionName}' to ${unmanagedZip}`);
runPac(['solution', 'export', '--path', unmanagedZip, '--name', options.solutionName, '--managed', 'false']);

console.log(`Refreshing unpacked source in ${options.sourceDir}`);
fs.rmSync(options.sourceDir, { recursive: true, force: true });
runPac(['solution', 'unpack', '--zipfile', unmanagedZip, '--folder', options.sourceDir, '--process-canvas-apps']);

// ── Auto-bump build version ──
if (!options.skipVersionBump) {
  const solutionXml = path.join(options.sourceDir, 'Other', 'Solution.xml');
  if (fs.existsSync(solutionXml)) {
    const xml = fs.readFileSync(solutionXml, 'utf8');
    const versionMatch = xml.match(/<Version>([\d.]+)<\/Version>/);
    if (versionMatch) {
      const oldVersion = versionMatch[1];
      const parts = oldVersion.split('.').map(Number);
      // Bump the build segment (index 2): 1.0.3.0 → 1.0.4.0
      parts[2] = (parts[2] || 0) + 1;
      const newVersion = parts.join('.');
      const updatedXml = xml.replace(
        `<Version>${oldVersion}</Version>`,
        `<Version>${newVersion}</Version>`,
      );
      fs.writeFileSync(solutionXml, updatedXml, 'utf8');
      console.log(`  Solution version: ${oldVersion} → ${newVersion}`);
    } else {
      console.log('  Could not parse version from Solution.xml — skipping bump.');
    }
  } else {
    console.log('  Solution.xml not found after unpack — skipping version bump.');
  }
}

if (options.includeManaged) {
  console.log(`Packing managed solution to ${managedZip}`);
  runPac(['solution', 'pack', '--zipfile', managedZip, '--folder', options.sourceDir, '--type', 'Managed']);
}

console.log('');
console.log('Solution export complete.');
console.log(`  Unmanaged zip: ${path.relative(process.cwd(), unmanagedZip)}`);
console.log(`  Source to commit: ${path.relative(process.cwd(), options.sourceDir)}`);
if (options.includeManaged) {
  console.log(`  Managed zip: ${path.relative(process.cwd(), managedZip)}`);
}
console.log('  Commit solution-source/ and leave solution/*.zip uncommitted.');