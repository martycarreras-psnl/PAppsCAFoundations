// Build-only verification remains separate from guarded Code App deployment.
import { confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { runLive, runSafeLive } from '../lib/shell.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { localCodeAppTool } from '../lib/code-app-target.mjs';

export default async function stepVerifyAndDeploy() {
  ui.stepHeader(8, TOTAL_STEPS, 'Build, Verify & Deploy');
  const projectDir = stateGet('PROJECT_DIR');
  const targetKey = stateGet('WIZARD_TARGET_ENV', 'dev');
  const deploy = await confirm({ message: 'Build and push to Power Platform now?', default: false });
  if (deploy) {
    const config = JSON.parse(readFileSync(join(projectDir, 'power.config.json'), 'utf8'));
    const allowCreate = !config.appId && await confirm({
      message: 'Create the first published app in the recorded target solution? Code Apps features must be enabled in that environment.',
      default: false,
    });
    if (!config.appId && !allowCreate) throw new Error('First publishing was not authorized. No app was created.');
    ui.line('Power Apps CLI uses its own account; PAC profiles do not establish pa authentication.');
    ui.line('Check or sign in first: npm run pa -- auth status --json / npm run pa -- auth login');
    ui.line('Separate Azure CLI sign-in with Global Discovery access is required to verify the environment resource tenant. No login or access grant is automated.');
    const helper = localCodeAppTool(projectDir, 'deploy');
    const args = ['--target', targetKey, '--auth', 'user', ...(allowCreate ? ['--allow-create'] : [])];
    if (!runSafeLive(helper, args, { cwd: projectDir })) throw new Error('Guarded deployment failed. Check the target, separate pa account, and build output. Existing app identity was not reset.');
    ui.ok('Guarded build and deployment succeeded.');
  } else {
    const buildOk = runLive('npm run build', { cwd: projectDir });
    if (!buildOk || !existsSync(join(projectDir, 'dist', 'index.html'))) throw new Error('Build verification failed. Fix build errors before deploying.');
    ui.ok('Build succeeded — dist/index.html exists. Publishing skipped.');
  }

  ui.completeBanner();
  ui.summary('Project:', stateGet('APP_NAME'));
  ui.summary('Location:', projectDir);
  ui.summary('Solution:', stateGet('SOLUTION_DISPLAY_NAME') || stateGet('SOLUTION_UNIQUE_NAME'));
  ui.summary('Deployment identity:', '.power-apps-targets.json (commit this file)');
  ui.line('');
  ui.line('  npm run dev:mock         <- prototype without authentication');
  ui.line('  npm run prototype:seed   <- refresh mock assets after planning changes');
  ui.line('  npm run pa -- auth login <- separate Power Apps CLI sign-in');
  ui.line('  npm run dev              <- Vite :3000 + Power Apps local host :8080');
  ui.line('  npm run deploy -- --preflight <- read-only target/configuration check');
  ui.line('  npm run deploy           <- guarded build + publish');
  ui.line('  npm run deploy -- --allow-create <- explicitly allow first publish only');
  ui.line('');
  ui.line('Bind connectors after prototype validation with /add-datasource, or:');
  ui.line('  npm run pa -- app add data-source --connector dataverse --table <table_logical_name>');
  ui.line('  npm run pa -- app add data-source --connector <connector_api_id> --connection-id <connection_id>');
  ui.line('PAC remains responsible for solution ALM/admin. SPN updates are opt-in and require an existing app plus maker-granted edit access.');
  ui.line('User publishing uses read-only Global Discovery via your separately signed-in Azure CLI. Missing discovery rows (including disabled/security-group/delegated-admin restrictions) stop publishing without fallback.');
  setCompletedStep(9);
}
