#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';

const TEMPLATE_REPO = 'martycarreras-psnl/PAppsCAFoundations';
const TEMPLATE_BRANCH = 'main';
const TEMPLATE_GIT_URL = `https://github.com/${TEMPLATE_REPO}.git`;
const SYNC_DIRS = ['.github/instructions', 'wizard', 'scripts', 'docs'];
const SYNC_FILES = ['.env.template', '.foundations-version.json'];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const autoYes = args.has('--yes') || args.has('-y');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function run(file, fileArgs, options = {}) {
  return execFileSync(file, fileArgs, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function walkFiles(rootDir) {
  const files = [];

  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    visit(rootDir);
  }

  return files;
}

function sameContent(left, right) {
  if (!fs.existsSync(left) || !fs.existsSync(right)) {
    return false;
  }

  const leftBuffer = fs.readFileSync(left);
  const rightBuffer = fs.readFileSync(right);
  return leftBuffer.equals(rightBuffer);
}

function showDiff(relativePath, templateFile) {
  const currentFile = path.resolve(relativePath);
  const result = spawnSync(
    'git',
    ['--no-pager', 'diff', '--no-index', '--', currentFile, templateFile],
    { stdio: 'inherit' },
  );

  if (result.status !== 0 && result.status !== 1) {
    console.warn(`WARN: could not render diff for ${relativePath}`);
  }
}

async function promptYesNo(message, defaultYes = false) {
  if (autoYes) {
    console.log(`${message} ${defaultYes ? '[Y/n]' : '[y/N]'} y (auto)`);
    return true;
  }

  const rl = readline.createInterface({ input, output });
  const answer = (await rl.question(`${message} ${defaultYes ? '[Y/n]' : '[y/N]'} `)).trim().toLowerCase();
  await rl.close();

  if (!answer) {
    return defaultYes;
  }

  return answer === 'y' || answer === 'yes';
}

/**
 * Merge Foundations-required scripts into the project's package.json.
 * Preserves any existing scripts the user added; overwrites only the
 * keys that Foundations manages (prebuild, deploy, setup:auth, etc.).
 */
function mergeRequiredScripts() {
  const pkgPath = path.resolve('package.json');
  if (!fs.existsSync(pkgPath)) return;

  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch { return; }

  const isWin = process.platform === 'win32';
  const devLocal = isWin
    ? 'set VITE_USE_MOCK=true && vite --port 3000'
    : 'VITE_USE_MOCK=true vite --port 3000';

  const required = {
    dev: 'concurrently "vite --port 3000" "pac code run"',
    'dev:local': devLocal,
    'prototype:seed': 'node scripts/seed-prototype-assets.mjs dataverse/planning-payload.json',
    typecheck: 'tsc --noEmit',
    prebuild: 'node scripts/patch-datasources-info.mjs',
    build: 'npm run typecheck && vite build',
    deploy: 'npm run build && node scripts/pac-safe.mjs --target dev --profile-type spn --mutating code push',
    'setup:auth': 'node scripts/setup-auth.mjs',
    pac: 'node scripts/op-pac.mjs',
    'solution:export': 'node scripts/export-solution.mjs --name YourSolutionName --target dev',
    'solution:export:unmanaged': 'node scripts/export-solution.mjs --name YourSolutionName --target dev --unmanaged-only',
    'validate:schema-plan': 'node scripts/validate-schema-plan.mjs dataverse/planning-payload.json',
    'generate:dataverse-plan': 'node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json',
    'register:dataverse': 'node scripts/register-dataverse-data-sources.mjs dataverse/register-datasources.plan.json',
    'sync:foundations': 'node scripts/sync-foundations.mjs',
  };

  const before = JSON.stringify(pkg.scripts || {});
  pkg.scripts = { ...(pkg.scripts || {}), ...required };

  if (JSON.stringify(pkg.scripts) !== before) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('Merged required scripts into package.json (prebuild, deploy, etc.)');
  }
}

console.log('');
console.log('================================================');
console.log('  Sync Foundations - Pull latest from template');
console.log('================================================');
console.log('');

if (!fs.existsSync(path.resolve('.git'))) {
  fail('Not a git repository. Run this from your project root.');
}

const workingTreeStatus = run('git', ['status', '--porcelain']);
if (workingTreeStatus) {
  fail('Working tree has uncommitted changes. Commit or stash first.');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'foundations-sync-'));
// Restrict temp directory to owner-only (prevents other system users from reading downloaded files)
try { fs.chmodSync(tempRoot, 0o700); } catch { /* best-effort: Windows ignores this */ }

// Clean up temp directory on unexpected termination
const cleanupAndExit = () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch { /* already gone */ }
  process.exit(1);
};
process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

try {
  console.log(`Fetching latest foundations from ${TEMPLATE_REPO}...`);
  let fetched = false;

  try {
    execFileSync('npx', ['--yes', 'degit', `${TEMPLATE_REPO}#${TEMPLATE_BRANCH}`, tempRoot, '--force'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    fetched = true;
  } catch {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.mkdirSync(tempRoot, { recursive: true });
    execFileSync('git', ['clone', '--depth', '1', '--branch', TEMPLATE_BRANCH, TEMPLATE_GIT_URL, tempRoot], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const nestedGitDir = path.join(tempRoot, '.git');
    if (fs.existsSync(nestedGitDir)) {
      fs.rmSync(nestedGitDir, { recursive: true, force: true });
    }
    fetched = true;
  }

  if (!fetched) {
    fail('unable to fetch the template repository');
  }
  console.log('Template downloaded');

  const changed = [];
  const added = [];
  let unchanged = 0;

  for (const dir of SYNC_DIRS) {
    for (const templateFile of walkFiles(path.join(tempRoot, dir))) {
      const relativePath = path.relative(tempRoot, templateFile);
      const localFile = path.resolve(relativePath);
      if (!fs.existsSync(localFile)) {
        added.push(relativePath);
      } else if (!sameContent(templateFile, localFile)) {
        changed.push(relativePath);
      } else {
        unchanged += 1;
      }
    }
  }

  for (const file of SYNC_FILES) {
    const templateFile = path.join(tempRoot, file);
    if (!fs.existsSync(templateFile)) {
      continue;
    }

    const localFile = path.resolve(file);
    if (!fs.existsSync(localFile)) {
      added.push(file);
    } else if (!sameContent(templateFile, localFile)) {
      changed.push(file);
    } else {
      unchanged += 1;
    }
  }

  const total = changed.length + added.length;
  if (total === 0) {
    console.log(`Already up to date! (${unchanged} files checked)`);
    process.exit(0);
  }

  console.log(`${changed.length} file(s) changed, ${added.length} new file(s), ${unchanged} unchanged`);
  console.log('');

  if (changed.length > 0) {
    console.log('Modified:');
    for (const file of changed) {
      console.log(`  M ${file}`);
    }
  }

  if (added.length > 0) {
    console.log('New:');
    for (const file of added) {
      console.log(`  A ${file}`);
    }
  }

  if (changed.length > 0) {
    console.log('');
    console.log('--- Diffs ---');
    for (const file of changed) {
      console.log('');
      console.log(`--- ${file}`);
      showDiff(file, path.join(tempRoot, file));
    }
    console.log('');
  }

  if (dryRun) {
    console.log('Dry run - no files were changed.');
    process.exit(0);
  }

  const apply = await promptYesNo('Apply these updates?', false);
  if (!apply) {
    console.log('Cancelled.');
    process.exit(0);
  }

  for (const file of [...changed, ...added]) {
    const destination = path.resolve(file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(tempRoot, file), destination);
  }
  console.log(`Applied ${total} file update(s)`);

  // ── Merge required scripts into package.json ──
  mergeRequiredScripts();

  const commit = await promptYesNo('Commit the updates?', true);
  if (!commit) {
    console.log('Files updated but not committed. Review and commit when ready.');
    process.exit(0);
  }

  execFileSync('git', ['add', '-A'], { stdio: 'inherit' });
  const filesList = [...changed, ...added].map((file) => `  - ${file}`).join('\n');
  const commitMessage = `chore: sync foundations from ${TEMPLATE_REPO}\n\nUpdated ${changed.length} file(s), added ${added.length} new file(s).\n\nFiles synced:\n${filesList}`;
  execFileSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' });
  console.log('Changes committed');
  console.log('Review the commit, then push when ready: git push');
} catch (error) {
  const stderr = error?.stderr?.toString?.().trim();
  fail(stderr || error.message || 'sync failed');
} finally {
  process.removeListener('SIGINT', cleanupAndExit);
  process.removeListener('SIGTERM', cleanupAndExit);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
