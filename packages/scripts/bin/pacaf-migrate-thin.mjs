#!/usr/bin/env node
// pacaf-migrate-thin — convert legacy "fat" derived repo to "thin" layout.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const LEGACY_DIRS = ['wizard', 'wizard-ux', 'scripts', 'docs'];

const SCRIPT_REPLACEMENTS = {
  'node scripts/validate-schema-plan.mjs':           'pacaf-validate',
  'node scripts/generate-dataverse-plan.mjs':        'pacaf-generate',
  'node scripts/register-dataverse-data-sources.mjs':'pacaf-register',
  'node scripts/seed-prototype-assets.mjs':          'pacaf-seed',
  'node scripts/patch-datasources-info.mjs':         'pacaf-patch-datasources',
  'node scripts/discover-copilot-connection.mjs':    'pacaf-discover-connection',
  'node scripts/export-solution.mjs':                'pacaf-export-solution',
  'node scripts/op-pac.mjs':                         'pacaf-pac',
  'node scripts/pac-safe.mjs':                       'pacaf-pac-safe',
  'node scripts/setup-auth.mjs':                     'pacaf-setup-auth',
  'node scripts/sync-foundations.mjs':               'pacaf-update',
};

const REPO = process.cwd();

function isLegacy() {
  return LEGACY_DIRS.some((d) => fs.existsSync(path.join(REPO, d)));
}

function archive(dir) {
  const archiveDir = path.join(REPO, '.pacaf-archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const target = path.join(archiveDir, dir);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  if (dryRun) {
    console.log(`  would archive ${dir}/ → .pacaf-archive/${dir}/`);
  } else {
    fs.renameSync(path.join(REPO, dir), target);
    console.log(`  archived ${dir}/ → .pacaf-archive/${dir}/`);
  }
}

function rewritePackageJson() {
  const pkgPath = path.join(REPO, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.log('  no package.json — skipping');
    return;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let changed = false;
  if (pkg.scripts) {
    for (const [k, v] of Object.entries(pkg.scripts)) {
      let next = v;
      for (const [from, to] of Object.entries(SCRIPT_REPLACEMENTS)) {
        if (next.includes(from)) next = next.split(from).join(to);
      }
      if (next !== v) { pkg.scripts[k] = next; changed = true; }
    }
  }
  pkg.devDependencies = pkg.devDependencies || {};
  for (const dep of ['@pacaf/scripts', '@pacaf/agent-instructions']) {
    if (!pkg.devDependencies[dep] && !(pkg.dependencies && pkg.dependencies[dep])) {
      pkg.devDependencies[dep] = '^1.0.0';
      changed = true;
    }
  }
  if (changed) {
    if (dryRun) {
      console.log('  would rewrite package.json scripts + add @pacaf devDependencies');
    } else {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log('  rewrote package.json');
    }
  } else {
    console.log('  package.json already thin');
  }
}

function syncInstructions() {
  console.log('\nRefreshing agent instructions...');
  if (dryRun) {
    console.log('  would run: npx @pacaf/agent-instructions sync');
    return;
  }
  spawnSync('npx', ['--yes', '@pacaf/agent-instructions', 'sync'], { stdio: 'inherit', shell: process.platform === 'win32' });
}

function main() {
  if (!isLegacy()) {
    console.log('No legacy directories detected. Repo appears to already be thin.');
    process.exit(0);
  }
  console.log(`pacaf-migrate-thin — migrating ${REPO}\n`);
  if (dryRun) console.log('Mode: DRY RUN\n');

  console.log('1. Archiving legacy directories...');
  for (const d of LEGACY_DIRS) {
    if (fs.existsSync(path.join(REPO, d))) archive(d);
  }

  console.log('\n2. Rewriting package.json...');
  rewritePackageJson();

  console.log('\n3. Installing dependencies...');
  if (!dryRun) {
    const pm = fs.existsSync(path.join(REPO, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';
    spawnSync(pm, ['install'], { stdio: 'inherit', shell: process.platform === 'win32' });
  } else {
    console.log('  would run: npm install / pnpm install');
  }

  syncInstructions();

  console.log('\nDone. Review with `git diff`, verify with `npm run build`, then commit.');
}

main();
