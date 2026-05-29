// Regression test for issue #74: the routing guard in pacaf-patch-datasources
// must not trip on a `main.tsx` that only *mentions* BrowserRouter inside a
// comment while importing/using HashRouter.
//
// Prior to @pacaf/scripts@3.0.3, the guard scanned raw file text with
// `/\b(BrowserRouter|createBrowserRouter)\b/`, which matched the word inside
// the scaffold's own explanatory comment ("HashRouter (NOT BrowserRouter) is
// required…") and failed the build (or, on 3.0.2, silently rewrote the
// comment).

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', 'patch-datasources-info.mjs');

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'pacaf-routing-guard-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  return dir;
}

function runGuard(cwd) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd,
    encoding: 'utf-8',
  });
}

test('does not trip when BrowserRouter appears only in a line comment', () => {
  const dir = makeProject();
  try {
    const source = [
      "import { createRoot } from 'react-dom/client';",
      "// HashRouter (NOT BrowserRouter) is required for Code Apps — BrowserRouter",
      "// 404s on first load inside the Power Apps iframe (see issue #47).",
      "import { HashRouter } from 'react-router-dom';",
      "import App from './App';",
      "createRoot(document.getElementById('root')!).render(<HashRouter><App /></HashRouter>);",
      '',
    ].join('\n');
    const mainTsx = join(dir, 'src', 'main.tsx');
    writeFileSync(mainTsx, source, 'utf-8');

    const result = runGuard(dir);

    assert.equal(result.status, 0, `guard exited non-zero: ${result.stderr}`);
    assert.equal(readFileSync(mainTsx, 'utf-8'), source, 'guard must not rewrite a correct main.tsx');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('does not trip when BrowserRouter appears only in a block comment', () => {
  const dir = makeProject();
  try {
    const source = [
      "import { createRoot } from 'react-dom/client';",
      '/*',
      ' * Use HashRouter. BrowserRouter / createBrowserRouter will 404 inside',
      ' * the Power Apps host iframe — see issues #47 and #63.',
      ' */',
      "import { HashRouter } from 'react-router-dom';",
      "import App from './App';",
      "createRoot(document.getElementById('root')!).render(<HashRouter><App /></HashRouter>);",
      '',
    ].join('\n');
    const mainTsx = join(dir, 'src', 'main.tsx');
    writeFileSync(mainTsx, source, 'utf-8');

    const result = runGuard(dir);

    assert.equal(result.status, 0, `guard exited non-zero: ${result.stderr}`);
    assert.equal(readFileSync(mainTsx, 'utf-8'), source, 'guard must not rewrite a correct main.tsx');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('still auto-rewrites a real BrowserRouter import to HashRouter', () => {
  const dir = makeProject();
  try {
    const source = [
      "import { createRoot } from 'react-dom/client';",
      "import { BrowserRouter } from 'react-router-dom';",
      "import App from './App';",
      "createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);",
      '',
    ].join('\n');
    const mainTsx = join(dir, 'src', 'main.tsx');
    writeFileSync(mainTsx, source, 'utf-8');

    const result = runGuard(dir);

    assert.equal(result.status, 0, `guard exited non-zero: ${result.stderr}`);
    const patched = readFileSync(mainTsx, 'utf-8');
    assert.match(patched, /import \{ HashRouter \} from 'react-router-dom'/);
    assert.match(patched, /<HashRouter>/);
    assert.doesNotMatch(patched, /\bBrowserRouter\b/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('still auto-removes a router.tsx that uses createBrowserRouter', () => {
  const dir = makeProject();
  try {
    const mainTsx = join(dir, 'src', 'main.tsx');
    writeFileSync(
      mainTsx,
      [
        "import { createRoot } from 'react-dom/client';",
        "import { HashRouter } from 'react-router-dom';",
        "import App from './App';",
        "createRoot(document.getElementById('root')!).render(<HashRouter><App /></HashRouter>);",
        '',
      ].join('\n'),
      'utf-8',
    );
    const routerTsx = join(dir, 'src', 'router.tsx');
    writeFileSync(
      routerTsx,
      [
        "import { createBrowserRouter } from 'react-router-dom';",
        "export const router = createBrowserRouter([]);",
        '',
      ].join('\n'),
      'utf-8',
    );

    const result = runGuard(dir);

    assert.equal(result.status, 0, `guard exited non-zero: ${result.stderr}`);
    assert.equal(existsSync(routerTsx), false, 'guard must remove the offending router.tsx');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
