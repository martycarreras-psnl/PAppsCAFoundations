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
import step5 from './05-publisher.mjs';
import step6 from './06-solution.mjs';
import step7 from './07-scaffold.mjs';
import step8 from './08-connectors.mjs';
import step9 from './09-verify-deploy.mjs';
import step10 from './10-add-to-solution.mjs';

export const STEPS = [step1, step2, step3, step4, step5, step6, step7, step8, step9, step10];
export const TOTAL_STEPS = STEPS.length;

export function getStep(n) {
  const s = STEPS[n - 1];
  if (!s) throw new Error(`Unknown step ${n}`);
  return s;
}
