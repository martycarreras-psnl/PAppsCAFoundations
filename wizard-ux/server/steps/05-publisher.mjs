// Step 5 — Publisher. List existing or create one via Dataverse API.
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dvGet, dvPost, hasUsableSecret, setSecret } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE = await import(pathToFileURL(resolve(__dirname, '..', '..', '..', 'wizard', 'lib', 'validate.mjs')).href);
const CREATE_NEW = '__create_new__';
const ENTER_EXISTING = '__enter_existing__';

async function listPublishers() {
  const data = await dvGet(
    'publishers?$filter=isreadonly eq false' +
    '&$select=publisherid,uniquename,friendlyname,customizationprefix,customizationoptionvalueprefix' +
    '&$orderby=friendlyname',
  );
  return (data.value || []).filter((p) => p.customizationprefix && !p.uniquename.startsWith('DefaultPublisherFor'));
}

function publisherOption(publisher) {
  return {
    value: publisher.publisherid,
    label: `${publisher.friendlyname} (${publisher.customizationprefix})`,
  };
}

function publisherStateUpdate(state, publisher) {
  const hasSavedSolution = Boolean(state.SOLUTION_ID || state.SOLUTION_UNIQUE_NAME || state.SOLUTION_DISPLAY_NAME);
  const publisherChanged = state.PUBLISHER_ID ? state.PUBLISHER_ID !== publisher.id : hasSavedSolution;
  return {
    PUBLISHER_ID: publisher.id,
    PUBLISHER_NAME: publisher.name,
    PUBLISHER_DISPLAY_NAME: publisher.displayName,
    PUBLISHER_PREFIX: publisher.prefix,
    CHOICE_VALUE_PREFIX: publisher.choiceValuePrefix,
    ...(publisherChanged
      ? {
        SOLUTION_ID: '',
        SOLUTION_UNIQUE_NAME: '',
        SOLUTION_DISPLAY_NAME: '',
        COMPLETED_STEP: 5,
      }
      : {}),
  };
}

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
    const isUserAuth = (state.AUTH_PROFILE_TYPE || 'user') === 'user';
    const hasSecret = !isUserAuth && hasUsableSecret();
    let publishers = [];
    let publisherLoadHelp = '';

    if (hasSecret) {
      try {
        publishers = await listPublishers();
      } catch (err) {
        publisherLoadHelp = `Could not load publishers from Dataverse: ${err.message}. You can still create a new publisher.`;
      }
    }

    if (hasResume) {
      questions.push({
        id: '__resume',
        type: 'confirm',
        label: `Keep "${state.PUBLISHER_DISPLAY_NAME}" (prefix ${state.PUBLISHER_PREFIX})?`,
        help: 'Selecting Yes skips publisher selection and reuses the saved one.',
        defaultValue: true,
      });
    }

    if (!hasSecret && !isUserAuth) {
      questions.push({
        id: 'PP_CLIENT_SECRET',
        type: 'secret',
        label: 'Client secret',
        help: 'Needed once to load publishers from Dataverse. Not stored here — held in memory for this server only.',
        required: true,
        defaultValue: '',
        hideIf: { id: '__resume', equals: true },
      });
    }

    const preferredPublisher = state.PUBLISHER_ID && publishers.some((publisher) => publisher.publisherid === state.PUBLISHER_ID)
      ? state.PUBLISHER_ID
      : publishers[0]?.publisherid || CREATE_NEW;

    questions.push({
      id: 'PUBLISHER_SELECTION',
      type: 'select',
      label: 'Publisher',
      help: isUserAuth
        ? 'With user auth, publishers cannot be auto-loaded. Enter an existing publisher\'s details or create a new one.'
        : (publisherLoadHelp || 'Choose an existing publisher from this Dev environment, or choose Create new publisher.'),
      defaultValue: preferredPublisher,
      options: [
        ...publishers.map(publisherOption),
        { value: ENTER_EXISTING, label: 'Enter existing publisher details' },
        { value: CREATE_NEW, label: '+ Create new publisher' },
      ],
      hideIf: { id: '__resume', equals: true },
    });

    questions.push({
      id: 'EXISTING_PUBLISHER_PREFIX',
      type: 'text',
      label: 'Existing publisher prefix',
      help: '2–8 lowercase letters. Find this in the Maker Portal under Solutions → Publishers.',
      defaultValue: state.PUBLISHER_PREFIX || '',
      showIf: { id: 'PUBLISHER_SELECTION', equals: ENTER_EXISTING },
    });

    questions.push({
      id: 'EXISTING_PUBLISHER_DISPLAY_NAME',
      type: 'text',
      label: 'Existing publisher display name',
      help: 'The human-readable name shown in the Maker Portal.',
      defaultValue: state.PUBLISHER_DISPLAY_NAME || '',
      showIf: { id: 'PUBLISHER_SELECTION', equals: ENTER_EXISTING },
    });

    questions.push({
      id: 'PUBLISHER_PREFIX',
      type: 'text',
      label: 'New publisher prefix',
      help: '2–8 lowercase letters. Becomes the namespace for every table/column. Pick carefully — cannot change after data exists.',
      defaultValue: state.PUBLISHER_PREFIX || '',
      showIf: { id: 'PUBLISHER_SELECTION', equals: CREATE_NEW },
    });

    questions.push({
      id: 'PUBLISHER_DISPLAY_NAME',
      type: 'text',
      label: 'New publisher display name',
      help: 'Human-readable. e.g. "Contoso Engineering".',
      defaultValue: state.PUBLISHER_DISPLAY_NAME || `${state.APP_NAME || 'My Org'} Publishing`,
      showIf: { id: 'PUBLISHER_SELECTION', equals: CREATE_NEW },
    });

    if (isUserAuth) {
      const devUrl = (state.PP_ENV_DEV || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const makerLink = devUrl
        ? `https://make.powerapps.com (select environment "${devUrl}")`
        : 'https://make.powerapps.com';
      questions.push({
        id: 'PUBLISHER_CREATED_MANUALLY',
        type: 'confirm',
        label: 'I have created this publisher in the Maker Portal',
        help: `With user credentials, the wizard cannot create the publisher automatically. You must create it manually at ${makerLink} before continuing.`,
        defaultValue: false,
        showIf: { id: 'PUBLISHER_SELECTION', equals: CREATE_NEW },
        why: [
          'Manual publisher creation steps:',
          `1. Open ${makerLink}`,
          '2. Go to Solutions → Publishers',
          '3. Click + New Publisher',
          '4. Enter the Display name and Prefix from above',
          '5. Save the publisher',
          '6. Return here and confirm',
        ].join('\n'),
      });
    }

    return questions;
  },

  async apply(answers, state, log) {
    if (answers.__resume) {
      log.ok(`Reusing existing publisher: ${state.PUBLISHER_DISPLAY_NAME} (${state.PUBLISHER_PREFIX})`);
      return { stateUpdate: {}, completedStep: 5 };
    }

    const isUserAuth = (state.AUTH_PROFILE_TYPE || 'user') === 'user';

    if (answers.PP_CLIENT_SECRET) {
      setSecret(answers.PP_CLIENT_SECRET);
    } else if (!isUserAuth && !hasUsableSecret()) {
      throw new Error('Client secret is required to query Dataverse. Provide it or run from CLI.');
    }

    const selectedPublisherId = String(answers.PUBLISHER_SELECTION || '').trim();

    // ── Enter existing publisher details manually ──
    if (selectedPublisherId === ENTER_EXISTING) {
      const prefix = (answers.EXISTING_PUBLISHER_PREFIX || '').trim();
      const friendly = (answers.EXISTING_PUBLISHER_DISPLAY_NAME || '').trim();
      if (!VALIDATE.isValidPrefix(prefix)) throw new Error('Prefix must be 2–8 lowercase letters only.');
      if (!friendly) throw new Error('Publisher display name is required.');
      const uniqueName = friendly.toLowerCase().replace(/[\s\-]+/g, '');
      log.ok(`Using existing publisher: "${friendly}" (prefix ${prefix})`);
      return {
        stateUpdate: publisherStateUpdate(state, {
          id: '',
          name: uniqueName,
          displayName: friendly,
          prefix,
          choiceValuePrefix: '',
        }),
        completedStep: 5,
      };
    }

    if (selectedPublisherId && selectedPublisherId !== CREATE_NEW) {
      if (isUserAuth) {
        throw new Error('Cannot look up publishers from Dataverse with user auth. Use "Enter existing publisher details" instead.');
      }
      log.info('Loading selected publisher from your Dev environment...');
      const publishers = await listPublishers();
      const pub = publishers.find((p) => p.publisherid === selectedPublisherId);
      if (!pub) throw new Error('Selected publisher was not found. Refresh this step and choose again.');
      log.ok(`Selected ${pub.friendlyname} (prefix ${pub.customizationprefix})`);
      if (state.PUBLISHER_ID && state.PUBLISHER_ID !== pub.publisherid) {
        log.info('Publisher changed, so the saved solution selection was cleared. Re-select a solution in Step 6.');
      }
      return {
        stateUpdate: publisherStateUpdate(state, {
          id: pub.publisherid,
          name: pub.uniquename,
          displayName: pub.friendlyname,
          prefix: pub.customizationprefix,
          choiceValuePrefix: String(pub.customizationoptionvalueprefix),
        }),
        completedStep: 5,
      };
    }

    const prefix = (answers.PUBLISHER_PREFIX || '').trim();
    const friendly = (answers.PUBLISHER_DISPLAY_NAME || '').trim();
    if (!VALIDATE.isValidPrefix(prefix)) throw new Error('Prefix must be 2–8 lowercase letters only.');
    if (!friendly) throw new Error('Publisher display name is required.');
    const uniqueName = friendly.toLowerCase().replace(/[\s\-]+/g, '');

    if (isUserAuth) {
      if (answers.PUBLISHER_CREATED_MANUALLY !== true) {
        throw new Error('You must create the publisher in the Maker Portal before continuing. Toggle the confirmation after creating it.');
      }
      log.ok(`Publisher confirmed as created in the Maker Portal: "${friendly}" (prefix ${prefix})`);
      return {
        stateUpdate: publisherStateUpdate(state, {
          id: '',
          name: uniqueName,
          displayName: friendly,
          prefix,
          choiceValuePrefix: '',
        }),
        completedStep: 5,
      };
    }

    log.info(`Creating publisher "${friendly}" (prefix ${prefix})…`);
    const result = await dvPost('publishers', {
      uniquename: uniqueName,
      friendlyname: friendly,
      customizationprefix: prefix,
    });
    const choicePrefix = String(result.customizationoptionvalueprefix);
    log.ok(`Publisher created. Choice value prefix: ${choicePrefix}`);
    if (state.PUBLISHER_ID && state.PUBLISHER_ID !== result.publisherid) {
      log.info('Publisher changed, so the saved solution selection was cleared. Re-select a solution in Step 6.');
    }

    return {
      stateUpdate: publisherStateUpdate(state, {
        id: result.publisherid,
        name: uniqueName,
        displayName: friendly,
        prefix,
        choiceValuePrefix: choicePrefix,
      }),
      completedStep: 5,
    };
  },
};
