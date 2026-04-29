// Cross-platform bootstrapper for WizardUX terminal handoff steps.
// Keeps the browser-displayed command shell-neutral while ensuring the CLI
// wizard's own dependencies exist before importing @inquirer/prompts.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const step = process.argv[2];
if (!/^\d+$/.test(step || '')) {
  console.error('Usage: node wizard-ux/server/run-cli-step.mjs <step-number>');
  process.exit(1);
}

const rootDir = process.cwd();
const wizardDir = resolve(rootDir, 'wizard');
const wizardPackage = resolve(wizardDir, 'package.json');
const inquirerPrompts = resolve(wizardDir, 'node_modules', '@inquirer', 'prompts');

if (!existsSync(wizardPackage)) {
  console.error(`Cannot find wizard/package.json from ${rootDir}. Run this command from the repository root.`);
  process.exit(1);
}

if (!existsSync(inquirerPrompts)) {
  console.log('[WizardUX] Installing CLI wizard dependencies...');
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const install = spawnSync(npmBin, ['install'], { cwd: wizardDir, stdio: 'inherit' });
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
}

const run = spawnSync(process.execPath, ['index.mjs', '--from', step], { cwd: wizardDir, stdio: 'inherit' });
process.exit(run.status ?? 1);