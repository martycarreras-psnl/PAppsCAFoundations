import { Question, QuestionCondition, QuestionGroup } from '../types/schema';
import {
  Field, Input, Switch, Combobox, Option, Textarea, Caption1, makeStyles, tokens, Body2, Body1, Checkbox,
  Popover, PopoverTrigger, PopoverSurface, Button,
} from '@fluentui/react-components';
import { QuestionCircleRegular, LockClosedRegular, EditRegular } from '@fluentui/react-icons';
import { ChangeEvent, useState } from 'react';

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

function QuestionContent({ question: q, value, onChange, showError }: Omit<Props, 'answers'>) {
  const s = useStyles();
  const error = questionError(q, value, showError);
  const [editingSecret, setEditingSecret] = useState(false);
  const showSavedIndicator = q.type === 'secret' && q.savedHint && !value && !editingSecret;

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
            <div className={s.why}>{q.why}</div>
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
          <Combobox
            value={(q.options?.find((o) => o.value === value)?.label) ?? ''}
            selectedOptions={value ? [String(value)] : []}
            onOptionSelect={(_e, d) => onChange(q.id, d.optionValue)}
          >
            {(q.options || []).map((o) => (
              <Option key={o.value} value={o.value}>{o.label}</Option>
            ))}
          </Combobox>
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

      {q.help && <Body2 className={s.help}>{q.help}</Body2>}
    </>
  );
}

export function QuestionCard({ question: q, answers, value, onChange, showError }: Props) {
  const s = useStyles();
  if (isQuestionHidden(q, answers)) return null;

  return (
    <div className={s.card}>
      <QuestionContent question={q} value={value} onChange={onChange} showError={showError} />
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
