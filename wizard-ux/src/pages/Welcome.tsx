import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles, tokens, Body1, Title2, Subtitle2,
  Button, Spinner, Badge, MessageBar, MessageBarBody, MessageBarTitle,
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent,
} from '@fluentui/react-components';
import {
  ArrowRightFilled, ArrowResetRegular, RocketRegular, BookGlobeRegular,
  CheckmarkCircleFilled, CircleRegular, ArrowRightRegular,
} from '@fluentui/react-icons';
import { HeroBackground } from '../components/HeroBackground';
import { useSteps, useSystem, useWizardState } from '../hooks/useWizardData';
import { api } from '../services/api';
import { gradients } from '../theme/tokens';

const useStyles = makeStyles({
  root: {
    position: 'relative',
    height: '100%',
    overflowY: 'auto',
  },

  // ─── HERO ─────────────────────────────────────────────────────
  hero: {
    position: 'relative',
    minHeight: '340px',
    display: 'grid',
    placeItems: 'center',
    padding: '64px 32px 40px',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    maxWidth: '660px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '999px',
    background: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    fontSize: tokens.fontSizeBase200,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: tokens.colorBrandForeground1,
    alignSelf: 'center',
  },
  title: {
    margin: 0,
    background: gradients.accent,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.02em',
    fontSize: 'clamp(32px, 4.5vw, 48px)',
    lineHeight: 1.1,
    fontWeight: 700,
    width: '100%',
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
    lineHeight: 1.55,
    maxWidth: '520px',
  },

  // ─── BODY ─────────────────────────────────────────────────────
  body: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '720px',
    margin: '0 auto',
    padding: '0 32px 60px',
    display: 'grid',
    gap: '32px',
  },

  // ─── PRIMARY CTA ──────────────────────────────────────────────
  ctaCard: {
    position: 'relative',
    padding: '28px 32px',
    borderRadius: '16px',
    background: gradients.accentSoft,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow16,
    overflow: 'hidden',
  },
  ctaInner: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap',
  },
  ctaText: { flex: 1, minWidth: '220px' },
  ctaActions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  ctaPrimary: {
    background: gradients.accent,
    color: '#ffffff',
    border: 'none',
    boxShadow: tokens.shadow8,
    minWidth: '180px',
    height: '44px',
    fontSize: tokens.fontSizeBase400,
    fontWeight: 600,
  },
  ctaTrack: {
    width: '100%',
    height: '6px',
    borderRadius: '999px',
    background: tokens.colorNeutralBackground3,
    overflow: 'hidden',
    marginTop: '12px',
  },
  ctaFill: {
    height: '100%',
    background: gradients.accent,
    transition: 'width 280ms ease',
  },

  // ─── SYSTEM READINESS ────────────────────────────────────────
  systemBar: {
    display: 'flex', flexWrap: 'wrap', gap: '8px',
    justifyContent: 'center',
  },

  // ─── STEP LIST ───────────────────────────────────────────────
  stepSection: {
    display: 'grid',
    gap: '2px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    transition: 'background-color 120ms',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  stepIcon: { fontSize: '16px', flexShrink: 0 },
  stepDone: { color: tokens.colorPaletteGreenForeground1 },
  stepCurrent: { color: tokens.colorBrandForeground1 },
  stepPending: { color: tokens.colorNeutralForeground4 },
  stepLabel: {
    flex: 1,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  stepLabelDim: {
    flex: 1,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground3,
  },
  stepBadge: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },

  footer: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

export function Welcome() {
  const s = useStyles();
  const navigate = useNavigate();
  const stateQ = useWizardState();
  const stepsQ = useSteps();
  const sysQ = useSystem();
  const qc = useQueryClient();

  const reset = useMutation({
    mutationFn: () => api.resetState(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['steps'] });
    },
  });

  const completed = stateQ.data?.completed ?? 0;
  const next = stateQ.data?.next ?? 1;
  const total = stateQ.data?.totalSteps ?? 9;
  const appName = (stateQ.data?.state?.APP_NAME as string) || '';
  const hasProgress = completed > 0;
  const percent = Math.round((completed / Math.max(1, total)) * 100);

  return (
    <div className={s.root}>
      {/* ─── HERO ─────────────────────────────────────────── */}
      <div className={s.hero}>
        <HeroBackground />
        <div className={s.heroInner}>
          <div className={s.pill}>
            <RocketRegular /> Foundations
          </div>
          <h1 className={s.title}>
            Set up a Code App the right way.
          </h1>
          <Body1 className={s.subtitle}>
            Nine guided steps from zero to a deployed Power Apps Code App.
            Every decision is captured and every step is re-runnable.
          </Body1>
        </div>
      </div>

      {/* ─── BODY ─────────────────────────────────────────── */}
      <div className={s.body}>

        {/* ─── PRIMARY CTA ──────────────────────────────── */}
        <div className={s.ctaCard}>
          <div className={s.ctaInner}>
            <div className={s.ctaText}>
              {hasProgress ? (
                <>
                  <Subtitle2 style={{ display: 'block', color: tokens.colorBrandForeground1, marginBottom: '4px' }}>
                    Welcome back{appName ? `, ${appName}` : ''}
                  </Subtitle2>
                  <Title2 style={{ margin: 0 }}>Pick up at step {next} of {total}</Title2>
                  <Body1 style={{ marginTop: '6px', color: tokens.colorNeutralForeground3 }}>
                    {completed} of {total} steps complete · {percent}%
                  </Body1>
                  <div className={s.ctaTrack} aria-hidden>
                    <div className={s.ctaFill} style={{ width: `${percent}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <Title2 style={{ margin: 0 }}>Ready when you are</Title2>
                  <Body1 style={{ marginTop: '6px', color: tokens.colorNeutralForeground2 }}>
                    Each step is self-contained. You'll end with a deployable app.
                  </Body1>
                </>
              )}
            </div>
            <div className={s.ctaActions}>
              <Button
                className={s.ctaPrimary}
                size="large"
                iconPosition="after"
                icon={<ArrowRightFilled />}
                onClick={() => navigate(`/step/${next}`)}
              >
                {hasProgress ? 'Resume' : 'Get started'}
              </Button>
              {hasProgress && (
                <Dialog>
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="subtle" icon={<ArrowResetRegular />}>Start over</Button>
                  </DialogTrigger>
                  <DialogSurface>
                    <DialogBody>
                      <DialogTitle>Reset wizard state?</DialogTitle>
                      <DialogContent>
                        This clears all collected answers. Your project files are not affected.
                      </DialogContent>
                      <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                          <Button appearance="secondary">Cancel</Button>
                        </DialogTrigger>
                        <DialogTrigger disableButtonEnhancement>
                          <Button appearance="primary" onClick={() => reset.mutate()}>
                            {reset.isPending ? <Spinner size="tiny" /> : 'Reset'}
                          </Button>
                        </DialogTrigger>
                      </DialogActions>
                    </DialogBody>
                  </DialogSurface>
                </Dialog>
              )}
            </div>
          </div>
        </div>

        {/* ─── SYSTEM READINESS ─────────────────────────── */}
        {sysQ.data && (
          <div className={s.systemBar}>
            <Badge appearance="filled" color={sysQ.data.node ? 'success' : 'danger'}>Node {sysQ.data.node || '—'}</Badge>
            <Badge appearance="filled" color={sysQ.data.git ? 'success' : 'danger'}>Git {sysQ.data.git || 'missing'}</Badge>
            <Badge appearance="filled" color={sysQ.data.dotnet ? 'success' : 'danger'}>.NET {sysQ.data.dotnet || 'missing'}</Badge>
            <Badge appearance="filled" color={sysQ.data.pac ? 'success' : 'danger'}>PAC {sysQ.data.pac || 'missing'}</Badge>
            <Badge appearance="filled" color={sysQ.data.op ? 'success' : 'informative'}>
              {sysQ.data.op ? `1Password ${sysQ.data.op}` : '1Password (optional)'}
            </Badge>
          </div>
        )}

        {/* ─── STEP LIST ────────────────────────────────── */}
        {stepsQ.data && (
          <div className={s.stepSection}>
            {stepsQ.data.steps.map((step) => {
              const isDone = step.status === 'done';
              const isCurrent = step.status === 'current';
              return (
                <div
                  key={step.number}
                  className={s.stepRow}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/step/${step.number}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/step/${step.number}`); }}
                >
                  {isDone ? (
                    <CheckmarkCircleFilled className={`${s.stepIcon} ${s.stepDone}`} />
                  ) : isCurrent ? (
                    <ArrowRightRegular className={`${s.stepIcon} ${s.stepCurrent}`} />
                  ) : (
                    <CircleRegular className={`${s.stepIcon} ${s.stepPending}`} />
                  )}
                  <span className={isDone || isCurrent ? s.stepLabel : s.stepLabelDim}>
                    {step.number}. {step.title}
                  </span>
                  {isDone && <span className={s.stepBadge}>Done</span>}
                  {isCurrent && <Badge appearance="filled" color="brand" size="small">Up next</Badge>}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── FOOTER ───────────────────────────────────── */}
        {sysQ.data?.rootDir && (
          <div className={s.footer}>
            <BookGlobeRegular style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Working in <code>{sysQ.data.rootDir}</code>
          </div>
        )}

        {reset.isError && (
          <MessageBar intent="error">
            <MessageBarBody>
              <MessageBarTitle>Reset failed</MessageBarTitle>
              {(reset.error as Error).message}
            </MessageBarBody>
          </MessageBar>
        )}
      </div>
    </div>
  );
}
