#!/usr/bin/env node
// wizard/index.mjs — Main entry point for the cross-platform setup wizard
//
// Usage:
//   node wizard/index.mjs            # Run (resumes where you left off)
//   node wizard/index.mjs --reset    # Start over from scratch
//   node wizard/index.mjs --from 8   # Re-run from connector binding onward

import { confirm } from '@inquirer/prompts';
import * as ui from './lib/ui.mjs';
import {
  loadState, getCompletedStep, setCompletedStep, resetState, stateGet, stateSet, TOTAL_STEPS,
} from './lib/state.mjs';

import stepPrerequisites from './steps/01-prerequisites.mjs';
import stepProjectAndEnv from './steps/02-project-and-env.mjs';
import stepAppRegistration from './steps/03-app-registration.mjs';
import stepAuthSetup from './steps/04-auth-setup.mjs';
import stepPublisher from './steps/05-publisher.mjs';
import stepSolution from './steps/06-solution.mjs';
import stepScaffold from './steps/07-scaffold.mjs';
import stepConnectors from './steps/08-connectors.mjs';
import stepVerifyAndDeploy from './steps/09-verify-deploy.mjs';

// Increment when step order changes to detect stale resume state
const WIZARD_VERSION = 3;

const steps = [
  stepPrerequisites,
  stepProjectAndEnv,
  stepAppRegistration,
  stepAuthSetup,
  stepPublisher,
  stepSolution,
  stepScaffold,
  stepConnectors,
  stepVerifyAndDeploy,
];

async function main() {
  // Handle --reset flag
  if (process.argv.includes('--reset')) {
    resetState();
    console.log('  Wizard state reset. Starting fresh.\n');
  }

  loadState();
  ui.banner();

  // Handle --from N flag (re-run from a specific step)
  const fromIdx = process.argv.indexOf('--from');
  if (fromIdx !== -1) {
    const fromStep = parseInt(process.argv[fromIdx + 1], 10);
    if (fromStep >= 1 && fromStep <= TOTAL_STEPS) {
      setCompletedStep(fromStep - 1);
      ui.line(`Jumping to Step ${fromStep}. Previous config is preserved.`);
      ui.line('');
    } else {
      console.error(`  Invalid step number. Use --from 1 through --from ${TOTAL_STEPS}`);
      process.exit(1);
    }
  }

  // Check for wizard version mismatch (step order changed between v1 and v2)
  const stateVersion = parseInt(stateGet('WIZARD_VERSION', '0'), 10);
  if (stateVersion < WIZARD_VERSION && getCompletedStep() > 0) {
    ui.warn('The wizard has been updated with a new step order.');
    ui.line('Your saved progress is from an older version.');
    ui.line('');
    const startOver = await confirm({ message: 'Start fresh with the new wizard?', default: true });
    if (startOver) {
      resetState();
      loadState();
    }
  }
  stateSet('WIZARD_VERSION', String(WIZARD_VERSION));

  let completed = getCompletedStep();

  if (completed > 0 && completed < TOTAL_STEPS) {
    const appName = stateGet('APP_NAME', 'your project');
    ui.line(`Welcome back! You left off after Step ${completed}.`);
    ui.line(`Project: ${appName}`);
    ui.line('');
    const resume = await confirm({
      message: `Resume from Step ${completed + 1}?`,
      default: true,
    });
    if (!resume) {
      const startOver = await confirm({ message: 'Start over from the beginning?', default: false });
      if (startOver) {
        resetState();
        loadState();
        completed = 0;
      } else {
        ui.line('OK, exiting. Re-run anytime: node wizard/index.mjs');
        process.exit(0);
      }
    }
  }

  // Run each step, skipping already-completed ones
  for (let i = 0; i < steps.length; i++) {
    if (completed < i + 1) {
      await steps[i]();
    }
  }
}

main().catch((err) => {
  // Handle user cancellation (Ctrl+C) gracefully
  if (err.name === 'ExitPromptError' || err.message?.includes('User force closed')) {
    console.log('\n  Wizard interrupted. Your progress is saved.');
    console.log('  Re-run: node wizard/index.mjs\n');
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
