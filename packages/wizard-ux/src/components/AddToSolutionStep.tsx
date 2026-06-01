import { useState } from 'react';
import {
  makeStyles, tokens, Title2, Title3, Body1, Body2, Caption1,
  Button, Checkbox, Badge,
} from '@fluentui/react-components';
import {
  OpenRegular, CheckmarkCircleFilled, WarningFilled,
  SearchRegular, AddRegular, ChevronRightRegular, ArrowLeftRegular,
  ArrowRightFilled,
} from '@fluentui/react-icons';
import { gradients } from '../theme/tokens';

interface SolutionInfo {
  displayName: string;
  uniqueName: string;
  appName: string;
  makerPortalUrl: string;
  linkTarget: 'solution' | 'solutions' | 'portal';
}

interface Props {
  solution: SolutionInfo;
  stepNumber: number;
  totalSteps: number;
  onBack: () => void;
  onFinish: () => void;
}

const useStyles = makeStyles({
  wrap: { display: 'flex', flexDirection: 'column', gap: '20px' },

  requiredBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, rgba(193,99,12,0.12), rgba(255,185,0,0.08))',
    border: `1px solid ${tokens.colorPaletteDarkOrangeBorderActive}`,
  },
  requiredIcon: { fontSize: '22px', color: tokens.colorPaletteDarkOrangeForeground1, flexShrink: 0 },

  intro: { color: tokens.colorNeutralForeground2 },

  steps: { display: 'flex', flexDirection: 'column', gap: '16px' },
  stepRow: { display: 'flex', gap: '14px', alignItems: 'flex-start' },
  stepNum: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: gradients.accent, color: '#fff',
    display: 'grid', placeItems: 'center',
    fontWeight: 700, fontSize: '14px', flexShrink: 0, marginTop: '2px',
  },
  stepBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 },

  ctaPrimary: {
    background: gradients.accent,
    color: '#ffffff',
    border: 'none',
    boxShadow: tokens.shadow4,
    minWidth: '260px',
    height: '44px',
    fontWeight: 600,
    alignSelf: 'flex-start',
  },

  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    borderRadius: '6px',
    background: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    fontWeight: 600,
  },
  outsidePill: {
    background: 'rgba(0,120,212,0.10)',
    border: `1px solid ${tokens.colorBrandStroke1}`,
    color: tokens.colorBrandForeground1,
  },

  // ─── Illustration: Maker Portal "Add existing → App → Code app" ───
  figure: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' },
  illo: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
    overflow: 'hidden',
    background: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
    maxWidth: '620px',
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '18px',
    padding: '10px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    background: tokens.colorNeutralBackground2,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  toolbarItem: { display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' },
  toolbarActive: {
    color: tokens.colorBrandForeground1,
    fontWeight: 700,
    position: 'relative',
  },
  menus: { display: 'flex', alignItems: 'flex-start', padding: '14px 16px', gap: '8px', flexWrap: 'wrap' },
  menu: {
    minWidth: '170px',
    borderRadius: '8px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    background: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    overflow: 'hidden',
    paddingTop: '4px', paddingBottom: '4px',
  },
  menuItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '12px',
    padding: '7px 12px',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  menuItemActive: {
    background: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: 600,
  },
  menuItemHighlight: {
    position: 'relative',
    background: tokens.colorNeutralBackground1,
    outline: `2px solid ${tokens.colorPaletteRedBorderActive}`,
    outlineOffset: '-2px',
    borderRadius: '6px',
    fontWeight: 700,
    color: tokens.colorPaletteRedForeground1,
  },
  connector: {
    alignSelf: 'center',
    color: tokens.colorNeutralForeground3,
    fontSize: '18px',
    flexShrink: 0,
  },
  caption: { color: tokens.colorNeutralForeground3 },

  confirmRow: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '16px 18px',
    borderRadius: '10px',
    background: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },

  actions: {
    display: 'flex', gap: '8px', alignItems: 'center',
    paddingTop: '16px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: '4px',
  },
  spacer: { flex: 1 },
});

/** Faithful recreation of the Maker Portal "+ Add existing → App → Code app" menu. */
function AddExistingIllustration() {
  const s = useStyles();
  return (
    <div className={s.figure}>
      <div className={s.illo} role="img" aria-label="Solution toolbar: Add existing, then App, then Code app">
        <div className={s.toolbar}>
          <span className={s.toolbarItem}><AddRegular /> New</span>
          <span className={[s.toolbarItem, s.toolbarActive].join(' ')}><AddRegular /> Add existing ⌄</span>
          <span className={s.toolbarItem}>↥ Publish all customizations</span>
          <span className={s.toolbarItem}>•••</span>
        </div>
        <div className={s.menus}>
          <div className={s.menu}>
            <div className={s.menuItem}>Automation</div>
            <div className={[s.menuItem, s.menuItemActive].join(' ')}>
              <span>App</span><ChevronRightRegular />
            </div>
            <div className={s.menuItem}>Dashboard</div>
            <div className={s.menuItem}>Table <ChevronRightRegular /></div>
            <div className={s.menuItem}>More <ChevronRightRegular /></div>
          </div>
          <ChevronRightRegular className={s.connector} />
          <div className={s.menu}>
            <div className={s.menuItem}>Canvas app</div>
            <div className={[s.menuItem, s.menuItemHighlight].join(' ')}>Code app</div>
            <div className={s.menuItem}>Model-driven app</div>
            <div className={s.menuItem}>Page</div>
          </div>
        </div>
      </div>
      <Caption1 className={s.caption}>
        In your solution, select <strong>+ Add existing → App → Code app</strong>.
      </Caption1>
    </div>
  );
}

export function AddToSolutionStep({ solution, stepNumber, totalSteps, onBack, onFinish }: Props) {
  const s = useStyles();
  const [confirmed, setConfirmed] = useState(false);

  const appName = solution.appName || 'your Code app';
  const solutionName = solution.displayName || solution.uniqueName || 'your target solution';
  const openLabel = solution.linkTarget === 'solution'
    ? `Open ${solutionName} in the Maker Portal`
    : solution.linkTarget === 'solutions'
      ? 'Open Solutions in the Maker Portal'
      : 'Open the Power Apps Maker Portal';

  return (
    <div className={s.wrap}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className={s.stepNum} style={{ width: 36, height: 36, borderRadius: 10 }}>{stepNumber}</div>
        <div style={{ flex: 1 }}>
          <Title2 style={{ margin: 0 }}>Add your Code app to your solution</Title2>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            Step {stepNumber} of {totalSteps} · required manual step
          </Caption1>
        </div>
      </div>

      {/* Required banner */}
      <div className={s.requiredBanner}>
        <WarningFilled className={s.requiredIcon} />
        <Body1 style={{ fontWeight: 600 }}>
          This step is required and can’t be done from the terminal — you must add the Code app to
          your solution by hand in the Maker Portal. A deployed Code app is <em>not</em> automatically
          included in your solution.
        </Body1>
      </div>

      <Body1 className={s.intro}>
        Your app is deployed, but Power Platform does not reliably bind a Code app to its solution
        during <code>pac code push</code>. Follow the three steps below to add it yourself — it takes
        under a minute.
      </Body1>

      {/* Steps */}
      <div className={s.steps}>
        {/* Step 1 — open solution */}
        <div className={s.stepRow}>
          <div className={s.stepNum}>1</div>
          <div className={s.stepBody}>
            <Title3>Open your solution</Title3>
            <Body2 style={{ color: tokens.colorNeutralForeground2 }}>
              {solution.linkTarget === 'solution'
                ? <>This link opens <strong>{solutionName}</strong> directly.</>
                : solution.linkTarget === 'solutions'
                  ? <>This opens the Solutions list — find and open <strong>{solutionName}</strong>.</>
                  : <>Open the Maker Portal, switch to your target environment, then open <strong>{solutionName}</strong>.</>}
            </Body2>
            <Button
              className={s.ctaPrimary}
              icon={<OpenRegular />}
              as="a"
              href={solution.makerPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {openLabel}
            </Button>
          </div>
        </div>

        {/* Step 2 — add existing code app */}
        <div className={s.stepRow}>
          <div className={s.stepNum}>2</div>
          <div className={s.stepBody}>
            <Title3>Choose “Add existing → App → Code app”</Title3>
            <Body2 style={{ color: tokens.colorNeutralForeground2 }}>
              On the solution toolbar, select <span className={s.pill}><AddRegular />Add existing</span>,
              then <span className={s.pill}>App</span>, then <span className={s.pill}>Code app</span>.
            </Body2>
            <AddExistingIllustration />
          </div>
        </div>

        {/* Step 3 — outside dataverse search */}
        <div className={s.stepRow}>
          <div className={s.stepNum}>3</div>
          <div className={s.stepBody}>
            <Title3>
              Switch to <span className={[s.pill, s.outsidePill].join(' ')}>Outside Dataverse</span> and add your app
            </Title3>
            <Body2 style={{ color: tokens.colorNeutralForeground2 }}>
              Code apps are <strong>not</strong> stored in Dataverse, so the picker won’t show them under
              the default tab. Select the <span className={[s.pill, s.outsidePill].join(' ')}>Outside Dataverse</span>{' '}
              filter, then <SearchRegular style={{ verticalAlign: 'middle' }} /> search for{' '}
              <Badge appearance="tint" color="brand">{appName}</Badge>, select it, and click <strong>Add</strong>.
            </Body2>
          </div>
        </div>
      </div>

      {/* Confirmation */}
      <div className={s.confirmRow}>
        <Checkbox
          checked={confirmed}
          onChange={(_, d) => setConfirmed(Boolean(d.checked))}
          label={
            <Body1>
              I’ve added <strong>{appName}</strong> to <strong>{solutionName}</strong> using the
              “Outside Dataverse” filter.
            </Body1>
          }
        />
        {confirmed && (
          <Caption1 style={{ color: tokens.colorPaletteGreenForeground1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckmarkCircleFilled /> Nicely done — your Code app now travels with your solution.
          </Caption1>
        )}
      </div>

      {/* Actions */}
      <div className={s.actions}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={onBack}>Back</Button>
        <div className={s.spacer} />
        <Button
          className={s.ctaPrimary}
          style={{ minWidth: '160px', height: '40px' }}
          iconPosition="after"
          icon={<ArrowRightFilled />}
          onClick={onFinish}
          disabled={!confirmed}
        >
          Finish
        </Button>
      </div>
    </div>
  );
}
