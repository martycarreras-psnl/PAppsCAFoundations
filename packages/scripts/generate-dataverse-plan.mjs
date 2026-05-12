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

  // Plugin-compatible provisioning summary for dv-metadata consumption
  const pluginPlanPath = resolvePlannedPath(
    provisioningEntries,
    /plugin|dv-metadata/i,
    'dataverse/provision-plugin.plan.json',
  );
  const pluginPlan = {
    generatedAt: new Date().toISOString(),
    sourcePlan: relativePath(resolvedPath),
    description:
      'Structured provisioning plan for the Dataverse-skills plugin (dv-metadata). ' +
      'Feed this to the agent: "Provision the schema described in dataverse/provision-plugin.plan.json".',
    sequence: [
      { phase: 1, action: 'Create global option sets', items: collectGlobalOptionSets(tables) },
      {
        phase: 2,
        action: 'Create tables with primary name columns',
        items: tables.map((t) => ({
          schemaName: t.schemaName,
          displayName: t.displayName,
          logicalName: t.logicalSingularName,
          ownership: t.ownership || 'UserOwned',
          primaryName: t.primaryName,
        })),
      },
      {
        phase: 3,
        action: 'Add columns to tables',
        items: tables.flatMap((t) =>
          t.columns.map((c) => ({
            table: t.logicalSingularName,
            column: c.schemaName || c.logicalName,
            type: c.type,
            globalOptionSetName: c.globalOptionSetName || undefined,
          })),
        ),
      },
      {
        phase: 4,
        action: 'Create relationships',
        items: relationships.map((r) => ({
          type: r.type,
          from: r.fromTable,
          to: r.toTable,
          schemaName: r.schemaName,
        })),
      },
      { phase: 5, action: 'PublishAllXml' },
      {
        phase: 6,
        action: 'Register data sources (pac code add-data-source)',
        tables: dataverseTables,
      },
    ],
  };

  writeJson(tablesPlanPath, tablesPlan);
  writeJson(relationshipsPlanPath, relationshipsPlan);
  writeJson(registrationPlanPath, registrationPlan);
  writeJson(pluginPlanPath, pluginPlan);

  console.log(`Dataverse plans generated from ${relativePath(resolvedPath)}`);
  console.log(`- ${relativePath(tablesPlanPath)}`);
  console.log(`- ${relativePath(relationshipsPlanPath)}`);
  console.log(`- ${relativePath(registrationPlanPath)}`);
  console.log(`- ${relativePath(pluginPlanPath)} (for Dataverse-skills plugin)`);
}

main();