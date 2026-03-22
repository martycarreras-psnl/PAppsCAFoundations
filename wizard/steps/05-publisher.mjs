// wizard/steps/05-publisher.mjs — Auto-detect or create publisher via Dataverse API
import { input, select, confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { isValidPrefix } from '../lib/validate.mjs';
import { dvGet, dvPost } from '../lib/dataverse.mjs';
import { getSecret, recoverSecret, setSecret } from '../lib/secrets.mjs';
import { password } from '@inquirer/prompts';

export default async function stepPublisher() {
  ui.stepHeader(5, TOTAL_STEPS, 'Publisher');

  // Resume: if already completed, offer to keep
  if (stateHas('PUBLISHER_PREFIX') && stateHas('PUBLISHER_ID')) {
    const prefix = stateGet('PUBLISHER_PREFIX');
    const display = stateGet('PUBLISHER_DISPLAY_NAME');
    ui.line(`Publisher (from previous run): ${display} (prefix: ${prefix})`);
    const keep = await confirm({ message: 'Keep this publisher?', default: true });
    if (keep) {
      setCompletedStep(5);
      return;
    }
  }

  // Ensure we have the client secret for API calls
  await ensureSecret();

  // ── Query existing publishers ──
  let publishers = [];
  try {
    ui.line('Querying existing publishers from your Dev environment...');
    const data = await dvGet(
      'publishers?' +
      '$filter=isreadonly eq false' +
      '&$select=publisherid,uniquename,friendlyname,customizationprefix,customizationoptionvalueprefix' +
      '&$orderby=friendlyname',
    );
    publishers = (data.value || []).filter((p) =>
      p.customizationprefix &&
      !p.uniquename.startsWith('DefaultPublisherFor'),
    );
  } catch (err) {
    ui.warn('Could not query publishers from Dataverse.');
    ui.line(`  ${err.message}`);
    ui.line('');
    ui.line('Falling back to manual entry.');
    ui.line('');
  }

  let publisherId, uniqueName, friendlyName, prefix, choicePrefix;

  if (publishers.length > 0) {
    const choices = publishers.map((p) => ({
      name: `${p.friendlyname}  (prefix: ${p.customizationprefix})`,
      value: p.publisherid,
    }));
    choices.push({ name: '+ Create a new publisher', value: '__new__' });

    ui.ok(`Found ${publishers.length} publisher(s)`);
    ui.line('');

    const selected = await select({ message: 'Select a publisher or create a new one', choices });

    if (selected !== '__new__') {
      const pub = publishers.find((p) => p.publisherid === selected);
      publisherId = pub.publisherid;
      uniqueName = pub.uniquename;
      friendlyName = pub.friendlyname;
      prefix = pub.customizationprefix;
      choicePrefix = String(pub.customizationoptionvalueprefix);
      ui.ok(`Selected: ${friendlyName} (prefix: ${prefix})`);
    } else {
      ({ publisherId, uniqueName, friendlyName, prefix, choicePrefix } = await createNewPublisher());
    }
  } else {
    // No publishers found or API failed — create new
    ({ publisherId, uniqueName, friendlyName, prefix, choicePrefix } = await createNewPublisher());
  }

  // Save to state
  stateSet('PUBLISHER_ID', publisherId || '');
  stateSet('PUBLISHER_NAME', uniqueName);
  stateSet('PUBLISHER_DISPLAY_NAME', friendlyName);
  stateSet('PUBLISHER_PREFIX', prefix);
  stateSet('CHOICE_VALUE_PREFIX', choicePrefix);

  ui.line('');
  ui.divider();
  ui.line('');
  ui.summary('Publisher:', friendlyName);
  ui.summary('Internal name:', uniqueName);
  ui.summary('Prefix:', prefix);
  ui.summary('Choice value prefix:', `${choicePrefix} (option set values start at ${choicePrefix}0000)`);
  ui.line('');

  setCompletedStep(5);
}

async function createNewPublisher() {
  ui.line('');
  const appName = stateGet('APP_NAME');

  // Prefix
  const prefix = await input({
    message: 'Publisher prefix (2–8 lowercase letters)',
    validate: (v) => {
      if (!v.trim()) return 'Required';
      if (!isValidPrefix(v.trim())) return 'Must be 2–8 lowercase letters only (no numbers, hyphens, or underscores)';
      return true;
    },
  });

  // Display name
  const friendlyName = await input({
    message: 'Publisher display name',
    default: `${appName} Publishing`,
  });

  // Unique name (internal)
  const defaultUnique = friendlyName.trim().toLowerCase().replace(/[\s\-]+/g, '');
  const uniqueName = await input({
    message: 'Publisher internal name (lowercase, no spaces)',
    default: defaultUnique,
  });

  // Try to create via Dataverse API
  let publisherId = '';
  let choicePrefix = '';
  try {
    ui.line('');
    ui.line('Creating publisher via Dataverse API...');
    const result = await dvPost('publishers', {
      uniquename: uniqueName.trim(),
      friendlyname: friendlyName.trim(),
      customizationprefix: prefix.trim(),
    });
    publisherId = result.publisherid;
    choicePrefix = String(result.customizationoptionvalueprefix);
    ui.ok(`Publisher created! Choice value prefix: ${choicePrefix}`);
  } catch (err) {
    ui.warn('Could not create publisher via API.');
    ui.line(`  ${err.message}`);
    ui.line('');
    ui.line('Create it manually in the Power Apps Maker Portal:');
    ui.line('  make.powerapps.com → Solutions → Publishers → + New Publisher');
    ui.line('');

    // Ask for choice prefix manually
    const entered = await input({
      message: 'Choice value prefix (4–6 digit number from the portal)',
      validate: (v) => /^[0-9]{4,6}$/.test(v.trim()) ? true : 'Expected a 4–6 digit number (e.g. 10000)',
    });
    choicePrefix = entered.trim();
  }

  return {
    publisherId,
    uniqueName: uniqueName.trim(),
    friendlyName: friendlyName.trim(),
    prefix: prefix.trim(),
    choicePrefix,
  };
}

/**
 * Make sure the client secret is available for Dataverse API calls.
 * On resume, the secret may need to be recovered from .env.local or 1Password.
 */
async function ensureSecret() {
  let secret = getSecret();
  if (secret) return;

  secret = recoverSecret();
  if (secret) {
    ui.info('Recovered client secret from credential store.');
    return;
  }

  ui.line('The Dataverse API needs your Client Secret to query your environment.');
  const entered = await password({ message: 'Client Secret (hidden input)', validate: (v) => v ? true : 'Required' });
  setSecret(entered);
}
