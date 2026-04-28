import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles, tokens, Body1, Title1, Title2, Title3, Subtitle2,
  Button, Spinner, Caption1, Badge, MessageBar, MessageBarBody, MessageBarTitle,
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent,
} from '@fluentui/react-components';
import {
  ArrowRightFilled, ArrowResetRegular, RocketRegular,
  CheckmarkCircleFilled, ShieldKeyholeRegular, FlashRegular, BookGlobeRegular,
  CircleFilled,
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
    minHeight: '420px',
    display: 'grid',
    placeItems: 'center',
    padding: '72px 32px 48px',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    maxWidth: '760px',
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
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    background: gradients.accent,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.025em',
    fontSize: '56px',
    lineHeight: 1.05,
    fontWeight: 700,
  },
  subtitle: {
    marginTop: '20px',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase500,
    lineHeight: 1.55,
    maxWidth: '640px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },

  // ─── BODY ─────────────────────────────────────────────────────
  body: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1080px',
    margin: '0 auto',
    padding: '0 32px 80px',
    display: 'grid',
    gap: '48px',
  },

  // ─── PRIMARY CTA ──────────────────────────────────────────────
  ctaCard: {
    position: 'relative',
    padding: '32px',
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
  ctaText: { flex: 1, minWidth: '260px' },
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
  ctaProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    marginTop: '8px',
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

  // ─── SECTIONS ────────────────────────────────────────────────
  sectionLabel: {
    display: 'block',
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase200,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    marginBottom: '8px',
    textAlign: 'center',
  },
  sectionTitle: {
    textAlign: 'center',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  sectionLead: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
    maxWidth: '640px',
    margin: '12px auto 0',
    lineHeight: 1.6,
  },

  // ─── PILLARS ─────────────────────────────────────────────────
  pillars: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
    marginTop: '32px',
  },
  pillar: {
    padding: '24px',
    borderRadius: '12px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    background: tokens.colorNeutralBackground1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'transform 220ms cubic-bezier(0.1,0.9,0.2,1), box-shadow 220ms',
    ':hover': { transform: 'translateY(-2px)', boxShadow: tokens.shadow8 },
  },
  pillarIcon: {
    width: '44px', height: '44px',
    borderRadius: '10px',
    display: 'grid',
    placeItems: 'center',
    background: gradients.accent,
    color: '#ffffff',
    fontSize: '22px',
    boxShadow: tokens.shadow4,
  },
  pillarBody: {
    color: tokens.colorNeutralForeground2,
    lineHeight: 1.55,
  },

  // ─── STEP TIMELINE ───────────────────────────────────────────
  timeline: {
    marginTop: '32px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '12px',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px',
    borderRadius: '10px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    background: tokens.colorNeutralBackground1,
    transition: 'border-color 200ms, background-color 200ms',
    ':hover': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      background: tokens.colorNeutralBackground1Hover,
      cursor: 'pointer',
    },
  },
  stepRowDone: {
    background: tokens.colorPaletteGreenBackground1,
    borderTopColor: tokens.colorPaletteGreenBorder1,
    borderRightColor: tokens.colorPaletteGreenBorder1,
    borderBottomColor: tokens.colorPaletteGreenBorder1,
    borderLeftColor: tokens.colorPaletteGreenBorder1,
  },
  stepRowCurrent: {
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
    boxShadow: `0 0 0 2px ${tokens.colorBrandBackground2}`,
  },
  stepNumber: {
    minWidth: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 600,
    fontSize: '13px',
    background: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
  },
  stepNumberDone: {
    background: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  stepNumberCurrent: {
    background: gradients.accent,
    color: '#ffffff',
  },
  stepText: { flex: 1, minWidth: 0 },
  stepTitle: {
    fontWeight: 600,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    marginBottom: '2px',
  },
  stepDesc: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    lineHeight: 1.45,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },

  // ─── SYSTEM READINESS ────────────────────────────────────────
  systemBar: {
    display: 'flex', flexWrap: 'wrap', gap: '8px',
    justifyContent: 'center',
    paddingTop: '12px',
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

  const steps = stepsQ.data?.steps ?? [];

  return (
    <div className={s.root}>
      {/* ─── HERO ─────────────────────────────────────────── */}
      <div className={s.hero}>
        <HeroBackground />
        <div className={s.heroInner}>
          <div className={s.pill}>
            <RocketRegular /> Power Apps Code Apps · Foundations
          </div>
          <Title1 as="h1" className={s.title}>
            Set up a Code App the right way, the first time.
          </Title1>
          <Body1 className={s.subtitle}>
            A guided, opinionated setup for Power Apps Code Apps. The wizard walks you through
            every prerequisite, every Power Platform decision, and every CLI command — in order,
            with safe defaults and an audit trail — so you finish with a working app instead of
            a folder full of half-configured pieces.
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
                  <div className={s.ctaProgress}>
                    <span>{completed} of {total} steps complete · {percent}%</span>
                  </div>
                  <div className={s.ctaTrack} aria-hidden>
                    <div className={s.ctaFill} style={{ width: `${percent}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <Subtitle2 style={{ display: 'block', color: tokens.colorBrandForeground1, marginBottom: '4px' }}>
                    Ready when you are
                  </Subtitle2>
                  <Title2 style={{ margin: 0 }}>Begin a fresh Code App</Title2>
                  <Body1 style={{ marginTop: '8px', color: tokens.colorNeutralForeground2, lineHeight: 1.5 }}>
                    Nine steps. Each one self-contained and re-runnable. You'll end with a deployable
                    app bound to your Power Platform environment.
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
                        This deletes <code>.wizard-state.json</code>. Your project files are not affected,
                        but the wizard will forget all collected answers and you will start from step&nbsp;1.
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

        {/* ─── PILLARS ──────────────────────────────────── */}
        <section>
          <span className={s.sectionLabel}>Why use the wizard</span>
          <Title2 as="h2" className={s.sectionTitle}>What it does for you</Title2>
          <Body1 className={s.sectionLead}>
            Nothing here is hidden. Every decision you make gets captured in
            <code> .wizard-state.json</code> so the next person picking up the project can see
            exactly how it was set up — and re-run any step on demand.
          </Body1>

          <div className={s.pillars}>
            <div className={s.pillar}>
              <div className={s.pillarIcon}><CheckmarkCircleFilled /></div>
              <Title3 as="h3" style={{ margin: 0 }}>Right order, every time</Title3>
              <Body1 className={s.pillarBody}>
                Publisher before solution. App Registration before auth profile. Connections before
                connection references. Skip a step and the next one breaks — so the wizard
                won't let you.
              </Body1>
            </div>
            <div className={s.pillar}>
              <div className={s.pillarIcon}><ShieldKeyholeRegular /></div>
              <Title3 as="h3" style={{ margin: 0 }}>Secrets stay where they belong</Title3>
              <Body1 className={s.pillarBody}>
                Auth uses <code>pac auth create</code> with optional 1Password integration.
                Client secrets never land in source. The local wizard server binds to
                <code> 127.0.0.1</code> only and uses CSRF tokens for every action.
              </Body1>
            </div>
            <div className={s.pillar}>
              <div className={s.pillarIcon}><FlashRegular /></div>
              <Title3 as="h3" style={{ margin: 0 }}>Real shell when you need it</Title3>
              <Body1 className={s.pillarBody}>
                Forms for the data-entry steps. A real embedded terminal — your zsh or pwsh —
                for the steps that need device-code prompts, biometric prompts, or live
                progress from <code>pac code push</code>.
              </Body1>
            </div>
          </div>
        </section>

        {/* ─── STEP TIMELINE ────────────────────────────── */}
        <section>
          <span className={s.sectionLabel}>The journey</span>
          <Title2 as="h2" className={s.sectionTitle}>Nine steps from zero to deployed</Title2>
          <Body1 className={s.sectionLead}>
            Each step is self-contained, idempotent, and re-runnable. Click any step to jump
            in, inspect what it will do, and decide whether to proceed.
          </Body1>

          <div className={s.timeline}>
            {steps.length === 0 && (
              <div className={s.stepRow}>
                <Spinner size="tiny" />
                <Caption1>Loading steps…</Caption1>
              </div>
            )}
            {steps.map((step) => {
              const isDone = step.status === 'done';
              const isCurrent = step.status === 'current';
              const rowCls = [
                s.stepRow,
                isDone ? s.stepRowDone : '',
                isCurrent ? s.stepRowCurrent : '',
              ].filter(Boolean).join(' ');
              const numCls = [
                s.stepNumber,
                isDone ? s.stepNumberDone : '',
                isCurrent ? s.stepNumberCurrent : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={step.number}
                  className={rowCls}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/step/${step.number}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/step/${step.number}`); }}
                >
                  <div className={numCls}>
                    {isDone ? <CheckmarkCircleFilled /> : isCurrent ? <CircleFilled style={{ fontSize: 10 }} /> : step.number}
                  </div>
                  <div className={s.stepText}>
                    <div className={s.stepTitle}>{step.title}</div>
                    <div className={s.stepDesc}>{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── SYSTEM READINESS ─────────────────────────── */}
        <section>
          <span className={s.sectionLabel}>System readiness</span>
          <Title2 as="h2" className={s.sectionTitle}>Tools detected on this machine</Title2>
          <Body1 className={s.sectionLead}>
            Step 1 will check these in detail. If any are missing, the wizard will tell you exactly
            what to install.
          </Body1>

          {sysQ.data ? (
            <div className={s.systemBar}>
              <Badge appearance="filled" color={sysQ.data.node ? 'success' : 'danger'}>Node {sysQ.data.node || '—'}</Badge>
              <Badge appearance="filled" color={sysQ.data.git ? 'success' : 'danger'}>Git {sysQ.data.git || 'missing'}</Badge>
              <Badge appearance="filled" color={sysQ.data.dotnet ? 'success' : 'danger'}>.NET {sysQ.data.dotnet || 'missing'}</Badge>
              <Badge appearance="filled" color={sysQ.data.pac ? 'success' : 'danger'}>PAC {sysQ.data.pac || 'missing'}</Badge>
              <Badge appearance="filled" color={sysQ.data.op ? 'success' : 'informative'}>
                {sysQ.data.op ? `1Password ${sysQ.data.op}` : '1Password (optional)'}
              </Badge>
              {sysQ.data.branch && <Badge appearance="outline">branch: {sysQ.data.branch}</Badge>}
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Spinner size="tiny" />
            </div>
          )}
        </section>

        {/* ─── FOOTER ───────────────────────────────────── */}
        {sysQ.data?.rootDir && (
          <div className={s.footer}>
            <BookGlobeRegular style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Working in <code>{sysQ.data.rootDir}</code> · state stored in <code>.wizard-state.json</code>
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
