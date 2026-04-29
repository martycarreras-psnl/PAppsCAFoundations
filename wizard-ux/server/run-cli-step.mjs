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

function exitFromChild(result, label) {
  if (result.error) {
    console.error(`[WizardUX] Failed to start ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(inquirerPrompts)) {
  console.log('[WizardUX] Installing CLI wizard dependencies...');
  const install = process.platform === 'win32'
    ? spawnSync(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', 'npm install'], { cwd: wizardDir, stdio: 'inherit' })
    : spawnSync('npm', ['install'], { cwd: wizardDir, stdio: 'inherit' });
  exitFromChild(install, 'npm install');
}

const run = spawnSync(process.execPath, ['index.mjs', '--from', step], { cwd: wizardDir, stdio: 'inherit' });
exitFromChild(run, 'CLI wizard');
