// Step 2 — Project name + environment URLs.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE_PATH = resolve(__dirname, '..', '..', '..', 'wizard', 'lib', 'validate.mjs');
const { isValidDataverseUrl, normalizeDataverseUrl } = await import(VALIDATE_PATH);

const URL_HINT = 'Format: https://org-name.crm.dynamics.com (the wizard adds https:// for you if you paste it without).';

export default {
  meta: {
    number: 2,
    title: 'Project & Environment',
    description: 'Name your app and point the wizard at your Dev (and optionally Test/Prod) Power Platform environments.',
    canRunInBrowser: true,
  },

  questions(state) {
    return [
      {
        id: 'APP_NAME',
        type: 'text',
        label: 'App name',
        help: 'A human-readable display name. e.g. "Project Tracker", "My Brain".',
        required: true,
        defaultValue: state.APP_NAME || '',
      },
      {
        id: 'PP_ENV_DEV',
        type: 'url',
        label: 'Dev environment URL',
        help: 'The URL of your Power Platform development environment. Paste it straight from PPAC — with or without https://. ' + URL_HINT,
        why: [
          "If you haven't created one yet:",
          '1. Open https://admin.powerplatform.microsoft.com',
          '2. Environments → + New',
          '3. Type: Developer or Sandbox · toggle "Add Dataverse" YES',
          '4. Save, wait for provisioning, then copy the Environment URL.',
        ].join('\n'),
        required: true,
        defaultValue: state.PP_ENV_DEV || '',
        validatePattern: 'dataverseUrl',
      },
      {
        id: 'PP_ENV_TEST',
        type: 'url',
        label: 'Test environment URL',
        help: 'Optional. Leave blank if you do not have a separate Test environment yet.',
        required: false,
        defaultValue: state.PP_ENV_TEST || '',
        validatePattern: 'dataverseUrl',
      },
      {
        id: 'PP_ENV_PROD',
        type: 'url',
        label: 'Prod environment URL',
        help: 'Optional. Leave blank if you do not have a Prod environment yet.',
        required: false,
        defaultValue: state.PP_ENV_PROD || '',
        validatePattern: 'dataverseUrl',
      },
    ];
  },

  async apply(answers, _state, log) {
    const errors = {};
    const norm = (s) => normalizeDataverseUrl(s);

    const appName = (answers.APP_NAME || '').trim();
    if (!appName) errors.APP_NAME = 'Required';

    const dev = norm(answers.PP_ENV_DEV);
    if (!dev) errors.PP_ENV_DEV = 'Required';
    else if (!isValidDataverseUrl(dev) && !isValidDataverseUrl(dev + '/')) errors.PP_ENV_DEV = URL_HINT;

    const test = norm(answers.PP_ENV_TEST);
    if (test && !isValidDataverseUrl(test) && !isValidDataverseUrl(test + '/')) {
      log.warn(`Test URL "${test}" doesn't look standard, saving anyway.`);
    }

    const prod = norm(answers.PP_ENV_PROD);
    if (prod && !isValidDataverseUrl(prod) && !isValidDataverseUrl(prod + '/')) {
      log.warn(`Prod URL "${prod}" doesn't look standard, saving anyway.`);
    }

    if (Object.keys(errors).length > 0) {
      const msg = Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join('; ');
      throw new Error(`Validation failed — ${msg}`);
    }

    log.ok(`App name: ${appName}`);
    log.ok(`Dev env: ${dev}`);
    if (test) log.ok(`Test env: ${test}`); else log.info('Test env: (skipped)');
    if (prod) log.ok(`Prod env: ${prod}`); else log.info('Prod env: (skipped)');

    return {
      stateUpdate: {
        APP_NAME: appName,
        PP_ENV_DEV: dev,
        PP_ENV_TEST: test,
        PP_ENV_PROD: prod,
        WIZARD_TARGET_ENV: 'dev',
      },
      completedStep: 2,
    };
  },
};
