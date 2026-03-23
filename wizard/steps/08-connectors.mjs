import { confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { pacPath } from '../lib/shell.mjs';
import { setupConnectors } from './07-scaffold.mjs';

export default async function stepConnectors() {
  ui.stepHeader(8, TOTAL_STEPS, 'Bind Connectors & Data Sources');

  const projectDir = stateGet('PROJECT_DIR');
  const pac = pacPath();

  ui.line('This step is intentionally separate from the initial scaffold.');
  ui.line('Use it after the planning payload and prototype are stable enough');
  ui.line('to bind real systems and create solution-aware connection references.');
  ui.line('');
  ui.line('Recommended sequence:');
  ui.line('  1. Plan the workflow');
  ui.line('  2. Prototype with mock providers');
  ui.line('  3. Capture feedback and update the planning payload');
  ui.line('  4. Bind real connectors here');
  ui.line('');

  const bindNow = await confirm({
    message: 'Bind real connectors and data sources now?',
    default: false,
  });

  if (!bindNow) {
    ui.line('Skipping connector binding for now.');
    ui.line('Re-run later with:');
    ui.line('  node wizard/index.mjs --from 8');
    setCompletedStep(8);
    return;
  }

  await setupConnectors(pac, projectDir);
  setCompletedStep(8);
}