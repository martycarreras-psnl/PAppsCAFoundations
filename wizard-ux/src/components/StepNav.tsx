import { useNavigate, useLocation } from 'react-router-dom';
import { makeStyles, tokens, Caption1, Body2 } from '@fluentui/react-components';
import { CheckmarkCircleFilled, CircleRegular, ArrowRightFilled, WindowConsoleRegular } from '@fluentui/react-icons';
import { StepInfo } from '../types/schema';

const useStyles = makeStyles({
  root: {
    width: '220px',
    height: '100%',
    overflowY: 'auto',
    padding: '12px',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  heading: { color: tokens.colorNeutralForeground3, paddingLeft: '8px', marginBottom: '6px' },
  item: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'background-color 150ms ease-out',
    ':hover': { backgroundColor: tokens.colorNeutralBackground3 },
  },
  itemActive: {
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorBrandStroke2}`,
  },
  iconCol: {
    flex: '0 0 18px',
    fontSize: '18px',
    display: 'grid', placeItems: 'center',
  },
  done: { color: tokens.colorPaletteGreenForeground1 },
  current: { color: tokens.colorBrandForeground1 },
  pending: { color: tokens.colorNeutralForeground3 },
  terminal: { color: tokens.colorNeutralForeground3 },
  title: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
});

interface Props {
  steps: StepInfo[];
  current: number;
}

export function StepNav({ steps, current }: Props) {
  const s = useStyles();
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <nav className={s.root} aria-label="Wizard steps">
      <Caption1 className={s.heading}>STEPS</Caption1>
      {steps.map((step) => {
        const active = step.number === current && loc.pathname.includes('/step/');
        const Icon = step.status === 'done' ? CheckmarkCircleFilled
          : step.status === 'current' ? ArrowRightFilled
          : !step.canRunInBrowser ? WindowConsoleRegular
          : CircleRegular;
        const iconClass = step.status === 'done' ? s.done
          : step.status === 'current' ? s.current
          : !step.canRunInBrowser ? s.terminal
          : s.pending;

        return (
          <div
            key={step.number}
            className={[s.item, active && s.itemActive].filter(Boolean).join(' ')}
            onClick={() => navigate(`/step/${step.number}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/step/${step.number}`); }}
            aria-current={active ? 'step' : undefined}
          >
            <div className={`${s.iconCol} ${iconClass}`}><Icon /></div>
            <Body2 className={s.title}>{step.number}. {step.title}</Body2>
          </div>
        );
      })}
    </nav>
  );
}
