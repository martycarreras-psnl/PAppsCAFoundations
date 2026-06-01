// Code App ↔ solution membership: authoritative read + automated repair.
//
// HOW A CODE APP RELATES TO A SOLUTION (verified against pac 2.7.4, 2026-06):
//   • A deployed Code App is a real Dataverse `canvasapp` record. Its primary
//     key `canvasappid` is THE SAME GUID as the `appId` written into
//     power.config.json (and shown by `pac code list`). Verified identical.
//   • Solution membership is recorded as a `solutioncomponent` row with
//     componenttype 300 (Canvas App) linking the canvasapp to a `solution`.
//   • EVERY component always belongs to the system "Active" and "Default"
//     solutions, so real membership means a solutioncomponent row whose
//     solution uniquename is the USER solution we selected.
//
// READ (auth-mode agnostic): `pac org fetch` runs FetchXML under the ACTIVE
//   auth profile, so it works for BOTH user (device-code) and SPN profiles
//   with no client secret. We query solutioncomponent filtered to our appId,
//   componenttype 300, and the target solution's uniquename; a returned
//   solutioncomponentid GUID proves membership.
//
// REPAIR (auth-mode agnostic): `pac solution add-solution-component
//   --component <appId> --componentType 300 --solutionUniqueName <name>` adds
//   the existing canvasapp to the solution. Because appId === canvasappid this
//   succeeds without deleting or recreating the app. The historic #81 failure
//   came from a different code path, and the old verification used a malformed
//   `pac solution export --managed false` that produced false negatives — both
//   are removed here in favour of the Dataverse read + component add above.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Canvas App component type in a Dataverse solution.
const CANVAS_APP_COMPONENT_TYPE = '300';

// A Dataverse GUID in pac org fetch output. When the membership query is
// scoped to a single solution, any returned GUID (the solutioncomponentid)
// means the app IS a component of that solution.
const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function escapeXmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// FetchXML that returns a solutioncomponentid row ONLY when appId is a Canvas
// App (type 300) component of the solution whose uniquename matches.
export function buildMembershipFetchXml(appId, solutionUniqueName) {
  return (
    '<fetch>' +
    '<entity name="solutioncomponent">' +
    '<attribute name="solutioncomponentid"/>' +
    '<filter>' +
    `<condition attribute="objectid" operator="eq" value="${escapeXmlAttr(appId)}"/>` +
    `<condition attribute="componenttype" operator="eq" value="${CANVAS_APP_COMPONENT_TYPE}"/>` +
    '</filter>' +
    '<link-entity name="solution" from="solutionid" to="solutionid" alias="sol">' +
    '<attribute name="uniquename"/>' +
    '<filter>' +
    `<condition attribute="uniquename" operator="eq" value="${escapeXmlAttr(solutionUniqueName)}"/>` +
    '</filter>' +
    '</link-entity>' +
    '</entity>' +
    '</fetch>'
  );
}

function makeLogger(log) {
  const noop = () => {};
  return {
    info: (log && (log.info || log.line)) || noop,
    ok: (log && log.ok) || noop,
    warn: (log && log.warn) || noop,
  };
}

// status: 'member' | 'absent' | 'unknown'
//   member  — appId is a Canvas App component of the target solution
//   absent  — appId is NOT a component of the target solution (repairable)
//   unknown — the read failed (no profile / org / network); callers should
//             warn and skip auto-repair rather than hard-block
//
// runCapture(file, args, opts) must return { ok, stdout, stderr } (sync or async).
export async function checkAppInSolution({ pac, projectDir, appId, solutionUniqueName, runCapture }) {
  const result = { status: 'unknown', detail: '', appId, solutionUniqueName };
  if (!appId) return { ...result, detail: 'No appId available (app has not been pushed yet).' };
  if (!solutionUniqueName) return { ...result, detail: 'No solution unique name provided.' };
  let workDir = '';
  try {
    workDir = mkdtempSync(join(tmpdir(), 'pacaf-solcheck-'));
    const xmlPath = join(workDir, 'membership.fetchxml');
    writeFileSync(xmlPath, buildMembershipFetchXml(appId, solutionUniqueName), 'utf8');
    const { ok, stdout, stderr } = await runCapture(pac, ['org', 'fetch', '--xmlFile', xmlPath], { cwd: projectDir });
    const out = `${stdout || ''}\n${stderr || ''}`;
    if (!ok) {
      result.detail = `pac org fetch failed: ${String(stderr || stdout || '').trim()}`.trim();
      return result;
    }
    // The query selects only solutioncomponentid and is scoped to a single
    // solution + appId, so a GUID in the output means a matching row exists.
    result.status = GUID_RE.test(out) ? 'member' : 'absent';
    result.detail = result.status === 'member'
      ? `App ${appId} is a component of solution "${solutionUniqueName}".`
      : `App ${appId} is NOT a component of solution "${solutionUniqueName}".`;
    return result;
  } catch (error) {
    result.detail = `Membership check failed: ${error.message}`;
    return result;
  } finally {
    if (workDir) { try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
}

// Add an existing Code App (canvasapp) to a solution. appId === canvasappid, so
// `--component <appId>` is the correct identifier. Runs under the active auth
// profile (works for user AND SPN). runCapture must return { ok, stdout, stderr }.
export async function addAppToSolution({ pac, projectDir, appId, solutionUniqueName, runCapture }) {
  const result = { ok: false, detail: '' };
  if (!appId) { result.detail = 'No appId available to add.'; return result; }
  if (!solutionUniqueName) { result.detail = 'No solution unique name provided.'; return result; }
  const args = [
    'solution', 'add-solution-component',
    '--solutionUniqueName', solutionUniqueName,
    '--component', appId,
    '--componentType', CANVAS_APP_COMPONENT_TYPE,
  ];
  try {
    const { ok, stdout, stderr } = await runCapture(pac, args, { cwd: projectDir });
    result.ok = ok === true;
    result.detail = String(stderr || stdout || '').trim();
    return result;
  } catch (error) {
    result.detail = `add-solution-component failed: ${error.message}`;
    return result;
  }
}

// Read membership; if the app is absent, add it and re-read. This is the single
// entry point both deploy-step copies call so the read+repair logic cannot
// drift between the CLI and browser wizards.
//
// Returns { status, repaired, detail, ... } where status is the FINAL status
// after any repair attempt.
export async function ensureAppInSolution({ pac, projectDir, appId, solutionUniqueName, runCapture, log }) {
  const say = makeLogger(log);
  const initial = await checkAppInSolution({ pac, projectDir, appId, solutionUniqueName, runCapture });

  if (initial.status === 'member') {
    say.ok(`Confirmed: the app is a component of solution "${solutionUniqueName}".`);
    return { ...initial, repaired: false };
  }
  if (initial.status === 'unknown') {
    say.warn(`Could not confirm solution membership (${initial.detail}). Skipping auto-repair — verify in the Maker Portal.`);
    return { ...initial, repaired: false };
  }

  // absent → repair automatically (no delete/recreate required).
  say.warn(`The app is not yet in solution "${solutionUniqueName}". Adding it automatically...`);
  const add = await addAppToSolution({ pac, projectDir, appId, solutionUniqueName, runCapture });
  if (!add.ok) {
    say.warn(`Automatic add-to-solution did not succeed: ${add.detail || 'unknown error'}`);
    return { ...initial, repaired: false, repairError: add.detail };
  }

  const recheck = await checkAppInSolution({ pac, projectDir, appId, solutionUniqueName, runCapture });
  if (recheck.status === 'member') {
    say.ok(`Repaired: the app was added to solution "${solutionUniqueName}".`);
    return { ...recheck, repaired: true };
  }
  say.warn(`Ran add-to-solution but membership is still unconfirmed (${recheck.detail}).`);
  return { ...recheck, repaired: false };
}

// Fallback text shown ONLY when automatic add-to-solution could not be
// confirmed. No delete/recreate is needed — the app keeps its appId and URL;
// it just needs to be added to the solution (which the Maker Portal can do
// directly because the canvasapp record already exists).
export function manualSolutionAddSteps(solutionUniqueName, appDisplayName = 'the Code App') {
  return [
    `The Code App "${appDisplayName}" is deployed but could not be auto-added to solution "${solutionUniqueName}".`,
    'Add it manually (the app keeps its existing appId and URL — do NOT delete it):',
    `  1. In the Maker Portal, open Solutions → "${solutionUniqueName}".`,
    '  2. Add existing → App → Code app.',
    `  3. Select "${appDisplayName}" and add it.`,
    'Or from a terminal with the same auth profile:',
    `  pac solution add-solution-component --solutionUniqueName ${solutionUniqueName} --component <appId> --componentType 300`,
  ];
}
