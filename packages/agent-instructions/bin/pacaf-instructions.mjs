#!/usr/bin/env node
// pacaf-instructions — materialize / check agent guidance files in a target repo.
//
// Subcommands:
//   sync   [--target DIR]   Copy instruction/rule files into the target repo.
//   check  [--target DIR]   Compare installed versions against this package.
//   list                    Print which files this package provides.
//   version                 Print the package version.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const require_ = createRequire(import.meta.url);
const pkg = require_(path.join(pkgRoot, 'package.json'));

const SOURCES = [
  { from: 'instructions', to: '.github/instructions' },
  { from: 'claude',       to: '.claude/rules' },
  { from: 'cursor',       to: '.cursor/rules' },
];

const META_FILES = [
  { from: 'meta/copilot-instructions.md', to: '.github/copilot-instructions.md' },
  { from: 'meta/AGENTS.md', to: 'AGENTS.md' },
  { from: 'meta/CLAUDE.md', to: 'CLAUDE.md' },
];

function parseArgs(argv) {
  const args = { target: process.cwd(), force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target' || a === '-t') args.target = path.resolve(argv[++i]);
    else if (a === '--force' || a === '-f') args.force = true;
    else if (!args.cmd) args.cmd = a;
  }
  return args;
}

function copyTree(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return { copied: 0 };
  fs.mkdirSync(dstDir, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyTree(src, dst).copied;
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dst);
      copied++;
    }
  }
  return { copied };
}

function sync(target) {
  let total = 0;
  for (const src of SOURCES) {
    const result = copyTree(path.join(pkgRoot, src.from), path.join(target, src.to));
    total += result.copied;
    console.log(`  ${src.from}/ → ${src.to}/  (${result.copied} files)`);
  }
  for (const m of META_FILES) {
    const srcFile = path.join(pkgRoot, m.from);
    if (!fs.existsSync(srcFile)) continue;
    const dstFile = path.join(target, m.to);
    fs.mkdirSync(path.dirname(dstFile), { recursive: true });
    fs.copyFileSync(srcFile, dstFile);
    total++;
    console.log(`  ${m.from} → ${m.to}`);
  }
  const stamp = {
    package: pkg.name,
    version: pkg.version,
    installedAt: new Date().toISOString(),
    layout: 'thin',
  };
  fs.writeFileSync(path.join(target, '.foundations-version.json'), JSON.stringify(stamp, null, 2) + '\n');
  console.log(`\nInstalled ${total} files. Recorded ${pkg.name}@${pkg.version} in .foundations-version.json`);
}

function check(target) {
  const stampPath = path.join(target, '.foundations-version.json');
  if (!fs.existsSync(stampPath)) {
    console.log(`No .foundations-version.json in ${target}. Run "pacaf-instructions sync" to install.`);
    process.exit(1);
  }
  const stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  const installed = stamp.version || '0.0.0';
  if (installed === pkg.version) {
    console.log(`Up to date: ${pkg.name}@${installed}`);
  } else {
    console.log(`Drift: installed ${pkg.name}@${installed}, package version ${pkg.version}`);
    console.log('Run "pacaf-instructions sync" to refresh.');
    process.exit(2);
  }
}

function list() {
  console.log(`${pkg.name}@${pkg.version} provides:`);
  for (const s of SOURCES) console.log(`  ${s.from}/  →  ${s.to}/`);
  for (const m of META_FILES) console.log(`  ${m.from}  →  ${m.to}`);
}

function usage() {
  console.log(`pacaf-instructions <command> [--target DIR]
  sync     Copy guidance files into the target repo (default cwd).
  check    Compare installed version against package version.
  list     Show what files this package provides.
  version  Print package version.
`);
}

const args = parseArgs(process.argv.slice(2));
switch (args.cmd) {
  case 'sync':    sync(args.target); break;
  case 'check':   check(args.target); break;
  case 'list':    list(); break;
  case 'version': console.log(pkg.version); break;
  default:        usage();
}
