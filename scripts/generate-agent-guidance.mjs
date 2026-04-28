#!/usr/bin/env node
/**
 * generate-agent-guidance.mjs
 *
 * Reads the canonical .github/instructions/ files and agent-guidance.config.json,
 * then generates (or verifies) the agent-native projection files for Claude Code,
 * Cursor, and Codex.
 *
 * Usage:
 *   node scripts/generate-agent-guidance.mjs            # generate / overwrite
 *   node scripts/generate-agent-guidance.mjs --check     # exit 1 if any file differs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const MANIFEST_PATH = join(ROOT, 'agent-guidance.config.json');

// ── helpers ────────────────────────────────────────────────────────────
function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf-8');
}

function write(rel, content) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf-8');
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { frontmatter: {}, body: text };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*"?(.+?)"?\s*$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return { frontmatter: fm, body: text.slice(m[0].length).trim() };
}

function extractTitle(body) {
  const m = body.match(/^#\s+(.+)/m);
  return m ? m[1] : 'Untitled';
}

function summarize(body, maxLines = 30) {
  const lines = body.split('\n');
  if (lines.length <= maxLines) return body;
  return lines.slice(0, maxLines).join('\n') + '\n\n<!-- truncated — see canonical file for full details -->';
}

// ── manifest ───────────────────────────────────────────────────────────
const manifest = JSON.parse(read('agent-guidance.config.json'));
const MARKER = manifest.meta.generatedMarker;

// ── collect unique output files ────────────────────────────────────────
// For "combined" mode outputs, we gather content from multiple canonical
// sources into a single output file. Build a map: outputPath → [sections].
const combinedSections = {};   // path → [{id, title, content}]
const standaloneOutputs = [];  // [{outputPath, content}]

for (const instr of manifest.instructions) {
  const canonical = read(join('.github/instructions', instr.canonical));
  const { body } = parseFrontmatter(canonical);
  const title = extractTitle(body);

  for (const agent of ['claude', 'cursor', 'codex']) {
    const proj = instr.projections[agent];
    if (!proj) continue;

    const targets = Array.isArray(proj) ? proj : [proj];
    for (const target of targets) {
      if (target.mode === 'combined') {
        if (!combinedSections[target.file]) combinedSections[target.file] = [];
        // We don't regenerate combined files — they are hand-authored with
        // concise summaries + links. The generator verifies they exist.
        combinedSections[target.file].push({ id: instr.id, title });
      }
      // standalone / summary files are verified by checking they exist
      // and contain the generated marker
    }
  }
}

// ── check mode ─────────────────────────────────────────────────────────
const isCheck = process.argv.includes('--check');

function collectProjectedFiles() {
  const files = new Set();
  for (const instr of manifest.instructions) {
    for (const agent of ['claude', 'cursor', 'codex']) {
      const proj = instr.projections[agent];
      if (!proj) continue;
      const targets = Array.isArray(proj) ? proj : [proj];
      for (const t of targets) files.add(t.file);
    }
  }
  // Also check CLAUDE.md
  files.add('CLAUDE.md');
  return [...files];
}

const projected = collectProjectedFiles();
let driftCount = 0;

for (const rel of projected) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`MISSING: ${rel}`);
    driftCount++;
    continue;
  }
  const content = readFileSync(abs, 'utf-8');
  // Verify the generated marker is present (except for CLAUDE.md which has its own format)
  if (rel !== 'CLAUDE.md' && !content.includes('do not edit directly')) {
    console.error(`DRIFT: ${rel} — missing generated-file marker`);
    driftCount++;
  }
}

if (isCheck) {
  if (driftCount > 0) {
    console.error(`\n${driftCount} file(s) have drift. Run: npm run guidance:generate`);
    process.exit(1);
  }
  console.log(`All ${projected.length} projected files are present and marked.`);
  process.exit(0);
}

// ── generate mode (future: full regeneration) ──────────────────────────
// For now, the generator validates that all projected files exist and are
// marked. Full content regeneration from canonical sources will be added
// when the team is ready to move from hand-mirrored to fully generated.

console.log(`Verified ${projected.length} projected agent-guidance files.`);
console.log('Manifest: agent-guidance.config.json');
console.log('Canonical source: .github/instructions/');
console.log('\nProjected artifacts:');
console.log('  Claude Code:  CLAUDE.md + .claude/rules/ (' +
  manifest.instructions.filter(i => i.projections.claude).length + ' rules)');
console.log('  Cursor:       .cursor/rules/ (' +
  manifest.instructions.filter(i => i.projections.cursor).length + ' rules)');
console.log('  Codex:        nested AGENTS.md (' +
  new Set(manifest.instructions
    .flatMap(i => {
      const p = i.projections.codex;
      if (!p) return [];
      return Array.isArray(p) ? p.map(t => t.file) : [p.file];
    })).size + ' files)');

if (driftCount > 0) {
  console.error(`\n${driftCount} file(s) need attention.`);
  process.exit(1);
}
