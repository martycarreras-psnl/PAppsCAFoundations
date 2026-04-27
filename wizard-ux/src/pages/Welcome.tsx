import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles, tokens, Card, CardHeader, Body1, Title1, Title3,
  Button, Spinner, Caption1, Badge, MessageBar, MessageBarBody, MessageBarTitle,
  Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent,
} from '@fluentui/react-components';
import {
  ArrowRightFilled, ArrowResetRegular, FlagRegular, RocketRegular,
} from '@fluentui/react-icons';
import { HeroBackground } from '../components/HeroBackground';
import { useSteps, useSystem, useWizardState } from '../hooks/useWizardData';
import { api } from '../services/api';

const useStyles = makeStyles({
  root: {
    position: 'relative',
    height: '100%',
    overflowY: 'auto',
  },
  hero: {
    position: 'relative',
    minHeight: '320px',
    display: 'grid',
    placeItems: 'center',
    padding: '64px 32px 32px',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    maxWidth: '640px',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    border: `1px solid rgba(255,255,255,0.12)`,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    background: `linear-gradient(135deg, #ffffff 0%, ${tokens.colorBrandForeground2} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    marginTop: '12px',
    color: tokens.colorNeutralForeground2,
  },
  body: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1080px',
    margin: '0 auto',
    padding: '0 32px 64px',
    display: 'grid',
    gap: '24px',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    cursor: 'pointer',
    transition: 'transform 200ms ease-out, box-shadow 200ms ease-out',
    ':hover': { transform: 'translateY(-2px)', boxShadow: tokens.shadow16 },
  },
  cardDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    ':hover': { transform: 'none', boxShadow: tokens.shadow4 },
  },
  cardIcon: {
    width: '40px', height: '40px',
    display: 'grid', placeItems: 'center',
    borderRadius: '10px',
    background: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    fontSize: '20px',
  },
  systemBar: {
    display: 'flex', flexWrap: 'wrap', gap: '8px',
    justifyContent: 'center',
    marginTop: '24px',
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

  return (
    <div className={s.root}>
      <div className={s.hero}>
        <HeroBackground />
        <div className={s.heroInner}>
          <div className={s.pill}>
            <RocketRegular /> Power Apps Code App Setup
          </div>
          <Title1 as="h1" className={s.title}>
            Build a Code App, beautifully
          </Title1>
          <Body1 className={s.subtitle}>
            A guided experience for everything Power Apps Code Apps need —
            tenant, environment, publisher, solution, and your first deploy.
          </Body1>
        </div>
      </div>

      <div className={s.body}>
        {hasProgress && (
          <MessageBar intent="info">
            <MessageBarBody>
              <MessageBarTitle>Welcome back{appName ? `, ${appName}` : ''}</MessageBarTitle>
              You finished step {completed} of {total}. Resume from step {next}, jump to a specific step,
              or reset and start fresh.
            </MessageBarBody>
          </MessageBar>
        )}

        <div className={s.cards}>
          {hasProgress && (
            <Card className={s.card} onClick={() => navigate(`/step/${next}`)}>
              <CardHeader
                image={<div className={s.cardIcon}><ArrowRightFilled /></div>}
                header={<Title3>Resume</Title3>}
                description={<Caption1>Continue from step {next}</Caption1>}
              />
              <Body1>Pick up exactly where you left off.</Body1>
            </Card>
          )}

          <Card className={s.card} onClick={() => navigate(hasProgress ? '/step/1' : `/step/${next}`)}>
            <CardHeader
              image={<div className={s.cardIcon}><FlagRegular /></div>}
              header={<Title3>{hasProgress ? 'Jump to a step' : 'Start a new project'}</Title3>}
              description={<Caption1>{hasProgress ? 'Pick any step to revisit' : 'Begin at step 1'}</Caption1>}
            />
            <Body1>
              {hasProgress
                ? 'Select any step from the side navigator to retry or revise.'
                : "We'll walk through prerequisites, environment, publisher, solution, and deploy."}
            </Body1>
          </Card>

          {hasProgress && (
            <Dialog>
              <DialogTrigger disableButtonEnhancement>
                <Card className={s.card}>
                  <CardHeader
                    image={<div className={s.cardIcon}><ArrowResetRegular /></div>}
                    header={<Title3>Reset</Title3>}
                    description={<Caption1>Clear all saved state</Caption1>}
                  />
                  <Body1>Wipe `.wizard-state.json` and start over from scratch.</Body1>
                </Card>
              </DialogTrigger>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>Reset wizard state?</DialogTitle>
                  <DialogContent>
                    This deletes `.wizard-state.json`. Your project files are not affected, but the
                    wizard will forget all collected answers and you will start from step 1.
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

        {sysQ.data && (
          <div className={s.systemBar}>
            <Badge appearance="filled" color={sysQ.data.node ? 'success' : 'danger'}>Node {sysQ.data.node}</Badge>
            <Badge appearance="filled" color={sysQ.data.git ? 'success' : 'danger'}>Git {sysQ.data.git || 'missing'}</Badge>
            <Badge appearance="filled" color={sysQ.data.dotnet ? 'success' : 'danger'}>.NET {sysQ.data.dotnet || 'missing'}</Badge>
            <Badge appearance="filled" color={sysQ.data.pac ? 'success' : 'danger'}>PAC {sysQ.data.pac || 'missing'}</Badge>
            <Badge appearance="filled" color={sysQ.data.op ? 'success' : 'informative'}>{sysQ.data.op ? '1Password ✓' : '1Password (optional)'}</Badge>
            {sysQ.data.branch && <Badge appearance="outline">branch: {sysQ.data.branch}</Badge>}
          </div>
        )}

        {stepsQ.data && (
          <Caption1 style={{ textAlign: 'center', color: tokens.colorNeutralForeground3 }}>
            {stepsQ.data.steps.filter(x => x.status === 'done').length} of {stepsQ.data.totalSteps} steps complete · state.json at {sysQ.data?.rootDir}
          </Caption1>
        )}
      </div>
    </div>
  );
}
