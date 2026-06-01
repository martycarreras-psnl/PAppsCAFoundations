import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles, tokens, Title2, Body1, Button, Spinner,
  MessageBar, MessageBarBody, Caption1,
  Accordion, AccordionItem, AccordionHeader, AccordionPanel,
} from '@fluentui/react-components';
import {
  ArrowLeftRegular, ArrowRightFilled, PlayRegular,
  CheckmarkCircleFilled, WindowConsoleRegular, CopyRegular,
  OpenRegular,
} from '@fluentui/react-icons';

import { useStepQuestions, useSteps } from '../hooks/useWizardData';
import { useStepStream } from '../hooks/useStepStream';
import { StepNav } from '../components/StepNav';
import { isQuestionHidden, QuestionCard, QuestionGroupCard } from '../components/QuestionCard';
import { LiveLog } from '../components/LiveLog';
import { api } from '../services/api';
import { Question, QuestionGroup } from '../types/schema';
import { gradients } from '../theme/tokens';

type QuestionBlock =
  | { kind: 'question'; question: Question }
  | { kind: 'group'; group: QuestionGroup; questions: Question[] };

const useStyles = makeStyles({
  root: { height: '100%', display: 'flex' },
  main: { flex: 1, height: '100%', minWidth: 0, overflow: 'hidden' },
  pane: { height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  formWrap: {
    height: '100%',
    overflowY: 'auto',
    padding: '24px 32px 32px',
    display: 'flex', flexDirection: 'column', gap: '16px',
    maxWidth: '820px',
    margin: '0 auto',
    width: '100%',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    marginBottom: '8px',
  },
  stepBadge: {
    width: '36px', height: '36px',
    borderRadius: '10px',
    display: 'grid', placeItems: 'center',
    fontWeight: 700, fontSize: '15px',
    flexShrink: 0,
  },
  stepBadgePending: {
    background: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
  },
  stepBadgeDone: {
    background: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  stepBadgeBrand: {
    background: gradients.accent,
    color: '#ffffff',
  },
  headerText: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  questions: { display: 'flex', flexDirection: 'column', gap: '12px' },
  actions: {
    display: 'flex', gap: '8px', alignItems: 'center',
    paddingTop: '16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: '8px',
  },
  spacer: { flex: 1 },
  inlineLog: {
    marginTop: '4px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '10px',
    overflow: 'hidden',
    minHeight: '180px',
    maxHeight: '320px',
    display: 'flex',
    flexDirection: 'column',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, rgba(16,124,16,0.10), rgba(0,120,212,0.08))',
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
  },
  successIcon: {
    fontSize: '24px',
    color: tokens.colorPaletteGreenForeground1,
    flexShrink: 0,
  },
  successText: { flex: 1 },
  ctaPrimary: {
    background: gradients.accent,
    color: '#ffffff',
    border: 'none',
    boxShadow: tokens.shadow4,
    minWidth: '160px',
    height: '40px',
    fontWeight: 600,
  },
  terminalNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
    borderRadius: '10px',
    background: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground2,
  },
  terminalIcon: {
    fontSize: '20px',
    color: tokens.colorBrandForeground1,
    flexShrink: 0,
  },
  deviceCodeCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '20px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, rgba(0,120,212,0.08), rgba(0,150,255,0.04))',
    border: `1.5px solid ${tokens.colorBrandStroke1}`,
  },
  deviceCodeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
  },
  deviceCodeBody: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  deviceCodeValue: {
    fontFamily: 'monospace',
    fontSize: '28px',
    fontWeight: 700,
    letterSpacing: '4px',
    color: tokens.colorBrandForeground1,
    padding: '8px 16px',
    background: tokens.colorNeutralBackground1,
    borderRadius: '8px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    userSelect: 'all' as const,
  },
});

export function StepRunner() {
  const s = useStyles();
  const params = useParams();
  const stepNumber = Math.max(1, Math.min(9, parseInt(params.n || '1', 10)));
  const navigate = useNavigate();
  const qc = useQueryClient();

  const stepsQ = useSteps();
  const questionsQ = useStepQuestions(stepNumber);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [initialAnswers, setInitialAnswers] = useState<Record<string, unknown>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const submittedAnswersRef = useRef<Record<string, unknown> | null>(null);
  const questionDefaultsKey = useMemo(
    () => JSON.stringify((questionsQ.data?.questions ?? []).map((q) => [q.id, q.defaultValue ?? ''])),
    [questionsQ.data?.questions],
  );

  // Initialize answers from defaults whenever the step's questions arrive
  useEffect(() => {
    if (!questionsQ.data) return;
    const init: Record<string, unknown> = {};
    for (const q of questionsQ.data.questions) init[q.id] = q.defaultValue ?? '';
    setAnswers(init);
    setInitialAnswers(init);
    setShowErrors(false);
  }, [questionsQ.data?.meta.number, questionDefaultsKey]);

  // Reset runId only when the step number changes (not on question refetch)
  useEffect(() => {
    setRunId(null);
  }, [stepNumber]);

  const apply = useMutation({
    mutationFn: (a: Record<string, unknown>) => api.apply(stepNumber, a),
    onSuccess: (data) => {
      setRunId(data.runId);
    },
  });

  const stream = useStepStream(stepNumber, runId);

  // Refresh state + steps when a run completes successfully
  useEffect(() => {
    if (stream.status === 'done') {
      if (submittedAnswersRef.current) {
        setInitialAnswers(submittedAnswersRef.current);
        submittedAnswersRef.current = null;
      }
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['steps'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
    }
  }, [stream.status, qc, stepNumber]);

  // Auto-advance to next step after success — skip when there are warnings
  const hasWarnings = useMemo(
    () => stream.lines.some((l) => l.stream === 'stderr'),
    [stream.lines],
  );
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (stream.status === 'done' && !hasWarnings) {
      const total = stepsQ.data?.totalSteps ?? 9;
      // On the FINAL step (Verify & Deploy) do NOT auto-advance to the summary —
      // stay put so the user can read the deploy log and see exactly what pac
      // code push reported (solution association, app URL, warnings). The user
      // moves on by explicitly clicking "View summary".
      if (stepNumber >= total) return;
      autoAdvanceRef.current = setTimeout(() => {
        navigate(`/step/${stepNumber + 1}`);
      }, 1500);
    }
    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); };
  }, [stream.status, stepNumber, stepsQ.data?.totalSteps, navigate, hasWarnings]);

  const meta = questionsQ.data?.meta;
  const questions = questionsQ.data?.questions ?? [];
  const { primaryBlocks, advancedBlocks } = useMemo(() => {
    const build = (qs: Question[]): QuestionBlock[] => {
      const blocks: QuestionBlock[] = [];
      for (const q of qs) {
        if (!q.group) {
          blocks.push({ kind: 'question', question: q });
          continue;
        }
        const previous = blocks[blocks.length - 1];
        if (previous?.kind === 'group' && previous.group.id === q.group.id) {
          previous.questions.push(q);
        } else {
          blocks.push({ kind: 'group', group: q.group, questions: [q] });
        }
      }
      return blocks;
    };
    const primary = questions.filter((q) => !q.advanced);
    const advanced = questions.filter((q) => q.advanced);
    return { primaryBlocks: build(primary), advancedBlocks: build(advanced) };
  }, [questions]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(answers) !== JSON.stringify(initialAnswers),
    [answers, initialAnswers],
  );

  // Persist in-progress answer changes (debounced) so a page refresh doesn't lose them.
  // The wizard already merges PUT bodies into state; the real apply still happens on "Save & run".
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!questionsQ.data) return;
    if (!hasUnsavedChanges) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const changed: Record<string, unknown> = {};
      for (const k of Object.keys(answers)) {
        if (JSON.stringify(answers[k]) !== JSON.stringify(initialAnswers[k])) {
          changed[k] = answers[k];
        }
      }
      if (Object.keys(changed).length > 0) {
        api.saveState(changed).catch(() => { /* best effort */ });
      }
    }, 600);
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
  }, [answers, initialAnswers, hasUnsavedChanges, questionsQ.data]);

  const validationErrors = useMemo(() => {
    if (!meta?.canRunInBrowser) return [];
    const errs: string[] = [];
    for (const q of questions) {
      if (isQuestionHidden(q, answers)) continue;
      if (q.required && (answers[q.id] == null || answers[q.id] === '')) errs.push(q.label);
    }
    return errs;
  }, [questions, answers, meta]);

  function submit() {
    if (!meta?.canRunInBrowser) return;
    if (questions.length > 0 && validationErrors.length > 0) {
      setShowErrors(true);
      return;
    }
    submittedAnswersRef.current = answers;
    apply.mutate(answers);
  }

  const status: 'done' | 'current' | 'pending' =
    stepsQ.data?.steps.find((x) => x.number === stepNumber)?.status ?? 'pending';

  const isRunning = apply.isPending || stream.status === 'running';
  const isComplete = stream.status === 'done';
  const total = stepsQ.data?.totalSteps ?? 9;
  const isLastStep = stepNumber >= total;
  const canRun = meta?.canRunInBrowser;

  // Single smart CTA label
  const ctaLabel = (() => {
    if (isRunning) return meta?.readOnly ? 'Checking…' : 'Running…';
    if (isComplete && hasWarnings) return isLastStep ? 'Finish' : 'Continue';
    if (isComplete) return isLastStep ? 'Finish' : 'Continuing…';
    if (status === 'done' && hasUnsavedChanges) return 'Save & re-run';
    if (meta?.readOnly) return 'Run checks';
    if (status === 'done') return 'Re-run';
    if (questions.length === 0) return 'Run';
    return 'Save & run';
  })();

  function handlePrimaryCta() {
    if (isComplete) {
      // Clicking the button while auto-advance countdown is active → advance immediately
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      if (isLastStep) navigate('/summary');
      else navigate(`/step/${stepNumber + 1}`);
      return;
    }
    submit();
  }

  return (
    <div className={s.root}>
      {stepsQ.data && <StepNav steps={stepsQ.data.steps} current={stepNumber} />}

      <div className={s.main}>
        <div className={s.pane}>
          <div className={s.formWrap}>
              {/* ─── Compact header ──────────────────────────── */}
              <div className={s.header}>
                <div className={[
                  s.stepBadge,
                  status === 'done' ? s.stepBadgeDone
                    : (status === 'current' ? s.stepBadgeBrand : s.stepBadgePending),
                ].join(' ')}>
                  {status === 'done' ? <CheckmarkCircleFilled /> : stepNumber}
                </div>
                <div className={s.headerText}>
                  <Title2 style={{ margin: 0 }}>{meta?.title || 'Loading…'}</Title2>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    Step {stepNumber} of {total}{meta?.optional ? ' · optional' : ''}
                  </Caption1>
                </div>
              </div>

              {/* Description — one line, not a paragraph */}
              {meta?.description && (
                <Body1 style={{ color: tokens.colorNeutralForeground2 }}>{meta.description}</Body1>
              )}

              {questionsQ.isLoading && (
                stepNumber === 8 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Spinner size="small" />
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      Loading connector details — this can take a moment…
                    </Caption1>
                  </div>
                ) : <Spinner size="small" />
              )}

              {/* Non-browser step: show terminal instructions instead of a form */}
              {meta && !canRun && (
                <div className={s.terminalNote}>
                  <WindowConsoleRegular className={s.terminalIcon} />
                  <Body1>
                    This step requires an interactive terminal session. Use the embedded terminal
                    or run the command in your own shell, then come back and advance.
                  </Body1>
                </div>
              )}

              {/* Question form */}
              {canRun && questions.length > 0 && (
                <div className={s.questions}>
                  {(() => {
                    const onChange = (id: string, v: unknown) => setAnswers((a) => ({ ...a, [id]: v }));
                    const renderBlock = (block: QuestionBlock) => {
                      if (block.kind === 'group') {
                        return (
                          <QuestionGroupCard
                            key={block.group.id}
                            group={block.group}
                            questions={block.questions}
                            answers={answers}
                            onChange={onChange}
                            showError={showErrors}
                          />
                        );
                      }
                      return (
                        <QuestionCard
                          key={block.question.id}
                          question={block.question}
                          answers={answers}
                          value={answers[block.question.id]}
                          onChange={onChange}
                          showError={showErrors}
                        />
                      );
                    };
                    return (
                      <>
                        {primaryBlocks.map(renderBlock)}
                        {advancedBlocks.length > 0 && (
                          <Accordion collapsible>
                            <AccordionItem value="advanced">
                              <AccordionHeader>Advanced options</AccordionHeader>
                              <AccordionPanel>
                                <div className={s.questions}>
                                  {advancedBlocks.map(renderBlock)}
                                </div>
                              </AccordionPanel>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Error states — compact */}
              {apply.isError && (
                <MessageBar intent="error">
                  <MessageBarBody>{(apply.error as Error).message}</MessageBarBody>
                </MessageBar>
              )}

              {stream.status === 'error' && (
                <MessageBar intent="error">
                  <MessageBarBody>{stream.error || 'Step failed — see output above.'}</MessageBarBody>
                </MessageBar>
              )}

              {/* Device code card — surface sign-in code prominently */}
              {stream.deviceCode?.code && stream.status === 'running' && (
                <div className={s.deviceCodeCard}>
                  <div className={s.deviceCodeHeader}>
                    <OpenRegular style={{ color: tokens.colorBrandForeground1 }} />
                    <Body1>Sign in with a device code</Body1>
                  </div>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    Open the link below, then enter the code to authenticate.
                  </Caption1>
                  <div className={s.deviceCodeBody}>
                    <span className={s.deviceCodeValue}>{stream.deviceCode.code}</span>
                    <Button
                      appearance="subtle"
                      icon={<CopyRegular />}
                      onClick={() => navigator.clipboard.writeText(stream.deviceCode!.code!)}
                    >
                      Copy code
                    </Button>
                  </div>
                  <Button
                    appearance="primary"
                    icon={<OpenRegular />}
                    as="a"
                    href={stream.deviceCode.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Open {stream.deviceCode.url}
                  </Button>
                </div>
              )}

              {/* Success banner with auto-advance */}
              {isComplete && (
                <div className={s.successBanner}>
                  <CheckmarkCircleFilled className={s.successIcon} />
                  <div className={s.successText}>
                    <Body1 style={{ fontWeight: 600 }}>
                      {isLastStep ? 'All steps complete!'
                        : hasWarnings ? 'Step complete — review items above'
                        : 'Step complete'}
                    </Body1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {isLastStep ? 'Review the deploy log above, then click View summary when ready.'
                        : hasWarnings ? 'Some items need attention. Continue when ready.'
                        : `Moving to step ${stepNumber + 1}…`}
                    </Caption1>
                  </div>
                  <Button
                    className={s.ctaPrimary}
                    iconPosition="after"
                    icon={<ArrowRightFilled />}
                    onClick={() => {
                      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
                      if (isLastStep) navigate('/summary');
                      else navigate(`/step/${stepNumber + 1}`);
                    }}
                  >
                    {isLastStep ? 'View summary' : 'Continue now'}
                  </Button>
                </div>
              )}

              {/* Step 7 long-running scaffold notice */}
              {stepNumber === 7 && isRunning && (
                <MessageBar intent="info">
                  <MessageBarBody>
                    <strong>Scaffolding can take a few minutes.</strong>{' '}
                    `pac code init` downloads templates, installs npm dependencies, and
                    initializes the project. Please keep this browser tab open and stay on
                    your network — closing the tab, sleeping the machine, or dropping VPN /
                    Wi-Fi mid-run can interrupt the PAC CLI authentication and leave the
                    scaffold in an incomplete state.
                  </MessageBarBody>
                </MessageBar>
              )}

              {/* Inline live output — only shown when a run is active or has output */}
              {canRun && (stream.status === 'running' || stream.lines.length > 0) && (
                <div className={s.inlineLog}>
                  <LiveLog lines={stream.lines} status={stream.status} />
                </div>
              )}

              {/* ─── Action bar ──────────────────────────── */}
              <div className={s.actions}>
                <Button
                  appearance="subtle"
                  icon={<ArrowLeftRegular />}
                  onClick={() => navigate(stepNumber <= 1 ? '/' : `/step/${stepNumber - 1}`)}
                >
                  {stepNumber <= 1 ? 'Home' : 'Back'}
                </Button>
                <div className={s.spacer} />
                {canRun ? (
                  <Button
                    appearance="primary"
                    icon={isRunning ? <Spinner size="tiny" /> : (isComplete ? <ArrowRightFilled /> : <PlayRegular />)}
                    iconPosition={isComplete ? 'after' : 'before'}
                    onClick={handlePrimaryCta}
                    disabled={isRunning}
                  >
                    {ctaLabel}
                  </Button>
                ) : (
                  <Button
                    appearance="primary"
                    iconPosition="after"
                    icon={<ArrowRightFilled />}
                    onClick={() => {
                      if (isLastStep) navigate('/summary');
                      else navigate(`/step/${stepNumber + 1}`);
                    }}
                  >
                    {isLastStep ? 'Finish' : 'Next'}
                  </Button>
                )}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
