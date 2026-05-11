import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const scriptPath = join(repoRoot, 'scripts', 'seed-prototype-assets.mjs');

function createTempProject() {
  const projectDir = mkdtempSync(join(tmpdir(), 'prototype-seed-'));
  mkdirSync(join(projectDir, 'dataverse'), { recursive: true });
  return projectDir;
}

function writePlan(projectDir, plan) {
  const planPath = join(projectDir, 'dataverse', 'planning-payload.json');
  writeFileSync(planPath, JSON.stringify(plan, null, 2));
  return planPath;
}

function runSeed(projectDir, planPath) {
  execFileSync(process.execPath, [scriptPath, planPath], {
    cwd: projectDir,
    stdio: 'pipe',
  });
}

function readProjectFile(projectDir, relativePath) {
  return readFileSync(join(projectDir, relativePath), 'utf-8');
}

test('seed-prototype-assets generates domain contracts, hooks, and feedback artifacts', async (t) => {
  const projectDir = createTempProject();
  t.after(() => rmSync(projectDir, { recursive: true, force: true }));

  const planPath = writePlan(projectDir, {
    tables: [
      {
        displayName: 'Project Request',
        displayCollectionName: 'Project Requests',
        description: 'Tracks incoming requests for work',
        primaryName: {
          displayName: 'Name',
          schemaName: 'sample_ProjectRequestName',
          description: 'Primary name for the request',
        },
        columns: [
          {
            logicalName: 'sample_requeststatus',
            displayName: 'Request Status',
            type: 'Picklist',
            requiredLevel: 'ApplicationRequired',
          },
          {
            logicalName: 'sample_isurgent',
            displayName: 'Is Urgent',
            type: 'Boolean',
            requiredLevel: 'None',
          },
          {
            logicalName: 'sample_labels',
            displayName: 'Labels',
            type: 'MultiSelectPicklist',
            requiredLevel: 'None',
          },
          {
            logicalName: 'sample_requestedon',
            displayName: 'Requested On',
            type: 'DateTime',
            requiredLevel: 'None',
          },
        ],
      },
    ],
  });

  runSeed(projectDir, planPath);

  assert.equal(existsSync(join(projectDir, 'src', 'types', 'domain-models.ts')), true);
  assert.equal(existsSync(join(projectDir, 'src', 'services', 'data-contracts.ts')), true);
  assert.equal(existsSync(join(projectDir, 'src', 'hooks', 'usePrototypeData.ts')), true);
  assert.equal(existsSync(join(projectDir, 'dataverse', 'prototype-feedback.md')), true);

  const domainModels = readProjectFile(projectDir, 'src/types/domain-models.ts');
  assert.match(domainModels, /export interface ProjectRequest/);
  assert.match(domainModels, /requestStatus: number;/);
  assert.match(domainModels, /isurgent\?: boolean;/i);
  assert.match(domainModels, /labels\?: number\[\];/);
  assert.match(domainModels, /requestedOn\?: string;/);

  const contracts = readProjectFile(projectDir, 'src/services/data-contracts.ts');
  assert.match(contracts, /export interface ProjectRequestRepository/);
  assert.match(contracts, /projectRequests: ProjectRequestRepository;/);

  const hooks = readProjectFile(projectDir, 'src/hooks/usePrototypeData.ts');
  assert.match(hooks, /export function useProjectRequests\(/);
  assert.match(hooks, /export function useProjectRequest\(/);
  assert.match(hooks, /prototypeQueryKeys/);

  const mockData = readProjectFile(projectDir, 'src/mockData/projectRequest.ts');
  assert.match(mockData, /id: 'mock-projectRequests-1'/);
  assert.match(mockData, /name: 'Project Request 1'/);

  const realProvider = readProjectFile(projectDir, 'src/services/real-data-provider.ts');
  assert.match(realProvider, /Implement projectRequests\.list\(\)/);
  assert.match(realProvider, /Implement projectRequests\.save\(\)/);

  const feedback = readProjectFile(projectDir, 'dataverse/prototype-feedback.md');
  assert.match(feedback, /## Data Model Changes Suggested by the Prototype/);
});

test('seed-prototype-assets handles a planning payload with no tables', async (t) => {
  const projectDir = createTempProject();
  t.after(() => rmSync(projectDir, { recursive: true, force: true }));

  const planPath = writePlan(projectDir, { tables: [] });
  runSeed(projectDir, planPath);

  const hooks = readProjectFile(projectDir, 'src/hooks/usePrototypeData.ts');
  assert.match(hooks, /export const prototypeQueryKeys = \{\} as const;/);

  const realProvider = readProjectFile(projectDir, 'src/services/real-data-provider.ts');
  assert.match(realProvider, /return \{\} satisfies AppDataProvider;/);

  const manifest = readProjectFile(projectDir, 'src/prototypeManifest.ts');
  assert.match(manifest, /entities: \[/);

  assert.equal(existsSync(join(projectDir, 'dataverse', 'prototype-feedback.md')), true);
});