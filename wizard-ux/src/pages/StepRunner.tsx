import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles, tokens, Title2, Body1, Button, Spinner, Badge,
  MessageBar, MessageBarBody, MessageBarTitle, Caption1,
} from '@fluentui/react-components';
import { ArrowLeftRegular, ArrowRightFilled, PlayRegular } from '@fluentui/react-icons';

import { useStepQuestions, useSteps } from '../hooks/useWizardData';
import { useStepStream } from '../hooks/useStepStream';
import { StepNav } from '../components/StepNav';
import { QuestionCard } from '../components/QuestionCard';
import { LiveLog } from '../components/LiveLog';
import { api } from '../services/api';
import { Question } from '../types/schema';

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
    display: 'flex', alignItems: 'flex-start', gap: '16px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    marginBottom: '8px',
  },
  headerText: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
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
  const [showErrors, setShowErrors] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  // Initialize answers from defaults whenever the step's questions arrive
  useEffect(() => {
    if (!questionsQ.data) return;
    const init: Record<string, unknown> = {};
    for (const q of questionsQ.data.questions) init[q.id] = q.defaultValue ?? '';
    setAnswers(init);
    setShowErrors(false);
    setRunId(null);
  }, [questionsQ.data?.meta.number]);

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
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['steps'] });
      qc.invalidateQueries({ queryKey: ['questions', stepNumber] });
    }
  }, [stream.status, qc, stepNumber]);

  const meta = questionsQ.data?.meta;
  const questions = questionsQ.data?.questions ?? [];

  const validationErrors = useMemo(() => {
    if (!meta?.canRunInBrowser) return [];
    const errs: string[] = [];
    for (const q of questions) {
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
    apply.mutate(answers);
  }

  const status: 'done' | 'current' | 'pending' =
    stepsQ.data?.steps.find((x) => x.number === stepNumber)?.status ?? 'pending';

  return (
    <div className={s.root}>
      {stepsQ.data && <StepNav steps={stepsQ.data.steps} current={stepNumber} />}

      <div className={s.main}>
        <div className={s.pane}>
          <div className={s.formWrap}>
              <div className={s.header}>
                <div className={s.headerText}>
                  <Caption1 style={{ color: tokens.colorBrandForeground1 }}>STEP {stepNumber} OF {stepsQ.data?.totalSteps ?? 9}</Caption1>
                  <Title2>{meta?.title || 'Loading…'}</Title2>
                  <Body1 style={{ color: tokens.colorNeutralForeground2 }}>{meta?.description}</Body1>
                </div>
                <div>
                  {status === 'done' && <Badge appearance="filled" color="success">Complete</Badge>}
                  {status === 'current' && <Badge appearance="filled" color="brand">Current</Badge>}
                  {status === 'pending' && <Badge appearance="outline">Pending</Badge>}
                </div>
              </div>

              {questionsQ.isLoading && <Spinner size="small" />}

              {/* Optional/skip note */}
              {meta?.optional && (
                <MessageBar intent="info">
                  <MessageBarBody>
                    <MessageBarTitle>Optional step</MessageBarTitle>
                    Skip this if you do not need it now — it can be re-run later from the side nav.
                  </MessageBarBody>
                </MessageBar>
              )}

              {/* Read-only steps (e.g. prereqs) — single Run button */}
              {meta?.canRunInBrowser && meta.readOnly && (
                <MessageBar intent="info">
                  <MessageBarBody>
                    <MessageBarTitle>Diagnostic step</MessageBarTitle>
                    Click Run checks to verify your machine.
                  </MessageBarBody>
                </MessageBar>
              )}

              {/* Question form */}
              {meta?.canRunInBrowser && questions.length > 0 && (
                <div className={s.questions}>
                  {questions.map((q: Question) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      answers={answers}
                      value={answers[q.id]}
                      onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
                      showError={showErrors}
                    />
                  ))}
                </div>
              )}

              {apply.isError && (
                <MessageBar intent="error">
                  <MessageBarBody>
                    <MessageBarTitle>Failed to start</MessageBarTitle>
                    {(apply.error as Error).message}
                  </MessageBarBody>
                </MessageBar>
              )}

              {stream.status === 'error' && (
                <MessageBar intent="error">
                  <MessageBarBody>
                    <MessageBarTitle>Step failed</MessageBarTitle>
                    {stream.error || 'See the live output for details.'}
                  </MessageBarBody>
                </MessageBar>
              )}

              {stream.status === 'done' && (
                <MessageBar intent="success">
                  <MessageBarBody>
                    <MessageBarTitle>Step complete</MessageBarTitle>
                    {stepNumber < (stepsQ.data?.totalSteps ?? 9) ? 'Move on to the next step.' : 'All done!'}
                  </MessageBarBody>
                </MessageBar>
              )}

              {/* Inline live output — only shown when an in-browser run is active or has output */}
              {meta?.canRunInBrowser && (stream.status === 'running' || stream.lines.length > 0) && (
                <div className={s.inlineLog}>
                  <LiveLog lines={stream.lines} status={stream.status} />
                </div>
              )}

              <div className={s.actions}>
                <Button
                  appearance="secondary"
                  icon={<ArrowLeftRegular />}
                  onClick={() => navigate(`/step/${Math.max(1, stepNumber - 1)}`)}
                  disabled={stepNumber <= 1}
                >
                  Back
                </Button>
                <div className={s.spacer} />
                {meta?.canRunInBrowser && (
                  <Button
                    appearance="primary"
                    icon={apply.isPending || stream.status === 'running' ? <Spinner size="tiny" /> : <PlayRegular />}
                    onClick={submit}
                    disabled={apply.isPending || stream.status === 'running'}
                  >
                    {meta?.readOnly ? 'Run checks' : (stream.status === 'running' ? 'Running…' : 'Submit')}
                  </Button>
                )}
                <Button
                  appearance="primary"
                  iconPosition="after"
                  icon={<ArrowRightFilled />}
                  onClick={() => {
                    const total = stepsQ.data?.totalSteps ?? 9;
                    if (stepNumber >= total) navigate('/summary');
                    else navigate(`/step/${stepNumber + 1}`);
                  }}
                  disabled={status !== 'done' && meta?.canRunInBrowser !== false}
                >
                  {stepNumber >= (stepsQ.data?.totalSteps ?? 9) ? 'Finish' : 'Next'}
                </Button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
