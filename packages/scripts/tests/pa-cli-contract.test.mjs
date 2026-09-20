import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../../../node_modules/@microsoft/power-apps-cli/dist/Bin.js', import.meta.url));
test('installed CLI 1.0.2 command/flag surface matches guarded scripts', t => {
  const root = mkdtempSync(join(tmpdir(), 'pacaf-pa-help-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'power.config.json'), JSON.stringify({
    appId: '11111111-1111-4111-8111-111111111111',
    environmentId: '22222222-2222-4222-8222-222222222222',
    region: 'prod', buildPath: './dist', buildEntryPoint: 'index.html',
  }));
  const help = args => {
    const result = spawnSync(process.execPath, [cli, ...args, '--help'], {
      cwd: root, env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PA_CLI_') && key !== 'CI')), PA_CLI_TELEMETRY: 'off' }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout;
  };
  assert.match(help(['app', 'run']), /--config-only/);
  const push = help(['app', 'push']);
  assert.match(push, /--solution-id/);
  assert.doesNotMatch(push, /--environment-id/);
  assert.match(help(['app', 'add', 'data-source']), /--connection-ref/);
  assert.match(help(['app', 'refresh', 'data-source']), /--name/);
  assert.match(help(['app', 'remove', 'data-source']), /--connector/);
  assert.match(help(['auth', 'status']), /--json/);
});
