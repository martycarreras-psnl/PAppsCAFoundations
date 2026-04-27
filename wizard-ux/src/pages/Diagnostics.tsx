import { makeStyles, tokens, Title2, Body1, Caption1, Card, CardHeader, Body1Strong, Badge } from '@fluentui/react-components';
import { useSystem, useWizardState } from '../hooks/useWizardData';

const useStyles = makeStyles({
  root: { height: '100%', overflowY: 'auto', padding: '32px', maxWidth: '960px', margin: '0 auto' },
  pre: { margin: 0, padding: '12px', background: tokens.colorNeutralBackground3, borderRadius: '8px', overflowX: 'auto', fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
});

export function Diagnostics() {
  const s = useStyles();
  const sysQ = useSystem();
  const stateQ = useWizardState();

  return (
    <div className={s.root}>
      <Title2>Diagnostics</Title2>
      <Body1 style={{ color: tokens.colorNeutralForeground2, marginBottom: '24px' }}>
        Read-only view of system tooling and the raw `.wizard-state.json`.
      </Body1>

      <Card style={{ marginBottom: '16px' }}>
        <CardHeader header={<Body1Strong>System</Body1Strong>} />
        {sysQ.data && (
          <>
            <div className={s.row}><Caption1>OS</Caption1><Caption1>{sysQ.data.os.platform} {sysQ.data.os.release}</Caption1></div>
            <div className={s.row}><Caption1>Node</Caption1><Caption1>{sysQ.data.node}</Caption1></div>
            <div className={s.row}><Caption1>Git</Caption1><Caption1>{sysQ.data.git || '—'}</Caption1></div>
            <div className={s.row}><Caption1>.NET SDK</Caption1><Caption1>{sysQ.data.dotnet || '—'}</Caption1></div>
            <div className={s.row}><Caption1>PAC CLI</Caption1><Caption1>{sysQ.data.pac || '—'}</Caption1></div>
            <div className={s.row}><Caption1>1Password CLI</Caption1>
              <Badge appearance="filled" color={sysQ.data.op ? 'success' : 'subtle'}>{sysQ.data.op ? 'available' : 'not installed'}</Badge>
            </div>
            <div className={s.row}><Caption1>Branch</Caption1><Caption1>{sysQ.data.branch || '—'}</Caption1></div>
            <div className={s.row}><Caption1>Repo clean?</Caption1>
              <Badge appearance="filled" color={sysQ.data.repoIsClean ? 'success' : 'warning'}>{sysQ.data.repoIsClean ? 'clean' : 'has changes'}</Badge>
            </div>
            <div className={s.row}><Caption1>Root</Caption1><Caption1>{sysQ.data.rootDir}</Caption1></div>
          </>
        )}
      </Card>

      <Card>
        <CardHeader header={<Body1Strong>State (.wizard-state.json)</Body1Strong>} />
        <pre className={s.pre}>{JSON.stringify(stateQ.data?.state ?? {}, null, 2)}</pre>
      </Card>
    </div>
  );
}
