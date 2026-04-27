// Step 6 — Solution. Pick existing or create new in the publisher.
import { dvGet, dvPost, hasUsableSecret, clearSecret } from '../lib/dataverse-bridge.mjs';

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

    if (hasResume) {
      questions.push({
        id: '__resume',
        type: 'confirm',
        label: `Keep "${state.SOLUTION_DISPLAY_NAME}" (${state.SOLUTION_UNIQUE_NAME})?`,
        defaultValue: true,
      });
    }

    questions.push({
      id: 'SOLUTION_CHOICE',
      type: 'select',
      label: 'Action',
      defaultValue: 'auto',
      options: [
        { value: 'auto', label: 'Auto — pick the best matching solution' },
        { value: 'create', label: 'Create a new solution' },
      ],
      hideIf: { id: '__resume', equals: true },
    });

    questions.push({
      id: 'SOLUTION_DISPLAY_NAME',
      type: 'text',
      label: 'New solution display name',
      defaultValue: state.SOLUTION_DISPLAY_NAME || state.APP_NAME || '',
      hideIf: [{ id: '__resume', equals: true }, { id: 'SOLUTION_CHOICE', equals: 'auto' }],
    });

    return questions;
  },

  async apply(answers, state, log) {
    if (answers.__resume) {
      log.ok(`Reusing solution: ${state.SOLUTION_DISPLAY_NAME}`);
      clearSecret();
      return { stateUpdate: {}, completedStep: 6 };
    }
    if (!hasUsableSecret()) throw new Error('Client secret unavailable — run step 5 first or use CLI.');

    const publisherId = state.PUBLISHER_ID;

    if (answers.SOLUTION_CHOICE === 'auto') {
      log.info('Querying existing solutions…');
      let filter = 'ismanaged eq false and isvisible eq true';
      if (publisherId) filter += ` and _publisherid_value eq '${publisherId}'`;
      const data = await dvGet(
        `solutions?$filter=${encodeURIComponent(filter)}` +
        '&$select=solutionid,uniquename,friendlyname,version,_publisherid_value' +
        '&$orderby=friendlyname',
      );
      const solutions = (data.value || []).filter((s) =>
        s.uniquename !== 'Default' && !s.uniquename.startsWith('msdyn') && !s.uniquename.startsWith('Mscrm'),
      );
      if (solutions.length === 0) throw new Error('No matching solutions in env. Re-run with "Create new".');
      const sol = solutions[0];
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
