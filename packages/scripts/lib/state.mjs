// Cross-platform, project-local wizard state persistence (JSON)
import { readFileSync, writeFileSync, existsSync, unlinkSync, chmodSync } from 'node:fs';
import { platform } from 'node:os';
import { resolve } from 'node:path';

let rootDir = process.cwd();
const stateFile = () => resolve(rootDir, '.wizard-state.json');

let state = {};

export function getRootDir() { return rootDir; }

export function loadState(projectRoot = process.cwd()) {
  rootDir = resolve(projectRoot);
  state = {};
  if (existsSync(stateFile())) {
    try {
      state = JSON.parse(readFileSync(stateFile(), 'utf-8'));
    } catch {
      state = {};
    }
  }
  return state;
}

export function saveState() {
  writeFileSync(stateFile(), JSON.stringify(state, null, 2) + '\n', 'utf-8');
  // Restrict to owner-only on Unix (prevents other system users from reading wizard state)
  if (platform() !== 'win32') {
    try { chmodSync(stateFile(), 0o600); } catch { /* best-effort */ }
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
  if (existsSync(stateFile())) unlinkSync(stateFile());
}

export const TOTAL_STEPS = 9;
