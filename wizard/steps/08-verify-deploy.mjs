// wizard/steps/08-verify-deploy.mjs — Build, verify & deploy
import { confirm, input } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { pacPath, runLive, runSafe, runSafeLive, run } from '../lib/shell.mjs';
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

  // ── Deploy ──
  if (distExists && pac) {
    ui.line('');
    ui.divider();
    ui.line('');
    ui.line('pac code push requires interactive (user) auth.');
    ui.line('Service principal auth does NOT work for push — the Power Platform');
    ui.line('BAP API rejects SPN tokens for the push/checkAccess endpoint.');
    ui.line('');

    const deploy = await confirm({ message: 'Push to Power Platform now?', default: true });
    if (deploy) {
      // ── Ensure interactive auth profile exists ──
      const profileName = stateGet('APP_NAME', 'DevInteractive').replace(/\s+/g, '');
      const profileReady = await ensureInteractiveAuth(pac, profileName, devUrl);

      if (profileReady) {
        ui.line('');
        ui.line('Deploying...');
        const pushOk = runSafeLive(pac, ['code', 'push'], { cwd: projectDir });
        if (pushOk) {
          ui.ok('Deployed! Your app is live.');
        } else {
          ui.warn('Deploy failed.');
          ui.line('');
          ui.line('Troubleshooting:');
          ui.line('  1. Confirm you are signed in with a user that has System Administrator');
          ui.line('     or System Customizer role in the target environment.');
          ui.line('  2. Verify power.config.json is in the same directory as package.json.');
          ui.line('  3. Retry manually:');
          ui.line(`     cd ${projectDir} && ${pac} code push`);
        }
      } else {
        ui.warn('Could not establish interactive auth. Deploy manually:');
        ui.line(`  ${pac} auth create --name ${profileName} --environment ${devUrl} --interactive`);
        ui.line(`  ${pac} auth select --name ${profileName}`);
        ui.line(`  cd ${projectDir} && ${pac} code push`);
      }
    } else {
      ui.line('');
      ui.line('Deploy later with interactive auth:');
      ui.line(`  ${pac} auth select --name <your-interactive-profile>`);
      ui.line(`  cd ${projectDir} && ${pac} code push`);
    }
  } else if (!distExists) {
    ui.line('');
    ui.line('Skipping deploy — no dist/index.html. Build first, then push:');
    ui.line(`  cd ${projectDir} && npm run build && ${pac || 'pac'} code push`);
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

// ─────────── Interactive Auth Helper ───────────

/**
 * Ensure an interactive (user-based) PAC auth profile is active.
 * SPN auth cannot push code apps — the BAP checkAccess API rejects it.
 * Returns true if an interactive profile is selected and verified.
 */
async function ensureInteractiveAuth(pac, profileName, envUrl) {
  // Check if current auth is already interactive (non-SPN)
  const whoOutput = runSafe(pac, ['org', 'who']);

  // List existing auth profiles to see what's available
  const authListOutput = runSafe(pac, ['auth', 'list']);

  // Try to find and select an existing interactive profile
  if (authListOutput) {
    // Look for a profile that matches our environment and is not SPN
    // pac auth list shows profiles with [*] for active, includes environment URL
    const lines = authListOutput.split('\n');
    let interactiveProfileFound = false;

    for (const line of lines) {
      // Interactive profiles typically show "Public" or user email, not "ApplicationUser"
      if (line.includes(envUrl) && !line.toLowerCase().includes('applicationuser')) {
        interactiveProfileFound = true;
        break;
      }
    }

    if (interactiveProfileFound) {
      ui.line('Found existing interactive auth profile.');
      // Try selecting by name
      const selectOk = runSafe(pac, ['auth', 'select', '--name', profileName]);
      if (selectOk !== null) {
        ui.ok(`Auth profile "${profileName}" selected`);
        return true;
      }
    }
  }

  // No suitable interactive profile — create one
  ui.line('');
  ui.line('An interactive (browser) sign-in is required to push Code Apps.');
  ui.line('This will open your browser — sign in with a user who has');
  ui.line('System Administrator or System Customizer role in the environment.');
  ui.line('');

  const proceed = await confirm({ message: 'Create interactive auth profile now?', default: true });
  if (!proceed) return false;

  ui.line('');
  ui.line('Opening browser for sign-in...');
  const createOk = runSafeLive(pac, [
    'auth', 'create',
    '--name', profileName,
    '--environment', envUrl,
    '--interactive',
  ]);

  if (!createOk) {
    ui.warn('Interactive auth creation failed.');
    return false;
  }

  // Select the newly created profile
  runSafe(pac, ['auth', 'select', '--name', profileName]);

  // Verify it works
  const verifyWho = runSafe(pac, ['org', 'who']);
  if (verifyWho) {
    ui.ok('Interactive auth verified');
    return true;
  }

  ui.warn('Auth created but verification failed.');
  return false;
}
