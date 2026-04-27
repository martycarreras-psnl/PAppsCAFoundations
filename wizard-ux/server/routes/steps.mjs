// Routes for /api/steps
import { STEPS, getStep, TOTAL_STEPS } from '../steps/index.mjs';
import { readState, writeState, getCompletedStep } from '../lib/state-bridge.mjs';
import { newRun, runInline } from '../lib/process-runner.mjs';

export default async function stepsRoutes(app, { rootDir }) {
  // GET /api/steps — list with status
  app.get('/', async () => {
    const state = readState(rootDir);
    const completed = getCompletedStep(state);
    return {
      totalSteps: TOTAL_STEPS,
      completed,
      steps: STEPS.map((s) => ({
        ...s.meta,
        status: s.meta.number <= completed ? 'done' : s.meta.number === completed + 1 ? 'current' : 'pending',
      })),
    };
  });

  // GET /api/steps/:n/questions
  app.get('/:n/questions', async (req, reply) => {
    const n = parseInt(req.params.n, 10);
    if (!n || n < 1 || n > TOTAL_STEPS) return reply.code(404).send({ error: 'Unknown step' });
    const step = getStep(n);
    const state = readState(rootDir);
    const questions = await step.questions(state);
    return {
      meta: step.meta,
      questions,
      state, // include for clientside conditional rendering convenience
    };
  });

  // POST /api/steps/:n/apply
  app.post('/:n/apply', async (req, reply) => {
    const n = parseInt(req.params.n, 10);
    if (!n || n < 1 || n > TOTAL_STEPS) return reply.code(404).send({ error: 'Unknown step' });
    const step = getStep(n);
    if (!step.meta.canRunInBrowser) {
      return reply.code(409).send({
        error: 'Step requires terminal handoff',
        terminalHandoff: step.meta.terminalHandoff,
      });
    }
    const answers = req.body?.answers || {};
    const run = newRun();

    // Kick off the apply asynchronously; client subscribes to /stream for log
    const state = readState(rootDir);
    queueMicrotask(async () => {
      const outcome = await runInline(run, async (log) => {
        const result = await step.apply(answers, state, log);
        if (result?.stateUpdate) writeState(rootDir, result.stateUpdate);
        if (result?.completedStep != null) {
          writeState(rootDir, { COMPLETED_STEP: Math.max(getCompletedStep(readState(rootDir)), result.completedStep) });
        }
        return result;
      });
      void outcome;
    });

    return { runId: run.id };
  });
}
