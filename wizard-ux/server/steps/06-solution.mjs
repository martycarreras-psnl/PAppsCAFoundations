// Step 6 — Solution. Pick existing or create new in the publisher.
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dvGet, dvPost, hasUsableSecret, clearSecret } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const SHELL = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);
const CREATE_NEW = '__create_new__';
const ENTER_EXISTING = '__enter_existing__';

/** Try to get environment ID via `pac org who`. Returns the Maker Portal solutions URL or a fallback. */
function getMakerPortalLink() {
  try {
    const pac = SHELL.pacPath();
    const whoOut = SHELL.runSafe(pac, ['org', 'who']);
    if (whoOut) {
      const whoInfo = PAC_TARGET.parsePacOrgWho(whoOut);
      if (whoInfo.environmentId) {
        return `https://make.powerapps.com/e/${whoInfo.environmentId}/solutions`;
      }
    }
  } catch { /* fall through */ }
  return 'https://make.powerapps.com';
}

async function listSolutions(publisherId) {
  let filter = 'ismanaged eq false and isvisible eq true';
  if (publisherId) filter += ` and _publisherid_value eq '${publisherId}'`;
  const data = await dvGet(
    `solutions?$filter=${encodeURIComponent(filter)}` +
    '&$select=solutionid,uniquename,friendlyname,version,_publisherid_value' +
    '&$orderby=friendlyname',
  );
  return (data.value || []).filter((s) =>
    s.uniquename !== 'Default' && !s.uniquename.startsWith('msdyn') && !s.uniquename.startsWith('Mscrm'),
  );
}

function solutionOption(solution) {
  return {
    value: solution.solutionid,
    label: `${solution.friendlyname} (${solution.uniquename})`,
  };
}

export default {
  meta: {
    number: 6,
    title: 'Solution',
    description: 'Pick or create the Power Platform solution that will hold this Code App.',
    canRunInBrowser: true,
    needsSecret: true,
  },

  async questions(state) {
    const questions = [];
    const hasResume = state.SOLUTION_UNIQUE_NAME;
    const publisherId = state.PUBLISHER_ID;
    const isUserAuth = (state.AUTH_PROFILE_TYPE || 'user') === 'user';
    let solutions = [];
    let solutionLoadHelp = '';

    if (!isUserAuth && hasUsableSecret()) {
      try {
        solutions = await listSolutions(publisherId);
      } catch (err) {
        solutionLoadHelp = `Could not load solutions from Dataverse: ${err.message}. You can still create a new solution.`;
      }
    }

    if (hasResume) {
      questions.push({
        id: '__resume',
        type: 'confirm',
        label: `Keep "${state.SOLUTION_DISPLAY_NAME}" (${state.SOLUTION_UNIQUE_NAME})?`,
        defaultValue: true,
      });
    }

    const preferredSolution = state.SOLUTION_ID && solutions.some((solution) => solution.solutionid === state.SOLUTION_ID)
      ? state.SOLUTION_ID
      : solutions[0]?.solutionid || CREATE_NEW;

    questions.push({
      id: 'SOLUTION_SELECTION',
      type: 'select',
      label: 'Solution',
      help: isUserAuth
        ? 'With user auth, solutions cannot be auto-loaded. Enter an existing solution\'s details or create a new one.'
        : (solutionLoadHelp || 'Choose an existing unmanaged solution for the selected publisher, or choose Create new solution.'),
      defaultValue: preferredSolution,
      options: [
        ...solutions.map(solutionOption),
        { value: ENTER_EXISTING, label: 'Enter existing solution details' },
        { value: CREATE_NEW, label: '+ Create new solution' },
      ],
      hideIf: { id: '__resume', equals: true },
    });

    questions.push({
      id: 'EXISTING_SOLUTION_UNIQUE_NAME',
      type: 'text',
      label: 'Solution unique name',
      help: 'The internal name (no spaces). Find this in the Maker Portal under Solutions.',
      defaultValue: state.SOLUTION_UNIQUE_NAME || '',
      showIf: { id: 'SOLUTION_SELECTION', equals: ENTER_EXISTING },
    });

    questions.push({
      id: 'EXISTING_SOLUTION_DISPLAY_NAME',
      type: 'text',
      label: 'Solution display name',
      help: 'The human-readable name shown in the Maker Portal.',
      defaultValue: state.SOLUTION_DISPLAY_NAME || state.APP_NAME || '',
      showIf: { id: 'SOLUTION_SELECTION', equals: ENTER_EXISTING },
    });

    questions.push({
      id: 'SOLUTION_DISPLAY_NAME',
      type: 'text',
      label: 'New solution display name',
      defaultValue: state.SOLUTION_DISPLAY_NAME || state.APP_NAME || '',
      showIf: { id: 'SOLUTION_SELECTION', equals: CREATE_NEW },
    });

    if (isUserAuth) {
      const makerLink = getMakerPortalLink();
      questions.push({
        id: 'SOLUTION_CREATED_MANUALLY',
        type: 'confirm',
        label: 'I have created this solution in the Maker Portal',
        help: `With user credentials, the wizard cannot create the solution automatically. Create it at ${makerLink} then confirm below.`,
        defaultValue: false,
        showIf: { id: 'SOLUTION_SELECTION', equals: CREATE_NEW },
        why: [
          'Manual solution creation steps:',
          `1. Open ${makerLink}`,
          `2. Click + New Solution`,
          `3. Enter the Display name from above`,
          `4. Select the publisher you created in Step 5`,
          `5. Save the solution`,
          `6. Return here and confirm`,
        ].join('\n'),
      });
    }

    return questions;
  },

  async apply(answers, state, log) {
    if (answers.__resume) {
      log.ok(`Reusing solution: ${state.SOLUTION_DISPLAY_NAME}`);
      clearSecret();
      return { stateUpdate: {}, completedStep: 6 };
    }
    const isUserAuth = (state.AUTH_PROFILE_TYPE || 'user') === 'user';
    if (!isUserAuth && !hasUsableSecret()) throw new Error('Client secret unavailable — run step 5 first or use CLI.');

    const publisherId = state.PUBLISHER_ID;
    const selectedSolutionId = String(answers.SOLUTION_SELECTION || '').trim();

    // ── Enter existing solution details manually ──
    if (selectedSolutionId === ENTER_EXISTING) {
      const unique = (answers.EXISTING_SOLUTION_UNIQUE_NAME || '').trim();
      const friendly = (answers.EXISTING_SOLUTION_DISPLAY_NAME || '').trim();
      if (!unique) throw new Error('Solution unique name is required.');
      if (!friendly) throw new Error('Solution display name is required.');
      log.ok(`Using existing solution: "${friendly}" (${unique})`);
      clearSecret();
      return {
        stateUpdate: {
          SOLUTION_ID: '',
          SOLUTION_UNIQUE_NAME: unique,
          SOLUTION_DISPLAY_NAME: friendly,
        },
        completedStep: 6,
      };
    }

    if (selectedSolutionId && selectedSolutionId !== CREATE_NEW) {
      if (isUserAuth) {
        throw new Error('Cannot look up solutions from Dataverse with user auth. Use "Enter existing solution details" instead.');
      }
      log.info('Loading selected solution...');
      const solutions = await listSolutions(publisherId);
      const sol = solutions.find((solution) => solution.solutionid === selectedSolutionId);
      if (!sol) throw new Error('Selected solution was not found. Refresh this step and choose again.');
      log.ok(`Selected ${sol.friendlyname} (${sol.uniquename})`);
      clearSecret();
      return {
        stateUpdate: {
          SOLUTION_ID: sol.solutionid,
          SOLUTION_UNIQUE_NAME: sol.uniquename,
          SOLUTION_DISPLAY_NAME: sol.friendlyname,
        },
        completedStep: 6,
      };
    }

    const friendly = (answers.SOLUTION_DISPLAY_NAME || '').trim();
    if (!friendly) throw new Error('Solution display name required.');
    const unique = friendly.replace(/[\s\-]+/g, '');

    if (isUserAuth) {
      if (answers.SOLUTION_CREATED_MANUALLY !== true) {
        throw new Error('You must create the solution in the Maker Portal before continuing. Toggle the confirmation after creating it.');
      }
      log.ok(`Solution confirmed as created in the Maker Portal: "${friendly}" (${unique})`);
      clearSecret();
      return {
        stateUpdate: {
          SOLUTION_ID: '',
          SOLUTION_UNIQUE_NAME: unique,
          SOLUTION_DISPLAY_NAME: friendly,
        },
        completedStep: 6,
      };
    }

    log.info(`Creating solution "${friendly}"…`);
    const created = await dvPost('solutions', {
      uniquename: unique,
      friendlyname: friendly,
      version: '1.0.0.0',
      ...(publisherId ? { 'publisherid@odata.bind': `/publishers(${publisherId})` } : {}),
    });
    log.ok('Solution created.');
    clearSecret();
    return {
      stateUpdate: {
        SOLUTION_ID: created.solutionid || '',
        SOLUTION_UNIQUE_NAME: unique,
        SOLUTION_DISPLAY_NAME: friendly,
      },
      completedStep: 6,
    };
  },
};
