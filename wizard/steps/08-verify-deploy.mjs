// wizard/steps/08-verify-deploy.mjs — Build, verify & deploy
import { confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { pacPath, runLive, runSafe, run } from '../lib/shell.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default async function stepVerifyAndDeploy() {
  ui.stepHeader(8, TOTAL_STEPS, 'Build, Verify & Deploy');

  const projectDir = stateGet('PROJECT_DIR');
  const appName = stateGet('APP_NAME');
  const prefix = stateGet('PUBLISHER_PREFIX');
  const solName = stateGet('SOLUTION_UNIQUE_NAME');
  const devUrl = stateGet('PP_ENV_DEV');
  const testUrl = stateGet('PP_ENV_TEST', '');
  const prodUrl = stateGet('PP_ENV_PROD', '');
  const authMode = stateGet('AUTH_MODE');
  const pac = pacPath();

  // ── Build ──
  ui.line('Building project...');
  const buildOk = runLive('npm run build', { cwd: projectDir });
  const distExists = existsSync(join(projectDir, 'dist', 'index.html'));
  if (buildOk && distExists) {
    ui.ok('Build succeeded — dist/index.html exists');
  } else if (buildOk) {
    ui.warn('Build ran but dist/index.html not found');
  } else {
    ui.warn("Build failed. This is normal if the template needs adjustments.");
    ui.line("  You can fix build errors and run 'npm run build' later.");
  }

  // ── Auth verification ──
  if (pac) {
    ui.line('');
    ui.line('Final auth check...');
    runSafe(pac, ['auth', 'select', '--name', 'Dev']);
    const who = runSafe(pac, ['org', 'who']);
    if (who) {
      ui.ok('Auth verified');
    } else {
      ui.warn('Auth check failed');
    }
  }

  // ── Deploy ──
  if (distExists && pac) {
    ui.line('');
    ui.line('Note: pac code push requires Power Platform API access.');
    ui.line('SPN (service principal) auth often lacks permission for this.');
    ui.line('If push fails, switch to interactive auth:');
    ui.line(`  pac auth create --name DevInteractive --environment ${devUrl} --interactive`);
    ui.line('');
    const deploy = await confirm({ message: 'Push to Power Platform now?', default: true });
    if (deploy) {
      ui.line('');
      ui.line('Deploying...');
      const pushOk = runLive(`"${pac}" code push`, { cwd: projectDir });
      if (pushOk) {
        ui.ok('Deployed! Your app is live.');
      } else {
        ui.warn('Deploy failed (likely SPN permission issue).');
        ui.line('');
        ui.line('Fix: create an interactive auth profile and retry:');
        ui.line(`  pac auth create --name DevInteractive --environment ${devUrl} --interactive`);
        ui.line('  pac auth select --name DevInteractive');
        ui.line(`  cd ${projectDir} && pac code push`);
      }
    } else {
      ui.line(`Skipped. Deploy later: cd ${projectDir} && pac code push`);
    }
  }

  // ── Summary ──
  ui.completeBanner();
  ui.summary('Project:', appName);
  ui.summary('Location:', projectDir);
  ui.summary('Prefix:', prefix);
  ui.summary('Solution:', solName);
  ui.summary('Dev env:', devUrl);
  if (testUrl) ui.summary('Test env:', testUrl);
  if (prodUrl) ui.summary('Prod env:', prodUrl);
  ui.summary('Auth:', authMode);
  ui.line('');
  ui.summary('Saved to:', '.wizard-state.json');
  ui.line('');
  ui.line("What's next:");
  ui.line(`  cd ${projectDir}`);
  ui.line('  npm run dev:local    <- prototype with mock data (no auth needed)');
  ui.line('  npm run dev          <- connected mode (Vite + pac code run)');
  ui.line('  pac code push        <- deploy changes to Power Platform');
  ui.line('');
  ui.line('To add connectors later:');
  ui.line('  node wizard/index.mjs --from 7    (re-run connector setup)');
  ui.line('  — or manually —');
  ui.line('  pac code add-data-source -a dataverse -t <table_logical_name>');
  ui.line('  pac code add-data-source -a <connector_api_id> -c <connection_id>');
  ui.line('');
  ui.line('Connection references travel with your solution.');
  ui.line('Map them to actual connections in Power Apps Maker Portal after import.');
  ui.line('');
  ui.line('To set up CI/CD:');
  ui.line('  See .github/instructions/04-deployment.instructions.md');
  ui.line('  Add GitHub secrets: PP_APP_ID, PP_CLIENT_SECRET, PP_TENANT_ID');
  ui.line('  Add env variable per environment: POWER_PLATFORM_URL');
  ui.line('');

  setCompletedStep(8);
}
