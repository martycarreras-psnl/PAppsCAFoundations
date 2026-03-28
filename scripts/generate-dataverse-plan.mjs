#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadSchemaPlan, validateSchemaPlan } from './validate-schema-plan.mjs';

const DEFAULT_PLAN_PATH = 'dataverse/planning-payload.json';

function normalizeColumns(table) {
  const columns = Array.isArray(table.columns) ? table.columns : table.attributes || [];
  return columns.map((column) => ({
    ...column,
    logicalName: column.logicalName || column.schemaName,
  }));
}

function normalizeTable(table) {
  const logicalPluralName = table.logicalPluralName || table.entitySetName || table.tableLogicalName;
  return {
    schemaName: table.schemaName,
    displayName: table.displayName,
    displayCollectionName: table.displayCollectionName,
    logicalSingularName: table.logicalSingularName,
    logicalPluralName,
    entitySetName: table.entitySetName,
    tableLogicalName: table.tableLogicalName || logicalPluralName,
    description: table.description || '',
    ownership: table.ownership || table.ownershipType,
    hasActivities: table.hasActivities ?? false,
    hasNotes: table.hasNotes ?? false,
    primaryName: table.primaryName || null,
    columns: normalizeColumns(table),
  };
}

function normalizeRelationship(relationship) {
  return {
    ...relationship,
    type: relationship.type,
    fromTable: relationship.fromTable || relationship.referencingEntity,
    toTable: relationship.toTable || relationship.referencedEntity,
  };
}

function collectGlobalOptionSets(tables) {
  const optionSets = new Map();

  for (const table of tables) {
    for (const column of table.columns) {
      if (!column.globalOptionSetName) continue;

      if (!optionSets.has(column.globalOptionSetName)) {
        optionSets.set(column.globalOptionSetName, {
          name: column.globalOptionSetName,
          referencedBy: [],
        });
      }

      optionSets.get(column.globalOptionSetName).referencedBy.push({
        table: table.tableLogicalName,
        column: column.logicalName,
      });
    }
  }

  return [...optionSets.values()];
}

function resolvePlannedPath(entries, matcher, fallbackPath) {
  const match = entries.find((entry) => matcher.test(entry.path));
  return path.resolve(match?.path || fallbackPath);
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function relativePath(filePath) {
  return path.relative(process.cwd(), filePath) || path.basename(filePath);
}

function main() {
  const planPath = process.argv[2] || DEFAULT_PLAN_PATH;
  const { resolvedPath, plan } = loadSchemaPlan(planPath);
  validateSchemaPlan(plan);

  const tables = plan.tables.map(normalizeTable);
  const relationships = plan.relationships.map(normalizeRelationship);
  const provisioningEntries = plan.provisioningPlansJson || [];

  const tablesPlanPath = resolvePlannedPath(
    provisioningEntries,
    /(table|tables)/i,
    'dataverse/provision-tables.plan.json',
  );
  const relationshipsPlanPath = resolvePlannedPath(
    provisioningEntries,
    /relationship/i,
    'dataverse/provision-relationships.plan.json',
  );
  const registrationPlanPath = resolvePlannedPath(
    provisioningEntries,
    /(register|datasource|data-source)/i,
    'dataverse/register-datasources.plan.json',
  );

  const tablesPlan = {
    generatedAt: new Date().toISOString(),
    sourcePlan: relativePath(resolvedPath),
    globalOptionSets: collectGlobalOptionSets(tables),
    tables,
  };

  const relationshipsPlan = {
    generatedAt: new Date().toISOString(),
    sourcePlan: relativePath(resolvedPath),
    relationships,
  };

  const dataverseTables = [...new Set(tables.map((table) => table.tableLogicalName))];
  const registrationPlan = {
    generatedAt: new Date().toISOString(),
    sourcePlan: relativePath(resolvedPath),
    dataverseTables,
    pacCommands: [
      ...dataverseTables.map((table) => `~/.dotnet/tools/pac code add-data-source -a dataverse -t ${table}`),
    ],
  };

  writeJson(tablesPlanPath, tablesPlan);
  writeJson(relationshipsPlanPath, relationshipsPlan);
  writeJson(registrationPlanPath, registrationPlan);

  console.log(`Dataverse plans generated from ${relativePath(resolvedPath)}`);
  console.log(`- ${relativePath(tablesPlanPath)}`);
  console.log(`- ${relativePath(relationshipsPlanPath)}`);
  console.log(`- ${relativePath(registrationPlanPath)}`);
}

main();