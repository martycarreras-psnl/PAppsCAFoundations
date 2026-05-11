// wizard/steps/06-solution.mjs — Auto-detect or create solution via Dataverse API
import { input, select, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { dvGet, dvPost } from '../lib/dataverse.mjs';
import { clearSecret } from '../lib/secrets.mjs';

export default async function stepSolution() {
  ui.stepHeader(6, TOTAL_STEPS, 'Solution');

  const publisherId = stateGet('PUBLISHER_ID');
  const publisherDisplay = stateGet('PUBLISHER_DISPLAY_NAME');
  const appName = stateGet('APP_NAME');

  // Resume: if already completed, offer to keep
  if (stateHas('SOLUTION_UNIQUE_NAME')) {
    const solName = stateGet('SOLUTION_UNIQUE_NAME');
    const solDisplay = stateGet('SOLUTION_DISPLAY_NAME');
    ui.line(`Solution (from previous run): ${solDisplay} (${solName})`);
    const keep = await confirm({ message: 'Keep this solution?', default: true });
    if (keep) {
      clearSecret();
      setCompletedStep(6);
      return;
    }
  }

  // ── Query existing solutions ──
  let solutions = [];
  try {
    ui.line('Querying existing solutions from your Dev environment...');
    let filter = 'ismanaged eq false and isvisible eq true';
    if (publisherId) {
      filter += ` and _publisherid_value eq '${publisherId}'`;
    }
    const data = await dvGet(
      `solutions?$filter=${encodeURIComponent(filter)}` +
      '&$select=solutionid,uniquename,friendlyname,version,_publisherid_value' +
      '&$orderby=friendlyname',
    );
    solutions = (data.value || []).filter((s) =>
      s.uniquename !== 'Default' &&
      !s.uniquename.startsWith('msdyn') &&
      !s.uniquename.startsWith('Mscrm'),
    );
  } catch (err) {
    ui.warn('Could not query solutions from Dataverse.');
    ui.line(`  ${err.message}`);
    ui.line('');
  }

  let solUniqueName, solFriendlyName, solId;

  if (solutions.length > 0) {
    const choices = solutions.map((s) => ({
      name: `${s.friendlyname}  (${s.uniquename} v${s.version})`,
      value: s.solutionid,
    }));
    choices.push({ name: '+ Create a new solution', value: '__new__' });

    if (publisherId) {
      ui.ok(`Found ${solutions.length} solution(s) for publisher "${publisherDisplay}"`);
    } else {
      ui.ok(`Found ${solutions.length} unmanaged solution(s)`);
    }
    ui.line('');

    const selected = await select({ message: 'Select a solution or create a new one', choices });

    if (selected !== '__new__') {
      const sol = solutions.find((s) => s.solutionid === selected);
      solUniqueName = sol.uniquename;
      solFriendlyName = sol.friendlyname;
      solId = sol.solutionid;
      ui.ok(`Selected: ${solFriendlyName} (${solUniqueName})`);
    } else {
      ({ solUniqueName, solFriendlyName, solId } = await createNewSolution(publisherId, appName));
    }
  } else {
    ui.line('No existing solutions found — let\'s create one.');
    ui.line('');
    ({ solUniqueName, solFriendlyName, solId } = await createNewSolution(publisherId, appName));
  }

  stateSet('SOLUTION_DISPLAY_NAME', solFriendlyName);
  stateSet('SOLUTION_UNIQUE_NAME', solUniqueName);
  if (solId) stateSet('SOLUTION_ID', solId);

  ui.line('');
  ui.divider();
  ui.line('');
  ui.summary('Solution:', `${solFriendlyName} (${solUniqueName})`);
  ui.line('');

  // Client secret no longer needed after this point
  clearSecret();

  setCompletedStep(6);
}

async function createNewSolution(publisherId, appName) {
  const solFriendlyName = await input({
    message: 'Solution display name',
    default: appName,
  });

  const defaultUnique = solFriendlyName.trim().replace(/[\s\-]+/g, '');
  const solUniqueName = await input({
    message: 'Solution unique name (no spaces, used in CLI)',
    default: defaultUnique,
  });

  // Try to create via Dataverse API
  let solId = '';
  if (publisherId) {
    try {
      ui.line('');
      ui.line('Creating solution via Dataverse API...');
      const result = await dvPost('solutions', {
        uniquename: solUniqueName.trim(),
        friendlyname: solFriendlyName.trim(),
        version: '1.0.0.0',
        'publisherid@odata.bind': `/publishers(${publisherId})`,
      });
      solId = result.solutionid || '';
      ui.ok('Solution created!');
    } catch (err) {
      ui.warn('Could not create solution via API.');
      ui.line(`  ${err.message}`);
      ui.line('');
      ui.line('Create it manually in the Power Apps Maker Portal:');
      ui.line('  make.powerapps.com → Solutions → + New Solution');
      ui.line('  Select the publisher you configured in the previous step.');
    }
  } else {
    ui.line('');
    ui.warn('Publisher ID not available — create the solution manually:');
    ui.line('  make.powerapps.com → Solutions → + New Solution');
    ui.line('  Select the publisher you configured in the previous step.');
  }

  return {
    solUniqueName: solUniqueName.trim(),
    solFriendlyName: solFriendlyName.trim(),
    solId,
  };
}
