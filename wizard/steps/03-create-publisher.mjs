// wizard/steps/03-create-publisher.mjs — Portal guidance for publisher creation
import { input, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { isValidChoicePrefix } from '../lib/validate.mjs';

export default async function stepCreatePublisher() {
  ui.stepHeader(3, TOTAL_STEPS, 'Create Your Publisher in Power Platform');

  const prefix = stateGet('PUBLISHER_PREFIX');
  const pubDisplay = stateGet('PUBLISHER_DISPLAY_NAME');
  const pubName = stateGet('PUBLISHER_NAME');

  ui.line('This step happens in your browser. The wizard can\'t do it');
  ui.line('for you — but it tells you exactly what to click and type.');
  ui.line('');
  ui.divider();
  ui.line('1. Open: https://make.powerapps.com');
  ui.line('2. Select your DEVELOPMENT environment (top-right dropdown)');
  ui.line('   (If you haven\'t created it yet, do that first — see Step 4)');
  ui.line('3. Click: Solutions (left nav) → Publishers → + New Publisher');
  ui.line('4. Fill in EXACTLY:');
  ui.line('');
  ui.line(`   Display name:      ${pubDisplay}`);
  ui.line(`   Name:              ${pubName}`);
  ui.line(`   Prefix:            ${prefix}`);
  ui.line('');
  ui.line('5. Note the "Choice value prefix" number that auto-populates');
  ui.line('   (usually something like 10000 or 27182)');
  ui.line('6. Click Save');
  ui.divider();
  ui.line('');

  const choicePrefix = await input({
    message: 'Choice value prefix (4–6 digit number shown in portal)',
    validate: (v) => {
      if (!v.trim()) return 'Required';
      if (!isValidChoicePrefix(v.trim())) return 'Expected a 4–6 digit number (e.g. 10000)';
      return true;
    },
  });
  stateSet('CHOICE_VALUE_PREFIX', choicePrefix.trim());
  ui.ok(`Saved. Your option set values will start at ${choicePrefix.trim()}0000.`);

  ui.line('');
  const done = await confirm({ message: 'Did you complete the publisher creation?', default: true });
  if (!done) {
    ui.line('');
    ui.line('No problem — complete it in the browser and re-run the wizard.');
    ui.line('Your progress is saved. Re-run: node wizard/index.mjs');
    process.exit(0);
  }

  setCompletedStep(3);
}
