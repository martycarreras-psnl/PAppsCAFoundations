// Step 9 - Verify & Deploy. Browser-native build and optional pac code push.
import { existsSync, readFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const SHELL = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);

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
      ? spawn(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', command], { cwd: opts.cwd || ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('sh', ['-c', command], { cwd: opts.cwd || ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
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
    log.info(`$ ${file} ${args.join(' ')}`);
    const child = SHELL.spawnSafe(file, args, { cwd: opts.cwd || ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
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

function resolveCredentialValues(state) {
  return PAC_TARGET.resolveCredentialValues({
    rootDir: ROOT_DIR,
    opBin: process.env.OP_BIN || (hasCommand('op') ? 'op' : null),
    source: state.AUTH_MODE || 'auto',
  });
}

function verifyUserProfile(pac, projectDir, state, credentialValues) {
  return PAC_TARGET.selectAndVerifyPacProfile({
    pac,
    rootDir: ROOT_DIR,
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
    requireCredentialMatch: true,
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
    const projectDir = resolve(String(state.PROJECT_DIR || ROOT_DIR));
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
    const credentialValues = resolveCredentialValues(state);
    const verification = verifyUserProfile(pac, projectDir, state, credentialValues);
    log.ok(`Verified user profile ${verification.profileName}`);

    const pushArgs = ['code', 'push'];
    if (state.SOLUTION_DISPLAY_NAME) pushArgs.push('-s', state.SOLUTION_DISPLAY_NAME);
    const pushOk = await runFile(log, pac, pushArgs, { cwd: projectDir });
    if (!pushOk) throw new Error('pac code push failed. Check the live output above, then retry.');
    log.ok('Code App pushed to Power Platform');

    await addAppToSolution(log, pac, projectDir, state.SOLUTION_UNIQUE_NAME || '');

    return { stateUpdate: { PROJECT_DIR: projectDir }, completedStep: 9 };
  },
};
