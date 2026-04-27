import { Link, useLocation } from 'react-router-dom';
import {
  makeStyles, tokens, Button, Tooltip, Body1Strong, mergeClasses,
} from '@fluentui/react-components';
import {
  WeatherMoonRegular, WeatherSunnyRegular, DesktopRegular,
  HomeRegular, BoxMultipleRegular, InfoRegular,
} from '@fluentui/react-icons';
import { useTheme } from '../theme/ThemeProvider';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '0 24px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    backdropFilter: 'blur(12px)',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: '12px',
    color: tokens.colorNeutralForeground1,
    textDecoration: 'none',
  },
  badge: {
    width: '32px', height: '32px',
    borderRadius: '8px',
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackground2} 100%)`,
    display: 'grid', placeItems: 'center',
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: 700,
    boxShadow: tokens.shadow4Brand,
  },
  spacer: { flex: 1 },
  navLinks: { display: 'flex', gap: '4px' },
  navLink: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 10px',
    borderRadius: '6px',
    color: tokens.colorNeutralForeground2,
    textDecoration: 'none',
    fontSize: tokens.fontSizeBase300,
  },
  navLinkActive: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
});

export function AppHeader() {
  const s = useStyles();
  const { mode, setMode } = useTheme();
  const loc = useLocation();
  const isActive = (path: string) => loc.pathname === path || (path !== '/' && loc.pathname.startsWith(path));

  const next = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
  const Icon = mode === 'dark' ? WeatherMoonRegular : mode === 'light' ? WeatherSunnyRegular : DesktopRegular;

  return (
    <header className={s.root}>
      <Link to="/" className={s.brand}>
        <div className={s.badge}>P</div>
        <Body1Strong>WizardUX</Body1Strong>
      </Link>

      <div className={s.spacer} />

      <nav className={s.navLinks}>
        <Link to="/" className={mergeClasses(s.navLink, isActive('/') && s.navLinkActive)}>
          <HomeRegular /> Home
        </Link>
        <Link to="/summary" className={mergeClasses(s.navLink, isActive('/summary') && s.navLinkActive)}>
          <BoxMultipleRegular /> Summary
        </Link>
        <Link to="/diagnostics" className={mergeClasses(s.navLink, isActive('/diagnostics') && s.navLinkActive)}>
          <InfoRegular /> Diagnostics
        </Link>
      </nav>

      <Tooltip relationship="label" content={`Theme: ${mode}. Click to cycle.`}>
        <Button appearance="subtle" icon={<Icon />} onClick={() => setMode(next)} aria-label="Toggle theme" />
      </Tooltip>
    </header>
  );
}
