// wizard-ux/server/steps/index.mjs — Step registry for WizardUX.
//
// Each step module exports:
//   meta:      { number, title, description, canRunInBrowser }
//   questions: (state) => Question[]   — pure, called on every render
//   apply:     async (answers, state, log) => Partial<State>  — side effects
import step1 from './01-prerequisites.mjs';
import step2 from './02-project-and-env.mjs';
import step3 from './03-app-registration.mjs';
import step4 from './04-auth-setup.mjs';
import step5 from './05-environments.mjs';
import step6 from './06-publisher.mjs';
import step7 from './07-solution.mjs';
import step8 from './08-scaffold.mjs';
import step9 from './09-verify-deploy.mjs';
import step10 from './10-add-to-solution.mjs';

// Connector binding is deliberately NOT a setup step. It is phase 7 of the
// prototype-first golden path (docs/prototype-golden-path.md) and cannot be
// answered correctly here: at setup time there is no stable planning payload,
// no prototype, and usually zero connections in the environment. Bind
// connectors later via the Code Apps plugin (/add-datasource) or
// `pac code add-data-source`. See issue: helixone Step 9 dead-end.
export const STEPS = [step1, step2, step3, step4, step5, step6, step7, step8, step9, step10];
export const TOTAL_STEPS = STEPS.length;

export function getStep(n) {
  const s = STEPS[n - 1];
  if (!s) throw new Error(`Unknown step ${n}`);
  return s;
}
