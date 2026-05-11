#!/usr/bin/env node
// pacaf-rebrand — retarget a fork of this monorepo to a different scope/binPrefix.
//
// Usage:
//   pacaf-rebrand                            # print current branding
//   pacaf-rebrand --scope @contoso           # change scope only
//   pacaf-rebrand --scope @contoso --bin-prefix cpcaf  # change both
//   pacaf-rebrand --docs-url https://...     # update docs URL
//   pacaf-rebrand --dry-run                  # show planned changes without writing
//
// Reads pacaf.config.json at the repo root, computes the rename, then rewrites:
//   - pacaf.config.json
//   - packages/*/package.json   (name + every bin key matching old binPrefix)
//   - README references to old scope/binPrefix
//
// Always run with a clean git tree so you can review the diff.

import fs from 'node:fs';
import path from 'node:path';

function findRepoRoot(start) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pacaf.config.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('Could not find pacaf.config.json in any ancestor directory.');
}

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--scope':       out.scope = argv[++i]; break;
      case '--bin-prefix':  out.binPrefix = argv[++i]; break;
      case '--docs-url':    out.docsUrl = argv[++i]; break;
      case '--template-repo': out.templateRepo = argv[++i]; break;
      case '--dry-run':     out.dryRun = true; break;
      case '--help':
      case '-h':
        out.help = true; break;
      default:
        console.error(`Unknown arg: ${a}`);
        process.exit(2);
    }
  }
  return out;
}

function loadConfig(repoRoot) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'pacaf.config.json'), 'utf8'));
}

function writeJson(file, obj, dryRun, label) {
  const next = JSON.stringify(obj, null, 2) + '\n';
  if (dryRun) {
    console.log(`  would write ${label || path.relative(process.cwd(), file)}`);
    return;
  }
  fs.writeFileSync(file, next);
  console.log(`  wrote     ${label || path.relative(process.cwd(), file)}`);
}

function rebrandPackageJson(file, oldScope, newScope, oldPrefix, newPrefix, dryRun) {
  if (!fs.existsSync(file)) return;
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = false;
  if (typeof pkg.name === 'string' && pkg.name.startsWith(oldScope + '/')) {
    pkg.name = newScope + pkg.name.slice(oldScope.length);
    changed = true;
  }
  if (pkg.bin && typeof pkg.bin === 'object') {
    const nextBin = {};
    for (const [k, v] of Object.entries(pkg.bin)) {
      const renamedKey = k.startsWith(oldPrefix + '-') ? newPrefix + k.slice(oldPrefix.length) : k;
      nextBin[renamedKey] = v;
      if (renamedKey !== k) changed = true;
    }
    pkg.bin = nextBin;
  }
  if (changed) writeJson(file, pkg, dryRun);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`pacaf-rebrand [--scope @newscope] [--bin-prefix newprefix] [--docs-url URL] [--template-repo owner/repo] [--dry-run]`);
    return;
  }

  const repoRoot = findRepoRoot(process.cwd());
  const cfg = loadConfig(repoRoot);

  const oldScope = cfg.scope;
  const oldPrefix = cfg.binPrefix;
  const newScope = args.scope || oldScope;
  const newPrefix = args.binPrefix || oldPrefix;

  if (!args.scope && !args.binPrefix && !args.docsUrl && !args.templateRepo) {
    console.log('Current branding:');
    console.log(`  scope:        ${cfg.scope}`);
    console.log(`  binPrefix:    ${cfg.binPrefix}`);
    console.log(`  templateRepo: ${cfg.templateRepo}`);
    console.log(`  docsUrl:      ${cfg.docsUrl}`);
    console.log('\nProvide --scope and/or --bin-prefix to rebrand.');
    return;
  }

  if (newScope === oldScope && newPrefix === oldPrefix && !args.docsUrl && !args.templateRepo) {
    console.log('Nothing to change.');
    return;
  }

  if (!/^@[a-z0-9][a-z0-9-]*$/.test(newScope)) {
    console.error(`Invalid scope ${newScope}. Expected pattern @[a-z0-9-]+ with leading @.`);
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(newPrefix)) {
    console.error(`Invalid bin-prefix ${newPrefix}.`);
    process.exit(1);
  }

  console.log(`Rebranding ${oldScope}/* (${oldPrefix}-*) → ${newScope}/* (${newPrefix}-*)`);
  console.log(args.dryRun ? '(dry-run)\n' : '');

  // 1. pacaf.config.json
  cfg.scope = newScope;
  cfg.binPrefix = newPrefix;
  if (args.docsUrl) cfg.docsUrl = args.docsUrl;
  if (args.templateRepo) cfg.templateRepo = args.templateRepo;
  writeJson(path.join(repoRoot, 'pacaf.config.json'), cfg, args.dryRun);

  // 2. each packages/*/package.json
  const pkgsDir = path.join(repoRoot, 'packages');
  if (fs.existsSync(pkgsDir)) {
    for (const entry of fs.readdirSync(pkgsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      rebrandPackageJson(path.join(pkgsDir, entry.name, 'package.json'), oldScope, newScope, oldPrefix, newPrefix, args.dryRun);
    }
  }

  console.log('\nDone. Next steps:');
  console.log('  1. Review with: git diff');
  console.log('  2. Update README.md and FORKING.md scope references manually if needed.');
  console.log('  3. Run: pnpm install');
  console.log('  4. Verify: pnpm -r run build');
  console.log('  5. Publish: pnpm changeset version && pnpm -r publish --access public');
}

main();
