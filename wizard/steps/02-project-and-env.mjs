// wizard/steps/02-project-and-env.mjs — Collect app name + environment URLs
import { input, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { isValidDataverseUrl } from '../lib/validate.mjs';

export default async function stepProjectAndEnv() {
  ui.stepHeader(2, TOTAL_STEPS, 'Project & Environment');

  // ── App name ──
  let appName = '';
  if (stateHas('APP_NAME')) {
    appName = stateGet('APP_NAME');
    ui.line(`App name (from previous run): ${appName}`);
    const keep = await confirm({ message: 'Keep this?', default: true });
    if (!keep) appName = '';
  }
  if (!appName) {
    ui.line('What is your app called?');
    ui.line('(A display name, e.g. "My Brain", "Project Tracker")');
    ui.line('');
    appName = await input({ message: 'App name', validate: (v) => v.trim() ? true : 'Required' });
    appName = appName.trim();
  }
  stateSet('APP_NAME', appName);

  ui.line('');
  ui.divider();
  ui.line('');

  // ── Dev environment URL (required) ──
  ui.line('Enter the URL of your Power Platform development environment.');
  ui.line('(e.g. https://org-name.crm.dynamics.com)');
  ui.line('');
  ui.line('If you haven\'t created one yet:');
  ui.line('  1. Open the Power Platform Admin Center:');
  ui.line('     https://admin.powerplatform.microsoft.com');
  ui.line('  2. Environments → + New');
  ui.line(`  3. Name: ${appName} - Dev  |  Type: Developer or Sandbox`);
  ui.line('  4. Toggle "Add Dataverse" to YES');
  ui.line('  5. Save, wait for provisioning, copy the Environment URL');
  ui.line('');

  let devUrl = '';
  if (stateHas('PP_ENV_DEV')) {
    devUrl = stateGet('PP_ENV_DEV');
    ui.line(`Dev URL (from previous run): ${devUrl}`);
    const keep = await confirm({ message: 'Keep this?', default: true });
    if (!keep) devUrl = '';
  }
  if (!devUrl) {
    devUrl = await input({
      message: 'Dev environment URL (required)',
      validate: (v) => {
        const url = v.trim().replace(/\/$/, '');
        if (!url) return 'Required';
        if (!isValidDataverseUrl(url) && !isValidDataverseUrl(url + '/')) {
          return 'Expected format: https://org-name.crm.dynamics.com';
        }
        return true;
      },
    });
  }
  devUrl = devUrl.trim().replace(/\/$/, '');
  stateSet('PP_ENV_DEV', devUrl);
  stateSet('WIZARD_TARGET_ENV', 'dev');

  // ── Test URL (optional) ──
  ui.line('');
  let testUrl = await input({ message: 'Test environment URL (Enter to skip)', default: '' });
  testUrl = testUrl.trim().replace(/\/$/, '');
  if (testUrl) {
    if (!isValidDataverseUrl(testUrl) && !isValidDataverseUrl(testUrl + '/')) {
      ui.warn('Doesn\'t look standard, but saving anyway.');
    }
    stateSet('PP_ENV_TEST', testUrl);
  }

  // ── Prod URL (optional) ──
  ui.line('');
  let prodUrl = await input({ message: 'Prod environment URL (Enter to skip)', default: '' });
  prodUrl = prodUrl.trim().replace(/\/$/, '');
  if (prodUrl) {
    if (!isValidDataverseUrl(prodUrl) && !isValidDataverseUrl(prodUrl + '/')) {
      ui.warn('Doesn\'t look standard, but saving anyway.');
    }
    stateSet('PP_ENV_PROD', prodUrl);
  }

  // ── Confirm ──
  ui.line('');
  ui.divider();
  ui.line('');
  ui.summary('App name:', appName);
  ui.summary('Dev environment:', devUrl);
  ui.summary('Test environment:', testUrl || '(skipped)');
  ui.summary('Prod environment:', prodUrl || '(skipped)');
  ui.line('');

  const correct = await confirm({ message: 'Look right?', default: true });
  if (!correct) {
    stateSet('APP_NAME', '');
    stateSet('PP_ENV_DEV', '');
    return stepProjectAndEnv();
  }

  setCompletedStep(2);
}
