import { MessageBar, MessageBarBody, Button, makeStyles, tokens, Caption1 } from '@fluentui/react-components';
import { CopyRegular, BotRegular } from '@fluentui/react-icons';
import { useState } from 'react';
import { getAgentHelp } from '../lib/agentHelp';

const useStyles = makeStyles({
  body: { display: 'flex', flexDirection: 'column', gap: '8px' },
  promptRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    padding: '8px 10px',
    borderRadius: '6px',
    background: tokens.colorNeutralBackground3,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
  },
  promptText: {
    flex: 1,
    fontFamily: 'var(--monospace-font-family, ui-monospace, monospace)',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    lineHeight: 1.4,
  },
  copied: { color: tokens.colorPaletteGreenForeground1, fontWeight: 600 },
});

export type Variant = 'proactive' | 'error' | 'warning';

export function AgentHelpBanner({
  stepNumber,
  variant,
}: {
  stepNumber: number;
  variant: Variant;
}) {
  const s = useStyles();
  const [copied, setCopied] = useState(false);
  const help = getAgentHelp(stepNumber);
  if (!help) return null;

  const intent = variant === 'error' ? 'error' : variant === 'warning' ? 'warning' : 'info';
  const lead =
    variant === 'error'
      ? 'This step hit an error — your coding agent can help.'
      : variant === 'warning'
        ? 'This step finished with warnings — your coding agent can help triage them.'
        : help.title;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(help.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no-op — clipboard not available */
    }
  };

  return (
    <MessageBar intent={intent} icon={<BotRegular />}>
      <MessageBarBody>
        <div className={s.body}>
          <div>
            <strong>{lead}</strong> {help.what}
          </div>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            Paste this back to your coding agent:
          </Caption1>
          <div className={s.promptRow}>
            <span className={s.promptText}>{help.prompt}</span>
            <Button
              size="small"
              appearance="subtle"
              icon={<CopyRegular />}
              onClick={copy}
              aria-label="Copy prompt to clipboard"
            >
              {copied ? <span className={s.copied}>Copied</span> : 'Copy'}
            </Button>
          </div>
        </div>
      </MessageBarBody>
    </MessageBar>
  );
}
