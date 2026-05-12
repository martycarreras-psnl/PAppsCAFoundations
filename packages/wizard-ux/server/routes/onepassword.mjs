// Routes for /api/1password — dynamic vault/item discovery
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STEP3_PATH = resolve(__dirname, '..', 'steps', '03-app-registration.mjs');
const step3 = await import(pathToFileURL(STEP3_PATH).href);

export default async function onepasswordRoutes(fastify, opts) {
  fastify.get('/vaults', async () => {
    const vaults = step3.listOpVaults();
    return { vaults };
  });

  fastify.get('/items', async (req) => {
    const vault = String(req.query.vault || '').trim();
    if (!vault) return { items: [] };
    const items = step3.listOpItems(vault);
    return { items };
  });
}
