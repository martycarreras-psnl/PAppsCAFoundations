import {
  makeStyles, tokens, MessageBar, MessageBarBody, MessageBarTitle, Body1, Button, Caption1,
} from '@fluentui/react-components';
import { CopyRegular, CheckmarkCircleRegular, PlayRegular } from '@fluentui/react-icons';
import { useState } from 'react';
import { gradients } from '../theme/tokens';
import { EmbeddedTerminal, EmbeddedTerminalStatus } from './EmbeddedTerminal';

const useStyles = makeStyles({
  card: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
    padding: '16px',
    background: gradients.accentSoft,
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  cmd: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    background: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
    padding: '8px 12px',
    color: tokens.colorBrandForeground1,
    userSelect: 'all',
    overflowX: 'auto',
  },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
  hint: { color: tokens.colorNeutralForeground3 },
});

interface Props {
  command: string;
  explanation: string;
  /** Optional callback when the embedded terminal session ends (success or otherwise). */
  onSessionEnd?: (info: { exitCode?: number; signal?: number }) => void;
}

export function TerminalHandoff({ command, explanation, onSessionEnd }: Props) {
  const s = useStyles();
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);

  function copy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleStatus(status: EmbeddedTerminalStatus, info?: { exitCode?: number; signal?: number; message?: string }) {
    if (status === 'closed' || status === 'error') {
      onSessionEnd?.({ exitCode: info?.exitCode, signal: info?.signal });
    }
  }

  return (
    <div className={s.card}>
      <MessageBar intent="info" layout="multiline">
        <MessageBarBody>
          <MessageBarTitle>This step runs in a real shell</MessageBarTitle>
          <Body1 style={{ whiteSpace: 'pre-wrap' }}>{explanation}</Body1>
        </MessageBarBody>
      </MessageBar>
      <div className={s.cmd}>{command}</div>

      {!running && (
        <div className={s.row}>
          <Button appearance="primary" icon={<PlayRegular />} onClick={() => setRunning(true)}>
            Run here
          </Button>
          <Button appearance="secondary" icon={copied ? <CheckmarkCircleRegular /> : <CopyRegular />} onClick={copy}>
            {copied ? 'Copied!' : 'Copy command'}
          </Button>
          <Caption1 className={s.hint}>
            Run here opens a real terminal inside this page (zsh / pwsh) — device-code prompts, biometric prompts, and live output all work.
          </Caption1>
        </div>
      )}

      {running && (
        <EmbeddedTerminal
          initialCommand={command}
          onStatusChange={handleStatus}
          onClose={() => setRunning(false)}
        />
      )}
    </div>
  );
}
