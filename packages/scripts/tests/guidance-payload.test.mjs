import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = file => readFileSync(join(root, file), 'utf8');
const body = text => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
const manifest = JSON.parse(read('agent-guidance.config.json'));

test('published canonical, native and root guidance payloads match their sources byte-for-byte', () => {
  for (const [source, payload] of [
    ['.github/instructions', 'instructions'],
    ['.claude/rules', 'claude'],
    ['.cursor/rules', 'cursor'],
  ]) {
    const sources = readdirSync(join(root, source)).sort();
    assert.deepEqual(readdirSync(join(root, 'packages/agent-instructions', payload)).sort(), sources);
    for (const file of sources) {
      assert.equal(read(`packages/agent-instructions/${payload}/${file}`), read(`${source}/${file}`), file);
    }
  }
  for (const [source, file] of [
    ['AGENTS.md', 'AGENTS.md'], ['CLAUDE.md', 'CLAUDE.md'],
    ['.github/copilot-instructions.md', 'copilot-instructions.md'],
  ]) assert.equal(read(`packages/agent-instructions/meta/${file}`), read(source), source);
});

test('standalone migration projections contain current canonical bodies, not stale PAC summaries', () => {
  for (const instruction of manifest.instructions) {
    for (const agent of ['claude', 'cursor']) {
      const projection = instruction.projections[agent];
      for (const target of Array.isArray(projection) ? projection : [projection]) {
        if (!target || target.mode !== 'standalone') continue;
        const canonicalPath = `.github/instructions/${instruction.canonical}`;
        assert.equal(body(read(target.file)),
          `<!-- Generated from ${canonicalPath} — do not edit directly -->\n${body(read(canonicalPath))}`, target.file);
      }
    }
  }
});

test('combined planning projection retains every mapped canonical planning phase', () => {
  const sources = manifest.instructions.filter(instruction => instruction.projections.claude?.file === '.claude/rules/planning.md');
  const expected = sources.map(instruction => {
    const source = `.github/instructions/${instruction.canonical}`;
    return `<!-- Generated from ${source} — do not edit directly -->\n${body(read(source))}`;
  }).join('\n\n---\n\n');
  assert.equal(body(read('.claude/rules/planning.md')), expected);
});
