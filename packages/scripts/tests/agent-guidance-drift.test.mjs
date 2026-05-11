import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf-8');
}

describe('agent-guidance projection drift checks', () => {
  const manifest = JSON.parse(read('agent-guidance.config.json'));

  it('manifest is valid JSON with expected shape', () => {
    assert.ok(manifest.meta);
    assert.ok(manifest.instructions);
    assert.ok(Array.isArray(manifest.instructions));
    assert.ok(manifest.instructions.length > 0);
  });

  it('every canonical file referenced in the manifest exists', () => {
    for (const instr of manifest.instructions) {
      const canonical = join(ROOT, '.github/instructions', instr.canonical);
      assert.ok(existsSync(canonical), `Missing canonical: ${instr.canonical}`);
    }
  });

  it('CLAUDE.md exists and imports AGENTS.md', () => {
    const claude = read('CLAUDE.md');
    assert.ok(claude.includes('@AGENTS.md'), 'CLAUDE.md must import AGENTS.md');
  });

  it('all Claude rule files exist and have generated marker', () => {
    for (const instr of manifest.instructions) {
      const proj = instr.projections.claude;
      if (!proj) continue;
      const abs = join(ROOT, proj.file);
      assert.ok(existsSync(abs), `Missing Claude rule: ${proj.file}`);
      const content = readFileSync(abs, 'utf-8');
      assert.ok(
        content.includes('do not edit directly'),
        `Claude rule ${proj.file} missing generated marker`
      );
    }
  });

  it('all Cursor rule files exist and have generated marker', () => {
    for (const instr of manifest.instructions) {
      const proj = instr.projections.cursor;
      if (!proj) continue;
      const abs = join(ROOT, proj.file);
      assert.ok(existsSync(abs), `Missing Cursor rule: ${proj.file}`);
      const content = readFileSync(abs, 'utf-8');
      assert.ok(
        content.includes('do not edit directly'),
        `Cursor rule ${proj.file} missing generated marker`
      );
    }
  });

  it('all Codex nested AGENTS.md files exist and have generated marker', () => {
    const seen = new Set();
    for (const instr of manifest.instructions) {
      const proj = instr.projections.codex;
      if (!proj) continue;
      const targets = Array.isArray(proj) ? proj : [proj];
      for (const t of targets) {
        if (seen.has(t.file)) continue;
        seen.add(t.file);
        const abs = join(ROOT, t.file);
        assert.ok(existsSync(abs), `Missing Codex file: ${t.file}`);
        const content = readFileSync(abs, 'utf-8');
        assert.ok(
          content.includes('do not edit directly'),
          `Codex file ${t.file} missing generated marker`
        );
      }
    }
  });

  it('Cursor rules use correct frontmatter fields', () => {
    for (const instr of manifest.instructions) {
      const proj = instr.projections.cursor;
      if (!proj) continue;
      const content = readFileSync(join(ROOT, proj.file), 'utf-8');
      // Must have frontmatter
      assert.ok(content.startsWith('---'), `${proj.file} missing frontmatter`);
      // Must have alwaysApply
      assert.ok(
        content.includes('alwaysApply:'),
        `${proj.file} missing alwaysApply field`
      );
    }
  });

  it('Claude path-scoped rules have paths frontmatter', () => {
    for (const instr of manifest.instructions) {
      const proj = instr.projections.claude;
      if (!proj || !proj.paths) continue;
      const content = readFileSync(join(ROOT, proj.file), 'utf-8');
      assert.ok(
        content.includes('paths:'),
        `Claude rule ${proj.file} should have paths frontmatter`
      );
    }
  });

  it('no projected file is larger than 500 lines', () => {
    const allFiles = new Set();
    for (const instr of manifest.instructions) {
      for (const agent of ['claude', 'cursor', 'codex']) {
        const proj = instr.projections[agent];
        if (!proj) continue;
        const targets = Array.isArray(proj) ? proj : [proj];
        for (const t of targets) allFiles.add(t.file);
      }
    }
    allFiles.add('CLAUDE.md');
    for (const rel of allFiles) {
      const content = readFileSync(join(ROOT, rel), 'utf-8');
      const lines = content.split('\n').length;
      assert.ok(
        lines <= 500,
        `${rel} has ${lines} lines (max 500 for agent context efficiency)`
      );
    }
  });
});
