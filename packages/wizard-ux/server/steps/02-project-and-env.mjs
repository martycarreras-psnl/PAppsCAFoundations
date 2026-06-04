// Step 2 — Project name.
//
// Environment URLs are NO LONGER captured here. After authentication (Step 4),
// the "Environments" step (Step 5) discovers environments via `pac env list`
// and lets the user pick Dev/Test/Prod from the results — no URL pasting.

export default {
  meta: {
    number: 2,
    title: 'Project',
    description: 'Name your app. You will pick your Power Platform environments after signing in — no URLs to paste.',
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
    ];
  },

  async apply(answers, _state, log) {
    const appName = (answers.APP_NAME || '').trim();
    if (!appName) {
      throw new Error('Validation failed — APP_NAME: Required');
    }

    log.ok(`App name: ${appName}`);
    log.info('Environments are selected after sign-in (Step 5) — no URLs needed here.');

    return {
      stateUpdate: {
        APP_NAME: appName,
        WIZARD_TARGET_ENV: 'dev',
      },
      completedStep: 2,
    };
  },
};
