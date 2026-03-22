// wizard/steps/04-environments.mjs — Collect environment URLs
import { input, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { isValidDataverseUrl } from '../lib/validate.mjs';

export default async function stepEnvironments() {
  ui.stepHeader(4, TOTAL_STEPS, 'Power Platform Environments');

  const appName = stateGet('APP_NAME');

  ui.line('You need at least a Development environment.');
  ui.line('Test and Production are optional for now.');
  ui.line('');
  ui.divider();
  ui.line('If you haven\'t created environments yet:');
  ui.line('1. Open: https://admin.powerplatform.microsoft.com');
  ui.line('2. Click: Environments → + New');
  ui.line(`3. Name it: ${appName} - Dev`);
  ui.line('4. Type: Developer or Sandbox');
  ui.line('5. IMPORTANT: Toggle "Add Dataverse" to YES');
  ui.line('6. Click Save, wait for provisioning to finish');
  ui.line('7. Open the environment → copy the Environment URL');
  ui.line('   (looks like: https://org-name.crm.dynamics.com)');
  ui.divider();
  ui.line('');

  // ── Dev URL (required) ──
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
  ui.ok('Valid Dataverse URL');

  // ── Test URL (optional) ──
  ui.line('');
  ui.line('Test environment URL (press Enter to skip):');
  let testUrl = await input({ message: 'Test environment URL', default: '' });
  testUrl = testUrl.trim().replace(/\/$/, '');
  if (testUrl) {
    if (isValidDataverseUrl(testUrl) || isValidDataverseUrl(testUrl + '/')) {
      ui.ok('Valid');
    } else {
      ui.warn('Doesn\'t look standard, but saving anyway.');
    }
    stateSet('PP_ENV_TEST', testUrl);
  }

  // ── Prod URL (optional) ──
  ui.line('');
  ui.line('Production environment URL (press Enter to skip):');
  let prodUrl = await input({ message: 'Prod environment URL', default: '' });
  prodUrl = prodUrl.trim().replace(/\/$/, '');
  if (prodUrl) {
    if (isValidDataverseUrl(prodUrl) || isValidDataverseUrl(prodUrl + '/')) {
      ui.ok('Valid');
    } else {
      ui.warn('Doesn\'t look standard, but saving anyway.');
    }
    stateSet('PP_ENV_PROD', prodUrl);
  }

  setCompletedStep(4);
}
