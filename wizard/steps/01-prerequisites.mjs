// wizard/steps/01-prerequisites.mjs — Check machine prerequisites
import { confirm } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { hasCommand, run, runLive, pacPath } from '../lib/shell.mjs';
import { stateSet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';

export default async function stepPrerequisites() {
  ui.stepHeader(1, TOTAL_STEPS, 'Checking Your Machine');

  let allOk = true;
  let hasOp = false;

  // ── Node.js ──
  if (hasCommand('node')) {
    const ver = run('node --version') || '';
    const major = parseInt(ver.replace(/^v/, ''), 10);
    if (major >= 20) {
      ui.ok(`Node.js ${ver}`);
    } else {
      ui.fail(`Node.js ${ver} — version 20+ required`);
      ui.line('  Install: https://nodejs.org/');
      allOk = false;
    }
  } else {
    ui.fail('Node.js — not found');
    ui.line('  Install: https://nodejs.org/');
    allOk = false;
  }

  // ── Git ──
  if (hasCommand('git')) {
    const ver = run('git --version')?.replace('git version ', '') || '';
    ui.ok(`Git ${ver}`);
  } else {
    ui.fail('Git — not found');
    ui.line('  Install: https://git-scm.com/');
    allOk = false;
  }

  // ── .NET SDK ──
  if (hasCommand('dotnet')) {
    ui.ok(`.NET SDK ${run('dotnet --version') || ''}`);
  } else {
    ui.fail('.NET SDK — not found (required for PAC CLI)');
    ui.line('  Install: https://dotnet.microsoft.com/download');
    allOk = false;
  }

  // ── PAC CLI ──
  const pac = pacPath();
  if (pac) {
    const header = run(`"${pac}"`) || '';
    const verMatch = header.match(/Version:\s*(\S+)/i);
    const pacVer = verMatch ? verMatch[1] : 'unknown';
    if (pacVer.includes('2.3.2')) {
      ui.fail(`PAC CLI ${pacVer} — this version has a known bug`);
      ui.line('  Fix: dotnet tool uninstall -g Microsoft.PowerApps.CLI.Tool');
      ui.line('       dotnet tool install -g Microsoft.PowerApps.CLI.Tool --version 2.2.1');
      allOk = false;
    } else {
      ui.ok(`PAC CLI (${pacVer})`);
    }
  } else {
    ui.fail('PAC CLI — not found');
    if (hasCommand('dotnet')) {
      const install = await confirm({
        message: 'Install PAC CLI now? (dotnet tool install -g Microsoft.PowerApps.CLI.Tool)',
        default: true,
      });
      if (install) {
        ui.line('');
        ui.line('Installing...');
        if (runLive('dotnet tool install -g Microsoft.PowerApps.CLI.Tool')) {
          ui.ok('PAC CLI installed');
          ui.line('');
          ui.line('NOTE: You may need to restart your terminal or add ~/.dotnet/tools to PATH.');
        } else {
          ui.fail('Installation failed. Try manually.');
          allOk = false;
        }
      } else {
        ui.line('Skipping PAC CLI install. You\'ll need it for later steps.');
        allOk = false;
      }
    } else {
      ui.line('  Install .NET SDK first, then: dotnet tool install -g Microsoft.PowerApps.CLI.Tool');
      allOk = false;
    }
  }

  // ── 1Password CLI (optional) ──
  if (hasCommand('op')) {
    ui.ok('1Password CLI (op) — available');
    hasOp = true;
  } else {
    ui.info('1Password CLI (op) — not found (optional)');
  }

  stateSet('HAS_OP', hasOp);

  ui.line('');
  if (allOk) {
    ui.line('Everything required is installed.');
  } else {
    ui.line('Some required tools are missing (marked with ✗ above).');
    ui.line('Install them and re-run this wizard.');
    ui.line('');
    const cont = await confirm({ message: 'Continue anyway?', default: false });
    if (!cont) {
      ui.line('');
      ui.line('Re-run: node wizard/index.mjs');
      process.exit(1);
    }
  }

  setCompletedStep(1);
}
