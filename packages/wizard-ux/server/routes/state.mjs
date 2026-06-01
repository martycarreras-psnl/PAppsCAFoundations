// Routes for /api/state
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readState, writeState, resetStateFile, getCompletedStep } from '../lib/state-bridge.mjs';
import { TOTAL_STEPS } from '../steps/index.mjs';

function pickTargetEnvUrl(state) {
  const target = String(state.WIZARD_TARGET_ENV || 'dev').toLowerCase();
  const map = {
    dev: state.PP_ENV_DEV,
    test: state.PP_ENV_TEST,
    prod: state.PP_ENV_PROD,
  };
  const raw = String(map[target] || state.PP_ENV_DEV || '').trim();
  if (!raw) return { target, environmentUrl: '' };
  return { target, environmentUrl: raw.replace(/\/$/, '') };
}

// Append ?hideNavBar=true (or & form) so the Power Apps "purple bar" is hidden
// by default for every Code App built from this template. See issue #44 and
// 04-deployment.instructions.md ("Default play URL: ?hideNavBar=true").
function withHideNavBar(url) {
  if (!url) return url;
  if (/[?&]hideNavBar=/i.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'hideNavBar=true';
}

function readPowerAppInfo(rootDir, state) {
  const projectDir = resolve(rootDir, String(state.PROJECT_DIR || '.'));
  const powerConfigPath = join(projectDir, 'power.config.json');

  // The deployed Code App URL (apps.powerapps.com/play/...) is captured from
  // `pac code push` stdout in Step 9 and persisted to wizard state as
  // DEPLOYED_APP_URL. NOTE: power.config.json's `localAppUrl` is the *local*
  // dev server URL (http://localhost:3000) — never use it for the launch CTA.
  const deployedUrl = String(state.DEPLOYED_APP_URL || '').trim();

  let appId = '';
  if (existsSync(powerConfigPath)) {
    try {
      const parsed = JSON.parse(readFileSync(powerConfigPath, 'utf-8'));
      appId = String(parsed?.appId || '').trim();
    } catch {
      // ignore — appId is optional for the launch CTA
    }
  }

  if (!deployedUrl && !appId) return null;

  const { target, environmentUrl } = pickTargetEnvUrl(state);
  return {
    appId,
    targetEnv: target,
    environmentUrl,
    launchUrl: withHideNavBar(deployedUrl),
  };
}

// Read the Power Platform environment GUID from power.config.json so we can
// build a Maker Portal deep link. The GUID is required by make.powerapps.com
// URLs (the org URL like https://contoso.crm.dynamics.com is NOT accepted).
function readEnvironmentId(rootDir, state) {
  const projectDir = resolve(rootDir, String(state.PROJECT_DIR || '.'));
  const powerConfigPath = join(projectDir, 'power.config.json');
  if (!existsSync(powerConfigPath)) return '';
  try {
    const c = JSON.parse(readFileSync(powerConfigPath, 'utf-8'));
    const direct = String(
      c.environmentId || c.environment?.id || c.targetEnvironmentId || '',
    ).trim().toLowerCase();
    if (direct) return direct;
    const appUrl = String(c.localAppUrl || c.appUrl || c.playUrl || '').trim();
    const m = appUrl.match(/\/play\/e\/([0-9a-f-]{36})\/app\//i);
    return m ? m[1].toLowerCase() : '';
  } catch {
    return '';
  }
}

// Build the manual "add Code App to solution" guidance consumed by Step 10 in
// WizardUX. Returns a direct Maker Portal deep link to the user's solution
// (falling back to the environment's solutions list, then the portal root) so
// the user can add the deployed Code App by hand. Never exposes raw GUIDs to
// the UI — only the human-readable solution display name and app name.
function readSolutionInfo(rootDir, state) {
  const environmentId = readEnvironmentId(rootDir, state);
  const solutionId = String(state.SOLUTION_ID || '').trim().toLowerCase();
  const displayName = String(state.SOLUTION_DISPLAY_NAME || '').trim();
  const uniqueName = String(state.SOLUTION_UNIQUE_NAME || '').trim();
  const appName = String(state.APP_NAME || '').trim();

  let makerPortalUrl = 'https://make.powerapps.com/';
  let linkTarget = 'portal'; // 'solution' | 'solutions' | 'portal'
  if (environmentId && solutionId) {
    makerPortalUrl = `https://make.powerapps.com/environments/${environmentId}/solutions/${solutionId}`;
    linkTarget = 'solution';
  } else if (environmentId) {
    makerPortalUrl = `https://make.powerapps.com/environments/${environmentId}/solutions`;
    linkTarget = 'solutions';
  }

  return { displayName, uniqueName, appName, makerPortalUrl, linkTarget };
}

export default async function stateRoutes(app, opts) {
  const { rootDir } = opts;

  app.get('/', async () => {
    const state = readState(rootDir);
    const completed = getCompletedStep(state);
    const powerApp = readPowerAppInfo(rootDir, state);
    const solution = readSolutionInfo(rootDir, state);
    return {
      state,
      completed,
      next: Math.min(completed + 1, TOTAL_STEPS),
      totalSteps: TOTAL_STEPS,
      powerApp,
      solution,
    };
  });

  app.put('/', async (req, reply) => {
    const partial = req.body || {};
    if (typeof partial !== 'object' || Array.isArray(partial)) {
      return reply.code(400).send({ error: 'Body must be an object' });
    }
    const merged = writeState(rootDir, partial);
    return { state: merged };
  });

  app.post('/reset', async () => {
    resetStateFile(rootDir);
    return { ok: true };
  });

  app.post('/jump', async (req, reply) => {
    const target = parseInt(req.body?.step, 10);
    if (!target || target < 1 || target > TOTAL_STEPS) {
      return reply.code(400).send({ error: `step must be 1..${TOTAL_STEPS}` });
    }
    const merged = writeState(rootDir, { COMPLETED_STEP: target - 1 });
    return { state: merged };
  });
}
