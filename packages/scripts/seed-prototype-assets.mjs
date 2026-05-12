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
const fieldMetadataCachePath = resolve(process.cwd(), 'src/services/field-metadata-cache.ts');
const prototypeHooksPath = resolve(process.cwd(), 'src/hooks/usePrototypeData.ts');
const prototypeManifestPath = resolve(process.cwd(), 'src/prototypeManifest.ts');
const feedbackPath = resolve(process.cwd(), 'dataverse/prototype-feedback.md');

for (const filePath of [domainModelsPath, dataContractsPath, mockProviderPath, realProviderPath, providerFactoryPath, fieldMetadataCachePath, prototypeHooksPath, prototypeManifestPath, feedbackPath]) {
  mkdirSync(dirname(filePath), { recursive: true });
}

const importEntityTypes = entities.map((entity) => `import type { ${entity.interfaceName} } from '@/types/domain-models';`).join('\n');

const domainModelsContent = `// Generated by scripts/seed-prototype-assets.mjs\n// Edit dataverse/planning-payload.json, then rerun npm run prototype:seed to refresh.\n\n${entities.map((entity) => `export interface ${entity.interfaceName} {\n  id: string;\n${entity.fields.map((field) => `  ${field.fieldName}${field.required ? '' : '?'}: ${field.type};`).join('\n')}\n}`).join('\n\n')}\n`;

const dataContractsContent = `// Generated by scripts/seed-prototype-assets.mjs\n// Provider contracts are the seam between mock UX and real connectors.\n\n${importEntityTypes}\n\nexport type DataverseFieldRequiredLevel = 'none' | 'recommended' | 'application' | 'system';\n\nexport interface DataverseFieldMetadata {\n  tableLogicalName: string;\n  fieldLogicalName: string;\n  displayName?: string;\n  requiredLevel: DataverseFieldRequiredLevel;\n  isRequired: boolean;\n  maxLength?: number;   // String/Memo columns\n  minValue?: number;    // Money/Decimal/Integer columns\n  maxValue?: number;    // Money/Decimal/Integer columns\n  precision?: number;   // Money/Decimal columns\n}\n\nexport interface FieldMetadataRepository {\n  getField(tableLogicalName: string, fieldLogicalName: string): Promise<DataverseFieldMetadata | null>;\n}\n\n${entities.map((entity) => `export interface ${entity.repositoryName} {\n  list(): Promise<${entity.interfaceName}[]>;\n  getById(id: string): Promise<${entity.interfaceName} | null>;\n  save(input: Partial<${entity.interfaceName}>): Promise<${entity.interfaceName}>;\n}`).join('\n\n')}\n\nexport interface AppDataProvider {\n${entities.map((entity) => `  ${entity.collectionName}: ${entity.repositoryName};`).join('\n')}\n  fieldMetadata: FieldMetadataRepository;\n}\n`;

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
const mockProviderContent = `// Generated by scripts/seed-prototype-assets.mjs\nimport type { AppDataProvider } from '@/services/data-contracts';\n${mockProviderEntityTypes}\n${mockProviderImports}\n\ntype PrototypeRecord = {\n  id: string;\n  name?: string;\n};\n\nfunction cloneRecord<T>(record: T): T {\n  return JSON.parse(JSON.stringify(record)) as T;\n}\n\nfunction createCollectionRepository<T extends PrototypeRecord>(records: T[], buildFallbackName: () => string) {\n  return {\n    async list(): Promise<T[]> {\n      return records.map((record) => cloneRecord(record));\n    },\n    async getById(id: string): Promise<T | null> {\n      const record = records.find((item) => item.id === id);\n      return record ? cloneRecord(record) : null;\n    },\n    async save(input: Partial<T>): Promise<T> {\n      if (input.id) {\n        const index = records.findIndex((record) => record.id === input.id);\n        if (index >= 0) {\n          records[index] = { ...records[index], ...input };\n          return cloneRecord(records[index]);\n        }\n      }\n\n      const record = {\n        id: input.id || crypto.randomUUID(),\n        name: input.name || buildFallbackName(),\n        ...input,\n      } as T;\n      records.unshift(record);\n      return cloneRecord(record);\n    },\n  };\n}\n\nexport function createMockDataProvider(): AppDataProvider {\n  const store = {\n${entities.map((entity) => `    ${entity.collectionName}: mock${entity.interfaceName}s.map((record) => cloneRecord(record)),`).join('\n')}\n  };\n\n  return {\n${entities.map((entity) => `    ${entity.collectionName}: createCollectionRepository<${entity.interfaceName}>(store.${entity.collectionName}, () => '${entity.displayName} Draft'),`).join('\n')}\n    fieldMetadata: {\n      async getField() { return null; },\n    },\n  } satisfies AppDataProvider;\n}\n`;

const realProviderContent = entities.length
  ? `// Generated by scripts/seed-prototype-assets.mjs\nimport type { AppDataProvider } from '@/services/data-contracts';\nimport { getFieldMetadata } from '@/services/field-metadata-cache';\n${entities.map((entity) => `import type { ${entity.interfaceName} } from '@/types/domain-models';`).join('\n')}\n\n// Replace the placeholder key mapping in this file after pac code add-data-source\n// generates src/generated/** for your real connectors. Keep the UI-facing contract\n// stable by adapting connector models into the domain models defined in src/types.\n\n${entities.map((entity) => `export function map${entity.interfaceName}FromConnector(record: Record<string, unknown>): ${entity.interfaceName} {\n  return {\n    id: String(record.id ?? ''),\n${entity.fields.map((field) => {
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
    }).join('\n')}\n  };\n}\n\nexport function map${entity.interfaceName}ToConnector(input: Partial<${entity.interfaceName}>): Record<string, unknown> {\n  return {\n${entity.fields.map((field) => `    ...(input.${field.fieldName} !== undefined ? { ${field.fieldName}: input.${field.fieldName} } : {}),`).join('\n')}\n  };\n}\n\n// Example once your generated service exists:\n// import { ${toPascalCase(entity.collectionName)}Service } from '@/generated/services/${toPascalCase(entity.collectionName)}Service';\n// const result = await ${toPascalCase(entity.collectionName)}Service.getAll();\n// return (result.data || []).map((record) => map${entity.interfaceName}FromConnector(record as Record<string, unknown>));`).join('\n\n')}\n\nexport function createRealDataProvider(): AppDataProvider {\n  return {\n${entities.map((entity) => `    ${entity.collectionName}: {\n      async list() {\n        throw new Error('Implement ${entity.collectionName}.list() in src/services/real-data-provider.ts using map${entity.interfaceName}FromConnector()');\n      },\n      async getById() {\n        throw new Error('Implement ${entity.collectionName}.getById() in src/services/real-data-provider.ts using map${entity.interfaceName}FromConnector()');\n      },\n      async save() {\n        throw new Error('Implement ${entity.collectionName}.save() in src/services/real-data-provider.ts using map${entity.interfaceName}ToConnector()');\n      },\n    },`).join('\n')}\n    fieldMetadata: { getField: getFieldMetadata },\n  } satisfies AppDataProvider;\n}\n`
  : `// Generated by scripts/seed-prototype-assets.mjs\nimport type { AppDataProvider } from '@/services/data-contracts';\nimport { getFieldMetadata } from '@/services/field-metadata-cache';\n\nexport function createRealDataProvider(): AppDataProvider {\n  return {\n    fieldMetadata: { getField: getFieldMetadata },\n  } satisfies AppDataProvider;\n}\n`;

const providerFactoryContent = `// Generated by scripts/seed-prototype-assets.mjs\nimport type { AppDataProvider } from '@/services/data-contracts';\nimport { createMockDataProvider } from '@/services/mock-data-provider';\nimport { createRealDataProvider } from '@/services/real-data-provider';\n\nexport function createAppDataProvider(): AppDataProvider {\n  return import.meta.env.VITE_USE_MOCK === 'true'\n    ? createMockDataProvider()\n    : createRealDataProvider();\n}\n`;

const prototypeHooksContent = entities.length
  ? `// Generated by scripts/seed-prototype-assets.mjs\nimport { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\nimport { createAppDataProvider } from '@/services/providerFactory';\n${importEntityTypes}\n\nconst provider = createAppDataProvider();\n\nexport const prototypeQueryKeys = {\n${entities.map((entity) => `  ${entity.collectionName}: ['${entity.collectionName}'] as const,\n  ${entity.fileBaseName}ById: (id: string) => ['${entity.collectionName}', id] as const,`).join('\n')}\n};\n\n// ── Generic optimistic save hook ──\n// Dataverse read replicas lag behind writes by up to several seconds.\n// A naive invalidate-and-refetch pattern after a mutation will show stale data.\n// This hook merges the user's input over the cache entry on success.\n\nfunction useOptimisticSave<T extends { id: string }>({\n  listKey, itemKey, saveFn,\n}: {\n  listKey: readonly string[];\n  itemKey: (id: string) => readonly string[];\n  saveFn: (input: Partial<T>) => Promise<T>;\n}) {\n  const queryClient = useQueryClient();\n  return useMutation({\n    mutationFn: saveFn,\n    onMutate: async (input) => {\n      await queryClient.cancelQueries({ queryKey: listKey });\n      if (input.id) await queryClient.cancelQueries({ queryKey: itemKey(input.id) });\n    },\n    onSuccess: (serverRecord, input) => {\n      const merged = input.id\n        ? { ...(queryClient.getQueryData<T>(itemKey(input.id)) ?? serverRecord), ...input } as T\n        : serverRecord;\n      queryClient.setQueryData(itemKey(merged.id), merged);\n      queryClient.setQueryData<T[]>(listKey, (old) => {\n        if (!old) return [merged];\n        const idx = old.findIndex((item) => item.id === merged.id);\n        return idx >= 0\n          ? old.map((item) => (item.id === merged.id ? merged : item))\n          : [merged, ...old];\n      });\n    },\n  });\n}\n\n${entities.map((entity) => `export function use${toPascalCase(entity.collectionName)}() {\n  return useQuery({\n    queryKey: prototypeQueryKeys.${entity.collectionName},\n    queryFn: () => provider.${entity.collectionName}.list(),\n  });\n}\n\nexport function use${entity.interfaceName}(id: string | undefined) {\n  return useQuery({\n    queryKey: prototypeQueryKeys.${entity.fileBaseName}ById(id || 'new'),\n    queryFn: () => (id ? provider.${entity.collectionName}.getById(id) : Promise.resolve(null)),\n    enabled: Boolean(id),\n  });\n}\n\nexport function useSave${entity.interfaceName}() {\n  return useOptimisticSave<${entity.interfaceName}>({\n    listKey: prototypeQueryKeys.${entity.collectionName},\n    itemKey: prototypeQueryKeys.${entity.fileBaseName}ById,\n    saveFn: (input) => provider.${entity.collectionName}.save(input),\n  });\n}`).join('\n\n')}\n`
  : `// Generated by scripts/seed-prototype-assets.mjs\nexport const prototypeQueryKeys = {} as const;\n`;

const prototypeManifestContent = `// Generated by scripts/seed-prototype-assets.mjs\nexport const prototypeManifest = {\n  generatedFrom: '${planPath.replace(resolve(process.cwd()), '.').replace(/^\./, '') || DEFAULT_PLAN_PATH}',\n  feedbackPath: 'dataverse/prototype-feedback.md',\n  entities: [\n${entities.map((entity) => `    {\n      displayName: '${entity.displayName}',\n      collectionName: '${entity.collectionName}',\n      description: '${entity.description.replace(/'/g, "\\'")}',\n      mockDataFile: 'src/mockData/${entity.fileBaseName}.ts',\n      repositoryName: '${entity.repositoryName}',\n    },`).join('\n')}\n  ],\n} as const;\n`;

const prototypeFeedbackContent = `# Prototype Feedback\n\nGenerated from ${planPath.replace(resolve(process.cwd()), '.').replace(/^\./, '') || DEFAULT_PLAN_PATH}. Update this file during prototype reviews, then feed decisions back into dataverse/planning-payload.json before schema provisioning.\n\n## Reviewed Flows\n- \n\n## What Worked Immediately\n- \n\n## Points of Confusion or Friction\n- \n\n## Data Model Changes Suggested by the Prototype\n- Fields to add, remove, merge, or rename:\n- Relationship changes:\n- Lifecycle or status changes:\n- Reporting or rollup needs:\n\n## Decision Log\n- [ ] Update planning payload now\n- [ ] Defer to later phase\n- [ ] Reject proposed change\n\n## Promotion Checklist\n- [ ] Primary workflow feels natural in the UI\n- [ ] Empty, error, and exception states are represented\n- [ ] Field names and record boundaries still make sense\n- [ ] Reporting needs have been surfaced\n- [ ] Planning payload has been updated after prototype review\n`;

const fieldMetadataCacheContent = `// Generated by scripts/seed-prototype-assets.mjs
// Provides Dataverse column metadata (required level, maxLength, min/max/precision)
// backed by the generated service getMetadata() call.

import type { DataverseFieldMetadata, DataverseFieldRequiredLevel } from '@/services/data-contracts';

// ── RequiredLevel mapping (handles both string names and numeric values) ──

const BY_VALUE: Record<number, DataverseFieldRequiredLevel> = {
  0: 'none', 1: 'system', 2: 'application', 3: 'recommended',
};
const BY_NAME: Record<string, DataverseFieldRequiredLevel> = {
  none: 'none', systemrequired: 'system', applicationrequired: 'application', recommended: 'recommended',
};

export function mapRequiredLevel(value: unknown): DataverseFieldRequiredLevel {
  if (typeof value === 'number' && value in BY_VALUE) return BY_VALUE[value];
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n) && n in BY_VALUE) return BY_VALUE[n];
    const k = value.trim().toLowerCase();
    if (k in BY_NAME) return BY_NAME[k];
  }
  return 'none';
}

// ── Per-table metadata cache backed by getMetadata() ──

type AttributeRecord = Record<string, unknown>;

interface MetadataServiceEntry {
  getMetadata: (options: { schema: { columns: 'all' } }) => Promise<{
    data?: Partial<{ Attributes: AttributeRecord[] }>;
  }>;
}

// Register each table's generated service here after pac code add-data-source.
// Without an entry, metadata lookups for that table return null (no asterisks,
// no maxLength, no min/max).
export const metadataServiceRegistry: Record<string, MetadataServiceEntry> = {
  // Example after registering msfttrp_trips:
  // msfttrp_trips: Msfttrp_tripsService as unknown as MetadataServiceEntry,
};

const tableMetadataCache = new Map<string, Promise<Map<string, DataverseFieldMetadata>>>();

function fetchTableMetadata(tableLogicalName: string): Promise<Map<string, DataverseFieldMetadata>> {
  const cached = tableMetadataCache.get(tableLogicalName);
  if (cached) return cached;

  const service = metadataServiceRegistry[tableLogicalName];
  if (!service) {
    const empty = Promise.resolve(new Map<string, DataverseFieldMetadata>());
    tableMetadataCache.set(tableLogicalName, empty);
    return empty;
  }

  const promise = service
    .getMetadata({ schema: { columns: 'all' } })
    .then((result) => {
      const attributes = (result.data?.Attributes ?? []) as AttributeRecord[];
      const map = new Map<string, DataverseFieldMetadata>();

      for (const attr of attributes) {
        const logicalName = String(attr.LogicalName ?? '').toLowerCase();
        if (!logicalName) continue;

        const requiredLevelProp = attr.RequiredLevel as { Value?: unknown } | undefined;
        const requiredLevel = mapRequiredLevel(requiredLevelProp?.Value);
        const displayLabel = attr.DisplayName as { UserLocalizedLabel?: { Label?: string } } | undefined;

        map.set(logicalName, {
          tableLogicalName,
          fieldLogicalName: logicalName,
          displayName: displayLabel?.UserLocalizedLabel?.Label,
          requiredLevel,
          isRequired: requiredLevel === 'application' || requiredLevel === 'system',
          maxLength: typeof attr.MaxLength === 'number' ? attr.MaxLength : undefined,
          minValue: typeof attr.MinValue === 'number' ? attr.MinValue : undefined,
          maxValue: typeof attr.MaxValue === 'number' ? attr.MaxValue : undefined,
          precision: typeof attr.Precision === 'number' ? attr.Precision : undefined,
        });
      }
      return map;
    })
    .catch(() => new Map<string, DataverseFieldMetadata>());

  tableMetadataCache.set(tableLogicalName, promise);
  return promise;
}

export async function getFieldMetadata(
  tableLogicalName: string,
  fieldLogicalName: string,
): Promise<DataverseFieldMetadata | null> {
  const map = await fetchTableMetadata(tableLogicalName);
  return map.get(fieldLogicalName.toLowerCase()) ?? null;
}
`;

writeFileSync(domainModelsPath, domainModelsContent);
writeFileSync(dataContractsPath, dataContractsContent);
writeFileSync(mockProviderPath, mockProviderContent);
writeFileSync(realProviderPath, realProviderContent);
writeFileSync(providerFactoryPath, providerFactoryContent);
writeFileSync(fieldMetadataCachePath, fieldMetadataCacheContent);
writeFileSync(prototypeHooksPath, prototypeHooksContent);
writeFileSync(prototypeManifestPath, prototypeManifestContent);
writeFileSync(feedbackPath, prototypeFeedbackContent);

console.log(`Seeded prototype assets from ${planPath}`);