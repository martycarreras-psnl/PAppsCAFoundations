// Step 9 — Build-only verification or guarded Power Apps CLI deployment.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const CODE_APP = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'code-app-target.mjs')).href);

function runFileCapture(log, file, args, cwd) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${SHELL.formatCommandForLog(file, args)}`);
    const child = SHELL.spawnSafe(file, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; log.info(String(chunk).trimEnd()); });
    child.stderr.on('data', (chunk) => { output += chunk; log.info(String(chunk).trimEnd()); });
    child.on('error', (error) => { log.fail(error.message); resolvePromise({ ok: false, output }); });
    child.on('close', (code) => resolvePromise({ ok: code === 0, output }));
  });
}

export default {
  meta: {
    number: 9,
    title: 'Verify & Deploy',
    description: 'Build the project or use guarded deployment to the recorded Power Apps target.',
    canRunInBrowser: true,
    noAutoAdvance: true,
  },
  questions() {
    return [
      {
        id: 'PUSH_TO_POWER_PLATFORM', type: 'confirm',
        label: 'Build and push to Power Platform',
        help: 'Uses the separate Power Apps CLI account and .power-apps-targets.json. User publishing also requires separate Azure CLI sign-in with Global Discovery access. No automatic login or permission grants. Leave off for build-only verification.',
        defaultValue: false,
      },
      {
        id: 'CODE_APPS_FEATURES_ENABLED', type: 'confirm',
        label: 'Code Apps features are enabled in the target environment',
        defaultValue: false, hideIf: { id: 'PUSH_TO_POWER_PLATFORM', equals: false },
      },
      {
        id: 'ALLOW_CREATE', type: 'confirm',
        label: 'Explicitly allow first publishing to create an app',
        help: 'Only needed when the recorded appId is empty. Existing apps are updated without changing their identity.',
        defaultValue: false, hideIf: { id: 'PUSH_TO_POWER_PLATFORM', equals: false },
      },
    ];
  },
  async apply(answers, state, log) {
    if (state.SMOKE_TEST_STATUS === 'failed') {
      throw new Error('Project files were generated, but smoke verification failed. Inspect npm run test:smoke, fix the test/worker error, then re-run Step 8 (verification only; existing files are preserved) to record a passing result before deployment.');
    }
    const projectDir = resolve(String(state.PROJECT_DIR || process.cwd()));
    if (!existsSync(join(projectDir, 'package.json'))) throw new Error(`No package.json found in ${projectDir}. Run Step 8 first.`);
    if (answers.PUSH_TO_POWER_PLATFORM !== true) {
      const build = await runFileCapture(log, process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], projectDir);
      if (!build.ok || !existsSync(join(projectDir, 'dist', 'index.html'))) throw new Error('Build did not produce dist/index.html. Fix build errors before deploying.');
      log.ok('Build succeeded. Publishing skipped; use npm run deploy later.');
      return { stateUpdate: { PROJECT_DIR: projectDir }, completedStep: 10 };
    }
    if (answers.CODE_APPS_FEATURES_ENABLED !== true) throw new Error('Confirm Code Apps features are enabled before publishing.');
    const config = JSON.parse(readFileSync(join(projectDir, 'power.config.json'), 'utf8'));
    if (!config.appId && answers.ALLOW_CREATE !== true) throw new Error('First publishing requires explicit create consent.');
    const args = ['--target', state.WIZARD_TARGET_ENV || 'dev', '--auth', 'user',
      ...(!config.appId && answers.ALLOW_CREATE === true ? ['--allow-create'] : [])];
    log.info('The guarded helper verifies the durable target and separate pa account, builds, then publishes. PAC auth profiles are not reused.');
    const result = await runFileCapture(log, CODE_APP.localCodeAppTool(projectDir, 'deploy'), args, projectDir);
    if (!result.ok) throw new Error('Guarded deployment failed. Check target configuration, pa authentication, and build output; existing app identity was preserved.');
    const stateUpdate = { PROJECT_DIR: projectDir };
    const match = result.output.match(/https:\/\/apps\.powerapps\.com\/play\/[^\s'"<>)]+/i);
    if (match) {
      const url = match[0].replace(/[.,;]+$/, '');
      stateUpdate.DEPLOYED_APP_URL = /[?&]hideNavBar=/i.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}hideNavBar=true`;
      log.ok(`App URL: ${stateUpdate.DEPLOYED_APP_URL}`);
    }
    log.ok('Guarded build and deployment succeeded. Verify solution membership in the Maker Portal.');
    return { stateUpdate, completedStep: 10 };
  },
};
