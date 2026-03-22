// wizard/steps/03-app-registration.mjs — App Registration + Application User (manual portal steps)
import { input, password, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { isValidUUID } from '../lib/validate.mjs';
import { setSecret } from '../lib/secrets.mjs';

export default async function stepAppRegistration() {
  ui.stepHeader(3, TOTAL_STEPS, 'App Registration & Application User');

  const appName = stateGet('APP_NAME');
  const appRegName = `PowerApps-CodeApps-${appName.replace(/ /g, '-')}`;

  ui.line('Two things to set up in your browser, then the wizard automates the rest.');
  ui.line('');

  // ── A. App Registration (Azure Portal) ──
  ui.line('── A. Create the Azure App Registration (Azure Portal) ──');
  ui.line('');
  ui.line('1. Open the Azure Portal: https://portal.azure.com');
  ui.line('2. Go to: Microsoft Entra ID → App registrations → + New');
  ui.line(`3. Name: ${appRegName}`);
  ui.line('4. Supported account types: Single tenant');
  ui.line('5. Redirect URI: Leave blank');
  ui.line('6. Click Register');
  ui.line('');
  ui.line('On the Overview page, copy these two values:');
  ui.line('');

  // Tenant ID
  let tenantId = '';
  if (stateHas('PP_TENANT_ID')) {
    tenantId = stateGet('PP_TENANT_ID');
    ui.line(`Tenant ID (from previous run): ${tenantId}`);
    const keep = await confirm({ message: 'Keep this?', default: true });
    if (!keep) tenantId = '';
  }
  if (!tenantId) {
    tenantId = await input({
      message: 'Tenant ID (Directory ID)',
      validate: (v) => {
        if (!v.trim()) return 'Required';
        if (!isValidUUID(v.trim())) return 'Not a valid UUID. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        return true;
      },
    });
  }
  stateSet('PP_TENANT_ID', tenantId.trim());
  ui.ok('Valid UUID');

  // Client ID
  let clientId = '';
  if (stateHas('PP_APP_ID')) {
    clientId = stateGet('PP_APP_ID');
    ui.line(`Client ID (from previous run): ${clientId}`);
    const keep = await confirm({ message: 'Keep this?', default: true });
    if (!keep) clientId = '';
  }
  if (!clientId) {
    clientId = await input({
      message: 'Client ID (Application ID)',
      validate: (v) => {
        if (!v.trim()) return 'Required';
        if (!isValidUUID(v.trim())) return 'Not a valid UUID. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
        return true;
      },
    });
  }
  stateSet('PP_APP_ID', clientId.trim());
  ui.ok('Valid UUID');

  ui.line('');
  ui.line('Now create a client secret:');
  ui.line('7. In the App Registration → Certificates & secrets');
  ui.line('8. + New client secret → Description: "Power Platform CLI"');
  ui.line('9. Expiration: 12 months (set a calendar reminder!)');
  ui.line('10. Click Add → COPY THE SECRET VALUE NOW (shown only once!)');
  ui.line('');

  const clientSecret = await password({
    message: 'Client Secret (hidden input)',
    validate: (v) => v ? true : 'Required',
  });
  setSecret(clientSecret);
  ui.ok('Got it (not saved to disk in plain text)');

  ui.line('');
  ui.line('Finally, grant API permissions:');
  ui.line('11. API permissions → + Add a permission');
  ui.line('12. APIs my organization uses → search "Dataverse"');
  ui.line('13. Delegated permissions → check "user_impersonation"');
  ui.line('14. Click Add permissions');
  ui.line('15. Click "Grant admin consent for [Your Org]"');
  ui.line('');

  ui.divider();
  ui.line('');

  // ── B. Application User (Power Platform Admin Center) ──
  ui.line('── B. Register as Application User (Power Platform Admin Center) ──');
  ui.line('');
  ui.line('For EACH environment, do this:');
  ui.line('1. Open the Power Platform Admin Center:');
  ui.line('   https://admin.powerplatform.microsoft.com');
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

  const done = await confirm({ message: 'Done registering the Application User in Dev?', default: true });
  if (!done) {
    ui.line('Complete it and re-run the wizard. Your progress is saved.');
    ui.line('Re-run: node wizard/index.mjs');
    process.exit(0);
  }

  setCompletedStep(3);
}
