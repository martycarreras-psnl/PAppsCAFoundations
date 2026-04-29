import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildPacProfileName,
  extractPowerConfigTargetMetadata,
  isRepoScopedProfileName,
  repairPowerConfigDisplayNames,
  resolveCredentialValues,
  selectAndVerifyPacProfile,
} from '../../wizard/lib/pac-target.mjs';

const DEV_URL = 'https://repo-dev.crm.dynamics.com';
const WRONG_URL = 'https://wrong-dev.crm.dynamics.com';
const ENV_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ENV_ID = '22222222-2222-2222-2222-222222222222';

function createTempDir() {
  return mkdtempSync(join(tmpdir(), 'pac-target-'));
}

function createRunner({ expectedProfileName, whoOutput, selectableProfiles = [], allowExpectedProfile = true }) {
  return (_pac, args) => {
    if (args[0] === 'auth' && args[1] === 'select' && args[2] === '--name') {
      if ((allowExpectedProfile && args[3] === expectedProfileName) || selectableProfiles.includes(args[3])) {
        return '';
      }
      return null;
    }
    if (args[0] === 'org' && args[1] === 'who') {
      return whoOutput;
    }
    return '';
  };
}

test('repo-scoped PAC profile names differ across repos on the same machine', () => {
  const first = buildPacProfileName({
    rootDir: '/tmp/finance-app',
    targetKey: 'dev',
    profileType: 'spn',
    url: DEV_URL,
  });
  const second = buildPacProfileName({
    rootDir: '/tmp/hr-app',
    targetKey: 'dev',
    profileType: 'spn',
    url: DEV_URL,
  });

  assert.notEqual(first, second);
  assert.ok(first.length <= 30);
  assert.ok(second.length <= 30);
  assert.equal(isRepoScopedProfileName(first), true);
  assert.equal(isRepoScopedProfileName(second), true);
});

test('pac code init guard aborts when pac org who points at the wrong environment', () => {
  const rootDir = '/tmp/foundations';
  const expectedProfileName = buildPacProfileName({ rootDir, targetKey: 'dev', profileType: 'spn', url: DEV_URL });
  const runSafeImpl = createRunner({
    expectedProfileName,
    whoOutput: `Environment ID: ${ENV_ID}\nEnvironment URL: ${WRONG_URL}`,
  });

  assert.throws(() => {
    selectAndVerifyPacProfile({
      pac: 'pac',
      rootDir,
      wizardState: { WIZARD_TARGET_ENV: 'dev', PP_ENV_DEV: DEV_URL },
      targetKey: 'dev',
      profileType: 'spn',
      credentialValues: { PP_ENV_DEV: DEV_URL },
      powerConfigPath: join(rootDir, 'power.config.json'),
      runSafeImpl,
    });
  }, /Active PAC org URL .* does not match wizard target/i);
});

test('deploy guard aborts when wizard state and power.config.json disagree', (t) => {
  const rootDir = createTempDir();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const powerConfigPath = join(rootDir, 'power.config.json');
  writeFileSync(powerConfigPath, JSON.stringify({
    appId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    environmentId: OTHER_ENV_ID,
    localAppUrl: `https://apps.powerapps.com/play/e/${OTHER_ENV_ID}/app/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
  }, null, 2));

  const expectedProfileName = buildPacProfileName({ rootDir, targetKey: 'dev', profileType: 'spn', url: DEV_URL });
  const runSafeImpl = createRunner({
    expectedProfileName,
    whoOutput: `Environment ID: ${ENV_ID}\nEnvironment URL: ${DEV_URL}`,
  });

  assert.throws(() => {
    selectAndVerifyPacProfile({
      pac: 'pac',
      rootDir,
      wizardState: { WIZARD_TARGET_ENV: 'dev', PP_ENV_DEV: DEV_URL },
      targetKey: 'dev',
      profileType: 'spn',
      credentialValues: { PP_ENV_DEV: DEV_URL },
      powerConfigPath,
      requirePowerConfig: true,
      requirePowerConfigTarget: true,
      runSafeImpl,
    });
  }, /power\.config\.json environment ID .* does not match pac org who environment ID/i);
});

test('first-push interactive auth names are repo-scoped and environment-scoped', () => {
  const profileName = buildPacProfileName({
    rootDir: '/tmp/chief-of-staff',
    targetKey: 'dev',
    profileType: 'user',
    url: DEV_URL,
  });

  assert.ok(profileName.startsWith('pp-'));
  assert.ok(profileName.includes('-d-u-'));
  assert.ok(profileName.length <= 30);
  assert.equal(isRepoScopedProfileName(profileName), true);
});

test('stale global Dev profiles are ignored when the repo-scoped profile is missing', () => {
  const rootDir = '/tmp/foundations';
  const expectedProfileName = buildPacProfileName({ rootDir, targetKey: 'dev', profileType: 'spn', url: DEV_URL });
  const runSafeImpl = createRunner({
    expectedProfileName,
    whoOutput: `Environment ID: ${ENV_ID}\nEnvironment URL: ${DEV_URL}`,
    selectableProfiles: ['Dev'],
    allowExpectedProfile: false,
  });

  assert.throws(() => {
    selectAndVerifyPacProfile({
      pac: 'pac',
      rootDir,
      wizardState: { WIZARD_TARGET_ENV: 'dev', PP_ENV_DEV: DEV_URL },
      targetKey: 'dev',
      profileType: 'spn',
      credentialValues: { PP_ENV_DEV: DEV_URL },
      powerConfigPath: join(rootDir, 'power.config.json'),
      runSafeImpl,
    });
  }, /Required repo-scoped PAC profile does not exist/i);
});

test('power.config metadata extraction uses environmentId from the local app URL when present', () => {
  const info = extractPowerConfigTargetMetadata({
    appId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    localAppUrl: `https://apps.powerapps.com/play/e/${ENV_ID}/app/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`,
  });

  assert.equal(info.environmentId, ENV_ID);
  assert.equal(info.hasTargetMetadata, true);
});

test('power.config display name repair removes accidental wrapping quotes', (t) => {
  const rootDir = createTempDir();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  const powerConfigPath = join(rootDir, 'power.config.json');
  writeFileSync(powerConfigPath, JSON.stringify({
    appDisplayName: '"Windows Hello"',
    metadata: {
      displayName: '\\"Nested App Name\\"',
    },
    appId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  }, null, 2));

  const result = repairPowerConfigDisplayNames(powerConfigPath);
  const repaired = JSON.parse(readFileSync(powerConfigPath, 'utf-8'));

  assert.equal(result.changed, true);
  assert.deepEqual(result.fields, ['appDisplayName', 'metadata.displayName']);
  assert.equal(repaired.appDisplayName, 'Windows Hello');
  assert.equal(repaired.metadata.displayName, 'Nested App Name');
  assert.equal(repaired.appId, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
});

test('explicit envlocal credential resolution ignores stale 1Password references', (t) => {
  const rootDir = createTempDir();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  writeFileSync(join(rootDir, '.env'), [
    'PP_TENANT_ID=op://Engineering/Stale/tenant-id',
    'PP_APP_ID=op://Engineering/Stale/app-id',
    'PP_CLIENT_SECRET=op://Engineering/Stale/client-secret',
    'PP_ENV_DEV=op://Engineering/Stale/env-dev',
    '',
  ].join('\n'));
  writeFileSync(join(rootDir, '.env.local'), [
    'PP_TENANT_ID=tenant-from-envlocal',
    'PP_APP_ID=app-from-envlocal',
    'PP_CLIENT_SECRET=secret-from-envlocal',
    `PP_ENV_DEV=${DEV_URL}`,
    '',
  ].join('\n'));

  const values = resolveCredentialValues({ rootDir, opBin: null, source: 'envlocal' });

  assert.equal(values.PP_TENANT_ID, 'tenant-from-envlocal');
  assert.equal(values.PP_APP_ID, 'app-from-envlocal');
  assert.equal(values.PP_CLIENT_SECRET, 'secret-from-envlocal');
  assert.equal(values.PP_ENV_DEV, DEV_URL);
});

test('auto credential resolution still reports missing op when only 1Password references exist', (t) => {
  const rootDir = createTempDir();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));

  writeFileSync(join(rootDir, '.env'), 'PP_TENANT_ID=op://Engineering/Stale/tenant-id\n');

  assert.throws(() => {
    resolveCredentialValues({ rootDir, opBin: null });
  }, /op CLI is not available/i);
});
