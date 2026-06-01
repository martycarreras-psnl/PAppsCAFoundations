// Authoritative Code App ↔ solution membership verification.
//
// THE PROBLEM THIS SOLVES (issue #81 / orphaned Code Apps):
// A Code App's solution membership is written EXACTLY ONCE — on the FIRST
// `pac code push` (the CREATE, when power.config.json has no appId). That push
// must carry `-s <UNIQUE name>`. Once an appId exists, every later push is an
// UPDATE and `-s` is SILENTLY IGNORED — it can never retroactively associate an
// app that was first pushed without a valid solution unique name. There is also
// no reliable post-hoc CLI repair (the old `solution add-solution-component
// -ct 300` path expects the canvasapp record GUID, not the play-URL appId, and
// always failed). So the only signal we can trust is: export the solution and
// look at what is actually inside it.
//
// The old wizard "verification" only ran `pac solution list` and checked the
// unique name appeared — that proves the SOLUTION exists, NOT that the APP is a
// component of it. That false positive is exactly how an app could be left
// orphaned while the wizard reported success.
//
// This module exports a real check: `pac solution export` the target solution,
// read its solution.xml from the zip (no external unzip dependency), and count
// Canvas App root components (`<RootComponent type="300" ...>`). Zero canvas
// components for a solution we expect to own our app === orphaned app.

import { inflateRawSync } from 'node:zlib';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Canvas App component type in a Dataverse solution's RootComponents.
const CANVAS_APP_COMPONENT_TYPE = '300';

// Minimal, dependency-free zip reader. Uses the central directory for entry
// sizes so it is robust against streamed entries that use data descriptors
// (local headers with zeroed sizes), which `pac solution export` can produce.
export function unzipEntries(buffer, wanted) {
  const EOCD_SIG = 0x06054b50;
  const CDH_SIG = 0x02014b50;
  const LFH_SIG = 0x04034b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) return {};
  const cdCount = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  const out = {};
  let p = cdOffset;
  for (let n = 0; n < cdCount; n += 1) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== CDH_SIG) break;
    const method = buffer.readUInt16LE(p + 10);
    const compSize = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    const want = typeof wanted === 'function' ? wanted(name) : (!wanted || wanted.includes(name));
    if (!want) continue;
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LFH_SIG) continue;
    const lNameLen = buffer.readUInt16LE(localOffset + 26);
    const lExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const compData = buffer.subarray(dataStart, dataStart + compSize);
    let content = null;
    if (method === 0) content = compData;
    else if (method === 8) { try { content = inflateRawSync(compData); } catch { content = null; } }
    if (content) out[name] = content.toString('utf8');
  }
  return out;
}

// Count Canvas App (type 300) root components in an exported solution's xml.
export function countCanvasComponents(solutionXml = '') {
  const re = /<RootComponent\b[^>]*\btype=["']?300["']?[^>]*>/gi;
  const matches = solutionXml.match(re);
  return matches ? matches.length : 0;
}

// status: 'member' | 'absent' | 'unknown'
//   member  — the solution contains at least one Canvas App component
//   absent  — the solution exports cleanly with ZERO Canvas App components
//             (definitive: an app that should be here is orphaned)
//   unknown — export failed or the zip could not be read (cannot decide;
//             callers should warn, never hard-block on this)
//
// runCapture(file, args, opts) must return { ok, stdout, stderr } (sync or async).
export async function checkAppInSolution({ pac, projectDir, solutionUniqueName, runCapture }) {
  const result = { status: 'unknown', detail: '', canvasComponentCount: 0 };
  if (!solutionUniqueName) return { ...result, detail: 'No solution unique name provided.' };
  let workDir = '';
  try {
    workDir = mkdtempSync(join(tmpdir(), 'pacaf-solcheck-'));
    const zipPath = join(workDir, `${solutionUniqueName}.zip`);
    const exportArgs = ['solution', 'export', '--name', solutionUniqueName, '--path', zipPath, '--overwrite', '--managed', 'false'];
    const { ok, stdout, stderr } = await runCapture(pac, exportArgs, { cwd: projectDir });
    if (!ok || !existsSync(zipPath)) {
      result.detail = `pac solution export did not produce a zip. ${String(stderr || stdout || '').trim()}`.trim();
      return result;
    }
    const buffer = readFileSync(zipPath);
    const entries = unzipEntries(buffer, (name) => /(^|\/)solution\.xml$/i.test(name) || /(^|\/)customizations\.xml$/i.test(name));
    const solutionXml = entries[Object.keys(entries).find((k) => /(^|\/)solution\.xml$/i.test(k)) || ''] || '';
    const customizationsXml = entries[Object.keys(entries).find((k) => /(^|\/)customizations\.xml$/i.test(k)) || ''] || '';
    if (!solutionXml && !customizationsXml) {
      result.detail = 'Could not read solution.xml from the exported solution zip.';
      return result;
    }
    const count = countCanvasComponents(`${solutionXml}\n${customizationsXml}`);
    result.canvasComponentCount = count;
    result.status = count > 0 ? 'member' : 'absent';
    result.detail = count > 0
      ? `Solution "${solutionUniqueName}" contains ${count} Canvas App component(s).`
      : `Solution "${solutionUniqueName}" exported cleanly with ZERO Canvas App components.`;
    return result;
  } catch (error) {
    result.detail = `Membership check failed: ${error.message}`;
    return result;
  } finally {
    if (workDir) { try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}

// Recovery text shown when an app is confirmed orphaned. An UPDATE push can
// NEVER associate it — the appId must be cleared so the next push is a CREATE
// that carries -s, and the existing app must be removed first so its name is
// free.
export function orphanRecoverySteps(solutionUniqueName, appDisplayName = 'the Code App') {
  return [
    `The Code App exists but is NOT a component of solution "${solutionUniqueName}".`,
    'A re-push cannot fix this: once an appId exists every push is an UPDATE and -s is ignored.',
    'To recover:',
    `  1. In the Maker Portal, delete the existing Code App "${appDisplayName}" (Apps → ... → Delete).`,
    '  2. Remove the "appId" field from power.config.json so the next push is a fresh CREATE.',
    `  3. Re-run the deploy. The first push will carry -s ${solutionUniqueName} and create the app INSIDE the solution.`,
    '  (The recreated app gets a new appId and URL — unavoidable for an orphaned Code App.)',
  ];
}
