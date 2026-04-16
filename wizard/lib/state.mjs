// wizard/lib/state.mjs — Cross-platform wizard state persistence (JSON)
import { readFileSync, writeFileSync, existsSync, unlinkSync, chmodSync } from 'node:fs';
import { platform } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..', '..');
const STATE_FILE = resolve(ROOT_DIR, '.wizard-state.json');

let state = {};

export function getRootDir() { return ROOT_DIR; }

export function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    } catch {
      state = {};
    }
  }
  return state;
}

export function saveState() {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  // Restrict to owner-only on Unix (prevents other system users from reading wizard state)
  if (platform() !== 'win32') {
    try { chmodSync(STATE_FILE, 0o600); } catch { /* best-effort */ }
  }
}

export function stateGet(key, defaultValue = '') {
  return state[key] ?? defaultValue;
}

export function stateSet(key, value) {
  state[key] = value;
  saveState();
}

export function stateHas(key) {
  return key in state && state[key] !== '' && state[key] != null;
}

export function getCompletedStep() {
  return parseInt(stateGet('COMPLETED_STEP', '0'), 10);
}

export function setCompletedStep(step) {
  stateSet('COMPLETED_STEP', step);
}

export function resetState() {
  state = {};
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
}

export const TOTAL_STEPS = 9;
