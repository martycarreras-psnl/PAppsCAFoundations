// Step 5 — Publisher. List existing or create one via Dataverse API.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dvGet, dvPost, hasUsableSecret, setSecret } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE = await import(resolve(__dirname, '..', '..', '..', 'wizard', 'lib', 'validate.mjs'));

export default {
  meta: {
    number: 5,
    title: 'Publisher',
    description: 'Pick or create the Power Platform solution publisher. Owns the prefix used by every table, column, and option set.',
    canRunInBrowser: true,
    needsSecret: true,
  },

  async questions(state) {
    const questions = [];
    const hasResume = state.PUBLISHER_PREFIX && state.PUBLISHER_ID;

    if (hasResume) {
      questions.push({
        id: '__resume',
        type: 'confirm',
        label: `Keep "${state.PUBLISHER_DISPLAY_NAME}" (prefix ${state.PUBLISHER_PREFIX})?`,
        help: 'Selecting Yes skips publisher selection and reuses the saved one.',
        defaultValue: true,
      });
    }

    questions.push({
      id: 'PP_CLIENT_SECRET',
      type: 'secret',
      label: 'Client secret',
      help: 'Needed for Dataverse API calls. Not stored — held in memory for this server only.',
      required: !hasUsableSecret(),
      defaultValue: '',
      hideIf: { id: '__resume', equals: true },
    });

    // We can't query publishers ahead of time without the secret. The "list" comes
    // back as part of the apply step's first phase, surfaced through the run log.
    // For now, expose two free-form fallback fields the user can fill if API access fails.
    questions.push({
      id: 'PUBLISHER_CHOICE',
      type: 'select',
      label: 'Action',
      help: 'Pick "Auto" to query existing publishers and prompt you to choose. Pick "Create new" to skip discovery.',
      defaultValue: 'auto',
      options: [
        { value: 'auto', label: 'Auto — query existing publishers' },
        { value: 'create', label: 'Create a brand-new publisher' },
      ],
      hideIf: { id: '__resume', equals: true },
    });

    questions.push({
      id: 'PUBLISHER_PREFIX',
      type: 'text',
      label: 'New publisher prefix',
      help: '2–8 lowercase letters. Becomes the namespace for every table/column. Pick carefully — cannot change after data exists.',
      defaultValue: state.PUBLISHER_PREFIX || '',
      hideIf: [{ id: '__resume', equals: true }, { id: 'PUBLISHER_CHOICE', equals: 'auto' }],
    });

    questions.push({
      id: 'PUBLISHER_DISPLAY_NAME',
      type: 'text',
      label: 'New publisher display name',
      help: 'Human-readable. e.g. "Contoso Engineering".',
      defaultValue: state.PUBLISHER_DISPLAY_NAME || `${state.APP_NAME || 'My Org'} Publishing`,
      hideIf: [{ id: '__resume', equals: true }, { id: 'PUBLISHER_CHOICE', equals: 'auto' }],
    });

    return questions;
  },

  async apply(answers, state, log) {
    if (answers.__resume) {
      log.ok(`Reusing existing publisher: ${state.PUBLISHER_DISPLAY_NAME} (${state.PUBLISHER_PREFIX})`);
      return { stateUpdate: {}, completedStep: 5 };
    }

    if (answers.PP_CLIENT_SECRET) {
      setSecret(answers.PP_CLIENT_SECRET);
    } else if (!hasUsableSecret()) {
      throw new Error('Client secret is required to query Dataverse. Provide it or run from CLI.');
    }

    if (answers.PUBLISHER_CHOICE === 'auto') {
      log.info('Querying existing publishers from your Dev environment…');
      let publishers = [];
      try {
        const data = await dvGet(
          'publishers?$filter=isreadonly eq false' +
          '&$select=publisherid,uniquename,friendlyname,customizationprefix,customizationoptionvalueprefix' +
          '&$orderby=friendlyname',
        );
        publishers = (data.value || []).filter((p) => p.customizationprefix && !p.uniquename.startsWith('DefaultPublisherFor'));
      } catch (err) {
        throw new Error(`Could not query publishers — ${err.message}. Try "Create new" instead.`);
      }

      // Auto-pick if exactly one prefix matches saved state, otherwise return a follow-up question
      if (publishers.length === 0) {
        throw new Error('No publishers found in this environment. Re-run with "Create new".');
      }
      // If user has saved PUBLISHER_PREFIX, try to find that one first
      const preferred = state.PUBLISHER_PREFIX
        ? publishers.find((p) => p.customizationprefix === state.PUBLISHER_PREFIX)
        : null;
      const pub = preferred || publishers[0];
      log.ok(`Selected ${pub.friendlyname} (prefix ${pub.customizationprefix})`);
      log.info(publishers.length > 1 ? `(${publishers.length} publishers in env — picked best match. Use CLI to choose differently.)` : '');
      return {
        stateUpdate: {
          PUBLISHER_ID: pub.publisherid,
          PUBLISHER_NAME: pub.uniquename,
          PUBLISHER_DISPLAY_NAME: pub.friendlyname,
          PUBLISHER_PREFIX: pub.customizationprefix,
          CHOICE_VALUE_PREFIX: String(pub.customizationoptionvalueprefix),
        },
        completedStep: 5,
      };
    }

    // Create new
    const prefix = (answers.PUBLISHER_PREFIX || '').trim();
    const friendly = (answers.PUBLISHER_DISPLAY_NAME || '').trim();
    if (!VALIDATE.isValidPrefix(prefix)) throw new Error('Prefix must be 2–8 lowercase letters only.');
    if (!friendly) throw new Error('Publisher display name is required.');
    const uniqueName = friendly.toLowerCase().replace(/[\s\-]+/g, '');

    log.info(`Creating publisher "${friendly}" (prefix ${prefix})…`);
    const result = await dvPost('publishers', {
      uniquename: uniqueName,
      friendlyname: friendly,
      customizationprefix: prefix,
    });
    const choicePrefix = String(result.customizationoptionvalueprefix);
    log.ok(`Publisher created. Choice value prefix: ${choicePrefix}`);

    return {
      stateUpdate: {
        PUBLISHER_ID: result.publisherid,
        PUBLISHER_NAME: uniqueName,
        PUBLISHER_DISPLAY_NAME: friendly,
        PUBLISHER_PREFIX: prefix,
        CHOICE_VALUE_PREFIX: choicePrefix,
      },
      completedStep: 5,
    };
  },
};
