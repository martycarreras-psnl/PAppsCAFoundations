#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadTarget } from '../lib/pa-deploy.mjs';
import { PA_VERSION, SDK_VERSION, TARGETS_FILE } from '../lib/pa.mjs';

const RECEIPT = '.pacaf-pa-migration.json';
const TARGETS = TARGETS_FILE;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENVIRONMENT_ID = /^(?:Default-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PINS = { '@microsoft/power-apps-cli': PA_VERSION, '@microsoft/power-apps': SDK_VERSION };
const digest = (text) => createHash('sha256').update(text).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function readText(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular file: ${path.basename(file)}`);
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  const text = readText(file);
  try {
    const value = JSON.parse(text);
    if (!object(value)) throw new Error();
    return value;
  } catch {
    throw new Error(`Invalid JSON object: ${path.basename(file)}`);
  }
}

function binPrefix(cwd) {
  const config = path.join(cwd, 'pacaf.config.json');
  let prefix;
  if (fs.existsSync(config)) prefix = readJson(config).binPrefix;
  if (prefix === undefined) {
    const installed = readJson(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json'));
    const prefixes = Object.entries(installed.bin ?? {})
      .filter(([, entry]) => typeof entry === 'string' && entry.endsWith('/pacaf-migrate-pa.mjs'))
      .map(([name]) => name.replace(/-migrate-pa$/, ''));
    if (prefixes.length > 1) throw new Error('Ambiguous scripts-package bin prefix.');
    prefix = prefixes[0] ?? 'pacaf';
  }
  if (typeof prefix !== 'string' || !/^[a-z][a-z0-9-]*$/.test(prefix)) {
    throw new Error('Invalid pacaf.config.json binPrefix.');
  }
  return prefix;
}

function packageManager(cwd, pkg) {
  const pnpm = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'));
  const npm = fs.existsSync(path.join(cwd, 'package-lock.json')) || fs.existsSync(path.join(cwd, 'npm-shrinkwrap.json'));
  if (pnpm && npm) throw new Error('Multiple package-manager lockfiles; resolve explicitly before migration.');
  if (fs.existsSync(path.join(cwd, 'yarn.lock')) || fs.existsSync(path.join(cwd, 'bun.lockb')) ||
      fs.existsSync(path.join(cwd, 'bun.lock'))) throw new Error('Only existing npm/pnpm projects are supported.');
  const declared = pkg.packageManager?.split('@')[0];
  if (declared && !['pnpm', 'npm'].includes(declared)) throw new Error('Unsupported packageManager; migrate manually.');
  if ((declared === 'pnpm' && npm) || (declared === 'npm' && pnpm)) {
    throw new Error('packageManager conflicts with the existing lockfile.');
  }
  return declared ?? (pnpm ? 'pnpm' : 'npm');
}

function validateTarget(cwd, errors) {
  const config = readJson(path.join(cwd, 'power.config.json'));
  const file = path.join(cwd, TARGETS);
  if (!fs.existsSync(file)) {
    errors.push(`Create and review ${TARGETS}: version 1, targets.dev with environmentId, environmentUrl, tenantId, account, appId, solutionId, solutionName. Identity is never inferred from wizard state or ambient authentication.`);
    return;
  }
  const targets = readJson(file);
  if (targets.version !== 1 || !object(targets.targets?.dev)) {
    errors.push(`${TARGETS} must have version: 1 and targets.dev.`);
    return;
  }
  const dev = targets.targets.dev;
  for (const key of ['environmentId', 'tenantId', 'appId', 'solutionId']) {
    const format = key === 'environmentId' ? ENVIRONMENT_ID : GUID;
    if (typeof dev[key] !== 'string' || !format.test(dev[key]) || /^(?:Default-)?0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(dev[key])) {
      errors.push(`targets.dev.${key} must be a nonzero GUID${key === 'environmentId' ? ' or Default-GUID' : ''} (migration requires an existing app).`);
    }
  }
  if (dev.spnClientId !== undefined && (typeof dev.spnClientId !== 'string' || !GUID.test(dev.spnClientId))) {
    errors.push('targets.dev.spnClientId must be a GUID when supplied.');
  }
  if (typeof dev.account !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(dev.account)) {
    errors.push('targets.dev.account must be an explicit user account.');
  }
  if (typeof dev.solutionName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(dev.solutionName)) {
    errors.push('targets.dev.solutionName must be a solution unique name.');
  }
  try {
    const url = new URL(dev.environmentUrl);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search ||
        url.hash || url.port || url.pathname !== '/') throw new Error();
  } catch {
    errors.push('targets.dev.environmentUrl must be an HTTPS environment origin without credentials.');
  }
  for (const key of ['appId', 'environmentId']) {
    const format = key === 'environmentId' ? ENVIRONMENT_ID : GUID;
    if (typeof config[key] !== 'string' || !format.test(config[key]) ||
        config[key].toLowerCase() !== String(dev[key]).toLowerCase()) {
      errors.push(`power.config.json ${key} must match reviewed targets.dev.${key}; migration will not change it.`);
    }
  }
  for (const key of ['environmentUrl', 'tenantId', 'solutionId', 'solutionName']) {
    if (config[key] !== undefined && String(config[key]).replace(/\/$/, '').toLowerCase() !==
        String(dev[key]).replace(/\/$/, '').toLowerCase()) {
      errors.push(`power.config.json ${key} conflicts with reviewed targets.dev.${key}.`);
    }
  }
  try {
    loadTarget(cwd, { target: 'dev', auth: 'user', allowCreate: false });
  } catch (error) {
    errors.push(`Deployment target validation: ${error.message}`);
  }
}

export function planMigration(cwd) {
  const filename = path.join(cwd, 'package.json');
  const before = readText(filename);
  const pkg = readJson(filename);
  const manager = packageManager(cwd, pkg);
  const prefix = binPrefix(cwd);
  const errors = [];
  const changes = [];
  validateTarget(cwd, errors);
  if (!object(pkg.scripts)) throw new Error('package.json scripts must be an object.');
  if (typeof pkg.scripts.build !== 'string' || !pkg.scripts.build.trim()) {
    errors.push('Missing package.json build script; guarded deployment requires an explicit build.');
  }
  const desired = {
    dev: `concurrently --kill-others-on-fail "vite --port 3000 --strictPort" "${prefix}-pa app run --config-only --port 8080 --local-app-url http://localhost:3000"`,
    deploy: `${prefix}-deploy --target dev`,
    'setup:pa-auth': `${prefix}-pa auth login`,
  };
  const legacyDeploy = new RegExp(`^npm run build && (?:${prefix}-pac-safe|node scripts/pac-safe\\.mjs) --target dev --profile-type user --mutating(?: --solution-name "([A-Za-z_][A-Za-z0-9_]*)")? code push$`);
  for (const [name, command] of Object.entries(desired)) {
    const current = pkg.scripts[name];
    if (current === command) continue;
    const recognized = name === 'dev'
      ? current === 'concurrently "vite --port 3000" "pac code run"'
      : name === 'deploy'
        ? typeof current === 'string' && legacyDeploy.test(current)
        : current === undefined;
    if (!recognized) {
      errors.push(`Customized or unsupported scripts.${name}; left unchanged. Review and migrate it manually.`);
      continue;
    }
    if (name === 'deploy') {
      const solution = current.match(legacyDeploy)?.[1];
      const targetFile = path.join(cwd, TARGETS);
      if (solution && fs.existsSync(targetFile) &&
          solution !== readJson(targetFile).targets?.dev?.solutionName) {
        errors.push('Legacy deploy solution name conflicts with targets.dev.solutionName.');
        continue;
      }
    }
    pkg.scripts[name] = command;
    changes.push(`scripts.${name} → ${command}`);
  }
  for (const [name, command] of Object.entries(pkg.scripts)) {
    if (typeof command === 'string' &&
        (/\bpac(?:\.exe|\.cmd)?["']?\s+code\b/i.test(command) ||
         /\b(?:[\w-]+-pac(?:-safe)?|(?:op-pac|pac-safe)\.mjs)\b[^;&|\n]*\bcode(?:\s|$)/i.test(command))) {
      errors.push(`Remaining legacy Code App command in scripts.${name}; review and migrate this custom script manually before switching guidance.`);
    }
  }
  for (const [name, version] of Object.entries(PINS)) {
    const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
      .filter((section) => pkg[section]?.[name] !== undefined);
    if (sections.length > 1 || sections.some((section) => ['optionalDependencies', 'peerDependencies'].includes(section))) {
      errors.push(`Unsupported dependency placement for ${name}; migrate manually.`);
      continue;
    }
    const originalSection = sections[0];
    const section = name.endsWith('-cli') ? 'devDependencies' : (originalSection ?? 'dependencies');
    const current = originalSection && pkg[originalSection][name];
    if (current === version && originalSection === section) continue;
    if (current !== undefined) {
      const numeric = typeof current === 'string' && current.match(/^[~^]?(\d+)\.(\d+)\.(\d+)$/);
      if (!numeric || numeric.slice(1).map(Number).some((part, i, values) =>
        values.slice(0, i).every((prior, j) => prior === Number(version.split('.')[j])) &&
          part > Number(version.split('.')[i]))) {
        errors.push(`Unsupported or newer ${name} version; review manually rather than downgrade or replace it.`);
        continue;
      }
      if (originalSection && originalSection !== section) {
        delete pkg[originalSection][name];
        changes.push(`Move ${name} from ${originalSection} to ${section} (tooling readiness marker)`);
      }
    }
    pkg[section] ??= {};
    pkg[section][name] = version;
    changes.push(`${section}.${name} → ${version}`);
  }
  const indent = before.match(/^\s*\n([ \t]+)"/)?.[1] ?? 2;
  const newline = before.includes('\r\n') ? '\r\n' : '\n';
  const after = changes.length ? `${JSON.stringify(pkg, null, indent)}\n`.replace(/\n/g, newline) : before;
  return { before, after, manager, prefix, changes, errors };
}

function replaceManifest(cwd, text, mode) {
  const scratch = path.join(cwd, `.pacaf-pa-write-${randomUUID()}`);
  try {
    fs.writeFileSync(scratch, text, { flag: 'wx', mode });
    fs.chmodSync(scratch, mode);
    fs.renameSync(scratch, path.join(cwd, 'package.json'));
  } finally {
    if (fs.existsSync(scratch)) fs.unlinkSync(scratch);
  }
}

function rollback(cwd, log) {
  const file = path.join(cwd, RECEIPT);
  if (!fs.existsSync(file)) {
    log('No migration backup to roll back. No files changed.');
    return 0;
  }
  const receipt = readJson(file);
  if (receipt.version !== 1 || typeof receipt.before !== 'string' ||
      !/^[a-f0-9]{64}$/.test(receipt.afterHash) || !Number.isInteger(receipt.mode) ||
      receipt.mode < 0 || receipt.mode > 0o777 || !['npm', 'pnpm'].includes(receipt.manager)) {
    throw new Error('Invalid migration backup; restore manually.');
  }
  const current = readText(path.join(cwd, 'package.json'));
  if (digest(current) !== receipt.afterHash && current !== receipt.before) {
    throw new Error('package.json changed after migration; rollback refused to preserve your edits. Restore manually using the backup.');
  }
  if (current !== receipt.before) replaceManifest(cwd, receipt.before, receipt.mode);
  fs.unlinkSync(file);
  log(`Restored package.json only. Lockfiles/config/auth/bindings are unchanged. Run ${receipt.manager} install to reconcile installed dependencies and the existing lockfile; review the diff.`);
  return 0;
}

export function migrationMain(args = process.argv.slice(2), cwd = process.cwd(), log = console.log) {
  try {
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
      log('Usage: pacaf-migrate-pa [--check | --apply | --rollback]\nDefault: --check (read-only). --apply requires reviewed .power-apps-targets.json and backs up package.json locally. No install, authentication, cloud changes, or reinitialization.');
      return 0;
    }
    if (args.length > 1 || (args[0] && !['--check', '--apply', '--rollback'].includes(args[0]))) {
      throw new Error('Use exactly one of --check, --apply, --rollback (default: --check).');
    }
    if (args[0] === '--rollback') return rollback(cwd, log);
    const plan = planMigration(cwd);
    for (const change of plan.changes) log(`Proposed: ${change}`);
    for (const error of plan.errors) log(`Blocked: ${error}`);
    if (plan.errors.length) return 1;
    if (args[0] !== '--apply') {
      log(plan.changes.length ? 'Check only; no files changed. Review the plan, then use --apply.' : 'Manifest already migrated; no changes needed.');
    } else if (plan.changes.length) {
      const backup = path.join(cwd, RECEIPT);
      if (fs.existsSync(backup)) throw new Error(`Existing ${RECEIPT}; rollback or review it before another migration.`);
      const mode = fs.lstatSync(path.join(cwd, 'package.json')).mode & 0o777;
      // Write the recovery record first so even an interrupted replacement is reversible.
      fs.writeFileSync(backup, JSON.stringify({
        version: 1, before: plan.before, afterHash: digest(plan.after), mode, manager: plan.manager,
      }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      if (readText(path.join(cwd, 'package.json')) !== plan.before) {
        throw new Error('package.json changed while planning; no manifest written. Review the backup.');
      }
      replaceManifest(cwd, plan.after, mode);
      log(`Applied local manifest changes only. Backup: ${RECEIPT} (contains prior manifest; keep private and do not commit).`);
    } else {
      log('Manifest already migrated; no files changed.');
    }
    log(`Installation/lockfile reconciliation is a separate required step: ${plan.manager} install. Preserve your registry and dependency-build policy; review package.json and the existing lockfile, then run ${plan.manager} run build and ${plan.prefix}-deploy --target dev --preflight. Migration does not establish installed/frozen-lockfile readiness.`);
    return 0;
  } catch (error) {
    log(`Migration refused: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = migrationMain();
}
