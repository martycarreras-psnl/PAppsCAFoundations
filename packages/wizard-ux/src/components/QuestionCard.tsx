import { Question, QuestionCondition, QuestionGroup } from '../types/schema';
import {
  Field, Input, Switch, Combobox, Option, Textarea, Caption1, makeStyles, tokens, Body2, Body1, Checkbox,
  Popover, PopoverTrigger, PopoverSurface, Button, Spinner,
} from '@fluentui/react-components';
import { QuestionCircleRegular, LockClosedRegular, EditRegular } from '@fluentui/react-icons';
import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';

/** Turn plain-text URLs into clickable <a> elements, preserving surrounding text. */
function linkify(text: string): ReactNode[] {
  const urlRe = /https?:\/\/[^\s)]+/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    // Strip trailing punctuation that was swept up by the greedy regex but isn't part of the URL.
    const raw = m[0].replace(/[.,;:!?]+$/, '');
    parts.push(<a key={m.index} href={raw} target="_blank" rel="noopener noreferrer">{raw}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const useStyles = makeStyles({
  card: {
    padding: '16px',
    borderRadius: '10px',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  required: { color: tokens.colorPaletteRedForeground1, marginLeft: '4px' },
  help: { color: tokens.colorNeutralForeground3 },
  groupHeader: { display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '4px' },
  groupTitle: { fontWeight: tokens.fontWeightSemibold },
  groupItems: { display: 'flex', flexDirection: 'column' },
  groupItem: {
    padding: '12px 0',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  firstGroupItem: { paddingTop: '8px' },
  why: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
    maxWidth: '360px',
    padding: '4px 0',
  },
  whyTrigger: {
    minWidth: 'auto',
    padding: '2px',
    height: 'auto',
    color: tokens.colorNeutralForeground3,
    ':hover': { color: tokens.colorBrandForeground1 },
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  checkboxList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  savedSecret: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '6px',
    background: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  savedSecretIcon: {
    color: tokens.colorPaletteGreenForeground1,
    fontSize: '16px',
    flexShrink: 0,
  },
  savedSecretEdit: {
    marginLeft: 'auto',
    minWidth: 'auto',
    padding: '2px 8px',
    height: 'auto',
  },
});

function matchesCondition(condition: QuestionCondition | QuestionCondition[], answers: Record<string, unknown>): boolean {
  const conditions: QuestionCondition[] = Array.isArray(condition) ? condition : [condition];
  return conditions.every((c) => {
    const value = answers[c.id];
    if ('contains' in c) return Array.isArray(value) && value.includes(c.contains);
    return value === c.equals;
  });
}

export function isQuestionHidden(q: Question, answers: Record<string, unknown>): boolean {
  if (q.showIf && !matchesCondition(q.showIf, answers)) return true;
  if (q.hideIf && matchesCondition(q.hideIf, answers)) return true;
  return false;
}

function validateUrl(value: string): string | null {
  if (!value) return null;
  // Accept with or without https:// — the server normalizes on save
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(candidate);
    if (!u.protocol.startsWith('https')) return 'Must be an https:// URL';
    return null;
  } catch { return 'Not a valid URL'; }
}

interface Props {
  question: Question;
  answers: Record<string, unknown>;
  value: unknown;
  onChange: (id: string, value: unknown) => void;
  showError?: boolean;
}

function questionError(q: Question, value: unknown, showError?: boolean): string | null {
  return (
    (q.required && (value == null || value === '') && showError) ? 'Required' :
    (q.validatePattern === 'dataverseUrl' && typeof value === 'string') ? validateUrl(value) :
    null
  );
}

function QuestionContent({ question: q, value, onChange, showError, answers }: Props) {
  const s = useStyles();
  const error = questionError(q, value, showError);
  const [editingSecret, setEditingSecret] = useState(false);
  const showSavedIndicator = q.type === 'secret' && q.savedHint && !value && !editingSecret;

  // ── Dynamic options: fetch from API when dependency changes ──
  const dyn = q.dynamicOptions;
  const depValue = dyn ? String(answers[dyn.dependsOn] ?? '') : '';
  const [dynamicOpts, setDynamicOpts] = useState<Array<{ value: string; label: string }>>([]);
  const [dynamicLoading, setDynamicLoading] = useState(false);
  const prevDepRef = useRef(depValue);

  useEffect(() => {
    if (!dyn) return;
    // Skip when dependency is empty, falsy (false/"false"/"0"), or a sentinel (create new / enter manually)
    const isFalsy = !depValue || depValue === 'false' || depValue === '0';
    if (isFalsy || depValue.startsWith('__')) {
      setDynamicOpts([]);
      prevDepRef.current = depValue;
      return;
    }
    if (depValue === prevDepRef.current && dynamicOpts.length > 0) return;
    prevDepRef.current = depValue;
    setDynamicLoading(true);
    const controller = new AbortController();
    fetch(`${dyn.endpoint}?${dyn.param}=${encodeURIComponent(depValue)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const items: Array<{ value: string; label: string }> = data[dyn.responseKey] || [];
        setDynamicOpts(items);
        setDynamicLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDynamicLoading(false);
      });
    return () => controller.abort();
  }, [dyn, depValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge: static sentinel options (create new, enter manually) come from q.options,
  // dynamic items from the API. Static options starting with __ are always appended at the end.
  const resolvedOptions = useMemo(() => {
    if (!dyn) return q.options || [];
    const sentinels = (q.options || []).filter((o) => o.value.startsWith('__'));
    return [...dynamicOpts, ...sentinels];
  }, [dyn, q.options, dynamicOpts]);

  const labelEl = (
    <span className={s.labelRow}>
      {q.label}{q.required ? <span className={s.required} aria-hidden>*</span> : null}
      {q.why && (
        <Popover withArrow>
          <PopoverTrigger disableButtonEnhancement>
            <Button
              appearance="transparent"
              icon={<QuestionCircleRegular />}
              size="small"
              className={s.whyTrigger}
              aria-label={`More info about ${q.label}`}
            />
          </PopoverTrigger>
          <PopoverSurface>
            <div className={s.why}>{linkify(q.why)}</div>
          </PopoverSurface>
        </Popover>
      )}
    </span>
  );

  return (
    <>
      <Field
        label={labelEl}
        validationState={error ? 'error' : undefined}
        validationMessage={error || undefined}
      >
        {q.type === 'text' || q.type === 'url' ? (
          <Input
            value={(value as string) ?? ''}
            onChange={(_e: ChangeEvent<HTMLInputElement>, d) => onChange(q.id, d.value)}
            aria-required={q.required || undefined}
          />
        ) : q.type === 'secret' ? (
          showSavedIndicator ? (
            <div className={s.savedSecret}>
              <LockClosedRegular className={s.savedSecretIcon} />
              <span>{q.savedHint}</span>
              <Button
                appearance="subtle"
                size="small"
                icon={<EditRegular />}
                className={s.savedSecretEdit}
                onClick={() => setEditingSecret(true)}
              >
                Change
              </Button>
            </div>
          ) : (
            <Input
              type="password"
              value={(value as string) ?? ''}
              onChange={(_e, d) => onChange(q.id, d.value)}
              placeholder={q.savedHint ? 'Enter new value to replace' : undefined}
              aria-required={q.required || undefined}
            />
          )
        ) : q.type === 'confirm' ? (
          <Switch checked={!!value} onChange={(_e, d) => onChange(q.id, d.checked)} />
        ) : q.type === 'select' ? (
          dynamicLoading ? (
            <Spinner size="tiny" label="Loading options…" />
          ) : (
            <Combobox
              value={(resolvedOptions.find((o) => o.value === value)?.label) ?? ''}
              selectedOptions={value ? [String(value)] : []}
              onOptionSelect={(_e, d) => onChange(q.id, d.optionValue)}
            >
              {resolvedOptions.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Combobox>
          )
        ) : q.type === 'multiselect' ? (
          <Textarea
            value={Array.isArray(value) ? (value as string[]).join(', ') : ''}
            onChange={(_e, d) => onChange(q.id, d.value.split(',').map((x) => x.trim()).filter(Boolean))}
          />
        ) : q.type === 'checkboxes' ? (
          <div className={s.checkboxList}>
            {(q.options || []).map((o) => {
              const checked = Array.isArray(value) && (value as string[]).includes(o.value);
              return (
                <Checkbox
                  key={o.value}
                  label={o.label}
                  checked={checked}
                  onChange={(_e, d) => {
                    const current = Array.isArray(value) ? [...(value as string[])] : [];
                    onChange(q.id, d.checked
                      ? Array.from(new Set([...current, o.value]))
                      : current.filter((entry) => entry !== o.value));
                  }}
                />
              );
            })}
          </div>
        ) : (
          <Caption1>Unsupported question type: {q.type}</Caption1>
        )}
      </Field>

      {q.help && <Body2 className={s.help}>{linkify(q.help)}</Body2>}
    </>
  );
}

export function QuestionCard({ question: q, answers, value, onChange, showError }: Props) {
  const s = useStyles();
  if (isQuestionHidden(q, answers)) return null;

  return (
    <div className={s.card}>
      <QuestionContent question={q} answers={answers} value={value} onChange={onChange} showError={showError} />
    </div>
  );
}

interface GroupProps {
  group: QuestionGroup;
  questions: Question[];
  answers: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  showError?: boolean;
}

export function QuestionGroupCard({ group, questions, answers, onChange, showError }: GroupProps) {
  const s = useStyles();
  const visibleQuestions = questions.filter((q) => !isQuestionHidden(q, answers));
  if (visibleQuestions.length === 0) return null;

  return (
    <div className={s.card}>
      <div className={s.groupHeader}>
        <Body1 className={s.groupTitle}>{group.label}</Body1>
        {group.help && <Body2 className={s.help}>{group.help}</Body2>}
      </div>
      <div className={s.groupItems}>
        {visibleQuestions.map((q, index) => (
          <div key={q.id} className={`${s.groupItem} ${index === 0 ? s.firstGroupItem : ''}`}>
            <QuestionContent
              question={q}
              answers={answers}
              value={answers[q.id]}
              onChange={onChange}
              showError={showError}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
