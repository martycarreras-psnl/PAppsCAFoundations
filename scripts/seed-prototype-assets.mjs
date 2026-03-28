#!/usr/bin/env node

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_PLAN_PATH = 'dataverse/planning-payload.json';
const planPath = resolve(process.cwd(), process.argv[2] || DEFAULT_PLAN_PATH);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(planPath)) {
  fail(`Planning payload not found at ${planPath}\nRun this command from your project root or pass a path.`);
}

let plan;
try {
  plan = JSON.parse(readFileSync(planPath, 'utf-8'));
} catch (error) {
  fail(`Unable to parse planning payload: ${error.message}`);
}

const tables = Array.isArray(plan.tables) ? plan.tables : [];

function toWords(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPascalCase(value) {
  return toWords(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : 'value';
}

function singularize(word) {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function stripPublisherPrefix(value) {
  return String(value || '').replace(/^[a-z0-9]+_/, '');
}

function getEntityBaseName(table) {
  return table.displayName || table.logicalSingularName || table.schemaName || 'Record';
}

function getCollectionBaseName(table) {
  return table.displayCollectionName || table.logicalPluralName || `${getEntityBaseName(table)}s`;
}

function dedupeColumns(table) {
  const seen = new Set();
  const rawColumns = [];
  if (table.primaryName) {
    rawColumns.push({
      displayName: table.primaryName.displayName || 'Name',
      logicalName: 'name',
      schemaName: table.primaryName.schemaName || 'name',
      type: 'String',
      requiredLevel: 'ApplicationRequired',
      description: table.primaryName.description || 'Primary name',
    });
  }
  for (const column of table.columns || table.attributes || []) {
    rawColumns.push(column);
  }

  return rawColumns.filter((column) => {
    const key = column.logicalName || column.schemaName || column.displayName;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapType(columnType) {
  switch (columnType) {
    case 'Picklist':
    case 'State':
    case 'Status':
    case 'Integer':
    case 'BigInt':
    case 'Decimal':
    case 'Double':
    case 'Money':
    case 'Currency':
      return 'number';
    case 'MultiSelectPicklist':
      return 'number[]';
    case 'Boolean':
    case 'TwoOptions':
      return 'boolean';
    case 'DateTime':
      return 'string';
    case 'Lookup':
    case 'Customer':
    case 'Owner':
    case 'Uniqueidentifier':
      return 'string';
    default:
      return 'string';
  }
}

function buildFieldName(column, usedNames) {
  const explicitName = column.displayName || column.logicalName || column.schemaName || 'field';
  const baseName = explicitName === 'name'
    ? 'name'
    : toCamelCase(stripPublisherPrefix(explicitName));

  let fieldName = baseName || 'field';
  let suffix = 2;
  while (usedNames.has(fieldName)) {
    fieldName = `${baseName}${suffix}`;
    suffix += 1;
  }
  usedNames.add(fieldName);
  return fieldName;
}

function buildEntity(table) {
  const interfaceName = toPascalCase(getEntityBaseName(table)) || 'Record';
  const collectionName = toCamelCase(getCollectionBaseName(table)) || `${toCamelCase(interfaceName)}s`;
  const repositoryName = `${interfaceName}Repository`;
  const fileBaseName = toCamelCase(singularize(collectionName));
  const usedNames = new Set(['id']);
  const fields = dedupeColumns(table).map((column) => {
    const fieldName = buildFieldName(column, usedNames);
    const type = mapType(column.type);
    const required = column.requiredLevel === 'ApplicationRequired' || column.requiredLevel === 'SystemRequired' || fieldName === 'name';
    return {
      fieldName,
      type,
      required,
      displayName: column.displayName || column.logicalName || fieldName,
      description: column.description || '',
    };
  });

  if (!fields.some((field) => field.fieldName === 'name')) {
    fields.unshift({
      fieldName: 'name',
      type: 'string',
      required: true,
      displayName: 'Name',
      description: 'Primary name',
    });
  }

  return {
    interfaceName,
    collectionName,
    repositoryName,
    fileBaseName,
    displayName: table.displayName || interfaceName,
    description: table.description || 'Prototype entity',
    fields,
  };
}

function sampleValue(field, entity, index) {
  if (field.fieldName === 'id') return `'mock-${entity.collectionName}-${index + 1}'`;
  if (field.fieldName === 'name') return `'${entity.displayName.replace(/'/g, "\\'")} ${index + 1}'`;
  if (field.type === 'number[]') return `[100000000, 100000001]`;
  if (field.type === 'number') return `${100000000 + index}`;
  if (field.type === 'boolean') return index % 2 === 0 ? 'true' : 'false';
  if (field.fieldName.toLowerCase().endsWith('on') || field.fieldName.toLowerCase().includes('date')) {
    return `'2026-03-0${index + 1}'`;
  }
  return `'${field.displayName} ${index + 1}'`;
}

const entities = tables.map(buildEntity);

const domainModelsPath = resolve(process.cwd(), 'src/types/domain-models.ts');
const dataContractsPath = resolve(process.cwd(), 'src/services/data-contracts.ts');
const mockProviderPath = resolve(process.cwd(), 'src/services/mock-data-provider.ts');
const realProviderPath = resolve(process.cwd(), 'src/services/real-data-provider.ts');
const providerFactoryPath = resolve(process.cwd(), 'src/services/providerFactory.ts');
const prototypeHooksPath = resolve(process.cwd(), 'src/hooks/usePrototypeData.ts');
const prototypeManifestPath = resolve(process.cwd(), 'src/prototypeManifest.ts');
const feedbackPath = resolve(process.cwd(), 'dataverse/prototype-feedback.md');

for (const filePath of [domainModelsPath, dataContractsPath, mockProviderPath, realProviderPath, providerFactoryPath, prototypeHooksPath, prototypeManifestPath, feedbackPath]) {
  mkdirSync(dirname(filePath), { recursive: true });
}

const importEntityTypes = entities.map((entity) => `import type { ${entity.interfaceName} } from '@/types/domain-models';`).join('\n');

const domainModelsContent = `// Generated by scripts/seed-prototype-assets.mjs\n// Edit dataverse/planning-payload.json, then rerun npm run prototype:seed to refresh.\n\n${entities.map((entity) => `export interface ${entity.interfaceName} {\n  id: string;\n${entity.fields.map((field) => `  ${field.fieldName}${field.required ? '' : '?'}: ${field.type};`).join('\n')}\n}`).join('\n\n')}\n`;

const dataContractsContent = `// Generated by scripts/seed-prototype-assets.mjs\n// Provider contracts are the seam between mock UX and real connectors.\n\n${importEntityTypes}\n\n${entities.map((entity) => `export interface ${entity.repositoryName} {\n  list(): Promise<${entity.interfaceName}[]>;\n  getById(id: string): Promise<${entity.interfaceName} | null>;\n  save(input: Partial<${entity.interfaceName}>): Promise<${entity.interfaceName}>;\n}`).join('\n\n')}\n\nexport interface AppDataProvider {\n${entities.map((entity) => `  ${entity.collectionName}: ${entity.repositoryName};`).join('\n')}\n}\n`;

for (const entity of entities) {
  const mockDataPath = resolve(process.cwd(), `src/mockData/${entity.fileBaseName}.ts`);
  mkdirSync(dirname(mockDataPath), { recursive: true });
  const mockRows = Array.from({ length: 3 }, (_, index) => `  {\n${['id', ...entity.fields.map((field) => field.fieldName)].map((fieldName) => {
    const field = fieldName === 'id' ? { fieldName: 'id', type: 'string', displayName: 'Id' } : entity.fields.find((item) => item.fieldName === fieldName);
    return `    ${fieldName}: ${sampleValue(field, entity, index)},`;
  }).join('\n')}\n  },`).join('\n');

  writeFileSync(mockDataPath, `// Generated by scripts/seed-prototype-assets.mjs\nimport type { ${entity.interfaceName} } from '@/types/domain-models';\n\nexport const mock${entity.interfaceName}s: ${entity.interfaceName}[] = [\n${mockRows}\n];\n`);
}

const mockProviderImports = entities.map((entity) => `import { mock${entity.interfaceName}s } from '@/mockData/${entity.fileBaseName}';`).join('\n');
const mockProviderEntityTypes = entities.map((entity) => `import type { ${entity.interfaceName} } from '@/types/domain-models';`).join('\n');
const mockProviderContent = `// Generated by scripts/seed-prototype-assets.mjs\nimport type { AppDataProvider } from '@/services/data-contracts';\n${mockProviderEntityTypes}\n${mockProviderImports}\n\ntype PrototypeRecord = {\n  id: string;\n  name?: string;\n};\n\nfunction cloneRecord<T>(record: T): T {\n  return JSON.parse(JSON.stringify(record)) as T;\n}\n\nfunction createCollectionRepository<T extends PrototypeRecord>(records: T[], buildFallbackName: () => string) {\n  return {\n    async list(): Promise<T[]> {\n      return records.map((record) => cloneRecord(record));\n    },\n    async getById(id: string): Promise<T | null> {\n      const record = records.find((item) => item.id === id);\n      return record ? cloneRecord(record) : null;\n    },\n    async save(input: Partial<T>): Promise<T> {\n      if (input.id) {\n        const index = records.findIndex((record) => record.id === input.id);\n        if (index >= 0) {\n          records[index] = { ...records[index], ...input };\n          return cloneRecord(records[index]);\n        }\n      }\n\n      const record = {\n        id: input.id || crypto.randomUUID(),\n        name: input.name || buildFallbackName(),\n        ...input,\n      } as T;\n      records.unshift(record);\n      return cloneRecord(record);\n    },\n  };\n}\n\nexport function createMockDataProvider(): AppDataProvider {\n  const store = {\n${entities.map((entity) => `    ${entity.collectionName}: mock${entity.interfaceName}s.map((record) => cloneRecord(record)),`).join('\n')}\n  };\n\n  return {\n${entities.map((entity) => `    ${entity.collectionName}: createCollectionRepository<${entity.interfaceName}>(store.${entity.collectionName}, () => '${entity.displayName} Draft'),`).join('\n')}\n  } satisfies AppDataProvider;\n}\n`;

const realProviderContent = entities.length
  ? `// Generated by scripts/seed-prototype-assets.mjs\nimport type { AppDataProvider } from '@/services/data-contracts';\n${entities.map((entity) => `import type { ${entity.interfaceName} } from '@/types/domain-models';`).join('\n')}\n\n// Replace the placeholder key mapping in this file after pac code add-data-source\n// generates src/generated/** for your real connectors. Keep the UI-facing contract\n// stable by adapting connector models into the domain models defined in src/types.\n\n${entities.map((entity) => `export function map${entity.interfaceName}FromConnector(record: Record<string, unknown>): ${entity.interfaceName} {\n  return {\n    id: String(record.id ?? ''),\n${entity.fields.map((field) => {
      const accessor = `record.${field.fieldName}`;
      if (field.type === 'number[]') {
        return `    ${field.fieldName}: Array.isArray(${accessor}) ? ${accessor}.map((value) => Number(value)) : ${field.required ? '[]' : 'undefined'},`;
      }
      if (field.type === 'number') {
        return `    ${field.fieldName}: ${field.required ? `Number(${accessor} ?? 0)` : `${accessor} !== undefined ? Number(${accessor}) : undefined`},`;
      }
      if (field.type === 'boolean') {
        return `    ${field.fieldName}: ${field.required ? `Boolean(${accessor})` : `${accessor} !== undefined ? Boolean(${accessor}) : undefined`},`;
      }
      return `    ${field.fieldName}: ${field.required ? `String(${accessor} ?? '')` : `${accessor} !== undefined ? String(${accessor}) : undefined`},`;
    }).join('\n')}\n  };\n}\n\nexport function map${entity.interfaceName}ToConnector(input: Partial<${entity.interfaceName}>): Record<string, unknown> {\n  return {\n${entity.fields.map((field) => `    ...(input.${field.fieldName} !== undefined ? { ${field.fieldName}: input.${field.fieldName} } : {}),`).join('\n')}\n  };\n}\n\n// Example once your generated service exists:\n// import { ${toPascalCase(entity.collectionName)}Service } from '@/generated/services/${toPascalCase(entity.collectionName)}Service';\n// const result = await ${toPascalCase(entity.collectionName)}Service.getAll();\n// return (result.data || []).map((record) => map${entity.interfaceName}FromConnector(record as Record<string, unknown>));`).join('\n\n')}\n\nexport function createRealDataProvider(): AppDataProvider {\n  return {\n${entities.map((entity) => `    ${entity.collectionName}: {\n      async list() {\n        throw new Error('Implement ${entity.collectionName}.list() in src/services/real-data-provider.ts using map${entity.interfaceName}FromConnector()');\n      },\n      async getById() {\n        throw new Error('Implement ${entity.collectionName}.getById() in src/services/real-data-provider.ts using map${entity.interfaceName}FromConnector()');\n      },\n      async save() {\n        throw new Error('Implement ${entity.collectionName}.save() in src/services/real-data-provider.ts using map${entity.interfaceName}ToConnector()');\n      },\n    },`).join('\n')}\n  } satisfies AppDataProvider;\n}\n`
  : `// Generated by scripts/seed-prototype-assets.mjs\nimport type { AppDataProvider } from '@/services/data-contracts';\n\nexport function createRealDataProvider(): AppDataProvider {\n  return {} satisfies AppDataProvider;\n}\n`;

const providerFactoryContent = `// Generated by scripts/seed-prototype-assets.mjs\nimport type { AppDataProvider } from '@/services/data-contracts';\nimport { createMockDataProvider } from '@/services/mock-data-provider';\nimport { createRealDataProvider } from '@/services/real-data-provider';\n\nexport function createAppDataProvider(): AppDataProvider {\n  return import.meta.env.VITE_USE_MOCK === 'true'\n    ? createMockDataProvider()\n    : createRealDataProvider();\n}\n`;

const prototypeHooksContent = entities.length
  ? `// Generated by scripts/seed-prototype-assets.mjs\nimport { useQuery } from '@tanstack/react-query';\nimport { createAppDataProvider } from '@/services/providerFactory';\n\nconst provider = createAppDataProvider();\n\nexport const prototypeQueryKeys = {\n${entities.map((entity) => `  ${entity.collectionName}: ['${entity.collectionName}'] as const,\n  ${entity.fileBaseName}ById: (id: string) => ['${entity.collectionName}', id] as const,`).join('\n')}\n};\n\n${entities.map((entity) => `export function use${toPascalCase(entity.collectionName)}() {\n  return useQuery({\n    queryKey: prototypeQueryKeys.${entity.collectionName},\n    queryFn: () => provider.${entity.collectionName}.list(),\n  });\n}\n\nexport function use${entity.interfaceName}(id: string | undefined) {\n  return useQuery({\n    queryKey: prototypeQueryKeys.${entity.fileBaseName}ById(id || 'new'),\n    queryFn: () => (id ? provider.${entity.collectionName}.getById(id) : Promise.resolve(null)),\n    enabled: Boolean(id),\n  });\n}`).join('\n\n')}\n`
  : `// Generated by scripts/seed-prototype-assets.mjs\nexport const prototypeQueryKeys = {} as const;\n`;

const prototypeManifestContent = `// Generated by scripts/seed-prototype-assets.mjs\nexport const prototypeManifest = {\n  generatedFrom: '${planPath.replace(resolve(process.cwd()), '.').replace(/^\./, '') || DEFAULT_PLAN_PATH}',\n  feedbackPath: 'dataverse/prototype-feedback.md',\n  entities: [\n${entities.map((entity) => `    {\n      displayName: '${entity.displayName}',\n      collectionName: '${entity.collectionName}',\n      description: '${entity.description.replace(/'/g, "\\'")}',\n      mockDataFile: 'src/mockData/${entity.fileBaseName}.ts',\n      repositoryName: '${entity.repositoryName}',\n    },`).join('\n')}\n  ],\n} as const;\n`;

const prototypeFeedbackContent = `# Prototype Feedback\n\nGenerated from ${planPath.replace(resolve(process.cwd()), '.').replace(/^\./, '') || DEFAULT_PLAN_PATH}. Update this file during prototype reviews, then feed decisions back into dataverse/planning-payload.json before schema provisioning.\n\n## Reviewed Flows\n- \n\n## What Worked Immediately\n- \n\n## Points of Confusion or Friction\n- \n\n## Data Model Changes Suggested by the Prototype\n- Fields to add, remove, merge, or rename:\n- Relationship changes:\n- Lifecycle or status changes:\n- Reporting or rollup needs:\n\n## Decision Log\n- [ ] Update planning payload now\n- [ ] Defer to later phase\n- [ ] Reject proposed change\n\n## Promotion Checklist\n- [ ] Primary workflow feels natural in the UI\n- [ ] Empty, error, and exception states are represented\n- [ ] Field names and record boundaries still make sense\n- [ ] Reporting needs have been surfaced\n- [ ] Planning payload has been updated after prototype review\n`;

writeFileSync(domainModelsPath, domainModelsContent);
writeFileSync(dataContractsPath, dataContractsContent);
writeFileSync(mockProviderPath, mockProviderContent);
writeFileSync(realProviderPath, realProviderContent);
writeFileSync(providerFactoryPath, providerFactoryContent);
writeFileSync(prototypeHooksPath, prototypeHooksContent);
writeFileSync(prototypeManifestPath, prototypeManifestContent);
writeFileSync(feedbackPath, prototypeFeedbackContent);

console.log(`Seeded prototype assets from ${planPath}`);