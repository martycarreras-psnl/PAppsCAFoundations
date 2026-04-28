import { ReactNode } from 'react';
import { makeStyles, tokens, Body1 } from '@fluentui/react-components';
import { HeroBackground } from './HeroBackground';
import { gradients } from '../theme/tokens';

const useStyles = makeStyles({
  hero: {
    position: 'relative',
    minHeight: '260px',
    display: 'grid',
    placeItems: 'center',
    paddingTop: '56px',
    paddingRight: '32px',
    paddingBottom: '36px',
    paddingLeft: '32px',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
    maxWidth: '760px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '999px',
    background: tokens.colorNeutralBackground1,
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    boxShadow: tokens.shadow4,
    fontSize: tokens.fontSizeBase200,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: tokens.colorBrandForeground1,
  },
  title: {
    margin: 0,
    background: gradients.accent,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.02em',
    fontSize: 'clamp(30px, 4.2vw, 44px)',
    lineHeight: 1.1,
    fontWeight: 700,
    width: '100%',
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase400,
    lineHeight: 1.55,
    maxWidth: '620px',
  },
});

export interface PageHeroProps {
  eyebrowIcon?: ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export function PageHero({ eyebrowIcon, eyebrow, title, subtitle }: PageHeroProps) {
  const s = useStyles();
  return (
    <div className={s.hero}>
      <HeroBackground />
      <div className={s.inner}>
        <div className={s.pill}>
          {eyebrowIcon}
          {eyebrow}
        </div>
        <h1 className={s.title}>{title}</h1>
        {subtitle && <Body1 className={s.subtitle}>{subtitle}</Body1>}
      </div>
    </div>
  );
}
