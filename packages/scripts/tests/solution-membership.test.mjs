// Unit tests for the shared authoritative solution-membership check.
//
// These lock the core logic that decides whether a Code App is actually a
// component of its solution (issue #81 orphaned-app bug): the dependency-free
// zip reader, the Canvas App (type 300) component counter, and the three
// membership statuses returned by checkAppInSolution (member / absent /
// unknown). The check is the safety net that turns the silent "create did not
// associate to the solution" failure into a hard, recoverable stop.

import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = join(__dirname, '..', '..', 'wizard', 'lib', 'solution-membership.mjs');
const { unzipEntries, countCanvasComponents, checkAppInSolution, orphanRecoverySteps } =
  await import(pathToFileURL(LIB).href);

// Build a minimal but real .zip (central directory + local headers) so the
// reader is exercised against the exact structure pac solution export produces.
function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.from(content, 'utf8');
    const comp = deflateRawSync(raw);
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(8, 8); // method: deflate
    lfh.writeUInt32LE(comp.length, 18);
    lfh.writeUInt32LE(raw.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    const localOffset = offset;
    chunks.push(lfh, nameBuf, comp);
    offset += lfh.length + nameBuf.length + comp.length;

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(8, 10); // method
    cdh.writeUInt32LE(comp.length, 20);
    cdh.writeUInt32LE(raw.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(localOffset, 42);
    central.push(cdh, nameBuf);
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  return Buffer.concat([...chunks, ...central, eocd]);
}

const SOLUTION_XML_WITH_APP = `<?xml version="1.0"?>
<ImportExportXml>
  <SolutionManifest>
    <RootComponents>
      <RootComponent type="300" schemaName="myprefix_myapp_a1b2c" behavior="0" />
    </RootComponents>
  </SolutionManifest>
</ImportExportXml>`;

const SOLUTION_XML_EMPTY = `<?xml version="1.0"?>
<ImportExportXml>
  <SolutionManifest>
    <RootComponents />
  </SolutionManifest>
</ImportExportXml>`;

test('countCanvasComponents detects a type 300 Canvas App component', () => {
  assert.equal(countCanvasComponents(SOLUTION_XML_WITH_APP), 1);
});

test('countCanvasComponents returns 0 for an empty solution', () => {
  assert.equal(countCanvasComponents(SOLUTION_XML_EMPTY), 0);
  assert.equal(countCanvasComponents(''), 0);
});

test('countCanvasComponents ignores non-canvas (non-300) components', () => {
  const xml = '<RootComponent type="1" /> <RootComponent type="80" />';
  assert.equal(countCanvasComponents(xml), 0);
});

test('unzipEntries round-trips a deflated solution.xml entry', () => {
  const zip = buildZip({ 'solution.xml': SOLUTION_XML_WITH_APP, 'other.txt': 'noise' });
  const entries = unzipEntries(zip, ['solution.xml']);
  assert.ok(entries['solution.xml'].includes('type="300"'));
  assert.equal(entries['other.txt'], undefined);
});

test('checkAppInSolution => member when the export contains a Canvas App', async () => {
  const res = await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    solutionUniqueName: 'MySolution',
    runCapture: makeFakeExport(SOLUTION_XML_WITH_APP),
  });
  assert.equal(res.status, 'member');
  assert.equal(res.canvasComponentCount, 1);
});

test('checkAppInSolution => absent (orphan) when the export has zero Canvas Apps', async () => {
  const res = await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    solutionUniqueName: 'MySolution',
    runCapture: makeFakeExport(SOLUTION_XML_EMPTY),
  });
  assert.equal(res.status, 'absent');
  assert.equal(res.canvasComponentCount, 0);
});

test('checkAppInSolution => unknown when the export command fails', async () => {
  const res = await checkAppInSolution({
    pac: 'pac',
    projectDir: process.cwd(),
    solutionUniqueName: 'MySolution',
    runCapture: () => ({ ok: false, stdout: '', stderr: 'export failed' }),
  });
  assert.equal(res.status, 'unknown');
});

test('orphanRecoverySteps tells the user to clear appId and re-create', () => {
  const steps = orphanRecoverySteps('MySolution', 'My App').join('\n');
  assert.match(steps, /appId/);
  assert.match(steps, /MySolution/);
  assert.match(steps, /My App/);
});

// Returns a runCapture stub that "exports" by writing a real zip to the --path
// the lib requested, mimicking pac solution export.
function makeFakeExport(solutionXml) {
  return (_file, args) => {
    const pathIdx = args.indexOf('--path');
    const zipPath = pathIdx >= 0 ? args[pathIdx + 1] : join(mkdtempSync(join(tmpdir(), 'x-')), 's.zip');
    writeFileSync(zipPath, buildZip({ 'solution.xml': solutionXml }));
    return { ok: true, stdout: 'Solution exported', stderr: '' };
  };
}
