import { Link } from 'react-router-dom';
import {
  makeStyles, tokens, Body1, Title3, Caption1, Subtitle2,
  Button, Badge, Spinner, MessageBar, MessageBarBody,
} from '@fluentui/react-components';
import {
  CheckmarkCircleFilled, DocumentBulletListRegular,
  ArrowRightFilled, HomeRegular, CircleFilled, CircleRegular,
} from '@fluentui/react-icons';
import { PageHero } from '../components/PageHero';
import { useWizardState, useSteps } from '../hooks/useWizardData';
import { gradients } from '../theme/tokens';

const useStyles = makeStyles({
  root: { height: '100%', overflowY: 'auto' },
  body: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1080px',
    margin: '0 auto',
    padding: '0 32px 80px',
    display: 'grid',
    gap: '32px',
  },

  // ─── progress strip ──────────────────────────────────────────
  progressCard: {
    padding: '24px 28px',
    borderRadius: '14px',
    background: gradients.accentSoft,
    borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
    borderTopStyle: 'solid', borderRightStyle: 'solid', borderBottomStyle: 'solid', borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2, borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2, borderLeftColor: tokens.colorNeutralStroke2,
    boxShadow: tokens.shadow8,
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap',
  },
  progressText: { flex: 1, minWidth: '240px' },
  progressBar: {
    width: '100%',
    height: '6px',
    borderRadius: '999px',
    background: tokens.colorNeutralBackground3,
    overflow: 'hidden',
    marginTop: '12px',
  },
  progressFill: {
    height: '100%',
    background: gradients.accent,
    transition: 'width 280ms ease',
  },

  // ─── section headers (matches Welcome) ──────────────────────
  sectionLabel: {
    display: 'block',
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase200,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    marginBottom: '6px',
  },
  sectionTitle: {
    margin: 0,
    letterSpacing: '-0.01em',
  },

  // ─── grid of info cards ─────────────────────────────────────
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
  },
  card: {
    padding: '20px',
    borderRadius: '12px',
    background: tokens.colorNeutralBackground1,
    borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
    borderTopStyle: 'solid', borderRightStyle: 'solid', borderBottomStyle: 'solid', borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2, borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2, borderLeftColor: tokens.colorNeutralStroke2,
    transition: 'transform 220ms cubic-bezier(0.1,0.9,0.2,1), box-shadow 220ms',
    ':hover': { transform: 'translateY(-2px)', boxShadow: tokens.shadow8 },
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  cardIcon: {
    width: '32px', height: '32px',
    borderRadius: '8px',
    display: 'grid', placeItems: 'center',
    background: gradients.accent,
    color: '#ffffff',
    fontSize: '16px',
    flexShrink: 0,
  },
  field: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '12px',
    paddingTop: '8px', paddingBottom: '8px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke3,
    ':last-child': { borderBottomColor: 'transparent' },
  },
  fieldLabel: { color: tokens.colorNeutralForeground3, fontWeight: 500 },
  fieldVal: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground1,
    textAlign: 'right',
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  fieldEmpty: { color: tokens.colorNeutralForeground4, fontStyle: 'italic', fontFamily: tokens.fontFamilyBase },

  // ─── progress detail ────────────────────────────────────────
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingTop: '8px', paddingBottom: '8px',
  },
  stepIconDone: { color: tokens.colorPaletteGreenForeground1, fontSize: '18px' },
  stepIconCurrent: { color: tokens.colorBrandForeground1, fontSize: '12px' },
  stepIconPending: { color: tokens.colorNeutralForeground4, fontSize: '14px' },

  // ─── footer actions ─────────────────────────────────────────
  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  ctaPrimary: {
    background: gradients.accent,
    color: '#ffffff',
    borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
    boxShadow: tokens.shadow8,
    minWidth: '200px',
    height: '44px',
    fontWeight: 600,
  },
  launchCard: {
    padding: '22px 24px',
    borderRadius: '14px',
    background: 'linear-gradient(145deg, rgba(16,124,16,0.12), rgba(0,120,212,0.1))',
    borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
    borderTopStyle: 'solid', borderRightStyle: 'solid', borderBottomStyle: 'solid', borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2, borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2, borderLeftColor: tokens.colorNeutralStroke2,
    boxShadow: tokens.shadow8,
    display: 'grid',
    gap: '14px',
  },
  launchTitle: {
    margin: 0,
    color: tokens.colorNeutralForeground1,
    letterSpacing: '-0.01em',
  },
  launchUrl: {
    display: 'block',
    padding: '12px 14px',
    borderRadius: '10px',
    textDecorationLine: 'none',
    fontFamily: tokens.fontFamilyMonospace,
    background: tokens.colorNeutralBackground1,
    borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
    borderTopStyle: 'solid', borderRightStyle: 'solid', borderBottomStyle: 'solid', borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2, borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2, borderLeftColor: tokens.colorNeutralStroke2,
    color: tokens.colorBrandForeground1,
    overflowWrap: 'anywhere',
    ':hover': { textDecorationLine: 'underline' },
  },
  launchActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  launchBtn: {
    background: gradients.accent,
    color: '#ffffff',
    borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0,
    boxShadow: tokens.shadow8,
    minWidth: '220px',
    height: '44px',
    fontWeight: 700,
  },
});

function Field({ label, value }: { label: string; value?: string }) {
  const s = useStyles();
  const empty = !value || value.trim() === '';
  return (
    <div className={s.field}>
      <Caption1 className={s.fieldLabel}>{label}</Caption1>
      <Caption1 className={empty ? `${s.fieldVal} ${s.fieldEmpty}` : s.fieldVal}>
        {empty ? 'not set' : value}
      </Caption1>
    </div>
  );
}

export function Summary() {
  const s = useStyles();
  const stateQ = useWizardState();
  const stepsQ = useSteps();
  const st = (stateQ.data?.state ?? {}) as Record<string, string>;

  const completed = stateQ.data?.completed ?? 0;
  const total = stateQ.data?.totalSteps ?? 9;
  const next = stateQ.data?.next ?? 1;
  const percent = Math.round((completed / Math.max(1, total)) * 100);
  const isDone = completed >= total;
  const launchUrl = stateQ.data?.powerApp?.launchUrl || '';
  const launchTarget = stateQ.data?.powerApp?.targetEnv || st.WIZARD_TARGET_ENV || 'dev';

  return (
    <div className={s.root}>
      <PageHero
        eyebrowIcon={<DocumentBulletListRegular />}
        eyebrow="Project Summary"
        title="Everything captured for this project"
        subtitle="Live values from .wizard-state.json — the single source of truth for how your Code App is wired together."
      />

      <div className={s.body}>
        {/* Progress overview */}
        <div className={s.progressCard}>
          <div className={s.progressText}>
            <Subtitle2 style={{ display: 'block', color: tokens.colorBrandForeground1, marginBottom: '4px' }}>
              {isDone ? 'Setup complete' : 'In progress'}
            </Subtitle2>
            <Title3 style={{ margin: 0 }}>
              {completed} of {total} steps complete · {percent}%
            </Title3>
            <div className={s.progressBar} aria-hidden>
              <div className={s.progressFill} style={{ width: `${percent}%` }} />
            </div>
          </div>
          {!isDone && (
            <Link to={`/step/${next}`}>
              <Button className={s.ctaPrimary} size="large" iconPosition="after" icon={<ArrowRightFilled />}>
                Continue setup
              </Button>
            </Link>
          )}
          {isDone && launchUrl && (
            <Button
              className={s.ctaPrimary}
              size="large"
              as="a"
              href={launchUrl}
              target="_blank"
              rel="noopener noreferrer"
              iconPosition="after"
              icon={<ArrowRightFilled />}
            >
              Open Power App
            </Button>
          )}
        </div>

        {isDone && (
          <section>
            <span className={s.sectionLabel}>Launch</span>
            <Title3 as="h2" className={s.sectionTitle}>You did it. Your app is ready to launch.</Title3>
            <div className={s.launchCard} style={{ marginTop: '16px' }}>
              {launchUrl ? (
                <>
                  <Subtitle2 className={s.launchTitle}>Power Apps URL ({String(launchTarget).toUpperCase()})</Subtitle2>
                  <a
                    className={s.launchUrl}
                    href={launchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {launchUrl}
                  </a>
                  <div className={s.launchActions}>
                    <Button
                      className={s.launchBtn}
                      as="a"
                      href={launchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      iconPosition="after"
                      icon={<ArrowRightFilled />}
                    >
                      Launch App Now
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Subtitle2 className={s.launchTitle}>Power Apps URL not available yet</Subtitle2>
                  <Caption1>
                    Complete Step 9 with "Push to Power Platform" enabled to generate and surface your launch URL here.
                  </Caption1>
                </>
              )}
            </div>
          </section>
        )}

        {/* Project values grid */}
        <section>
          <span className={s.sectionLabel}>Project values</span>
          <Title3 as="h2" className={s.sectionTitle}>What the wizard knows about your app</Title3>

          <div className={s.grid} style={{ marginTop: '20px' }}>
            <div className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.cardIcon}><DocumentBulletListRegular /></div>
                <Subtitle2>Project</Subtitle2>
              </div>
              <Field label="App name" value={st.APP_NAME} />
              <Field label="Project dir" value={st.PROJECT_DIR} />
            </div>

            <div className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.cardIcon}><DocumentBulletListRegular /></div>
                <Subtitle2>Environments</Subtitle2>
              </div>
              <Field label="Dev" value={st.PP_ENV_DEV} />
              <Field label="Test" value={st.PP_ENV_TEST} />
              <Field label="Prod" value={st.PP_ENV_PROD} />
              <Field label="Active target" value={st.WIZARD_TARGET_ENV} />
            </div>

            <div className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.cardIcon}><DocumentBulletListRegular /></div>
                <Subtitle2>Identity</Subtitle2>
              </div>
              <Field label="Auth method" value={st.AUTH_PROFILE_TYPE === 'spn' ? 'Service Principal' : 'User credentials'} />
              {st.AUTH_PROFILE_TYPE === 'spn' && <Field label="Tenant ID" value={st.PP_TENANT_ID} />}
              {st.AUTH_PROFILE_TYPE === 'spn' && <Field label="App ID" value={st.PP_APP_ID} />}
              {st.AUTH_PROFILE_TYPE === 'spn' && <Field label="Credential storage" value={st.AUTH_MODE} />}
            </div>

            <div className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.cardIcon}><DocumentBulletListRegular /></div>
                <Subtitle2>Publisher</Subtitle2>
              </div>
              <Field label="Display name" value={st.PUBLISHER_DISPLAY_NAME} />
              <Field label="Prefix" value={st.PUBLISHER_PREFIX} />
              <Field label="Choice value prefix" value={st.CHOICE_VALUE_PREFIX} />
            </div>

            <div className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.cardIcon}><DocumentBulletListRegular /></div>
                <Subtitle2>Solution</Subtitle2>
              </div>
              <Field label="Display name" value={st.SOLUTION_DISPLAY_NAME} />
              <Field label="Unique name" value={st.SOLUTION_UNIQUE_NAME} />
            </div>
          </div>
        </section>

        {/* Step-by-step progress detail */}
        <section>
          <span className={s.sectionLabel}>Step-by-step</span>
          <Title3 as="h2" className={s.sectionTitle}>Where each step stands</Title3>

          <div className={s.card} style={{ marginTop: '20px' }}>
            {!stepsQ.data && <Spinner size="small" />}
            {stepsQ.data?.steps.map((step) => (
              <div key={step.number} className={s.stepRow}>
                {step.status === 'done' && <CheckmarkCircleFilled className={s.stepIconDone} />}
                {step.status === 'current' && <CircleFilled className={s.stepIconCurrent} />}
                {step.status === 'pending' && <CircleRegular className={s.stepIconPending} />}
                <Body1 style={{ flex: 1 }}>
                  <span style={{ color: tokens.colorNeutralForeground3, marginRight: '8px' }}>
                    {String(step.number).padStart(2, '0')}
                  </span>
                  {step.title}
                </Body1>
                {step.status === 'done' && (
                  <Badge appearance="filled" color="success" size="small">Done</Badge>
                )}
                {step.status === 'current' && (
                  <Badge appearance="filled" color="brand" size="small">Up next</Badge>
                )}
              </div>
            ))}
          </div>
        </section>

        {!stateQ.data && (
          <MessageBar intent="info">
            <MessageBarBody>Loading state…</MessageBarBody>
          </MessageBar>
        )}

        <div className={s.actions}>
          <Link to="/"><Button appearance="subtle" icon={<HomeRegular />}>Home</Button></Link>
          {!isDone && (
            <Link to={`/step/${next}`}>
              <Button className={s.ctaPrimary} iconPosition="after" icon={<ArrowRightFilled />}>
                Continue setup
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
