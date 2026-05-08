// Step 6 — Solution. Pick existing or create new in the publisher.
import { dvGet, dvPost, hasUsableSecret, clearSecret } from '../lib/dataverse-bridge.mjs';
const CREATE_NEW = '__create_new__';

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
        ? 'With user auth, solutions cannot be auto-loaded. Create a new solution or enter details from a solution you created in the Maker Portal.'
        : (solutionLoadHelp || 'Choose an existing unmanaged solution for the selected publisher, or choose Create new solution.'),
      defaultValue: preferredSolution,
      options: [
        ...solutions.map(solutionOption),
        { value: CREATE_NEW, label: '+ Create new solution' },
      ],
      hideIf: { id: '__resume', equals: true },
    });

    questions.push({
      id: 'SOLUTION_DISPLAY_NAME',
      type: 'text',
      label: 'New solution display name',
      defaultValue: state.SOLUTION_DISPLAY_NAME || state.APP_NAME || '',
      showIf: { id: 'SOLUTION_SELECTION', equals: CREATE_NEW },
    });

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

    if (selectedSolutionId && selectedSolutionId !== CREATE_NEW) {
      if (isUserAuth) {
        throw new Error('Cannot look up solutions from Dataverse with user auth. Select "Create new solution" and enter the details manually, or create the solution in the Maker Portal first.');
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
      log.warn('User auth does not support automated solution creation via the Dataverse API.');
      log.info('Create the solution manually in the Maker Portal:');
      log.info(`  1. Go to make.powerapps.com → your Dev environment`);
      log.info(`  2. Solutions → New Solution`);
      log.info(`  3. Display name: ${friendly}`);
      log.info(`  4. Publisher: select the publisher from Step 5`);
      log.info(`  5. Version: 1.0.0.0 → Create`);
      log.ok(`Solution metadata saved: "${friendly}" (${unique})`);
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
