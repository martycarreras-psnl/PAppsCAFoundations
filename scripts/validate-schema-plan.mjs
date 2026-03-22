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

    if (logicalNames.has(singular)) {
      fail(`${context}.logicalSingularName must be unique`);
    }
    logicalNames.add(singular);

    columns.forEach((column, columnIndex) => {
      const columnContext = `${context}.columns[${columnIndex}]`;
      requireString(column, 'displayName', columnContext);
      requireString(column, 'schemaName', columnContext);
      requireStringFromKeys(column, ['logicalName', 'schemaName'], `${columnContext}.logicalName`);
      requireString(column, 'type', columnContext);
    });
  });
}

function validateRelationships(plan) {
  const relationships = requireArray(plan, 'relationships', 'root');
  relationships.forEach((relationship, index) => {
    const context = `relationships[${index}]`;
    requireStringFromKeys(relationship, ['type'], `${context}.type`);
    requireStringFromKeys(relationship, ['fromTable', 'referencingEntity'], `${context}.fromTable`);
    requireStringFromKeys(relationship, ['toTable', 'referencedEntity'], `${context}.toTable`);
    requireString(relationship, 'schemaName', context);
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
