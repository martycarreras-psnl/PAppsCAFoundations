import { useEffect, useRef, useState } from 'react';
import { makeStyles, tokens, Button, Caption1, Spinner } from '@fluentui/react-components';
import { DismissRegular, ArrowResetRegular } from '@fluentui/react-icons';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { ensureToken } from '../services/api';
import { accent } from '../theme/tokens';

const useStyles = makeStyles({
  shell: {
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '10px',
    overflow: 'hidden',
    backgroundColor: '#0E1620',
    boxShadow: tokens.shadow8,
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'linear-gradient(90deg, rgba(0,120,212,0.18), rgba(92,45,145,0.18))',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    color: '#E8E8EC',
  },
  dot: {
    width: '10px', height: '10px', borderRadius: '50%',
    boxShadow: '0 0 6px currentColor',
  },
  status: {
    flex: 1,
    fontSize: tokens.fontSizeBase200,
    color: '#E8E8EC',
    opacity: 0.85,
    letterSpacing: '0.02em',
  },
  body: {
    position: 'relative',
    minHeight: '320px',
    padding: '8px',
    backgroundColor: '#0E1620',
  },
  xtermHost: {
    width: '100%',
    height: '100%',
    minHeight: '300px',
  },
  overlay: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px',
    color: '#E8E8EC',
    background: 'rgba(14,22,32,0.75)',
    backdropFilter: 'blur(2px)',
  },
});

export type EmbeddedTerminalStatus = 'connecting' | 'open' | 'closed' | 'error';

interface Props {
  /** Optional command to auto-run once the shell is ready. The user can still edit/press Enter manually. */
  initialCommand?: string;
  /** Called when the WS connects, exits, or errors. Useful for the parent to know when to refresh state. */
  onStatusChange?: (status: EmbeddedTerminalStatus, info?: { exitCode?: number; signal?: number; message?: string }) => void;
  /** Called once on mount when the user wants to dismiss the terminal panel. */
  onClose?: () => void;
  /** Visual height in px (the xterm grid will fit to whatever space is available). */
  height?: number;
}

export function EmbeddedTerminal({ initialCommand, onStatusChange, onClose, height = 360 }: Props) {
  const s = useStyles();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<EmbeddedTerminalStatus>('connecting');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);

  function setStatusAnd(next: EmbeddedTerminalStatus, info?: { exitCode?: number; signal?: number; message?: string }) {
    setStatus(next);
    onStatusChange?.(next, info);
  }

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const term = new Terminal({
      fontFamily: '"SF Mono", "JetBrains Mono", "Cascadia Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
      theme: {
        background: '#0E1620',
        foreground: '#E8E8EC',
        cursor: '#0078D4',
        cursorAccent: '#0E1620',
        selectionBackground: 'rgba(0,120,212,0.35)',
        black: '#0E1620',
        brightBlack: '#5A6A7E',
        red: '#FF6B6B',
        brightRed: '#FF8B8B',
        green: '#7BD88F',
        brightGreen: '#A0E6B0',
        yellow: '#FFB900',
        brightYellow: '#FFD24F',
        blue: '#0078D4',
        brightBlue: '#4FA7EE',
        magenta: accent.purple,
        brightMagenta: accent.purpleSoft,
        cyan: accent.teal,
        brightCyan: '#3DBFAA',
        white: '#E8E8EC',
        brightWhite: '#FFFFFF',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(hostRef.current);
    setTimeout(() => { try { fit.fit(); } catch { /* ignore */ } }, 0);

    termRef.current = term;
    fitRef.current = fit;

    let ws: WebSocket | null = null;
    let cancelled = false;

    (async () => {
      try {
        const token = await ensureToken();
        if (cancelled) return;
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${proto}://${window.location.host}/ws/pty?token=${encodeURIComponent(token)}`);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.addEventListener('open', () => {
          setStatusAnd('open');
          // Send init with current dimensions and optional command
          const cols = term.cols;
          const rows = term.rows;
          ws!.send(JSON.stringify({ type: 'init', cols, rows, cmd: initialCommand }));
          term.focus();
        });

        ws.addEventListener('message', (ev) => {
          if (typeof ev.data === 'string') {
            // Control frame (JSON) from the server
            try {
              const msg = JSON.parse(ev.data);
              if (msg && msg.type === 'exit') {
                setExitCode(msg.code ?? null);
                setStatusAnd('closed', { exitCode: msg.code, signal: msg.signal });
                term.writeln('');
                term.writeln(`\u001b[90m[process exited with code ${msg.code ?? '?'}]\u001b[0m`);
              } else if (msg && msg.type === 'error') {
                setStatusAnd('error', { message: msg.message });
                term.writeln(`\u001b[31m${msg.message}\u001b[0m`);
              }
            } catch { /* ignore */ }
            return;
          }
          // Binary stdout/stderr
          term.write(new Uint8Array(ev.data as ArrayBuffer));
        });

        ws.addEventListener('close', () => {
          // Only flip to 'closed' if we were previously open. If the close
          // happened before 'open' fired, leave the existing status alone.
          setStatus((prev) => (prev === 'open' ? 'closed' : prev));
        });
        ws.addEventListener('error', () => {
          setStatusAnd('error', { message: 'WebSocket error' });
        });
      } catch (err) {
        setStatusAnd('error', { message: (err as Error).message });
        term.writeln(`\u001b[31m${(err as Error).message}\u001b[0m`);
      }
    })();

    // Pipe keystrokes to the PTY (text frames)
    const onDataDisp = term.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', data }));
      }
    });

    // Resize handling
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        const cols = term.cols;
        const rows = term.rows;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      } catch { /* ignore */ }
    });
    if (hostRef.current) ro.observe(hostRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      onDataDisp.dispose();
      try { ws?.close(); } catch { /* ignore */ }
      try { term.dispose(); } catch { /* ignore */ }
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  function reconnect() {
    setExitCode(null);
    setStatusAnd('connecting');
    setGeneration((g) => g + 1);
  }

  const dotColor =
    status === 'open' ? '#7BD88F' :
    status === 'connecting' ? '#FFB900' :
    status === 'error' ? '#FF6B6B' :
    '#5A6A7E';

  const label =
    status === 'connecting' ? 'Connecting to your shell…' :
    status === 'open' ? 'Live shell · ' + (initialCommand ?? '') :
    status === 'closed' ? `Session ended${exitCode != null ? ` · exit ${exitCode}` : ''}` :
    'Disconnected';

  return (
    <div className={s.shell} style={{ minHeight: height + 50 }}>
      <div className={s.bar}>
        <span className={s.dot} style={{ background: dotColor, color: dotColor }} />
        <Caption1 className={s.status}>{label}</Caption1>
        {status === 'closed' && (
          <Button size="small" appearance="subtle" icon={<ArrowResetRegular />} onClick={reconnect}>
            Run again
          </Button>
        )}
        {onClose && (
          <Button size="small" appearance="subtle" icon={<DismissRegular />} onClick={onClose} aria-label="Close terminal" />
        )}
      </div>
      <div className={s.body} style={{ height }}>
        <div ref={hostRef} className={s.xtermHost} />
        {status === 'connecting' && (
          <div className={s.overlay}>
            <Spinner size="tiny" />
            <span>Opening PTY…</span>
          </div>
        )}
      </div>
    </div>
  );
}
