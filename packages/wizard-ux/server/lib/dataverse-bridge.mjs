// wizard-ux/server/lib/dataverse-bridge.mjs
// Refreshes wizard/lib/state.mjs from disk before each Dataverse call so the
// existing dvGet/dvPost helpers see the latest state written by WizardUX.
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIZARD_LIB = resolve(__dirname, '..', '..', '..', 'wizard', 'lib');

const stateMod = await import(pathToFileURL(resolve(WIZARD_LIB, 'state.mjs')).href);
const dvMod = await import(pathToFileURL(resolve(WIZARD_LIB, 'dataverse.mjs')).href);
const secretsMod = await import(pathToFileURL(resolve(WIZARD_LIB, 'secrets.mjs')).href);

function refresh() {
  // Reload disk state into the wizard's in-memory singleton
  stateMod.loadState();
}

export async function dvGet(path) {
  refresh();
  dvMod.clearTokenCache();
  return dvMod.dvGet(path);
}

export async function dvPost(path, body, opts) {
  refresh();
  dvMod.clearTokenCache();
  return dvMod.dvPost(path, body, opts);
}

export function setSecret(value) {
  secretsMod.setSecret(value);
}

export function getSecret() {
  return secretsMod.getSecret();
}

export function recoverSecret() {
  refresh();
  return secretsMod.recoverSecret();
}

export function clearSecret() {
  secretsMod.clearSecret();
}

export function hasUsableSecret() {
  if (secretsMod.getSecret()) return true;
  return Boolean(secretsMod.recoverSecret());
}
