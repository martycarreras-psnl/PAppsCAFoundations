#!/usr/bin/env node
// scripts/patch-datasources-info.mjs
// Fixes a PAC CLI code generation bug where some API definitions in
// .power/schemas/appschemas/dataSourcesInfo.ts are missing the required
// "parameters" field. The @microsoft/power-apps SDK's IApiDefinition type
// requires parameters: Array<...> on every entry, but PAC omits it for
// parameterless APIs (e.g. SharePoint's OnTableUpdatedHook).
//
// This script adds "parameters": [] to any API definition that has "path"
// and "method" but no "parameters" key.
//
// Usage:  node scripts/patch-datasources-info.mjs
// Runs automatically as part of `npm run build` (prebuild hook).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_DIR = process.cwd();
const DS_INFO_PATH = join(PROJECT_DIR, '.power', 'schemas', 'appschemas', 'dataSourcesInfo.ts');

if (!existsSync(DS_INFO_PATH)) {
  // No generated data sources — nothing to patch
  process.exit(0);
}

const original = readFileSync(DS_INFO_PATH, 'utf-8');

// Match API entries that have "path" and "method" but no "parameters".
// Pattern: after "method": "...", if the next non-whitespace is "responseInfo"
// (not "parameters"), insert "parameters": [].
const patched = original.replace(
  /("method"\s*:\s*"[^"]*"\s*,\s*\n)(\s*)("responseInfo")/g,
  (match, methodLine, indent, responseInfo) => {
    return `${methodLine}${indent}"parameters": [],\n${indent}${responseInfo}`;
  },
);

if (patched !== original) {
  writeFileSync(DS_INFO_PATH, patched, 'utf-8');
  const count = (patched.match(/"parameters": \[\],/g) || []).length;
  console.log(`✓ Patched dataSourcesInfo.ts — added missing "parameters": [] to ${count} API definition(s)`);
} else {
  console.log('✓ dataSourcesInfo.ts — no patching needed');
}
