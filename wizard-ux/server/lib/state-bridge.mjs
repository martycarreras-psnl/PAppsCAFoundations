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

export function writeState(rootDir, partial) {
  const merged = { ...readState(rootDir), ...partial };
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
