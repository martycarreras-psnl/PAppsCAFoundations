import { useEffect, useMemo, useRef, useState } from 'react';
import { makeStyles, tokens, Caption1, Button, Body1Strong } from '@fluentui/react-components';
import { ArrowDownloadRegular, BroomRegular } from '@fluentui/react-icons';
import { LogLine } from '../types/schema';

const useStyles = makeStyles({
  root: {
    height: '100%',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '10px',
    overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground4,
  },
  spacer: { flex: 1 },
  output: {
    margin: 0,
    padding: '12px 16px',
    overflowY: 'auto',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  err: { color: tokens.colorPaletteRedForeground1 },
  warn: { color: tokens.colorPaletteYellowForeground1 },
  info: { color: tokens.colorNeutralForeground3, fontStyle: 'italic' },
  footer: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground3,
    minHeight: '28px',
  },
  footerIdle: { color: tokens.colorPaletteDarkOrangeForeground1 },
});

interface Props {
  lines: LogLine[];
  status: 'idle' | 'running' | 'done' | 'error';
  onClear?: () => void;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function LiveLog({ lines, status, onClear }: Props) {
  const s = useStyles();
  const ref = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  // ── Elapsed-time footer + 20s idle detector ──
  // The footer ticks while status === 'running' so users can see that work
  // is still happening even when an inner command (e.g. `npm install`) goes
  // quiet because npm suppresses progress in non-TTY mode. After 20s of no
  // new log lines, the footer text flips to a muted "Still working…" hint.
  const lineCount = lines.length;
  const lastLineText = lines[lineCount - 1]?.text ?? '';
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastLineAt, setLastLineAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  // Reset the run timer whenever status transitions into 'running'.
  useEffect(() => {
    if (status === 'running') {
      setStartedAt((prev) => prev ?? Date.now());
      setLastLineAt(Date.now());
    } else {
      setStartedAt(null);
    }
  }, [status]);

  // Reset the idle detector each time a new log line arrives.
  useEffect(() => {
    if (status !== 'running') return;
    setLastLineAt(Date.now());
  }, [lineCount, lastLineText, status]);

  // Tick the displayed clock at 1Hz while running.
  useEffect(() => {
    if (status !== 'running') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const footer = useMemo(() => {
    if (status !== 'running' || startedAt === null) return null;
    const elapsed = now - startedAt;
    const idleMs = now - lastLineAt;
    const idle = idleMs > 20_000;
    const label = idle
      ? `Still working — waiting on npm / network… (running for ${formatElapsed(elapsed)})`
      : `Running for ${formatElapsed(elapsed)}`;
    return { label, idle };
  }, [status, startedAt, now, lastLineAt]);

  function download() {
    const text = lines.map((l) => l.text).join('');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wizardux-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <Body1Strong>Live output</Body1Strong>
        <Caption1 style={{ color: status === 'error' ? tokens.colorPaletteRedForeground1
          : status === 'done' ? tokens.colorPaletteGreenForeground1
          : tokens.colorNeutralForeground3 }}>
          {status === 'idle' ? 'Idle' : status === 'running' ? 'Running…' : status === 'done' ? 'Complete' : 'Failed'}
        </Caption1>
        <div className={s.spacer} />
        <Button appearance="subtle" size="small" icon={<ArrowDownloadRegular />} onClick={download} disabled={lines.length === 0}>
          Save
        </Button>
        {onClear && (
          <Button appearance="subtle" size="small" icon={<BroomRegular />} onClick={onClear} disabled={lines.length === 0}>
            Clear
          </Button>
        )}
      </div>
      <pre ref={ref} className={s.output} aria-live="polite">
        {lines.length === 0 ? (
          <span className={s.info}>No output yet. Save the form to begin.</span>
        ) : lines.map((l, i) => {
          // Color by intent, not the OS pipe: benign subprocess stderr (git,
          // npm, vitest, pac progress) stays neutral; only wizard warn/fail
          // lines are highlighted. Falls back to stream for older buffered
          // lines that predate the `level` field.
          const cls = l.level === 'error' ? s.err
            : l.level === 'warn' ? s.warn
            : l.level === 'info' ? undefined
            : (l.stream === 'stderr' ? s.err : undefined);
          return <span key={i} className={cls}>{l.text}</span>;
        })}
      </pre>
      {footer && (
        <div className={`${s.footer}${footer.idle ? ` ${s.footerIdle}` : ''}`} aria-live="polite">
          <Caption1 style={{ color: 'inherit' }}>{footer.label}</Caption1>
        </div>
      )}
    </div>
  );
}
