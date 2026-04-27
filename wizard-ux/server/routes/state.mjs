// Routes for /api/state
import { readState, writeState, resetStateFile, getCompletedStep } from '../lib/state-bridge.mjs';
import { TOTAL_STEPS } from '../steps/index.mjs';

export default async function stateRoutes(app, opts) {
  const { rootDir } = opts;

  app.get('/', async () => {
    const state = readState(rootDir);
    const completed = getCompletedStep(state);
    return {
      state,
      completed,
      next: Math.min(completed + 1, TOTAL_STEPS),
      totalSteps: TOTAL_STEPS,
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
