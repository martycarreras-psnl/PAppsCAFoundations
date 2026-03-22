#!/usr/bin/env node
// wizard/index.mjs — Main entry point for the cross-platform setup wizard
//
// Usage:
//   node wizard/index.mjs            # Run (resumes where you left off)
//   node wizard/index.mjs --reset    # Start over from scratch

import { confirm } from '@inquirer/prompts';
import * as ui from './lib/ui.mjs';
import {
  loadState, getCompletedStep, resetState, stateGet, TOTAL_STEPS,
} from './lib/state.mjs';

import stepPrerequisites from './steps/01-prerequisites.mjs';
import stepProjectIdentity from './steps/02-project-identity.mjs';
import stepCreatePublisher from './steps/03-create-publisher.mjs';
import stepEnvironments from './steps/04-environments.mjs';
import stepSolutionAndAppReg from './steps/05-solution-app-reg.mjs';
import stepAuthSetup from './steps/06-auth-setup.mjs';
import stepScaffold from './steps/07-scaffold.mjs';
import stepVerifyAndDeploy from './steps/08-verify-deploy.mjs';

const steps = [
  stepPrerequisites,
  stepProjectIdentity,
  stepCreatePublisher,
  stepEnvironments,
  stepSolutionAndAppReg,
  stepAuthSetup,
  stepScaffold,
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
