// wizard/steps/05-solution-app-reg.mjs — Solution + App Registration + Application User
import { input, password, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { isValidUUID } from '../lib/validate.mjs';

/** Module-level store for the client secret (never persisted to disk). */
let clientSecret = '';
export function getClientSecret() { return clientSecret; }
export function setClientSecret(s) { clientSecret = s; }

export default async function stepSolutionAndAppReg() {
  ui.stepHeader(5, TOTAL_STEPS, 'Solution, App Registration & Application User');

  const appName = stateGet('APP_NAME');
  const solDisplay = stateGet('SOLUTION_DISPLAY_NAME');
  const pubDisplay = stateGet('PUBLISHER_DISPLAY_NAME');

  ui.line('Three things to do in the browser, then we automate the rest.');
  ui.line('');

  // ── A. Create Solution ──
  ui.line('── A. Create the Solution ──');
  ui.line('');
  ui.line('1. Open: https://make.powerapps.com');
  ui.line('2. Select your Dev environment (top-right)');
  ui.line('3. Click: Solutions (left nav) → + New Solution');
  ui.line('4. Fill in:');
  ui.line(`   Display name:  ${solDisplay}`);
  ui.line(`   Publisher:     ${pubDisplay}  (select from dropdown)`);
  ui.line('   Version:       1.0.0.0');
  ui.line('5. Click Create');
  ui.line('');
  const solDone = await confirm({ message: 'Done creating the solution?', default: true });
  if (!solDone) {
    ui.line('Complete it in the browser and re-run the wizard.');
    process.exit(0);
  }

  ui.line('');
  ui.divider();
  ui.line('');

  // ── B. App Registration ──
  const appRegName = `PowerApps-CodeApps-${appName.replace(/ /g, '-')}`;
  ui.line('── B. Create the Azure App Registration ──');
  ui.line('');
  ui.line('1. Open: https://portal.azure.com');
  ui.line('2. Go to: Microsoft Entra ID → App registrations → + New');
  ui.line(`3. Name: ${appRegName}`);
  ui.line('4. Supported account types: Single tenant');
  ui.line('5. Redirect URI: Leave blank');
  ui.line('6. Click Register');
  ui.line('');
  ui.line('On the Overview page, copy these two values:');
  ui.line('');

  // Tenant ID
  const tenantId = await input({
    message: 'Tenant ID (Directory ID)',
    validate: (v) => {
      if (!v.trim()) return 'Required';
      if (!isValidUUID(v.trim())) return 'Not a valid UUID. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
      return true;
    },
  });
  stateSet('PP_TENANT_ID', tenantId.trim());
  ui.ok('Valid UUID');

  // Client ID
  const clientId = await input({
    message: 'Client ID (Application ID)',
    validate: (v) => {
      if (!v.trim()) return 'Required';
      if (!isValidUUID(v.trim())) return 'Not a valid UUID. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
      return true;
    },
  });
  stateSet('PP_APP_ID', clientId.trim());
  ui.ok('Valid UUID');

  ui.line('');
  ui.line('Now create a client secret:');
  ui.line('7. In the App Registration → Certificates & secrets');
  ui.line('8. + New client secret → Description: "Power Platform CLI"');
  ui.line('9. Expiration: 12 months (set a calendar reminder!)');
  ui.line('10. Click Add → COPY THE SECRET VALUE NOW (shown only once!)');
  ui.line('');

  clientSecret = await password({
    message: 'Client Secret (hidden input)',
    validate: (v) => v ? true : 'Required',
  });
  ui.ok('Got it (not saved to disk in plain text)');

  ui.line('');
  ui.line('Finally, grant API permissions:');
  ui.line('11. API permissions → + Add a permission');
  ui.line('12. APIs my organization uses → search "Dataverse"');
  ui.line('13. Delegated permissions → check "user_impersonation"');
  ui.line('14. Click Add permissions');
  ui.line('15. Click "Grant admin consent for [Your Org]"');
  ui.line('');

  ui.line('');
  ui.divider();
  ui.line('');

  // ── C. Application User ──
  ui.line('── C. Register as Application User ──');
  ui.line('');
  ui.line('For EACH environment, do this:');
  ui.line('1. Open: https://admin.powerplatform.microsoft.com');
  ui.line('2. Select the environment → Settings');
  ui.line('3. Users + permissions → Application users');
  ui.line('4. + New app user → Add an app');
  ui.line(`5. Search: ${appRegName}`);
  ui.line('6. Select it → assign Security Role:');
  ui.line('   • Dev/Test: System Administrator');
  ui.line('   • Production: Least-privilege custom role');
  ui.line('7. Click Create');
  ui.line('');
  ui.line('Do this for your Dev environment at minimum.');
  ui.line('(Test and Prod can be done later.)');
  ui.line('');

  const appUserDone = await confirm({ message: 'Done registering the Application User in Dev?', default: true });
  if (!appUserDone) {
    ui.line('Complete it and re-run the wizard.');
    process.exit(0);
  }

  setCompletedStep(5);
}
