// wizard/steps/08-verify-deploy.mjs — Build, verify & deploy
import { confirm, input } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { pacPath, runLive, runSafe, runSafeLive, run } from '../lib/shell.mjs';
import { existsSync, readFileSync } from 'node:fs';
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

    // Check if the app is already registered (appId populated in power.config.json)
    const powerConfigPath = join(projectDir, 'power.config.json');
    let isFirstPush = true;
    if (existsSync(powerConfigPath)) {
      try {
        const config = JSON.parse(readFileSync(powerConfigPath, 'utf-8'));
        isFirstPush = !config.appId;
      } catch { /* treat as first push */ }
    }

    if (isFirstPush) {
      ui.line('This is the first push — the app has not been registered yet.');
      ui.line('The first push MUST use user (interactive) auth because');
      ui.line('the BAP checkAccess API rejects service principal tokens.');
      ui.line('');
      ui.line('After the first push succeeds, SPN auth will work for CI/CD.');
    } else {
      ui.ok('App already registered (appId found in power.config.json).');
      ui.line('SPN or user auth both work for subsequent pushes.');
    }
    ui.line('');

    const deploy = await confirm({ message: 'Push to Power Platform now?', default: true });
    if (deploy) {
      const profileName = stateGet('APP_NAME', 'DevInteractive').replace(/\s+/g, '');

      if (isFirstPush) {
        // First push: require user auth
        const profileReady = await ensureInteractiveAuth(pac, profileName, devUrl);
        if (profileReady) {
          ui.line('');
          ui.line('Deploying (first push — creating app)...');
          const pushOk = runSafeLive(pac, ['code', 'push'], { cwd: projectDir });
          if (pushOk) {
            ui.ok('Deployed! Your app is live.');
            ui.line('power.config.json now contains the appId — future pushes can use SPN auth.');
          } else {
            ui.warn('Deploy failed.');
            showTroubleshooting(projectDir, pac);
          }
        } else {
          ui.warn('Could not establish user auth. Deploy manually:');
          ui.line(`  ${pac} auth create --name ${profileName} --environment ${devUrl}`);
          ui.line(`  ${pac} auth select --name ${profileName}`);
          ui.line(`  cd ${projectDir} && ${pac} code push`);
        }
      } else {
        // Subsequent push: use whatever auth is active
        ui.line('');
        ui.line('Deploying...');
        const pushOk = runSafeLive(pac, ['code', 'push'], { cwd: projectDir });
        if (pushOk) {
          ui.ok('Deployed! Your app is updated.');
        } else {
          ui.warn('Deploy failed.');
          showTroubleshooting(projectDir, pac);
        }
      }
    } else {
      ui.line('');
      if (isFirstPush) {
        ui.line('Deploy later (first push needs user auth):');
        ui.line(`  ${pac} auth create --name <ProfileName> --environment ${devUrl}`);
        ui.line(`  ${pac} auth select --name <ProfileName>`);
      } else {
        ui.line('Deploy later:');
      }
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

// ─────────── Helpers ───────────

function showTroubleshooting(projectDir, pac) {
  ui.line('');
  ui.line('Troubleshooting:');
  ui.line('  1. Confirm you are signed in with a user that has System Administrator');
  ui.line('     or System Customizer role in the target environment.');
  ui.line('  2. Verify power.config.json is in the same directory as package.json.');
  ui.line('  3. Retry manually:');
  ui.line(`     cd ${projectDir} && ${pac} code push`);
}

// ─────────── Interactive Auth Helper ───────────

/**
 * Ensure an interactive (user-based) PAC auth profile is active.
 * SPN auth cannot push code apps — the BAP checkAccess API rejects it.
 *
 * pac auth list output format (real example):
 *   [1]          UNIVERSAL AgentIdeator-SP     7a53c97f-...  Public Application  ...
 *   [2]          UNIVERSAL AgentIdeatorRefresh user@...      Public User         ...
 *   [3]   *      UNIVERSAL Dev                 7a53c97f-...  Public Application  ...
 *
 * Key: Type column = "Application" (SPN) vs "User" (interactive).
 * Environment URL may have a trailing slash.
 */
async function ensureInteractiveAuth(pac, profileName, envUrl) {
  const envUrlNorm = envUrl.replace(/\/+$/, '');

  // Parse pac auth list to find a User-type profile for our environment
  const authListOutput = runSafe(pac, ['auth', 'list']);
  if (authListOutput) {
    const lines = authListOutput.split('\n');
    for (const line of lines) {
      const indexMatch = line.match(/^\[(\d+)\]/);
      if (!indexMatch) continue;

      // Must be Type=User, NOT Application
      if (!/\bUser\b/i.test(line)) continue;

      // Must target our environment (normalize trailing slash)
      if (!line.replace(/\/+/g, '/').includes(envUrlNorm.replace(/\/+/g, '/'))) continue;

      const idx = indexMatch[1];
      const selectOk = runSafe(pac, ['auth', 'select', '--index', idx]);
      if (selectOk !== null) {
        ui.ok(`Selected existing User auth profile (index ${idx})`);
        return true;
      }
    }
  }

  // No User profile for this environment — create one
  ui.line('');
  ui.line('No user-based auth profile found for this environment.');
  ui.line('A browser sign-in is required to push Code Apps.');
  ui.line('Your browser will open — sign in with a user who has');
  ui.line('System Administrator or System Customizer role.');
  ui.line('');
  ui.line(`Environment: ${envUrl}`);
  ui.line('');

  const proceed = await confirm({ message: 'Sign in now?', default: true });
  if (!proceed) return false;

  ui.line('');
  ui.line('Opening browser for sign-in...');
  // Default pac auth create (no --deviceCode) opens a browser dialog.
  // Falls back to device code if the browser flow fails.
  let createOk = runSafeLive(pac, [
    'auth', 'create',
    '--name', profileName,
    '--environment', envUrl,
  ]);

  if (!createOk) {
    // Browser dialog may not work on headless/remote — try device code
    ui.warn('Browser sign-in failed. Trying device code flow...');
    ui.line('You will see a URL and code — open the URL in any browser and enter the code.');
    ui.line('');
    createOk = runSafeLive(pac, [
      'auth', 'create',
      '--name', profileName,
      '--environment', envUrl,
      '--deviceCode',
    ]);
  }

  if (!createOk) {
    ui.warn('Auth creation failed.');
    return false;
  }

  // Select the newly created profile
  runSafe(pac, ['auth', 'select', '--name', profileName]);

  // Verify it works
  const verifyWho = runSafe(pac, ['org', 'who']);
  if (verifyWho) {
    ui.ok('User auth verified');
    return true;
  }

  ui.warn('Auth created but verification failed.');
  return false;
}
