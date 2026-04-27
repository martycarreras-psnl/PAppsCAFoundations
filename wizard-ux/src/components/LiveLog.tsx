import { useEffect, useRef } from 'react';
import { makeStyles, tokens, Caption1, Button, Body1Strong } from '@fluentui/react-components';
import { ArrowDownloadRegular, BroomRegular } from '@fluentui/react-icons';
import { LogLine } from '../types/schema';

const useStyles = makeStyles({
  root: {
    height: '100%',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
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
  info: { color: tokens.colorNeutralForeground3, fontStyle: 'italic' },
});

interface Props {
  lines: LogLine[];
  status: 'idle' | 'running' | 'done' | 'error';
  onClear?: () => void;
}

export function LiveLog({ lines, status, onClear }: Props) {
  const s = useStyles();
  const ref = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

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
          <span className={s.info}>No output yet. Submit the form to begin.</span>
        ) : lines.map((l, i) => (
          <span key={i} className={l.stream === 'stderr' ? s.err : undefined}>{l.text}</span>
        ))}
      </pre>
    </div>
  );
}
