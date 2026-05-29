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

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
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
// ── Code App routing guard (issues #47, #63) ────────────────────────────────
// BrowserRouter / createBrowserRouter from react-router-dom 404s on first load
// inside the Power Apps host iframe because the host owns the URL path. Only
// the fragment is reliably owned by the iframe, so HashRouter (or
// createHashRouter) is the only routing option that works for a deployed Code
// App.
//
// This guard is SELF-HEALING (#63): the upstream Microsoft starter template
// keeps shifting where BrowserRouter lives (originally in src/main.tsx, then
// moved into src/router.tsx). Rather than fail the build every time Microsoft
// reshapes their starter, we auto-rewrite the offending file in place and
// emit a warning. The build continues; the user can commit the patch.
// Strip line and block comments before scanning so words like "BrowserRouter"
// appearing inside an explanatory comment don't trigger the guard (#71).
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Match real BrowserRouter usage only: a named import from react-router-dom,
// a JSX tag, or a createBrowserRouter() call. Plain mentions in identifiers
// like `MyBrowserRouterThing` or in strings/comments don't count.
const BROWSER_ROUTER_IMPORT_RE = /import\s*\{[^}]*\b(BrowserRouter|createBrowserRouter)\b[^}]*\}\s*from\s*['"]react-router-dom['"]/;
const BROWSER_ROUTER_USAGE_RE = /<\s*BrowserRouter\b|\bcreateBrowserRouter\s*\(/;

function hasBrowserRouter(source) {
  const code = stripComments(source);
  return BROWSER_ROUTER_IMPORT_RE.test(code) || BROWSER_ROUTER_USAGE_RE.test(code);
}

const MAIN_TSX = join(PROJECT_DIR, 'src', 'main.tsx');
const ROUTER_TSX = join(PROJECT_DIR, 'src', 'router.tsx');

if (existsSync(MAIN_TSX)) {
  const original = readFileSync(MAIN_TSX, 'utf-8');
  if (hasBrowserRouter(original)) {
    const patched = original
      .replace(/\bcreateBrowserRouter\b/g, 'createHashRouter')
      .replace(/\bBrowserRouter\b/g, 'HashRouter');
    writeFileSync(MAIN_TSX, patched, 'utf-8');
    console.warn('');
    console.warn('⚠ Routing guard auto-fix: rewrote src/main.tsx BrowserRouter → HashRouter');
    console.warn('  Power Apps host iframes 404 on BrowserRouter (see #47, #63).');
    console.warn('  Review the change and commit it.');
    console.warn('');
  }
}

if (existsSync(ROUTER_TSX)) {
  const contents = readFileSync(ROUTER_TSX, 'utf-8');
  if (hasBrowserRouter(contents)) {
    // src/router.tsx is an upstream Microsoft starter artifact that we don't
    // use (our main.tsx wraps <App /> in <HashRouter> directly). Auto-rewriting
    // it to createHashRouter is risky because createHashRouter does not accept
    // the `basename` option the upstream file passes. Safer: delete it and let
    // main.tsx own the router. See #63.
    try {
      unlinkSync(ROUTER_TSX);
      console.warn('');
      console.warn('⚠ Routing guard auto-fix: removed src/router.tsx (used BrowserRouter)');
      console.warn('  This file was left over from the upstream Microsoft starter template.');
      console.warn('  Our src/main.tsx already wraps <App /> in <HashRouter>. See #47, #63.');
      console.warn('');
    } catch (error) {
      console.error('');
      console.error('✗ Code App routing guard FAILED');
      console.error(`  Could not remove ${ROUTER_TSX}: ${error.message}`);
      console.error('  Delete the file manually — main.tsx already provides the HashRouter.');
      console.error('');
      process.exit(1);
    }
  }
}
