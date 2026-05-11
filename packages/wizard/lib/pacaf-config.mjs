// pacaf-config.mjs — load branding config so a forked wizard works without code changes.
//
// Reads pacaf.config.json from (in order):
//   1. an absolute path passed via the PACAF_CONFIG env var
//   2. the package's installation directory (if it ships a copy)
//   3. the upstream defaults below
//
// All callers should treat the returned object as immutable.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const DEFAULTS = Object.freeze({
  scope: '@pacaf',
  binPrefix: 'pacaf',
  templateRepo: 'martycarreras-psnl/PAppsCAFoundations',
  templateBranch: 'main',
  templatePath: 'templates/starter',
  docsUrl: 'https://martycarreras-psnl.github.io/PAppsCAFoundations',
  registry: 'https://registry.npmjs.org',
  packages: ['wizard', 'wizard-ux', 'scripts', 'agent-instructions', 'rebrand'],
});

function tryLoad(file) {
  if (!file || !existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

let cached;
export function loadPacafConfig() {
  if (cached) return cached;

  const candidates = [];
  if (process.env.PACAF_CONFIG) candidates.push(resolve(process.env.PACAF_CONFIG));
  // package-relative copy (e.g. when published with pacaf.config.json bundled)
  candidates.push(join(here, '..', 'pacaf.config.json'));
  // monorepo workspace root (when running from source)
  candidates.push(join(here, '..', '..', '..', 'pacaf.config.json'));

  for (const file of candidates) {
    const loaded = tryLoad(file);
    if (loaded) {
      cached = Object.freeze({ ...DEFAULTS, ...loaded });
      return cached;
    }
  }

  cached = DEFAULTS;
  return cached;
}

export function scopedPackageName(localName, config = loadPacafConfig()) {
  return `${config.scope}/${localName}`;
}

export function binName(suffix, config = loadPacafConfig()) {
  return `${config.binPrefix}-${suffix}`;
}
