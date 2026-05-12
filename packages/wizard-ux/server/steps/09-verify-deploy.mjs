// Step 9 - Verify & Deploy. Browser-native build and optional pac code push.
import { existsSync, readFileSync } from 'node:fs';
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

function runFile(log, file, args, opts = {}) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${SHELL.formatCommandForLog(file, args)}`);
    const child = SHELL.spawnSafe(file, args, { cwd: opts.cwd || PROJECT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => log.info(String(chunk).trimEnd()));
    child.stderr.on('data', (chunk) => log.warn(String(chunk).trimEnd()));
    child.on('error', (error) => {
      log.fail(`Failed to start ${file}: ${error.message}`);
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

async function addAppToSolution(log, pac, projectDir, solutionName) {
  if (!solutionName) return;
  let appId = '';
  try {
    appId = JSON.parse(readFileSync(join(projectDir, 'power.config.json'), 'utf-8')).appId || '';
  } catch {
    // ignore
  }
  if (!appId) {
    log.warn('Could not read appId from power.config.json; skipping solution component registration.');
    return;
  }
  const ok = await runFile(log, pac, ['solution', 'add-solution-component', '-sn', solutionName, '-c', appId, '-ct', '300'], { cwd: projectDir });
  if (ok) log.ok(`App added to solution ${solutionName}`);
  else log.warn(`Could not add app to solution ${solutionName}. It may already be present, or you can add it manually.`);
}

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

    const pushArgs = ['code', 'push'];
    if (state.SOLUTION_DISPLAY_NAME) pushArgs.push('-s', state.SOLUTION_DISPLAY_NAME);
    const pushResult = await runFileCapture(log, pac, pushArgs, { cwd: projectDir });
    const pushOutput = `${pushResult.stdout}\n${pushResult.stderr}`;
    if (!pushResult.ok || PAC_HTTP_ERROR_RE.test(pushOutput)) throw new Error('pac code push failed. Check the live output above, then retry.');
    log.ok('Code App pushed to Power Platform');

    // pac code push prints the deployed Code App URL in stdout, e.g.
    //   "The app was successfully published. URL: https://apps.powerapps.com/play/e/<envId>/a/<appId>"
    // Capture the first matching apps.powerapps.com/play URL and persist it
    // to wizard state so the Summary can show the real launch URL.
    const deployedUrlMatch = pushOutput.match(/https:\/\/apps\.powerapps\.com\/play\/[^\s'"<>)]+/i);
    const stateUpdate = { PROJECT_DIR: projectDir };
    if (deployedUrlMatch) {
      const deployedUrl = deployedUrlMatch[0].replace(/[.,;]+$/, '');
      stateUpdate.DEPLOYED_APP_URL = deployedUrl;
      log.ok(`App URL: ${deployedUrl}`);
    } else {
      log.warn('Could not detect deployed app URL in pac output. Open the app from Power Apps Maker Portal.');
    }

    await addAppToSolution(log, pac, projectDir, state.SOLUTION_UNIQUE_NAME || '');

    return { stateUpdate, completedStep: 9 };
  },
};
