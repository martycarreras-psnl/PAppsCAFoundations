// Routes for /api/config-seed — export/import portable wizard configuration "seeds".
// A seed is an allow-listed subset of .wizard-state.json — never secrets.
import { readState, writeState } from '../lib/state-bridge.mjs';
import {
  CONFIG_SEED_KEYS, SEED_VERSION, filterToSeed, validateSeed,
} from '../lib/config-seed-allowlist.mjs';

const MAX_IMPORT_BYTES = 64 * 1024;

export default async function configSeedRoutes(app, opts) {
  const { rootDir } = opts;

  // Metadata about what is exportable. Lets the UI render a preview/legend.
  app.get('/keys', async () => ({
    version: SEED_VERSION,
    keys: CONFIG_SEED_KEYS.map(({ key, type, label }) => ({ key, type, label })),
  }));

  // Download the current state, filtered to the allow-list.
  app.get('/export', async (_req, reply) => {
    const state = readState(rootDir);
    const values = filterToSeed(state);
    const payload = {
      $schema: 'https://aka.ms/pacaf/wizard-config/v1',
      version: SEED_VERSION,
      exportedAt: new Date().toISOString(),
      values,
    };
    const filename = `pacaf-wizard-config-${new Date().toISOString().slice(0, 10)}.json`;
    reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(JSON.stringify(payload, null, 2) + '\n');
  });

  // Import a seed file. Body = parsed seed JSON. Validates against allow-list and merges.
  // Modes:
  //   merge (default)        — only write keys whose current value is empty/missing
  //   replace-allowlisted    — overwrite every allow-listed key the seed provides
  app.post('/import', async (req, reply) => {
    const raw = req.body;
    const size = Buffer.byteLength(JSON.stringify(raw ?? {}), 'utf-8');
    if (size > MAX_IMPORT_BYTES) {
      return reply.code(413).send({ error: `Payload too large (${size} > ${MAX_IMPORT_BYTES} bytes).` });
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return reply.code(400).send({ error: 'Body must be a JSON object.' });
    }
    const mode = String(raw.mode || 'merge');
    if (mode !== 'merge' && mode !== 'replace-allowlisted') {
      return reply.code(400).send({ error: `Unknown mode: ${mode}` });
    }
    const seed = raw.seed;
    if (!seed || typeof seed !== 'object') {
      return reply.code(400).send({ error: 'Body must include a `seed` object.' });
    }
    if (seed.version !== undefined && Number(seed.version) > SEED_VERSION) {
      return reply.code(400).send({
        error: `Seed version ${seed.version} is newer than this wizard supports (max ${SEED_VERSION}). Upgrade the wizard.`,
      });
    }
    const { applied, skipped } = validateSeed(seed.values || {});

    const current = readState(rootDir);
    const partial = {};
    const written = [];
    const preserved = [];

    for (const { key, value } of applied) {
      const existing = current[key];
      const isEmpty = existing === undefined
        || existing === null
        || existing === ''
        || (Array.isArray(existing) && existing.length === 0)
        || (typeof existing === 'object' && !Array.isArray(existing) && Object.keys(existing).length === 0);

      if (mode === 'merge' && !isEmpty) {
        preserved.push({ key, reason: 'Existing value preserved (merge mode).' });
        continue;
      }
      partial[key] = value;
      written.push({ key });
    }

    if (Object.keys(partial).length > 0) writeState(rootDir, partial);

    return {
      mode,
      written,
      preserved,
      skipped,
    };
  });
}
