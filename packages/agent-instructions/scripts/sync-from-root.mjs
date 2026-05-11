#!/usr/bin/env node
// sync-from-root.mjs — copy canonical sources from the monorepo root into
// this package's payload directories. Run before publishing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const repoRoot = path.resolve(pkgRoot, '..', '..');

const MAPPINGS = [
  { from: '.github/instructions', to: 'instructions' },
  { from: '.claude/rules',         to: 'claude' },
  { from: '.cursor/rules',         to: 'cursor' },
];

const SINGLE_FILES = [
  { from: '.github/copilot-instructions.md', to: 'meta/copilot-instructions.md' },
  { from: 'AGENTS.md',                       to: 'meta/AGENTS.md' },
  { from: 'CLAUDE.md',                       to: 'meta/CLAUDE.md' },
];

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyTree(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(dstDir, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(dstDir, entry.name);
    if (entry.isDirectory()) n += copyTree(s, d);
    else if (entry.isFile()) { fs.copyFileSync(s, d); n++; }
  }
  return n;
}

let total = 0;
for (const m of MAPPINGS) {
  const dst = path.join(pkgRoot, m.to);
  rmrf(dst);
  const n = copyTree(path.join(repoRoot, m.from), dst);
  console.log(`  ${m.from}/ → ${m.to}/  (${n} files)`);
  total += n;
}
for (const f of SINGLE_FILES) {
  const src = path.join(repoRoot, f.from);
  const dst = path.join(pkgRoot, f.to);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`  ${f.from} → ${f.to}`);
  total++;
}
console.log(`Synced ${total} files from ${repoRoot}`);
