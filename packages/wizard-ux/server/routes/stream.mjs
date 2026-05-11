// Routes for /api/steps/:n/stream — SSE log streaming
import { getRun } from '../lib/process-runner.mjs';

export default async function streamRoutes(app /* , opts */) {
  app.get('/:n/stream', async (req, reply) => {
    const runId = req.query?.runId;
    if (!runId) return reply.code(400).send({ error: 'runId required' });
    const run = getRun(runId);
    if (!run) return reply.code(404).send({ error: 'Unknown runId (may have been GC\'d)' });

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    const send = (event, data) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Replay buffered lines to late joiners
    for (const line of run.lines) send('line', line);
    if (run.deviceCode) send('deviceCode', run.deviceCode);
    if (run.status === 'done' || run.status === 'error') {
      send('end', { status: run.status, exitCode: run.exitCode, error: run.error });
      reply.raw.end();
      return reply;
    }

    const onLine = (line) => send('line', line);
    const onDeviceCode = (dc) => send('deviceCode', dc);
    const onEnd = () => {
      send('end', { status: run.status, exitCode: run.exitCode, error: run.error });
      reply.raw.end();
    };

    run.on('line', onLine);
    run.on('deviceCode', onDeviceCode);
    run.on('end', onEnd);

    req.raw.on('close', () => {
      run.off('line', onLine);
      run.off('deviceCode', onDeviceCode);
      run.off('end', onEnd);
    });

    return reply;
  });
}
