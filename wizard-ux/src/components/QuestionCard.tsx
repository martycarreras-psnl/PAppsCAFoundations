import { Question, QuestionCondition } from '../types/schema';
import {
  Field, Input, Switch, Combobox, Option, Textarea, Caption1, makeStyles, tokens, Body2,
} from '@fluentui/react-components';
import { ChangeEvent } from 'react';

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
  why: {
    background: tokens.colorNeutralBackground3,
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
  },
});

function matchesCondition(condition: QuestionCondition | QuestionCondition[], answers: Record<string, unknown>): boolean {
  const conditions: QuestionCondition[] = Array.isArray(condition) ? condition : [condition];
  return conditions.every((c) => answers[c.id] === c.equals);
}

export function isQuestionHidden(q: Question, answers: Record<string, unknown>): boolean {
  if (q.showIf && !matchesCondition(q.showIf, answers)) return true;
  if (q.hideIf && matchesCondition(q.hideIf, answers)) return true;
  return false;
}

function validateUrl(value: string): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
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

export function QuestionCard({ question: q, answers, value, onChange, showError }: Props) {
  const s = useStyles();
  if (isQuestionHidden(q, answers)) return null;

  const error =
    (q.required && (value == null || value === '') && showError) ? 'Required' :
    (q.validatePattern === 'dataverseUrl' && typeof value === 'string') ? validateUrl(value) :
    null;

  const labelEl = (
    <span>
      {q.label}{q.required ? <span className={s.required} aria-hidden>*</span> : null}
    </span>
  );

  return (
    <div className={s.card}>
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
          <Input
            type="password"
            value={(value as string) ?? ''}
            onChange={(_e, d) => onChange(q.id, d.value)}
            aria-required={q.required || undefined}
          />
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
        ) : (
          <Caption1>Unsupported question type: {q.type}</Caption1>
        )}
      </Field>

      {q.help && <Body2 className={s.help}>{q.help}</Body2>}
      {q.why && <div className={s.why}>{q.why}</div>}
    </div>
  );
}
