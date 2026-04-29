import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  copyFoundationFiles,
  createMinimalProject,
  mergePackageJsonScripts,
  normalizePackageJsonDependencies,
  writeConfig,
  writeStarterFiles,
} from '../../wizard/lib/scaffold-foundations.mjs';

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');

function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'prototype-scaffold-'));
}

function readProjectFile(projectDir, relativePath) {
  return readFileSync(join(projectDir, relativePath), 'utf-8');
}

test('scaffold helpers seed prototype-first assets into a temp project', async (t) => {
  const projectDir = createTempProject();
  t.after(() => rmSync(projectDir, { recursive: true, force: true }));

  mkdirSync(join(projectDir, '.github', 'instructions'), { recursive: true });
  mkdirSync(join(projectDir, 'dataverse'), { recursive: true });
  mkdirSync(join(projectDir, 'solution'), { recursive: true });

  createMinimalProject(projectDir, 'Prototype Hardening Demo');
  writeConfig(projectDir);
  mergePackageJsonScripts(projectDir);
  writeStarterFiles(projectDir, 'Prototype Hardening Demo');
  copyFoundationFiles(repoRoot, projectDir);

  assert.equal(existsSync(join(projectDir, 'scripts', 'seed-prototype-assets.mjs')), true);
  assert.equal(existsSync(join(projectDir, 'dataverse', 'planning-payload.json')), true);
  assert.equal(existsSync(join(projectDir, 'src', 'hooks', 'usePrototypeData.ts')), true);
  assert.equal(existsSync(join(projectDir, 'src', 'services', 'providerFactory.ts')), true);
  assert.equal(existsSync(join(projectDir, 'dataverse', 'prototype-feedback.md')), true);

  const packageJson = JSON.parse(readProjectFile(projectDir, 'package.json'));
  assert.equal(packageJson.scripts['prototype:seed'], 'node scripts/seed-prototype-assets.mjs dataverse/planning-payload.json');

  const app = readProjectFile(projectDir, 'src/App.tsx');
  assert.match(app, /Prototype Mode/);
  assert.match(app, /npm run prototype:seed/);

  const manifest = readProjectFile(projectDir, 'src/prototypeManifest.ts');
  assert.match(manifest, /feedbackPath: 'dataverse\/prototype-feedback.md'/);

  const contracts = readProjectFile(projectDir, 'src/services/data-contracts.ts');
  assert.match(contracts, /export interface AppDataProvider/);
});

test('dependency normalization overrides incompatible starter package pins', (t) => {
  const projectDir = createTempProject();
  t.after(() => rmSync(projectDir, { recursive: true, force: true }));

  writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
    name: 'starter-with-newer-react',
    private: true,
    type: 'module',
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
    devDependencies: {
      '@types/react': '^19.1.16',
      '@types/react-dom': '^19.0.0',
      typescript: '^5.9.0',
    },
  }, null, 2));

  normalizePackageJsonDependencies(projectDir);

  const packageJson = JSON.parse(readProjectFile(projectDir, 'package.json'));
  assert.equal(packageJson.dependencies.react, '^18.3.1');
  assert.equal(packageJson.dependencies['react-dom'], '^18.3.1');
  assert.equal(packageJson.devDependencies['@types/react'], '^18.3.12');
  assert.equal(packageJson.devDependencies['@types/react-dom'], '^18.3.1');
  assert.equal(packageJson.devDependencies.typescript, '5.7.3');
  assert.equal(packageJson.dependencies['@types/react'], undefined);
  assert.equal(packageJson.devDependencies.react, undefined);
});