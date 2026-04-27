import { Link } from 'react-router-dom';
import {
  makeStyles, tokens, Title2, Body1, Caption1, Card, CardHeader,
  Button, Badge, Body1Strong,
} from '@fluentui/react-components';
import { CheckmarkCircleFilled } from '@fluentui/react-icons';
import { useWizardState, useSteps } from '../hooks/useWizardData';

const useStyles = makeStyles({
  root: { height: '100%', overflowY: 'auto', padding: '32px', maxWidth: '960px', margin: '0 auto' },
  hero: { marginBottom: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' },
  field: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  fieldLabel: { color: tokens.colorNeutralForeground3 },
  fieldVal: { fontFamily: tokens.fontFamilyMonospace, color: tokens.colorNeutralForeground1, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' },
  stepRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' },
});

function Field({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <div className={s.field}>
      <Caption1 className={s.fieldLabel}>{label}</Caption1>
      <Caption1 className={s.fieldVal}>{value || '—'}</Caption1>
    </div>
  );
}

export function Summary() {
  const s = useStyles();
  const stateQ = useWizardState();
  const stepsQ = useSteps();
  const st = (stateQ.data?.state ?? {}) as Record<string, string>;

  return (
    <div className={s.root}>
      <div className={s.hero}>
        <Title2>Project Summary</Title2>
        <Body1 style={{ color: tokens.colorNeutralForeground2 }}>
          Everything WizardUX has captured for this project so far. Live values from `.wizard-state.json`.
        </Body1>
      </div>

      <div className={s.grid}>
        <Card>
          <CardHeader header={<Body1Strong>Project</Body1Strong>} />
          <Field label="App name" value={st.APP_NAME || ''} />
          <Field label="Project dir" value={st.PROJECT_DIR || ''} />
        </Card>

        <Card>
          <CardHeader header={<Body1Strong>Environments</Body1Strong>} />
          <Field label="Dev" value={st.PP_ENV_DEV || ''} />
          <Field label="Test" value={st.PP_ENV_TEST || ''} />
          <Field label="Prod" value={st.PP_ENV_PROD || ''} />
          <Field label="Active target" value={st.WIZARD_TARGET_ENV || ''} />
        </Card>

        <Card>
          <CardHeader header={<Body1Strong>Identity</Body1Strong>} />
          <Field label="Tenant ID" value={st.PP_TENANT_ID || ''} />
          <Field label="App ID" value={st.PP_APP_ID || ''} />
          <Field label="Auth mode" value={st.AUTH_MODE || ''} />
        </Card>

        <Card>
          <CardHeader header={<Body1Strong>Publisher</Body1Strong>} />
          <Field label="Display name" value={st.PUBLISHER_DISPLAY_NAME || ''} />
          <Field label="Prefix" value={st.PUBLISHER_PREFIX || ''} />
          <Field label="Choice value prefix" value={st.CHOICE_VALUE_PREFIX || ''} />
        </Card>

        <Card>
          <CardHeader header={<Body1Strong>Solution</Body1Strong>} />
          <Field label="Display name" value={st.SOLUTION_DISPLAY_NAME || ''} />
          <Field label="Unique name" value={st.SOLUTION_UNIQUE_NAME || ''} />
        </Card>

        <Card>
          <CardHeader header={<Body1Strong>Progress</Body1Strong>} />
          {stepsQ.data?.steps.map((step) => (
            <div key={step.number} className={s.stepRow}>
              {step.status === 'done'
                ? <CheckmarkCircleFilled style={{ color: tokens.colorPaletteGreenForeground1 }} />
                : <Badge appearance="outline" size="small">{step.number}</Badge>}
              <Body1 style={{ flex: 1 }}>{step.title}</Body1>
              {step.status === 'done' && <Caption1 style={{ color: tokens.colorPaletteGreenForeground1 }}>Done</Caption1>}
              {step.status === 'current' && <Caption1 style={{ color: tokens.colorBrandForeground1 }}>Up next</Caption1>}
            </div>
          ))}
        </Card>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '8px' }}>
        <Link to="/"><Button appearance="secondary">Home</Button></Link>
        <Link to={`/step/${stateQ.data?.next ?? 1}`}><Button appearance="primary">Continue setup</Button></Link>
      </div>
    </div>
  );
}
