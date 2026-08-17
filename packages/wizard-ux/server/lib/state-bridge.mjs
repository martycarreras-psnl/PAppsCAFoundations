// wizard-ux/server/lib/state-bridge.mjs
// Reads/writes the shared .wizard-state.json file. Mirrors wizard/lib/state.mjs but
// keeps zero global state — every call reads from disk to stay correct across multiple
// browser windows and concurrent CLI runs.
import { existsSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs';
import { platform } from 'node:os';
import { resolve } from 'node:path';

export function stateFilePath(rootDir) {
  return resolve(rootDir, '.wizard-state.json');
}

export function readState(rootDir) {
  const path = stateFilePath(rootDir);
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return {}; }
}

// Step numbering schema. v1 had a "Bind Connectors" step at 9, pushing
// Verify & Deploy to 10 and Add App to Solution to 11. v2 removed the connector
// step, so everything from 9 up shifts down by one.
export const STEP_SCHEMA_VERSION = 2;

export function writeState(rootDir, partial) {
  // Every write stamps the step-numbering schema, so only state files authored by
  // an older wizard lack it — that absence is what migrateStepNumbering keys off.
  const merged = { ...readState(rootDir), WIZARD_STEP_SCHEMA: STEP_SCHEMA_VERSION, ...partial };
  const path = stateFilePath(rootDir);
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  if (platform() !== 'win32') {
    try { chmodSync(path, 0o600); } catch { /* best-effort */ }
  }
  return merged;
}

export function resetStateFile(rootDir) {
  const path = stateFilePath(rootDir);
  if (existsSync(path)) unlinkSync(path);
}

export function getCompletedStep(state) {
  return parseInt(state.COMPLETED_STEP ?? '0', 10);
}

export function setCompletedStep(rootDir, step) {
  return writeState(rootDir, { COMPLETED_STEP: step });
}

// Rewrite a v1 COMPLETED_STEP so a partially-finished setup resumes at the same
// real task instead of silently skipping deploy. Idempotent via WIZARD_STEP_SCHEMA.
export function migrateStepNumbering(rootDir) {
  const state = readState(rootDir);
  if (Object.keys(state).length === 0) return state;
  if (parseInt(state.WIZARD_STEP_SCHEMA ?? '1', 10) >= STEP_SCHEMA_VERSION) return state;

  const completed = getCompletedStep(state);
  const patch = { WIZARD_STEP_SCHEMA: STEP_SCHEMA_VERSION };
  if (completed >= 9) patch.COMPLETED_STEP = completed - 1;
  return writeState(rootDir, patch);
}

