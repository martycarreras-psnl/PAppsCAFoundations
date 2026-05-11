#!/usr/bin/env node
// pacaf-wizard-ux — boots the Fastify server which serves the wizard UX.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, '..', 'server', 'index.mjs');

const child = spawn(process.execPath, [serverEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
