// wizard-ux/server/index.mjs — Fastify server bridging WizardUX UI to wizard internals.
// Binds to 127.0.0.1 only. Single CSRF token issued at startup; required on mutating routes.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

import stateRoutes from './routes/state.mjs';
import systemRoutes from './routes/system.mjs';
import stepsRoutes from './routes/steps.mjs';
import streamRoutes from './routes/stream.mjs';
import ptyRoutes from './routes/pty.mjs';
import onepasswordRoutes from './routes/onepassword.mjs';
import { detectCloudSync, cloudSyncWarning } from '../../wizard/lib/cloud-sync-detect.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UX_DIR = resolve(__dirname, '..');
// ROOT_DIR must be the user's project directory (where .wizard-state.json is written
// and from which pac/npm commands run). Under `npx`, __dirname resolves into the npx
// cache — using it as the working directory would share state across all projects on
// the machine. process.cwd() is always the directory the user launched the wizard from.
const ROOT_DIR = process.cwd();

const HOST = '127.0.0.1';
const PORT = Number(process.env.WIZARD_UX_PORT || 5174);
// When installed as a published package, dist/ is always shipped and vite is
// not a runtime dep. Only treat this as "dev mode" when the caller opts in.
const IS_DEV = process.env.NODE_ENV === 'development' || process.env.WIZARD_UX_DEV === '1';

const CSRF_TOKEN = randomBytes(24).toString('hex');

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
});

await app.register(cors, {
  origin: (origin, cb) => {
    // Same-origin requests have no Origin header; accept those.
    // Otherwise only accept the well-known localhost origins.
    if (!origin) return cb(null, true);
    if (origin === `http://${HOST}:${PORT}` || origin === `http://localhost:${PORT}`) return cb(null, true);
    if (IS_DEV && (origin === `http://${HOST}:5175` || origin === 'http://localhost:5175')) return cb(null, true);
    cb(new Error('Origin not allowed'), false);
  },
  credentials: true,
});

// Expose the CSRF token to the UI on a single endpoint. UI stores it in memory and
// echoes it on mutating calls. Token rotates per server start.
app.get('/api/handshake', async () => {
  const cloud = detectCloudSync(ROOT_DIR);
  return {
    csrfToken: CSRF_TOKEN,
    rootDir: ROOT_DIR,
    startedAt: new Date().toISOString(),
    cloudSync: cloud ? { detected: true, provider: cloud.provider } : { detected: false },
  };
});

// Guard mutating routes
app.addHook('onRequest', async (req, reply) => {
  if (!req.url.startsWith('/api/')) return;
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
  if (req.url === '/api/handshake') return;
  const token = req.headers['x-wizard-token'];
  if (token !== CSRF_TOKEN) {
    reply.code(403).send({ error: 'Invalid or missing CSRF token' });
  }
});

// Activity tracker for auto-shutdown (10 min idle)
let lastActivity = Date.now();
app.addHook('onRequest', async (req) => {
  if (req.url.startsWith('/api/')) lastActivity = Date.now();
});

// Routes
await app.register(stateRoutes, { prefix: '/api/state', rootDir: ROOT_DIR });
await app.register(systemRoutes, { prefix: '/api/system', rootDir: ROOT_DIR });
await app.register(stepsRoutes, { prefix: '/api/steps', rootDir: ROOT_DIR });
await app.register(streamRoutes, { prefix: '/api/steps', rootDir: ROOT_DIR });
await app.register(ptyRoutes, { rootDir: ROOT_DIR, csrfToken: CSRF_TOKEN });
await app.register(onepasswordRoutes, { prefix: '/api/1password' });

// Serve the UI — prebuilt dist/ by default; vite middleware only in dev mode
const distDir = join(UX_DIR, 'dist');
const haveDist = existsSync(distDir);

if (!IS_DEV && haveDist) {
  const fastifyStatic = (await import('@fastify/static')).default;
  await app.register(fastifyStatic, { root: distDir, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
    // SPA fallback
    reply.sendFile('index.html');
  });
} else if (IS_DEV) {
  let createViteServer;
  try {
    ({ createServer: createViteServer } = await import('vite'));
  } catch (err) {
    app.log.error('Dev mode requested (NODE_ENV=development or WIZARD_UX_DEV=1) but `vite` is not installed. Install it as a devDependency or run without WIZARD_UX_DEV.');
    throw err;
  }
  const vite = await createViteServer({
    root: UX_DIR,
    server: { middlewareMode: true, hmr: { port: 5176 } },
    appType: 'custom',
  });
  // Mount Vite's connect-style middleware
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/ws/')) return;
    return new Promise((resolveP) => {
      vite.middlewares(req.raw, reply.raw, () => resolveP());
      reply.raw.on('finish', () => resolveP());
    });
  });
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/ws/')) return reply.code(404).send({ error: 'Not found' });
    try {
      const indexHtml = readFileSync(join(UX_DIR, 'index.html'), 'utf-8');
      const html = await vite.transformIndexHtml(req.url, indexHtml);
      reply.type('text/html').send(html);
    } catch (e) {
      reply.code(500).send(String(e));
    }
  });
} else {
  app.log.error(`No prebuilt UI found at ${distDir} and dev mode is not enabled. Reinstall @pacaf/wizard-ux or set WIZARD_UX_DEV=1.`);
  throw new Error('wizard-ux/dist missing');
}

await app.listen({ host: HOST, port: PORT });

// Cloud-sync warning surfaced in the server console at startup. The UI also
// reads /api/handshake -> cloudSync to render an in-browser MessageBar.
{
  const cloud = detectCloudSync(ROOT_DIR);
  if (cloud) {
    console.log(cloudSyncWarning(cloud.provider, ROOT_DIR));
  }
}

const url = `http://${HOST}:${PORT}`;
console.log('');
console.log('  ╭─────────────────────────────────────────────╮');
console.log('  │  WizardUX is running                        │');
console.log(`  │  ${url.padEnd(43)}│`);
console.log('  ╰─────────────────────────────────────────────╯');
console.log('');

if (process.env.WIZARD_UX_OPEN !== '0') {
  // Best-effort browser open
  const opener = process.platform === 'win32'
    ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
  opener.on('error', () => { /* best effort */ });
  opener.unref();
}

// Idle auto-shutdown
const IDLE_MS = 10 * 60 * 1000;
setInterval(() => {
  if (Date.now() - lastActivity > IDLE_MS) {
    app.log.info('Idle for 10 minutes — shutting down.');
    app.close().then(() => process.exit(0));
  }
}, 60_000).unref();
