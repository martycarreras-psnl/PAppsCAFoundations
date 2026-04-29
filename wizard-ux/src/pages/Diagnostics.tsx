import {
  makeStyles, tokens, Body1, Title3, Caption1, Subtitle2, Badge, Spinner,
} from '@fluentui/react-components';
import {
  StethoscopeRegular, DesktopRegular, BranchRegular, ShieldKeyholeRegular,
  CheckmarkCircleFilled, DismissCircleFilled, InfoRegular,
} from '@fluentui/react-icons';
import { ReactNode } from 'react';
import { PageHero } from '../components/PageHero';
import { useSystem, useWizardState } from '../hooks/useWizardData';
import { gradients } from '../theme/tokens';

const useStyles = makeStyles({
  root: { height: '100%', overflowY: 'auto' },
  body: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1080px',
    margin: '0 auto',
    padding: '0 32px 80px',
    display: 'grid',
    gap: '32px',
  },

  sectionLabel: {
    display: 'block',
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase200,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    marginBottom: '6px',
  },
  sectionTitle: { margin: 0, letterSpacing: '-0.01em' },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
    marginTop: '20px',
  },
  card: {
    padding: '20px',
    borderRadius: '12px',
    background: tokens.colorNeutralBackground1,
    borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px',
    borderTopStyle: 'solid', borderRightStyle: 'solid', borderBottomStyle: 'solid', borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2, borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2, borderLeftColor: tokens.colorNeutralStroke2,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: '10px',
    marginBottom: '12px', paddingBottom: '12px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  cardIcon: {
    width: '32px', height: '32px',
    borderRadius: '8px',
    display: 'grid', placeItems: 'center',
    background: gradients.accent,
    color: '#ffffff',
    fontSize: '16px',
    flexShrink: 0,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '8px', paddingBottom: '8px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke3,
    ':last-child': { borderBottomColor: 'transparent' },
  },
  rowLabel: { color: tokens.colorNeutralForeground3, display: 'flex', alignItems: 'center', gap: '6px' },
  rowVal: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground1,
    textAlign: 'right',
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  rowValMissing: { color: tokens.colorPaletteRedForeground1, fontStyle: 'italic', fontFamily: tokens.fontFamilyBase },

  pre: {
    margin: 0,
    padding: '16px',
    background: tokens.colorNeutralBackground3,
    borderRadius: '10px',
    overflowX: 'auto',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: 1.6,
    color: tokens.colorNeutralForeground1,
    maxHeight: '480px',
    overflowY: 'auto',
  },
});

function StatusRow({
  icon, label, value, ok, neutral,
}: {
  icon?: ReactNode;
  label: string;
  value: string | null | undefined;
  ok?: boolean;
  neutral?: boolean;
}) {
  const s = useStyles();
  const missing = !value;
  const indicator = neutral
    ? <InfoRegular style={{ color: tokens.colorBrandForeground1 }} />
    : ok
      ? <CheckmarkCircleFilled style={{ color: tokens.colorPaletteGreenForeground1 }} />
      : <DismissCircleFilled style={{ color: tokens.colorPaletteRedForeground1 }} />;

  return (
    <div className={s.row}>
      <Caption1 className={s.rowLabel}>
        {indicator}
        {icon}
        {label}
      </Caption1>
      <Caption1 className={missing ? `${s.rowVal} ${s.rowValMissing}` : s.rowVal}>
        {missing ? 'not detected' : value}
      </Caption1>
    </div>
  );
}

export function Diagnostics() {
  const s = useStyles();
  const sysQ = useSystem();
  const stateQ = useWizardState();
  const sys = sysQ.data;

  return (
    <div className={s.root}>
      <PageHero
        eyebrowIcon={<StethoscopeRegular />}
        eyebrow="Diagnostics"
        title="What the wizard sees on this machine"
        subtitle="A read-only view of system tooling and the raw .wizard-state.json. If something looks off, this is where you check first."
      />

      <div className={s.body}>
        {!sys && <Spinner size="medium" />}

        {sys && (
          <section>
            <span className={s.sectionLabel}>Environment</span>
            <Title3 as="h2" className={s.sectionTitle}>Tooling and host detection</Title3>

            <div className={s.grid}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <div className={s.cardIcon}><DesktopRegular /></div>
                  <Subtitle2>Host</Subtitle2>
                </div>
                <StatusRow neutral label="OS" value={`${sys.os.platform} ${sys.os.release}`} />
                <StatusRow ok={!!sys.node} label="Node.js" value={sys.node} />
                <StatusRow ok={!!sys.git} label="Git" value={sys.git} />
                <StatusRow ok={!!sys.dotnet} label=".NET SDK" value={sys.dotnet} />
              </div>

              <div className={s.card}>
                <div className={s.cardHeader}>
                  <div className={s.cardIcon}><ShieldKeyholeRegular /></div>
                  <Subtitle2>Power Platform tooling</Subtitle2>
                </div>
                <StatusRow ok={!!sys.pac} label="PAC CLI" value={sys.pac} />
                <div className={s.row}>
                  <Caption1 className={s.rowLabel}>
                    {sys.op
                      ? <CheckmarkCircleFilled style={{ color: tokens.colorPaletteGreenForeground1 }} />
                      : <InfoRegular style={{ color: tokens.colorBrandForeground1 }} />}
                    1Password CLI
                  </Caption1>
                  <Badge appearance="filled" color={sys.op ? 'success' : 'informative'}>
                    {sys.op ? sys.op : 'optional · not installed'}
                  </Badge>
                </div>
              </div>

              <div className={s.card}>
                <div className={s.cardHeader}>
                  <div className={s.cardIcon}><BranchRegular /></div>
                  <Subtitle2>Repository</Subtitle2>
                </div>
                <StatusRow neutral label="Branch" value={sys.branch} />
                <div className={s.row}>
                  <Caption1 className={s.rowLabel}>
                    {sys.repoIsClean
                      ? <CheckmarkCircleFilled style={{ color: tokens.colorPaletteGreenForeground1 }} />
                      : <InfoRegular style={{ color: tokens.colorPaletteYellowForeground1 }} />}
                    Working tree
                  </Caption1>
                  <Badge appearance="filled" color={sys.repoIsClean ? 'success' : 'warning'}>
                    {sys.repoIsClean ? 'clean' : 'has uncommitted changes'}
                  </Badge>
                </div>
                <StatusRow neutral label="Root" value={sys.rootDir} />
              </div>
            </div>
          </section>
        )}

        <section>
          <span className={s.sectionLabel}>Raw state</span>
          <Title3 as="h2" className={s.sectionTitle}>.wizard-state.json</Title3>
          <Body1 style={{ color: tokens.colorNeutralForeground2, marginTop: '8px', marginBottom: '16px' }}>
            The exact contents the server sees on disk. This is what every step reads from and writes to.
          </Body1>
          <pre className={s.pre}>{JSON.stringify(stateQ.data?.state ?? {}, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}
