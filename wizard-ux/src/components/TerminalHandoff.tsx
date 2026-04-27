import {
  makeStyles, tokens, MessageBar, MessageBarBody, MessageBarTitle, Body1, Button,
} from '@fluentui/react-components';
import { CopyRegular, CheckmarkCircleRegular, OpenRegular } from '@fluentui/react-icons';
import { useState } from 'react';

const useStyles = makeStyles({
  card: {
    border: `1px dashed ${tokens.colorBrandStroke1}`,
    borderRadius: '10px',
    padding: '16px',
    backgroundColor: tokens.colorBrandBackground2,
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
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
});

interface Props {
  command: string;
  explanation: string;
}

export function TerminalHandoff({ command, explanation }: Props) {
  const s = useStyles();
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={s.card}>
      <MessageBar intent="info" layout="multiline">
        <MessageBarBody>
          <MessageBarTitle>This step runs in your terminal</MessageBarTitle>
          <Body1 style={{ whiteSpace: 'pre-wrap' }}>{explanation}</Body1>
        </MessageBarBody>
      </MessageBar>
      <div className={s.cmd}>{command}</div>
      <div className={s.row}>
        <Button appearance="primary" icon={copied ? <CheckmarkCircleRegular /> : <CopyRegular />} onClick={copy}>
          {copied ? 'Copied!' : 'Copy command'}
        </Button>
        <Button
          appearance="secondary"
          icon={<OpenRegular />}
          onClick={() => alert('Open a terminal in your repo root and paste the command.')}
        >
          How do I open a terminal?
        </Button>
      </div>
    </div>
  );
}
