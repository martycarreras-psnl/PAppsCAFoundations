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
    launchUrl: deployedUrl,
  };
}

export default async function stateRoutes(app, opts) {
  const { rootDir } = opts;

  app.get('/', async () => {
    const state = readState(rootDir);
    const completed = getCompletedStep(state);
    const powerApp = readPowerAppInfo(rootDir, state);
    return {
      state,
      completed,
      next: Math.min(completed + 1, TOTAL_STEPS),
      totalSteps: TOTAL_STEPS,
      powerApp,
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
