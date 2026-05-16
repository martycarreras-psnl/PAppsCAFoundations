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

if (existsSync(DS_INFO_PATH)) {
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
}
// ── Code App routing guard (issue #47) ───────────────────────────────────────
// BrowserRouter / createBrowserRouter from react-router-dom 404s on first load
// inside the Power Apps host iframe because the host owns the URL path. Only
// the fragment is reliably owned by the iframe, so HashRouter (or
// createHashRouter) is the only routing option that works for a deployed Code
// App. Fail the build loudly if main.tsx or router.tsx still reference the
// browser router — much better than letting it ship and 404 in production.
const ROUTER_FILES = [
  join(PROJECT_DIR, 'src', 'main.tsx'),
  join(PROJECT_DIR, 'src', 'router.tsx'),
];
const BROWSER_ROUTER_RE = /\b(BrowserRouter|createBrowserRouter)\b/;
for (const file of ROUTER_FILES) {
  if (!existsSync(file)) continue;
  const contents = readFileSync(file, 'utf-8');
  if (BROWSER_ROUTER_RE.test(contents)) {
    console.error('');
    console.error('✗ Code App routing guard FAILED');
    console.error('');
    console.error(`  ${file} imports BrowserRouter / createBrowserRouter from react-router-dom.`);
    console.error('  BrowserRouter 404s on first load inside the Power Apps iframe because the');
    console.error('  Power Apps host owns the URL path. Use HashRouter (or createHashRouter)');
    console.error('  instead — the fragment is the only URL segment the iframe reliably owns.');
    console.error('');
    console.error('  Fix:');
    console.error('    - import { HashRouter } from \'react-router-dom\';');
    console.error('    + <HashRouter><App /></HashRouter>');
    console.error('');
    console.error('  See .github/instructions/01-scaffold.instructions.md and issue #47.');
    console.error('');
    process.exit(1);
  }
}
