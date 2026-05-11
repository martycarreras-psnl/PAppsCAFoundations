// wizard-ux/server/routes/pty.mjs
// WebSocket-backed PTY bridge. Spawns a real shell in the repo root so wizard
// commands like `pac auth create`, `op signin`, and `pac code push` get the
// device-code prompts, biometric prompts, and progress bars they need.
//
// Protocol:
//   - Binary frames (Buffer) from client = stdin bytes
//   - Binary frames (Buffer) from server = stdout/stderr bytes
//   - JSON text frames are control messages:
//       client -> server: { type: 'resize', cols, rows }
//                         { type: 'init',   cols, rows, cmd? }   // optional cmd auto-typed once shell is ready
//       server -> client: { type: 'exit', code, signal }
//
// Security:
//   - Connection upgrade requires `?token=<csrf>` query parameter that matches
//     the CSRF token issued by /api/handshake.
//   - Server is bound to 127.0.0.1; CORS already restricts origins.

import websocketPlugin from '@fastify/websocket';
import * as pty from 'node-pty';

export default async function ptyRoutes(app, opts) {
  const { rootDir, csrfToken } = opts;
  if (!csrfToken) throw new Error('ptyRoutes requires csrfToken');

  await app.register(websocketPlugin, {
    options: { maxPayload: 1024 * 1024 },
  });

  app.get('/ws/pty', { websocket: true }, (socket, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (token !== csrfToken) {
      app.log.warn({ ip: req.ip }, 'pty: rejected — bad token');
      try { socket.close(4401, 'unauthorized'); } catch { /* ignore */ }
      return;
    }

    const isWin = process.platform === 'win32';
    const shell = isWin
      ? (process.env.COMSPEC || 'powershell.exe')
      : (process.env.SHELL || '/bin/zsh');
    const shellArgs = isWin ? [] : ['-l'];

    let term;
    try {
      term = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: rootDir,
        env: { ...process.env, TERM: 'xterm-256color', WIZARD_UX: '1' },
      });
    } catch (err) {
      app.log.error({ err }, 'pty: spawn failed');
      try {
        socket.send(JSON.stringify({ type: 'error', message: `Failed to spawn shell: ${err.message}` }));
        socket.close(1011, 'spawn-failed');
      } catch { /* ignore */ }
      return;
    }

    app.log.info({ pid: term.pid, shell, cwd: rootDir }, 'pty: spawned');

    term.onData((data) => {
      try { socket.send(data); } catch { /* socket likely closed */ }
    });

    term.onExit(({ exitCode, signal }) => {
      try {
        socket.send(JSON.stringify({ type: 'exit', code: exitCode, signal }));
        socket.close(1000, 'exit');
      } catch { /* ignore */ }
    });

    socket.on('message', (raw, isBinary) => {
      if (isBinary) {
        try { term.write(raw); } catch { /* ignore */ }
        return;
      }
      const text = raw.toString('utf8');
      let msg;
      try { msg = JSON.parse(text); } catch {
        try { term.write(text); } catch { /* ignore */ }
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      switch (msg.type) {
        case 'init': {
          const cols = Number.isFinite(msg.cols) ? Math.max(1, msg.cols | 0) : 80;
          const rows = Number.isFinite(msg.rows) ? Math.max(1, msg.rows | 0) : 24;
          try { term.resize(cols, rows); } catch { /* ignore */ }
          if (typeof msg.cmd === 'string' && msg.cmd.trim()) {
            const cmd = msg.cmd;
            setTimeout(() => {
              try { term.write(`${cmd}\r`); } catch { /* ignore */ }
            }, 350);
          }
          break;
        }
        case 'resize': {
          const cols = Math.max(1, (msg.cols | 0) || 80);
          const rows = Math.max(1, (msg.rows | 0) || 24);
          try { term.resize(cols, rows); } catch { /* ignore */ }
          break;
        }
        case 'data': {
          if (typeof msg.data === 'string') {
            try { term.write(msg.data); } catch { /* ignore */ }
          }
          break;
        }
        default:
          break;
      }
    });

    socket.on('close', () => {
      app.log.info({ pid: term.pid }, 'pty: socket closed; killing shell');
      try { term.kill(); } catch { /* ignore */ }
    });
  });
}
