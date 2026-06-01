// wizard/steps/09-verify-deploy.mjs — Build, verify & deploy
import { confirm, input } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, setCompletedStep, TOTAL_STEPS, getRootDir } from '../lib/state.mjs';
import { pacPath, runLive, runSafe, runSafeLive, runSafeCapture, run, hasCommand } from '../lib/shell.mjs';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPacProfileName,
  getWizardStateSnapshot,
  quarantinePowerConfig,
  repairPowerConfigDisplayNames,
  resolveCredentialValues,
  selectAndVerifyPacProfile,
  solutionExistsInSelectedEnv,
} from '../lib/pac-target.mjs';

export default async function stepVerifyAndDeploy() {
  ui.stepHeader(9, TOTAL_STEPS, 'Build, Verify & Deploy');

  const projectDir = stateGet('PROJECT_DIR');
  const appName = stateGet('APP_NAME');
  const prefix = stateGet('PUBLISHER_PREFIX');
  const solUniqueName = stateGet('SOLUTION_UNIQUE_NAME');
  const solDisplayName = stateGet('SOLUTION_DISPLAY_NAME');
  const devUrl = stateGet('PP_ENV_DEV');
  const testUrl = stateGet('PP_ENV_TEST', '');
  const prodUrl = stateGet('PP_ENV_PROD', '');
  const authMode = stateGet('AUTH_MODE');
  const pac = pacPath();
  const rootDir = getRootDir();
  const credentialValues = resolveCredentialValues({
    rootDir,
    opBin: process.env.OP_BIN || (hasCommand('op') ? 'op' : null),
    source: authMode || 'auto',
  });

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
  if (buildOk && distExists && pac) {
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
      ui.line('');
      ui.warn('IMPORTANT: Before your first push, you must enable Code Apps');
      ui.line('  in the Power Platform Admin Center:');
      ui.line('');
      ui.line('  1. Go to admin.powerplatform.microsoft.com');
      ui.line('  2. Select your environment → Settings → Features');
      ui.line('  3. Find "Code components for canvas apps" → toggle ON');
      ui.line('  4. Find "Allow publishing of canvas apps with code components" → toggle ON');
      ui.line('  5. Save and wait ~1 minute for it to propagate');
    } else {
      ui.ok('App already registered (appId found in power.config.json).');
    }
    ui.line('');
    ui.warn('pac code push requires a user auth profile (SPN is not supported).');
    ui.line('  Once created, the profile works silently — no sign-in on subsequent pushes.');
    ui.line('');

    const deploy = await confirm({ message: 'Push to Power Platform now?', default: true });
    if (deploy) {
      const wizardState = getWizardStateSnapshot(stateGet);
      const targetKey = stateGet('WIZARD_TARGET_ENV', 'dev');

      // ALL pac code push calls require user auth — SPN is always rejected
      const profileReady = await ensureInteractiveAuth(pac, rootDir, targetKey, wizardState, projectDir, credentialValues);
      if (profileReady) {
        // The first push with -s (the CREATE) both creates the canvasapp record
        // AND makes it a component of the chosen solution in one shot — the
        // documented golden path. An UPDATE push (appId already present) just
        // republishes the existing app in place; -s is a no-op but the app stays
        // in the solution it was created in (#81).
        if (!isFirstPush && solUniqueName) {
          ui.line('Existing appId detected — this push is an UPDATE (republish in place).');
        }

        // PRECONDITION (issue #81 follow-up): `pac code push -s` only associates
        // the app with its solution if that UNIQUE name already EXISTS in the
        // target environment. If it does not, pac SILENTLY publishes into the
        // Default solution. On the FIRST push, verify the solution exists first
        // and REFUSE to push if it is absent — never let the CREATE land the app
        // outside its solution.
        if (isFirstPush) {
          ui.line(`Verifying solution "${solUniqueName}" exists in the target environment...`);
          const solCheck = solutionExistsInSelectedEnv({ pac, uniqueName: solUniqueName, cwd: projectDir });
          if (solCheck.status === 'absent') {
            ui.fail(`Solution "${solUniqueName}" does not exist in the target environment.`);
            ui.line(`  Refusing to run "pac code push -s ${solUniqueName}" — it would SILENTLY publish the app`);
            ui.line('  into the Default solution (the recurring "app not in my solution" failure).');
            ui.line('  Create the solution in this environment (Maker Portal → Solutions → New solution,');
            ui.line('  or reuse an existing one), then re-run this step. The -s value must be the');
            ui.line('  solution UNIQUE name, not the display name.');
            setCompletedStep(9);
            return;
          }
          if (solCheck.status === 'unknown') {
            ui.warn(`Could not confirm solution "${solUniqueName}" exists (${solCheck.reason}).`);
            ui.line('  Proceeding, but if the app lands in the Default solution, verify the unique name.');
          } else {
            ui.ok(`Solution "${solUniqueName}" exists in the target environment — safe to push with -s`);
          }
        }

        ui.line('');
        ui.line(isFirstPush ? 'Deploying (first push — creating app)...' : 'Deploying...');
        const success = await attemptPushWithRetry(pac, rootDir, targetKey, 'user', projectDir, solUniqueName, credentialValues);
        if (success) {
          ui.ok(isFirstPush ? 'Deployed! Your app is live.' : 'Deployed! Your app is updated.');
        }
      } else {
        const profileName = buildPacProfileName({ rootDir, targetKey, profileType: 'user', url: devUrl });
        ui.warn('Could not establish user auth. Deploy manually:');
        ui.line(`  ${pac} auth create --name ${profileName} --environment ${devUrl} --deviceCode`);
        ui.line(`  ${pac} auth select --name ${profileName}`);
        ui.line(`  cd ${projectDir} && ${pac} code push -s "${solUniqueName}"`);
      }
    } else {
      ui.line('');
      const profileName = buildPacProfileName({ rootDir, targetKey: stateGet('WIZARD_TARGET_ENV', 'dev'), profileType: 'user', url: devUrl });
      ui.line('Deploy later (requires user auth profile):');
      ui.line(`  ${pac} auth select --name ${profileName}`);
      ui.line(`  cd ${projectDir} && ${pac} code push -s "${solUniqueName}"`);
    }
  } else if (!buildOk || !distExists) {
    ui.line('');
    ui.line('Skipping deploy — build did not succeed. Fix errors, then:');
    ui.line(`  cd ${projectDir} && npm run build && ${pac || 'pac'} code push -s "${solUniqueName}"`);  ui.line('  (reminder: pac code push requires a user auth profile, and -s must be the solution UNIQUE name so the app joins the solution on first push)');  }

  // ── Summary ──
  ui.completeBanner();
  ui.summary('Project:', appName);
  ui.summary('Location:', projectDir);
  ui.summary('Prefix:', prefix);
  ui.summary('Solution:', solDisplayName || solUniqueName);
  ui.summary('Dev env:', devUrl);
  if (testUrl) ui.summary('Test env:', testUrl);
  if (prodUrl) ui.summary('Prod env:', prodUrl);
  ui.summary('Auth:', authMode);
  ui.line('');
  ui.summary('Saved to:', '.wizard-state.json');
  ui.line('');
  ui.line("What's next:");
  ui.line(`  cd ${projectDir}`);
  ui.line('  npm run dev:local       <- prototype with mock providers (no auth needed)');
  ui.line('  npm run prototype:seed  <- refresh domain contracts + mock assets after editing the planning payload');
  ui.line('  review dataverse/prototype-feedback.md and update the planning payload');
  ui.line('  node wizard/index.mjs --from 8  <- bind real connectors when ready');
  ui.line('  npm run dev             <- connected mode once real providers exist');
  ui.line(`  pac code push -s "${solUniqueName}"  <- deploy (cached user auth; -s keeps the app in its solution)`);
  ui.line('');
  ui.line('To add connectors later:');
  ui.line('  node wizard/index.mjs --from 8    (re-run connector setup)');
  ui.line('  — or manually —');
  ui.line('  pac code add-data-source -a dataverse -t <table_logical_name>');
  ui.line('  pac code add-data-source -a <connector_api_id> -c <connection_id>');
  ui.line('  generated files in src/generated/** refresh during add-data-source');
  ui.line('');
  ui.line('Connection references travel with your solution.');
  ui.line('Map them to actual connections in Power Apps Maker Portal after import.');
  ui.line('');
  ui.line('To set up CI/CD:');
  ui.line('  See .github/instructions/04-deployment.instructions.md');
  ui.line('  Add GitHub secrets: PP_APP_ID, PP_CLIENT_SECRET, PP_TENANT_ID');
  ui.line('  Add env variable per environment: POWER_PLATFORM_URL');
  ui.line('');

  setCompletedStep(9);
}

// ─────────── Push with Error Detection & Retry ───────────

const CODE_APPS_NOT_ENABLED_RE = /does not allow this operation for this Code app/i;
const SPN_PERMISSION_RE = /does not have permission to access.*checkAccess/i;
const PAC_CRASH_RE = /non-recoverable error|ArgumentOutOfRange|will need to terminate/i;
const DUPLICATE_APP_RE = /already created an application with this name.*Existing App:\s*'([0-9a-f-]+)'/i;
const PAC_HTTP_ERROR_RE = /HTTP error status:\s*[45]\d\d/i;

/**
 * Attempt pac code push, detect known errors, and offer guided retry.
 * Returns true on success, false on permanent failure.
 */
async function attemptPushWithRetry(pac, rootDir, targetKey, profileType, projectDir, solUniqueName, credentialValues, maxRetries = 3) {
  const wizardState = getWizardStateSnapshot(stateGet);
  const envUrl = wizardState.PP_ENV_DEV;
  const profileName = buildPacProfileName({ rootDir, targetKey, profileType, url: envUrl });
  const pushArgs = ['code', 'push'];
  // The first `pac code push -s <UNIQUE name>` (the CREATE) both creates the
  // canvasapp record and makes it a component of the chosen solution — the
  // documented golden path. We REFUSE a bare push: a bare first push creates
  // the app OUTSIDE any solution, and no later -s re-push (an ignored UPDATE)
  // can move it in. -s MUST be the solution UNIQUE name, never the friendly
  // display name (issue #81).
  if (!solUniqueName) {
    ui.warn('No solution unique name available — refusing to run a bare `pac code push`.');
    ui.line('  A bare push creates the Code App OUTSIDE any solution, which a later -s re-push cannot fix.');
    ui.line('  Re-run the wizard solution step so the UNIQUE name is captured, then deploy.');
    return false;
  }
  pushArgs.push('-s', solUniqueName);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    verifyPacContext(pac, rootDir, projectDir, credentialValues, profileType, true, true);
    const repair = repairPowerConfigDisplayNames(join(projectDir, 'power.config.json'));
    if (repair.changed) ui.warn(`Repaired quoted display name fields in power.config.json: ${repair.fields.join(', ')}`);
    const { ok, stdout, stderr } = runSafeCapture(pac, pushArgs, { cwd: projectDir });
    const combined = `${stdout}\n${stderr}`;
    if (stdout) process.stdout.write(stdout);
    if (ok && !PAC_HTTP_ERROR_RE.test(combined)) return true;

    // ── Duplicate app name (check BEFORE crash — crash is a side effect) ──
    const dupMatch = DUPLICATE_APP_RE.exec(combined);
    if (dupMatch) {
      const existingId = dupMatch[1];
      ui.line('');
      ui.warn(`An app named "${stateGet('APP_NAME', 'this app')}" already exists in the environment.`);
      ui.line(`  Existing appId: ${existingId}`);
      ui.line('');

      const adopt = await confirm({
        message: 'Adopt the existing app and update it instead?',
        default: true,
      });

      if (adopt) {
        // Write the existing appId into power.config.json
        const configPath = join(projectDir, 'power.config.json');
        try {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          config.appId = existingId;
          writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
          ui.ok(`power.config.json updated with appId: ${existingId}`);
          ui.line('  Retrying push as an update...');
          continue;
        } catch (e) {
          ui.warn(`Could not update power.config.json: ${e.message}`);
          ui.line(`  Manually set "appId": "${existingId}" in power.config.json, then retry.`);
          return false;
        }
      } else {
        ui.line('  Options:');
        ui.line('  1. Delete the existing app in Power Apps Maker Portal, then retry.');
        ui.line('  2. Change appDisplayName in power.config.json to a unique name.');
        ui.line(`  3. Set "appId": "${existingId}" in power.config.json to update the existing app.`);
        return false;
      }
    }

    // ── Code Apps not enabled in environment ──
    if (CODE_APPS_NOT_ENABLED_RE.test(combined)) {
      ui.line('');
      ui.warn('Code Apps are not enabled in this environment.');
      ui.line('');
      ui.line('  To fix this:');
      ui.line('  1. Go to admin.powerplatform.microsoft.com');
      ui.line('  2. Select your environment → Settings → Features');
      ui.line('  3. Toggle ON:');
      ui.line('     • "Power Apps component framework for canvas apps"');
      ui.line('     • "Allow publishing of canvas apps with code components"');
      ui.line('     • "Power Apps Code Apps"');
      ui.line('  4. Save and wait 1–2 minutes for propagation');
      ui.line('');
      ui.line('  After toggling, you may also need to refresh your auth profile.');
      ui.line('  The wizard can delete and re-create it for you.');
      ui.line('');

      if (attempt >= maxRetries) break;

      const retry = await confirm({
        message: `Enable features, then retry? (attempt ${attempt}/${maxRetries})`,
        default: true,
      });
      if (!retry) return false;

      // Offer to refresh the auth profile (clears cached env capabilities)
      const refresh = await confirm({ message: 'Refresh auth profile? (recommended after toggling features)', default: true });
      if (refresh) {
        ui.line('  Refreshing auth profile...');
        runSafe(pac, ['auth', 'delete', '--name', profileName]);
        const createOk = runSafeLive(pac, [
          'auth', 'create',
          '--name', profileName,
          '--environment', envUrl,
        ]);
        if (createOk) {
          verifyPacContext(pac, rootDir, projectDir, credentialValues, 'user', true, true);
          ui.ok('Auth profile refreshed');
        } else {
          ui.warn('Auth refresh failed. Retrying push with existing profile...');
        }
      }

      ui.line('');
      ui.line('Retrying push...');
      continue;
    }

    // ── SPN permission error (needs user auth) ──
    if (SPN_PERMISSION_RE.test(combined)) {
      ui.line('');
      ui.warn('Push failed — service principal does not have permission.');
      ui.line('  The first push for a new app requires user (interactive) auth.');
      ui.line('  Switching to interactive auth...');
      ui.line('');

      if (attempt >= maxRetries) break;

      const authOk = await ensureInteractiveAuth(pac, rootDir, targetKey, wizardState, projectDir, credentialValues);
      if (!authOk) {
        ui.warn('Could not establish user auth.');
        break;
      }
      ui.line('');
      ui.line('Retrying push with user auth...');
      continue;
    }

    // ── PAC CLI internal crash ──
    if (PAC_CRASH_RE.test(combined)) {
      ui.line('');
      ui.warn('PAC CLI crashed with an internal error.');
      ui.line('');
      ui.line('  This can happen when data sources were partially registered.');
      ui.line('  Try these steps:');
      ui.line('  1. Delete the .power/ folder in your project directory.');
      ui.line('  2. Re-run: pac code init --displayName "' + (stateGet('APP_NAME', 'YourApp')) + '"');
      ui.line('  3. Re-add data sources with correct connection IDs.');
      ui.line('  4. Rebuild: npm run build');
      ui.line('  5. Retry: pac code push');
      ui.line('');
      ui.line('  PAC log file:');
      ui.line('  ~/.dotnet/tools/.store/microsoft.powerapps.cli.tool/2.2.1/microsoft.powerapps.cli.tool/2.2.1/tools/net10.0/any/logs/pac-log.txt');
      return false;
    }

    // ── Unknown error ──
    ui.line('');
    ui.warn('Deploy failed.');
    if (combined.trim()) {
      // Show the last meaningful line from output
      const lines = combined.split('\n').filter((l) => l.trim());
      const errorLine = lines.find((l) => /^Error:/i.test(l)) || lines[lines.length - 1] || '';
      if (errorLine) ui.line(`  ${errorLine.trim()}`);
    }
    ui.line('');
    ui.line('Troubleshooting:');
    ui.line('  1. Confirm you are signed in with a user that has System Administrator');
    ui.line('     or System Customizer role in the target environment.');
    ui.line('  2. Verify power.config.json is in the same directory as package.json.');
    ui.line('  3. Retry manually:');
    ui.line(`     cd ${projectDir} && ${pac} code push -s "${solUniqueName}"`);
    return false;
  }

  ui.warn(`Push failed after ${maxRetries} attempts.`);
  ui.line('  Retry later: node wizard/index.mjs --from 9');
  return false;
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
async function ensureInteractiveAuth(pac, rootDir, targetKey, wizardState, projectDir, credentialValues) {
  try {
    verifyPacContext(pac, rootDir, projectDir, credentialValues, 'user', true, true);
    return true;
  } catch {
    const envUrl = wizardState.PP_ENV_DEV;
    const profileName = buildPacProfileName({ rootDir, targetKey, profileType: 'user', url: envUrl });

    ui.line('');
    ui.line('No user auth profile was found for this environment.');
    ui.line('A one-time browser sign-in is needed to create the profile.');
    ui.line('After this, all subsequent pushes work silently (the refresh token auto-renews ~90 days).');
    ui.line('Sign in with a user who has System Administrator or System Customizer role.');
    ui.line('');
    ui.line(`Environment: ${envUrl}`);
    ui.line(`Profile: ${profileName}`);
    ui.line('');

    const proceed = await confirm({ message: 'Sign in now?', default: true });
    if (!proceed) return false;

    ui.line('');
    ui.line('Opening browser for sign-in...');
    let createOk = runSafeLive(pac, [
      'auth', 'create',
      '--name', profileName,
      '--environment', envUrl,
    ]);

    if (!createOk) {
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

    try {
      verifyPacContext(pac, rootDir, projectDir, credentialValues, 'user', true, true);
      ui.ok('User auth verified');
      return true;
    } catch (error) {
      ui.warn(error.message);
      return false;
    }
  }
}

function verifyPacContext(pac, rootDir, projectDir, credentialValues, profileType, requirePowerConfig, requirePowerConfigTarget) {
  return selectAndVerifyPacProfile({
    pac,
    rootDir,
    wizardState: getWizardStateSnapshot(stateGet),
    targetKey: stateGet('WIZARD_TARGET_ENV', 'dev'),
    profileType,
    credentialValues,
    powerConfigPath: join(projectDir, 'power.config.json'),
    requireCredentialMatch: true,
    requirePowerConfig,
    requirePowerConfigTarget,
  });
}
