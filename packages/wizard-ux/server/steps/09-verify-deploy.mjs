// Step 9 - Verify & Deploy. Browser-native build and optional pac code push.
import { existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// PACKAGE_DIR locates sibling @pacaf/wizard lib files (must stay __dirname-relative).
// PROJECT_DIR is the user's working directory (profile names, command cwd).
const PACKAGE_DIR = resolve(__dirname, '..', '..', '..');
const PROJECT_DIR = process.cwd();
const SHELL = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);

function hasCommand(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runCommand(log, command, opts = {}) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${command}`);
    const child = process.platform === 'win32'
      ? spawn(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', command], { cwd: opts.cwd || PROJECT_DIR, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('sh', ['-c', command], { cwd: opts.cwd || PROJECT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => log.info(String(chunk).trimEnd()));
    child.stderr.on('data', (chunk) => log.warn(String(chunk).trimEnd()));
    child.on('error', (error) => {
      log.fail(`Failed to start command: ${error.message}`);
      resolvePromise(false);
    });
    child.on('close', (code) => resolvePromise(code === 0));
  });
}

function runFileCapture(log, file, args, opts = {}) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${SHELL.formatCommandForLog(file, args)}`);
    const child = SHELL.spawnSafe(file, args, { cwd: opts.cwd || PROJECT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
      log.info(String(chunk).trimEnd());
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
      log.warn(String(chunk).trimEnd());
    });
    child.on('error', (error) => {
      stderr += `\n${error.message}`;
      log.fail(`Failed to start ${file}: ${error.message}`);
      resolvePromise({ ok: false, stdout, stderr });
    });
    child.on('close', (code) => resolvePromise({ ok: code === 0, stdout, stderr }));
  });
}

const PAC_HTTP_ERROR_RE = /HTTP error status:\s*[45]\d\d/i;

// Append ?hideNavBar=true (or &hideNavBar=true if the URL already has a query
// string) so the Power Apps "purple bar" — the top chrome rendered by the
// Power Apps host around any Code App — is hidden by default. See
// .github/instructions/04-deployment.instructions.md and issue #44.
function withHideNavBar(url) {
  if (!url) return url;
  if (/[?&]hideNavBar=/i.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'hideNavBar=true';
}

function resolveCredentialValues(state) {
  return PAC_TARGET.resolveCredentialValues({
    rootDir: PROJECT_DIR,
    opBin: process.env.OP_BIN || (hasCommand('op') ? 'op' : null),
    source: state.AUTH_MODE || 'auto',
  });
}

function verifyUserProfile(pac, projectDir, state, credentialValues) {
  return PAC_TARGET.selectAndVerifyPacProfile({
    pac,
    rootDir: PROJECT_DIR,
    wizardState: {
      WIZARD_TARGET_ENV: state.WIZARD_TARGET_ENV || 'dev',
      PP_ENV_DEV: state.PP_ENV_DEV || '',
      PP_ENV_TEST: state.PP_ENV_TEST || '',
      PP_ENV_PROD: state.PP_ENV_PROD || '',
    },
    targetKey: state.WIZARD_TARGET_ENV || 'dev',
    profileType: 'user',
    credentialValues,
    powerConfigPath: join(projectDir, 'power.config.json'),
    requireCredentialMatch: credentialValues !== null,
    requirePowerConfig: true,
    requirePowerConfigTarget: true,
  });
}

// Ensure the deployed Code App is a component of the selected solution.
//
// The first `pac code push -s <UNIQUE name>` (the CREATE) both creates the
// canvasapp record AND makes it a component of the chosen solution in one shot
// — the documented golden path. We REFUSE a bare push below, so the app can
// never be created OUTSIDE its solution (a silent failure a later -s re-push,
// which is an ignored UPDATE, cannot fix). No post-push repair is needed (#81).

export default {
  meta: {
    number: 9,
    title: 'Verify & Deploy',
    description: 'Build the project, optionally push it to Power Platform, and surface the live app URL when available.',
    canRunInBrowser: true,
  },

  questions() {
    return [
      {
        id: 'PUSH_TO_POWER_PLATFORM',
        type: 'confirm',
        label: 'Push to Power Platform after a successful build',
        help: 'Requires the user auth profile created in Step 4. Leave off to only verify the build.',
        defaultValue: false,
      },
      {
        id: 'CODE_APPS_FEATURES_ENABLED',
        type: 'confirm',
        label: 'Code Apps features are enabled in the target environment',
        help: 'Before first push, enable Code components for canvas apps and publishing code components in Power Platform Admin Center.',
        defaultValue: false,
        hideIf: { id: 'PUSH_TO_POWER_PLATFORM', equals: false },
      },
    ];
  },

  async apply(answers, state, log) {
    const projectDir = resolve(String(state.PROJECT_DIR || PROJECT_DIR));
    if (!existsSync(join(projectDir, 'package.json'))) throw new Error(`No package.json found in ${projectDir}. Run Step 7 first.`);

    log.info('Building project...');
    const buildOk = await runCommand(log, 'npm run build', { cwd: projectDir });
    const distExists = existsSync(join(projectDir, 'dist', 'index.html'));
    if (!buildOk || !distExists) {
      log.warn('Build did not produce dist/index.html. Fix build errors before deploying.');
      return { stateUpdate: { PROJECT_DIR: projectDir }, completedStep: 9 };
    }
    log.ok('Build succeeded and dist/index.html exists');

    if (answers.PUSH_TO_POWER_PLATFORM !== true) {
      log.info('Push skipped. You can deploy later from WizardUX or with pac code push.');
      return { stateUpdate: { PROJECT_DIR: projectDir }, completedStep: 9 };
    }

    if (answers.CODE_APPS_FEATURES_ENABLED !== true) {
      throw new Error('Confirm Code Apps features are enabled in Power Platform Admin Center before first push.');
    }

    const pac = SHELL.pacPath();
    if (!pac) throw new Error('PAC CLI was not found. Install it before deploying.');
    const powerConfigPath = join(projectDir, 'power.config.json');
    const repair = PAC_TARGET.repairPowerConfigDisplayNames(powerConfigPath);
    if (repair.changed) log.warn(`Repaired quoted display name fields in power.config.json: ${repair.fields.join(', ')}`);
    const isUserAuth = (state.AUTH_PROFILE_TYPE || 'user') === 'user';
    const credentialValues = isUserAuth ? null : resolveCredentialValues(state);
    const verification = verifyUserProfile(pac, projectDir, state, credentialValues);
    log.ok(`Verified user profile ${verification.profileName}`);

    // -s MUST be the solution UNIQUE name. Passing the friendly display name
    // (e.g. "AI PMO" with a space) silently no-ops and leaves the app OUTSIDE
    // the solution — association only happens on the first push WITH the unique
    // name, and a later -s re-push cannot fix it (issue #81).
    const solutionUniqueName = String(state.SOLUTION_UNIQUE_NAME || '').trim();
    const pushArgs = ['code', 'push'];
    if (solutionUniqueName) {
      pushArgs.push('-s', solutionUniqueName);
    } else {
      throw new Error('No solution unique name (SOLUTION_UNIQUE_NAME) is available. Refusing to run a bare `pac code push`, which would create the Code App outside any solution (a silent failure a later -s re-push cannot fix). Re-run the wizard solution step so the unique name is captured before deploying.');
    }

    // The first push with -s (the CREATE) both creates the canvasapp record and
    // makes it a component of the chosen solution in one shot. An UPDATE push
    // (appId already present) just republishes the existing app in place; -s is
    // a no-op but the app stays in the solution it was created in (#81).
    const preInfo = PAC_TARGET.loadPowerConfigInfo(powerConfigPath);
    const isFirstPush = !preInfo.appId;
    if (!isFirstPush) {
      log.info(`Existing appId detected (${preInfo.appId}) — this push is an UPDATE (republish in place).`);
    }

    // PRECONDITION (issue #81 follow-up): `pac code push -s` only associates the
    // app with its solution if that UNIQUE name already EXISTS in the target
    // environment. If it does not, pac SILENTLY publishes into the Default
    // solution. On the FIRST push, verify the solution exists FIRST and STOP if
    // it is absent — never let the CREATE land the app outside its solution.
    if (isFirstPush) {
      log.info(`Verifying solution "${solutionUniqueName}" exists in the target environment...`);
      const solCheck = PAC_TARGET.solutionExistsInSelectedEnv({ pac, uniqueName: solutionUniqueName, cwd: projectDir });
      if (solCheck.status === 'absent') {
        throw new Error(`Solution "${solutionUniqueName}" does not exist in the target environment. `
          + `Running "pac code push -s ${solutionUniqueName}" now would SILENTLY publish the app into the Default solution `
          + `(the recurring "app not in my solution" failure). Create the solution in this environment (Maker Portal → Solutions → New solution, or reuse an existing one), `
          + `then re-run this step. Tip: the -s value must be the solution UNIQUE name, not the display name.`);
      }
      if (solCheck.status === 'unknown') {
        log.warn(`Could not confirm solution "${solutionUniqueName}" exists (${solCheck.reason}). Proceeding, but if the app lands in the Default solution, verify the unique name is correct.`);
      } else {
        log.ok(`Solution "${solutionUniqueName}" exists in the target environment — safe to push with -s`);
      }
    }

    const pushResult = await runFileCapture(log, pac, pushArgs, { cwd: projectDir });
    const pushOutput = `${pushResult.stdout}\n${pushResult.stderr}`;
    if (!pushResult.ok || PAC_HTTP_ERROR_RE.test(pushOutput)) throw new Error('pac code push failed. Check the live output above, then retry.');
    log.ok('Code App pushed to Power Platform');

    // pac code push prints the deployed Code App URL in stdout, e.g.
    //   "The app was successfully published. URL: https://apps.powerapps.com/play/e/<envId>/a/<appId>"
    // Capture the first matching apps.powerapps.com/play URL and persist it
    // to wizard state so the Summary can show the real launch URL.
    // Always append ?hideNavBar=true so the deployed app hides the Power
    // Apps "purple bar" by default (see issue #44 and 04-deployment.instructions.md).
    const deployedUrlMatch = pushOutput.match(/https:\/\/apps\.powerapps\.com\/play\/[^\s'"<>)]+/i);
    const stateUpdate = { PROJECT_DIR: projectDir };
    if (deployedUrlMatch) {
      const deployedUrl = withHideNavBar(deployedUrlMatch[0].replace(/[.,;]+$/, ''));
      stateUpdate.DEPLOYED_APP_URL = deployedUrl;
      log.ok(`App URL: ${deployedUrl}`);
    } else {
      log.warn('Could not detect deployed app URL in pac output. Open the app from Power Apps Maker Portal.');
    }

    return { stateUpdate, completedStep: 9 };
  },
};
