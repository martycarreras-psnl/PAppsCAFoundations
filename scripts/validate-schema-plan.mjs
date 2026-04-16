#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PLAN_PATH = 'dataverse/planning-payload.json';
const RESERVED_NAMES = new Set([
  'account',
  'activitypointer',
  'annotation',
  'asyncoperation',
  'businessunit',
  'contact',
  'email',
  'incident',
  'lead',
  'opportunity',
  'owner',
  'phonecall',
  'queue',
  'role',
  'systemuser',
  'task',
  'team',
  'user',
  'workflow'
]);

const RESERVED_COLUMN_NAMES = new Set([
  'createdon', 'modifiedon', 'createdby', 'modifiedby', 'ownerid',
  'owningbusinessunit', 'owningteam', 'owninguser', 'statecode',
  'statuscode', 'versionnumber', 'importsequencenumber', 'overriddencreatedon',
  'timezoneruleversionnumber', 'utcconversiontimezonecode',
]);

const MAX_COLUMN_NAME_LENGTH = 50;
const MAX_ENTITY_NAME_LENGTH = 50;

function fail(message) {
  console.error(`Schema plan validation failed: ${message}`);
  process.exit(1);
}

function requireString(object, key, context) {
  const value = object?.[key];
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${context}.${key} must be a non-empty string`);
  }
  return value.trim();
}

function requireArray(object, key, context) {
  const value = object?.[key];
  if (!Array.isArray(value)) {
    fail(`${context}.${key} must be an array`);
  }
  return value;
}

function requireStringFromKeys(object, keys, context) {
  for (const key of keys) {
    const value = object?.[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  fail(`${context} must include one of: ${keys.join(', ')}`);
}

function requireArrayFromKeys(object, keys, context) {
  for (const key of keys) {
    const value = object?.[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  fail(`${context} must include one of: ${keys.join(', ')}`);
}

export function loadSchemaPlan(planPath) {
  const resolvedPath = path.resolve(planPath || DEFAULT_PLAN_PATH);
  if (!fs.existsSync(resolvedPath)) {
    fail(`file not found at ${resolvedPath}`);
  }

  try {
    return {
      resolvedPath,
      plan: JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
    };
  } catch (error) {
    fail(`could not parse JSON in ${resolvedPath}: ${error.message}`);
  }
}

function validateDomains(plan) {
  const domains = requireArray(plan, 'domains', 'root');
  domains.forEach((domain, index) => {
    const context = `domains[${index}]`;
    requireString(domain, 'name', context);
    requireString(domain, 'description', context);
  });
}

function validateTables(plan) {
  const tables = requireArray(plan, 'tables', 'root');
  if (tables.length === 0) {
    fail('root.tables must contain at least one table');
  }

  const logicalNames = new Set();

  tables.forEach((table, index) => {
    const context = `tables[${index}]`;
    requireString(table, 'displayName', context);
    requireString(table, 'schemaName', context);
    requireString(table, 'logicalSingularName', context);
    requireStringFromKeys(table, ['logicalPluralName', 'entitySetName', 'tableLogicalName'], `${context}.logicalPluralName`);
    requireString(table, 'entitySetName', context);
    requireStringFromKeys(table, ['ownership', 'ownershipType'], `${context}.ownership`);

    const columns = requireArrayFromKeys(table, ['columns', 'attributes'], `${context}.columns`);

    const singular = table.logicalSingularName.trim().toLowerCase();
    const plural = requireStringFromKeys(table, ['logicalPluralName', 'entitySetName', 'tableLogicalName'], `${context}.logicalPluralName`).toLowerCase();
    const entitySetName = table.entitySetName.trim().toLowerCase();

    if (RESERVED_NAMES.has(singular) || RESERVED_NAMES.has(plural) || RESERVED_NAMES.has(entitySetName)) {
      fail(`${context} uses a reserved Dataverse name`);
    }

    if (singular.length > MAX_ENTITY_NAME_LENGTH) {
      fail(`${context}.logicalSingularName exceeds ${MAX_ENTITY_NAME_LENGTH} characters`);
    }

    if (logicalNames.has(singular)) {
      fail(`${context}.logicalSingularName must be unique`);
    }
    logicalNames.add(singular);

    const columnLogicalNames = new Set();
    columns.forEach((column, columnIndex) => {
      const columnContext = `${context}.columns[${columnIndex}]`;
      requireString(column, 'displayName', columnContext);
      requireString(column, 'schemaName', columnContext);
      const logicalName = requireStringFromKeys(column, ['logicalName', 'schemaName'], `${columnContext}.logicalName`).toLowerCase();
      requireString(column, 'type', columnContext);

      if (logicalName.length > MAX_COLUMN_NAME_LENGTH) {
        fail(`${columnContext} logicalName "${logicalName}" exceeds ${MAX_COLUMN_NAME_LENGTH} characters`);
      }

      if (columnLogicalNames.has(logicalName)) {
        fail(`${columnContext} duplicate column logicalName "${logicalName}" in ${context}`);
      }
      columnLogicalNames.add(logicalName);

      if (RESERVED_COLUMN_NAMES.has(logicalName.replace(/^[a-z]+_/, ''))) {
        fail(`${columnContext} logicalName "${logicalName}" collides with a reserved system column name`);
      }

      const colType = column.type?.toLowerCase();
      if ((colType === 'picklist' || colType === 'choice' || colType === 'optionset') && !column.globalOptionSetName && !column.options) {
        fail(`${columnContext} is a ${colType} column but has neither globalOptionSetName nor inline options`);
      }
    });
  });
}

function validateRelationships(plan) {
  const tables = plan.tables || [];
  const tableNames = new Set(tables.map(t => (t.logicalSingularName || '').trim().toLowerCase()));

  const relationships = requireArray(plan, 'relationships', 'root');
  relationships.forEach((relationship, index) => {
    const context = `relationships[${index}]`;
    requireStringFromKeys(relationship, ['type'], `${context}.type`);
    const fromTable = requireStringFromKeys(relationship, ['fromTable', 'referencingEntity'], `${context}.fromTable`).toLowerCase();
    const toTable = requireStringFromKeys(relationship, ['toTable', 'referencedEntity'], `${context}.toTable`).toLowerCase();
    requireString(relationship, 'schemaName', context);

    if (tableNames.size > 0 && !tableNames.has(fromTable)) {
      fail(`${context}.fromTable "${fromTable}" does not match any table in the plan`);
    }
    if (tableNames.size > 0 && !tableNames.has(toTable)) {
      fail(`${context}.toTable "${toTable}" does not match any table in the plan`);
    }
  });
}

function validateProvisioning(plan) {
  const provisioningPlansJson = requireArrayFromKeys(plan, ['provisioningPlansJson'], 'root.provisioningPlansJson');
  provisioningPlansJson.forEach((entry, index) => {
    const context = `provisioningPlansJson[${index}]`;
    requireString(entry, 'path', context);
    requireString(entry, 'purpose', context);
  });
}

export function validateSchemaPlan(plan) {
  validateDomains(plan);
  validateTables(plan);
  validateRelationships(plan);
  validateProvisioning(plan);
}

function main() {
  const planPath = process.argv[2] || DEFAULT_PLAN_PATH;
  const { resolvedPath, plan } = loadSchemaPlan(planPath);

  validateSchemaPlan(plan);

  console.log(`Schema plan valid: ${resolvedPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
