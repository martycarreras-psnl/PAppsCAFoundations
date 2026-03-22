// wizard/steps/02-project-identity.mjs — Collect naming decisions
import { input, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { isValidPrefix } from '../lib/validate.mjs';

export default async function stepProjectIdentity() {
  ui.stepHeader(2, TOTAL_STEPS, 'Project Identity');

  ui.line('These names become permanent identifiers in Power Platform.');
  ui.line('Choose carefully — they cannot be changed after data exists.');
  ui.line('');

  // ── App name ──
  let appName = '';
  if (stateHas('APP_NAME')) {
    appName = stateGet('APP_NAME');
    ui.line(`App name (from previous run): ${appName}`);
    const keep = await confirm({ message: 'Keep this?', default: true });
    if (!keep) appName = '';
  }
  if (!appName) {
    ui.line('What is your app called?');
    ui.line('(A display name, e.g. "My Brain", "Project Tracker")');
    ui.line('');
    appName = await input({ message: 'App name', validate: (v) => v.trim() ? true : 'Required' });
    appName = appName.trim();
  }
  stateSet('APP_NAME', appName);

  ui.line('');
  ui.divider();
  ui.line('');

  // ── Publisher prefix ──
  let prefix = '';
  if (stateHas('PUBLISHER_PREFIX')) {
    prefix = stateGet('PUBLISHER_PREFIX');
    ui.line(`Publisher prefix (from previous run): ${prefix}`);
    const keep = await confirm({ message: 'Keep this?', default: true });
    if (!keep) prefix = '';
  }
  while (!prefix) {
    ui.line('Publisher prefix — a short namespace (2–8 lowercase letters).');
    ui.line('This prefixes EVERY table, column, and choice in Dataverse.');
    ui.line('Examples: mybrn, contso, hr, fin');
    ui.line('');
    prefix = await input({
      message: 'Publisher prefix',
      validate: (v) => {
        if (!v.trim()) return 'Required';
        if (!isValidPrefix(v.trim())) return 'Must be 2–8 lowercase letters only (no numbers, hyphens, or underscores)';
        return true;
      },
    });
    prefix = prefix.trim();
    ui.ok(`Valid: "${prefix}" (${prefix.length} lowercase letters)`);
  }
  stateSet('PUBLISHER_PREFIX', prefix);

  ui.line('');
  ui.divider();
  ui.line('');

  // ── Publisher display name ──
  const pubDisplay = await input({
    message: 'Publisher display name (human-readable owner)',
    default: `${appName} Engineering`,
  });
  stateSet('PUBLISHER_DISPLAY_NAME', pubDisplay.trim());

  // ── Publisher internal name ──
  const defaultPubName = pubDisplay.toLowerCase().replace(/[\s-]/g, '');
  const pubName = await input({
    message: 'Publisher internal name (lowercase, no spaces)',
    default: defaultPubName,
  });
  stateSet('PUBLISHER_NAME', pubName.trim());

  ui.line('');

  // ── Solution display name ──
  const solDisplay = await input({
    message: 'Solution display name',
    default: appName,
  });
  stateSet('SOLUTION_DISPLAY_NAME', solDisplay.trim());

  // ── Solution unique name ──
  const defaultSolName = solDisplay.trim().replace(/[\s-]/g, '');
  const solName = await input({
    message: 'Solution unique name (no spaces, used in CLI)',
    default: defaultSolName,
  });
  stateSet('SOLUTION_UNIQUE_NAME', solName.trim());

  // ── Confirm ──
  ui.line('');
  ui.divider();
  ui.line('');
  ui.line("Here's what we've got:");
  ui.line('');
  ui.summary('App name:', appName);
  ui.summary('Publisher prefix:', prefix);
  ui.summary('Publisher display:', pubDisplay);
  ui.summary('Publisher name:', pubName);
  ui.summary('Solution display:', solDisplay.trim());
  ui.summary('Solution unique name:', solName.trim());
  ui.line('');

  const correct = await confirm({ message: 'Look right?', default: true });
  if (!correct) {
    ui.line('');
    ui.line("Let's redo it.");
    stateSet('APP_NAME', '');
    stateSet('PUBLISHER_PREFIX', '');
    return stepProjectIdentity();
  }

  setCompletedStep(2);
}
