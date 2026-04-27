import { Routes, Route, Navigate } from 'react-router-dom';
import { makeStyles, tokens } from '@fluentui/react-components';
import { AppHeader } from './components/AppHeader';
import { Welcome } from './pages/Welcome';
import { StepRunner } from './pages/StepRunner';
import { Summary } from './pages/Summary';
import { Diagnostics } from './pages/Diagnostics';

const useStyles = makeStyles({
  root: {
    height: '100vh',
    display: 'grid',
    gridTemplateRows: '64px 1fr',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  body: {
    overflow: 'hidden',
    minHeight: 0,
  },
});

export default function App() {
  const s = useStyles();
  return (
    <div className={s.root}>
      <AppHeader />
      <div className={s.body}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/step/:n" element={<StepRunner />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
