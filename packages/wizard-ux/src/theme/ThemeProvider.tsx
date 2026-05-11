import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { darkTheme, lightTheme } from './tokens';

type Mode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'wizardux.theme';

interface ThemeCtx {
  mode: Mode;
  resolved: 'light' | 'dark';
  setMode: (m: Mode) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function getSystem(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(STORAGE_KEY) as Mode) || 'system');
  const [systemPref, setSystemPref] = useState<'light' | 'dark'>(getSystem);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemPref(getSystem());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const resolved = mode === 'system' ? systemPref : mode;
  const theme = resolved === 'dark' ? darkTheme : lightTheme;

  // Sync body bg so the boot loader / overscroll feel cohesive
  useEffect(() => {
    document.body.style.background = theme.colorNeutralBackground1;
    document.body.style.color = theme.colorNeutralForeground1;
  }, [theme]);

  const value = useMemo<ThemeCtx>(() => ({ mode, resolved, setMode }), [mode, resolved]);

  return (
    <Ctx.Provider value={value}>
      <FluentProvider theme={theme} style={{ height: '100%' }}>
        {children}
      </FluentProvider>
    </Ctx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
