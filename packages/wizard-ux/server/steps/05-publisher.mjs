// Step 5 — Solution & Publisher (solution-first, publisher auto-resolved).
import { dirname, resolve, join } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dvGet, dvPost, hasUsableSecret, setSecret, clearSecret } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const VALIDATE = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'validate.mjs')).href);
const SHELL = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);

const CREATE_NEW = '__create_new__';
const PASTE_URL = '__paste_url__';

/**
 * Run `pac env fetch` using --xmlFile instead of --xml to avoid XmlException
 * on macOS PAC CLI 2.2.1+ where inline FetchXML attribute quotes get corrupted.
 * Writes the XML to a temp file, runs the command, and cleans up.
 */
function pacEnvFetchXml(pac, fetchXml, opts) {
  const tmp = join(tmpdir(), `pac-fetch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.xml`);
  try {
    writeFileSync(tmp, fetchXml, 'utf-8');
    return SHELL.runSafe(pac, ['env', 'fetch', '--xmlFile', tmp], opts);
  } finally {
    try { unlinkSync(tmp); } catch { /* best effort cleanup */ }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Get the Maker Portal solutions deep-link via `pac org who`. */
function getMakerPortalLink() {
  try {
    const pac = SHELL.pacPath();
    const whoOut = SHELL.runSafe(pac, ['org', 'who']);
    if (whoOut) {
      const whoInfo = PAC_TARGET.parsePacOrgWho(whoOut);
      if (whoInfo.environmentId) {
        return `https://make.powerapps.com/environments/${whoInfo.environmentId}/solutions`;
      }
    }
  } catch { /* fall through */ }
  return 'https://make.powerapps.com';
}

/** Extract solution GUID from a Maker Portal URL. */
function extractSolutionIdFromUrl(url) {
  const m = String(url).match(/\/solutions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Use `pac env fetch` to get solution + publisher by solution ID.
 * Works with both user auth and SPN — uses whatever PAC profile is active.
 * Returns { solutionid, uniquename, friendlyname, version, publisherid, prefix, publisherFriendlyName, publisherUniqueName }
 */
function fetchSolutionViaPac(solutionId) {
  const pac = SHELL.pacPath();
  if (!pac) return null;
  // Use separate queries: one for solution, one for publisher (avoids tabular parse issues)
  const solXml = `<fetch><entity name="solution"><attribute name="uniquename"/><attribute name="friendlyname"/><attribute name="version"/><attribute name="solutionid"/><attribute name="publisherid"/><filter><condition attribute="solutionid" operator="eq" value="${solutionId}"/></filter></entity></fetch>`;
  const solOutput = pacEnvFetchXml(pac, solXml);
  if (!solOutput) return null;

  // Parse the tabular output for the solution
  const solId = extractGuid(solOutput, solutionId) || solutionId;
  const version = extractPattern(solOutput, /(\d+\.\d+\.\d+\.\d+)/);

  // The publisherid in the solution output is a GUID (the lookup value)
  const guids = [...solOutput.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)]
    .map((m) => m[0].toLowerCase());
  // publisherid is the GUID that is NOT the solutionid
  const pubGuid = guids.find((g) => g !== solId) || '';

  // Extract unique name: it's a single PascalCase/camelCase token (no spaces, not a GUID, not a version)
  const tokens = extractDataTokens(solOutput);
  const uniquename = tokens.find((t) => !isGuid(t) && !/^\d+\.\d+/.test(t) && t.length > 1) || '';

  // For friendlyname, we need to be smarter. The text between known tokens.
  // Approach: remove GUIDs, version, uniquename, and "Connected..." lines → what's left is the friendly name
  const friendlyname = extractFriendlyName(solOutput, [solId, pubGuid, version, uniquename]);

  // Now fetch the publisher details using the pubGuid
  let prefix = '';
  let publisherFriendlyName = '';
  let publisherUniqueName = '';
  let choiceValuePrefix = '';

  if (pubGuid) {
    const pubXml = `<fetch><entity name="publisher"><attribute name="customizationprefix"/><attribute name="friendlyname"/><attribute name="uniquename"/><attribute name="publisherid"/><attribute name="customizationoptionvalueprefix"/><filter><condition attribute="publisherid" operator="eq" value="${pubGuid}"/></filter></entity></fetch>`;
    const pubOutput = pacEnvFetchXml(pac, pubXml);
    if (pubOutput) {
      const pubTokens = extractDataTokens(pubOutput);
      // customizationprefix is a short lowercase string
      prefix = pubTokens.find((t) => /^[a-z]{2,8}$/.test(t) && !['and', 'for', 'the'].includes(t)) || '';
      // customizationoptionvalueprefix is a numeric string
      choiceValuePrefix = pubTokens.find((t) => /^\d{3,6}$/.test(t)) || '';
      // publisher uniquename is a single token (not GUID, not prefix, not choiceValuePrefix)
      publisherUniqueName = pubTokens.find((t) =>
        !isGuid(t) && t !== prefix && t !== choiceValuePrefix && t.length > 1 && !/^\d+$/.test(t),
      ) || '';
      publisherFriendlyName = extractFriendlyName(pubOutput, [pubGuid, prefix, publisherUniqueName, choiceValuePrefix]);
    }
  }

  return {
    solutionid: solId,
    uniquename,
    friendlyname,
    version,
    publisherid: pubGuid,
    prefix,
    publisherFriendlyName,
    publisherUniqueName,
    choiceValuePrefix,
  };
}

/**
 * List unmanaged solutions via `pac env fetch`. Returns basic solution list.
 * Each entry has { solutionid, label }.
 */
function listSolutionSummariesViaPac() {
  const pac = SHELL.pacPath();
  if (!pac) return [];
  const xml = `<fetch><entity name="solution"><attribute name="uniquename"/><attribute name="friendlyname"/><attribute name="solutionid"/><link-entity name="publisher" from="publisherid" to="publisherid" link-type="inner" alias="pub"><attribute name="customizationprefix"/></link-entity><filter><condition attribute="ismanaged" operator="eq" value="0"/><condition attribute="isvisible" operator="eq" value="1"/></filter><order attribute="friendlyname"/></entity></fetch>`;
  const output = pacEnvFetchXml(pac, xml, { timeout: 15000 });
  if (!output) return [];

  // Parse each data row. The output has: uniquename, friendlyname, solutionid, pub.customizationprefix
  // Each row has a GUID. Group by GUID.
  const guids = [...output.matchAll(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)]
    .map((m) => m[1].toLowerCase());
  const uniqueGuids = [...new Set(guids)];

  // Filter out well-known system solution GUIDs
  const systemGuids = new Set([
    'fd140aaf-4df4-11dd-bd17-0019b9312238', // Default Solution
    '00000001-0000-0000-0001-00000000009b', // Common Data Services
  ]);

  // For each solution GUID, we need the display label.
  // Since parsing multi-row tabular output is fragile, use a simple approach:
  // split output into segments by GUID, extract the text around each.
  const lines = output.split(/\r?\n/).filter((l) =>
    l.trim() &&
    !l.startsWith('Connected') &&
    !l.startsWith('Microsoft') &&
    !l.startsWith('Version:') &&
    !l.startsWith('Online') &&
    !l.startsWith('Feedback'),
  );

  // The header line contains column names. Skip it.
  const headerKeywords = ['uniquename', 'friendlyname', 'solutionid'];
  const dataLines = lines.filter((l) => !headerKeywords.some((kw) => l.toLowerCase().includes(kw)));
  const fullData = dataLines.join(' ');

  const results = [];
  for (const guid of uniqueGuids) {
    if (systemGuids.has(guid)) continue;

    // Find the text around this GUID to extract a label
    const idx = fullData.indexOf(guid);
    if (idx < 0) continue;

    // Look for a short lowercase prefix near the GUID (the pub.customizationprefix)
    const nearby = fullData.slice(Math.max(0, idx - 200), idx + 200);
    const prefixMatch = nearby.match(/\b([a-z]{2,8})\b/);
    const prefix = prefixMatch ? prefixMatch[1] : '?';

    // The friendlyname is harder to extract from the concatenated data.
    // We'll use the GUID as the value and fetch full details on selection.
    results.push({ value: guid, label: `Solution ${guid.slice(0, 8)}… (${prefix}_)` });
  }

  // If we got results but labels are poor, try fetching details for each
  // (only if there are few solutions)
  if (results.length > 0 && results.length <= 20) {
    for (const r of results) {
      const details = fetchSolutionViaPac(r.value);
      if (details) {
        const name = details.friendlyname || details.uniquename || r.value;
        r.label = `${name} (${details.prefix || '?'}_)`;
      }
    }
  }

  return results.filter((r) => r.label && !r.label.includes('Default Solution') && !r.label.includes('Common Data'));
}

// ─── Parse utilities ─────────────────────────────────────────────────

function isGuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function extractGuid(text, hint) {
  const guids = [...text.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)]
    .map((m) => m[0].toLowerCase());
  if (hint) return guids.find((g) => g === hint.toLowerCase()) || guids[0] || '';
  return guids[0] || '';
}

function extractPattern(text, re) {
  const m = text.match(re);
  return m ? m[1] : '';
}

/** Extract data tokens from PAC CLI output (skip header/banner lines). */
function extractDataTokens(output) {
  const lines = output.split(/\r?\n/).filter((l) =>
    l.trim() &&
    !l.startsWith('Connected') &&
    !l.startsWith('Microsoft') &&
    !l.startsWith('Version:') &&
    !l.startsWith('Online') &&
    !l.startsWith('Feedback'),
  );
  const headerKeywords = ['uniquename', 'friendlyname', 'solutionid', 'publisherid', 'customizationprefix', 'version'];
  const dataLines = lines.filter((l) => !headerKeywords.some((kw) => l.toLowerCase().includes(kw)));
  return dataLines.join(' ').split(/\s+/).filter(Boolean);
}

/** Extract the friendly name from PAC output by removing known tokens. */
function extractFriendlyName(output, knownTokens) {
  const lines = output.split(/\r?\n/).filter((l) =>
    l.trim() &&
    !l.startsWith('Connected') &&
    !l.startsWith('Microsoft') &&
    !l.startsWith('Version:') &&
    !l.startsWith('Online') &&
    !l.startsWith('Feedback'),
  );
  const headerKeywords = ['uniquename', 'friendlyname', 'solutionid', 'publisherid', 'customizationprefix', 'version', 'customizationoptionvalueprefix'];
  const dataLines = lines.filter((l) => !headerKeywords.some((kw) => l.toLowerCase().includes(kw)));
  let text = dataLines.join(' ');
  // Remove known tokens (GUIDs, version, uniquename, prefix)
  for (const token of knownTokens) {
    if (token) text = text.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  }
  // Clean up multiple spaces and trim
  return text.replace(/\s+/g, ' ').trim();
}

// ─── Dataverse API helpers (SPN) ─────────────────────────────────────

async function listSolutionsViaApi() {
  const data = await dvGet(
    'solutions?$filter=' + encodeURIComponent('ismanaged eq false and isvisible eq true') +
    '&$select=solutionid,uniquename,friendlyname,version,_publisherid_value' +
    '&$expand=publisherid($select=publisherid,uniquename,friendlyname,customizationprefix,customizationoptionvalueprefix)' +
    '&$orderby=friendlyname',
  );
  return (data.value || []).filter((s) =>
    s.uniquename !== 'Default' &&
    !s.uniquename.startsWith('msdyn') &&
    !s.uniquename.startsWith('Mscrm'),
  );
}

async function fetchSolutionViaApi(solutionId) {
  return dvGet(
    `solutions(${solutionId})?$select=solutionid,uniquename,friendlyname,version` +
    '&$expand=publisherid($select=publisherid,uniquename,friendlyname,customizationprefix,customizationoptionvalueprefix)',
  );
}

// ─── Step definition ─────────────────────────────────────────────────

export default {
  meta: {
    number: 5,
    title: 'Solution & Publisher',
    description: 'Select or create the Power Platform solution for your Code App. The publisher (prefix) is resolved automatically from the solution.',
    canRunInBrowser: true,
    needsSecret: true,
  },

  async questions(state) {
    const questions = [];
    const isUserAuth = (state.AUTH_PROFILE_TYPE || 'user') === 'user';
    const hasSecret = !isUserAuth && hasUsableSecret();
    const hasSaved = state.SOLUTION_UNIQUE_NAME && state.PUBLISHER_PREFIX;

    // ── Resume ──
    if (hasSaved) {
      questions.push({
        id: '__resume',
        type: 'confirm',
        label: `Keep "${state.SOLUTION_DISPLAY_NAME}" (publisher prefix: ${state.PUBLISHER_PREFIX})?`,
        help: 'Selecting Yes skips solution selection and reuses the saved values.',
        defaultValue: true,
      });
    }

    // ── Secret for SPN ──
    if (!hasSecret && !isUserAuth) {
      questions.push({
        id: 'PP_CLIENT_SECRET',
        type: 'secret',
        label: 'Client secret',
        help: 'Needed once to load solutions from Dataverse. Held in memory only.',
        required: true,
        defaultValue: '',
        hideIf: { id: '__resume', equals: true },
      });
    }

    // ── Build solution options ──
    let solutions = [];
    let loadHelp = '';

    if (hasSecret) {
      try {
        const apiSolutions = await listSolutionsViaApi();
        solutions = apiSolutions.map((s) => ({
          value: s.solutionid,
          label: `${s.friendlyname} (${s.publisherid?.customizationprefix || '?'}_)`,
        }));
      } catch (err) {
        loadHelp = `Could not load solutions: ${err.message}`;
      }
    } else if (isUserAuth) {
      try {
        solutions = listSolutionSummariesViaPac();
      } catch {
        loadHelp = 'Could not auto-discover solutions.';
      }
    }

    const makerLink = getMakerPortalLink();

    const defaultSelection = state.SOLUTION_ID && solutions.some((s) => s.value === state.SOLUTION_ID)
      ? state.SOLUTION_ID
      : solutions.length > 0 ? solutions[0].value : (isUserAuth ? PASTE_URL : CREATE_NEW);

    questions.push({
      id: 'SOLUTION_SELECTION',
      type: 'select',
      label: 'Solution',
      help: loadHelp || 'Select an existing solution or create a new one. The publisher prefix is resolved from the solution automatically.',
      defaultValue: defaultSelection,
      options: [
        ...solutions,
        { value: PASTE_URL, label: 'Paste solution URL from Maker Portal' },
        { value: CREATE_NEW, label: '+ Create new solution' },
      ],
      hideIf: { id: '__resume', equals: true },
    });

    // ── Paste URL ──
    questions.push({
      id: 'SOLUTION_URL',
      type: 'text',
      label: 'Solution URL from Maker Portal',
      help: `Open your solution at ${makerLink}, copy the browser URL from your browser's address bar, and paste it here.`,
      defaultValue: '',
      showIf: { id: 'SOLUTION_SELECTION', equals: PASTE_URL },
      why: [
        'How to get the solution URL:',
        `1. Open ${makerLink}`,
        '2. If you need to create a new solution, click + New Solution, pick a publisher, and save it',
        '3. Click on the solution to open it',
        '4. Copy the URL from your browser\'s address bar',
        '5. Paste it here — it looks like:',
        '   https://make.powerapps.com/environments/.../solutions/{guid}',
      ].join('\n'),
    });

    // ── Create new: solution name ──
    questions.push({
      id: 'NEW_SOLUTION_NAME',
      type: 'text',
      label: 'New solution display name',
      help: 'Human-readable name for the new solution.',
      defaultValue: state.SOLUTION_DISPLAY_NAME || state.APP_NAME || '',
      showIf: { id: 'SOLUTION_SELECTION', equals: CREATE_NEW },
    });

    // ── Create new SPN: publisher selection ──
    if (hasSecret) {
      let publishers = [];
      try {
        const pubData = await dvGet(
          'publishers?$filter=isreadonly eq false' +
          '&$select=publisherid,uniquename,friendlyname,customizationprefix,customizationoptionvalueprefix' +
          '&$orderby=friendlyname',
        );
        publishers = (pubData.value || []).filter((p) => p.customizationprefix && !p.uniquename.startsWith('DefaultPublisherFor'));
      } catch { /* ignore */ }

      if (publishers.length > 0) {
        questions.push({
          id: 'NEW_SOLUTION_PUBLISHER',
          type: 'select',
          label: 'Publisher for new solution',
          help: 'The publisher whose prefix will namespace your tables and columns.',
          defaultValue: state.PUBLISHER_ID || publishers[0]?.publisherid || '',
          options: publishers.map((p) => ({
            value: p.publisherid,
            label: `${p.friendlyname} (${p.customizationprefix})`,
          })),
          showIf: { id: 'SOLUTION_SELECTION', equals: CREATE_NEW },
        });
      }
    }

    // ── Create new user auth: link to Maker Portal + URL paste back ──
    if (isUserAuth) {
      questions.push({
        id: 'SOLUTION_CREATED_MANUALLY',
        type: 'confirm',
        label: 'I have created the solution in the Maker Portal',
        help: `Create the solution at ${makerLink}, then come back here. You can either paste the URL above (switch to "Paste solution URL") or toggle this and enter details manually.`,
        defaultValue: false,
        showIf: { id: 'SOLUTION_SELECTION', equals: CREATE_NEW },
        why: [
          'Create your solution in the Maker Portal:',
          `1. Open ${makerLink}`,
          '2. Click + New Solution',
          '3. Enter the display name',
          '4. Select (or create) a publisher',
          '5. Save the solution',
          '',
          'Then come back here and either:',
          '• Switch the dropdown to "Paste solution URL" and paste the URL (recommended)',
          '• OR toggle this confirmation and enter the details manually below',
        ].join('\n'),
      });

      questions.push({
        id: 'MANUAL_SOLUTION_UNIQUE_NAME',
        type: 'text',
        label: 'Solution unique name',
        help: 'The internal name (no spaces). Find this in the solution details in the Maker Portal.',
        defaultValue: '',
        showIf: { id: 'SOLUTION_CREATED_MANUALLY', equals: true },
      });

      questions.push({
        id: 'MANUAL_PUBLISHER_PREFIX',
        type: 'text',
        label: 'Publisher prefix',
        help: '2–8 lowercase letters. Find this in the Maker Portal under the publisher you selected.',
        defaultValue: state.PUBLISHER_PREFIX || '',
        showIf: { id: 'SOLUTION_CREATED_MANUALLY', equals: true },
      });
    }

    return questions;
  },

  async apply(answers, state, log) {
    if (answers.__resume) {
      log.ok(`Reusing solution: ${state.SOLUTION_DISPLAY_NAME} (prefix: ${state.PUBLISHER_PREFIX})`);
      return { stateUpdate: {}, completedStep: 5 };
    }

    const isUserAuth = (state.AUTH_PROFILE_TYPE || 'user') === 'user';
    if (answers.PP_CLIENT_SECRET) setSecret(answers.PP_CLIENT_SECRET);

    const selection = String(answers.SOLUTION_SELECTION || '').trim();

    // ── Paste URL → extract GUID → fetch via PAC ──
    if (selection === PASTE_URL) {
      // Strip trailing punctuation that users may accidentally include when pasting from a document.
      const url = String(answers.SOLUTION_URL || '').trim().replace(/[.,;:!?]+$/, '');
      const solutionId = extractSolutionIdFromUrl(url);
      if (!solutionId) throw new Error('Could not find a solution GUID in that URL. Paste the full Maker Portal solution URL (…/solutions/{guid}).');

      log.info(`Extracted solution ID: ${solutionId}`);

      // Try PAC CLI first (works for both auth types)
      log.info('Fetching solution & publisher details…');
      const sol = fetchSolutionViaPac(solutionId);
      if (!sol || !sol.solutionid) {
        throw new Error('Could not fetch solution details. Make sure you are signed in (pac auth) and the URL is from your active environment.');
      }
      if (!sol.prefix) {
        throw new Error('Could not resolve the publisher prefix. Try the manual entry option instead.');
      }

      log.ok(`Solution: ${sol.friendlyname || sol.uniquename}`);
      log.ok(`Publisher: ${sol.publisherFriendlyName || sol.publisherUniqueName || '?'} (prefix: ${sol.prefix})`);
      clearSecret();
      return { stateUpdate: buildStateUpdate(sol), completedStep: 6 };
    }

    // ── Selected an existing solution from dropdown ──
    if (selection && selection !== CREATE_NEW) {
      if (!isUserAuth && hasUsableSecret()) {
        log.info('Loading solution details…');
        const sol = await fetchSolutionViaApi(selection);
        const pub = sol.publisherid;
        log.ok(`Solution: ${sol.friendlyname} (${sol.uniquename})`);
        log.ok(`Publisher: ${pub?.friendlyname || '?'} (prefix: ${pub?.customizationprefix || '?'})`);
        clearSecret();
        return {
          stateUpdate: {
            SOLUTION_ID: sol.solutionid,
            SOLUTION_UNIQUE_NAME: sol.uniquename,
            SOLUTION_DISPLAY_NAME: sol.friendlyname,
            PUBLISHER_ID: pub?.publisherid || '',
            PUBLISHER_NAME: pub?.uniquename || '',
            PUBLISHER_DISPLAY_NAME: pub?.friendlyname || '',
            PUBLISHER_PREFIX: pub?.customizationprefix || '',
            CHOICE_VALUE_PREFIX: String(pub?.customizationoptionvalueprefix || ''),
          },
          completedStep: 6,
        };
      }
      // User auth: selected from dropdown (came from pac env fetch)
      log.info('Fetching solution & publisher details…');
      const sol = fetchSolutionViaPac(selection);
      if (!sol?.solutionid) throw new Error('Could not fetch solution details. Try pasting the solution URL instead.');
      log.ok(`Solution: ${sol.friendlyname || sol.uniquename}`);
      log.ok(`Publisher prefix: ${sol.prefix || '?'}`);
      return { stateUpdate: buildStateUpdate(sol), completedStep: 6 };
    }

    // ── Create new ──
    const solName = String(answers.NEW_SOLUTION_NAME || '').trim();
    if (!solName) throw new Error('Solution display name is required.');
    const solUnique = solName.replace(/[\s\-]+/g, '');

    if (isUserAuth) {
      if (answers.SOLUTION_CREATED_MANUALLY !== true) {
        throw new Error('Create the solution in the Maker Portal first, then confirm — or switch to "Paste solution URL".');
      }
      const manualUnique = String(answers.MANUAL_SOLUTION_UNIQUE_NAME || '').trim();
      const manualPrefix = String(answers.MANUAL_PUBLISHER_PREFIX || '').trim();
      if (!manualUnique) throw new Error('Solution unique name is required.');
      if (!VALIDATE.isValidPrefix(manualPrefix)) throw new Error('Publisher prefix must be 2–8 lowercase letters.');
      log.ok(`Solution: "${solName}" (${manualUnique})`);
      log.ok(`Publisher prefix: ${manualPrefix}`);
      return {
        stateUpdate: {
          SOLUTION_ID: '',
          SOLUTION_UNIQUE_NAME: manualUnique,
          SOLUTION_DISPLAY_NAME: solName,
          PUBLISHER_ID: '',
          PUBLISHER_NAME: '',
          PUBLISHER_DISPLAY_NAME: '',
          PUBLISHER_PREFIX: manualPrefix,
          CHOICE_VALUE_PREFIX: '',
        },
        completedStep: 6,
      };
    }

    // SPN: create via API
    const publisherId = String(answers.NEW_SOLUTION_PUBLISHER || '').trim();
    if (!publisherId) throw new Error('Select a publisher for the new solution.');

    log.info(`Creating solution "${solName}"…`);
    const created = await dvPost('solutions', {
      uniquename: solUnique,
      friendlyname: solName,
      version: '1.0.0.0',
      'publisherid@odata.bind': `/publishers(${publisherId})`,
    });

    const pubData = await dvGet(`publishers(${publisherId})?$select=publisherid,uniquename,friendlyname,customizationprefix,customizationoptionvalueprefix`);
    log.ok(`Solution created: "${solName}" (${solUnique})`);
    log.ok(`Publisher: ${pubData.friendlyname} (prefix: ${pubData.customizationprefix})`);
    clearSecret();

    return {
      stateUpdate: {
        SOLUTION_ID: created.solutionid || '',
        SOLUTION_UNIQUE_NAME: solUnique,
        SOLUTION_DISPLAY_NAME: solName,
        PUBLISHER_ID: pubData.publisherid || publisherId,
        PUBLISHER_NAME: pubData.uniquename || '',
        PUBLISHER_DISPLAY_NAME: pubData.friendlyname || '',
        PUBLISHER_PREFIX: pubData.customizationprefix || '',
        CHOICE_VALUE_PREFIX: String(pubData.customizationoptionvalueprefix || ''),
      },
      completedStep: 6,
    };
  },
};

function buildStateUpdate(sol) {
  return {
    SOLUTION_ID: sol.solutionid || '',
    SOLUTION_UNIQUE_NAME: sol.uniquename || '',
    SOLUTION_DISPLAY_NAME: sol.friendlyname || '',
    PUBLISHER_ID: sol.publisherid || '',
    PUBLISHER_NAME: sol.publisherUniqueName || '',
    PUBLISHER_DISPLAY_NAME: sol.publisherFriendlyName || '',
    PUBLISHER_PREFIX: sol.prefix || '',
    CHOICE_VALUE_PREFIX: sol.choiceValuePrefix || '',
  };
}
