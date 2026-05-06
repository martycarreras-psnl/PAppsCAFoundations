// Step 1 — Prerequisites. Read-only checks, no questions.
import { platform } from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { pacPath, runSafe } from '../../../wizard/lib/shell.mjs';

function hasCommand(name) {
  try {
    const cmd = platform() === 'win32' ? 'where' : 'which';
    execFileSync(cmd, [name], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function tryRun(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch { return null; }
}

export default {
  meta: {
    number: 1,
    title: 'Prerequisites',
    description: 'Verify Node, Git, .NET SDK, PAC CLI, Python 3, and optional tools are present.',
    canRunInBrowser: true,
    readOnly: true,
  },

  questions() { return []; },

  async apply(_answers, _state, log) {
    const checks = [];
    let allOk = true;
    let hasOp = false;

    // Node
    if (hasCommand('node')) {
      const ver = tryRun('node --version') || '';
      const major = parseInt(ver.replace(/^v/, ''), 10);
      const ok = major >= 20;
      checks.push({ name: 'Node.js', ok, value: ver, hint: ok ? null : 'Version 20+ required (https://nodejs.org/)' });
      if (ok) log.ok(`Node.js ${ver}`); else { log.fail(`Node.js ${ver} — version 20+ required`); allOk = false; }
    } else {
      checks.push({ name: 'Node.js', ok: false, value: null, hint: 'Not installed (https://nodejs.org/)' });
      log.fail('Node.js — not found'); allOk = false;
    }

    // Git
    if (hasCommand('git')) {
      const ver = tryRun('git --version')?.replace('git version ', '') || '';
      checks.push({ name: 'Git', ok: true, value: ver, hint: null });
      log.ok(`Git ${ver}`);
    } else {
      checks.push({ name: 'Git', ok: false, value: null, hint: 'Not installed (https://git-scm.com/)' });
      log.fail('Git — not found'); allOk = false;
    }

    // .NET
    if (hasCommand('dotnet')) {
      const ver = tryRun('dotnet --version') || '';
      checks.push({ name: '.NET SDK', ok: true, value: ver, hint: null });
      log.ok(`.NET SDK ${ver}`);
    } else {
      checks.push({ name: '.NET SDK', ok: false, value: null, hint: 'Required for PAC CLI (https://dotnet.microsoft.com/download)' });
      log.fail('.NET SDK — not found'); allOk = false;
    }

    // PAC CLI
    const pac = pacPath();
    if (pac) {
      const header = runSafe(pac, []) || '';
      const m = header.match(/Version:\s*(\S+)/i);
      const pacVer = m ? m[1] : 'unknown';
      const bad = pacVer.includes('2.3.2');
      checks.push({ name: 'PAC CLI', ok: !bad, value: pacVer, hint: bad ? 'Version 2.3.2 has a known bug — install 2.2.1 instead' : null });
      if (bad) { log.fail(`PAC CLI ${pacVer} — known-bad version`); allOk = false; }
      else log.ok(`PAC CLI ${pacVer}`);
    } else {
      checks.push({ name: 'PAC CLI', ok: false, value: null, hint: 'Run: dotnet tool install -g Microsoft.PowerApps.CLI.Tool' });
      log.fail('PAC CLI — not found'); allOk = false;
    }

    // 1Password CLI (optional)
    if (hasCommand('op')) {
      hasOp = true;
      checks.push({ name: '1Password CLI', ok: true, value: 'available', hint: null, optional: true });
      log.ok('1Password CLI available');
    } else {
      checks.push({ name: '1Password CLI', ok: false, value: null, hint: 'Optional — speeds up secret handling', optional: true });
      log.info('1Password CLI not found (optional)');
    }

    // Python 3 (required for Dataverse-skills plugin)
    let pythonCmd = null;
    if (hasCommand('python3')) pythonCmd = 'python3';
    else if (hasCommand('python')) pythonCmd = 'python';

    if (pythonCmd) {
      const pyVer = tryRun(`${pythonCmd} --version`)?.replace('Python ', '') || '';
      const pyMajor = parseInt(pyVer, 10);
      if (pyMajor >= 3) {
        checks.push({ name: 'Python', ok: true, value: pyVer, hint: null });
        log.ok(`Python ${pyVer}`);
      } else {
        checks.push({ name: 'Python', ok: false, value: pyVer, hint: 'Python 3+ required for Dataverse-skills plugin (https://www.python.org/downloads/)' });
        log.warn(`Python ${pyVer} — Python 3+ required for Dataverse-skills plugin`);
        log.info('  → Install Python 3: https://www.python.org/downloads/');
        log.info('  → Then re-run this step to verify');
        pythonCmd = null;
      }
    } else {
      checks.push({ name: 'Python', ok: false, value: null, hint: 'Required for Dataverse-skills plugin (https://www.python.org/downloads/)' });
      log.warn('Python 3 — not found (required for Dataverse-skills plugin)');
      log.info('  → Install Python 3: https://www.python.org/downloads/');
      log.info('  → Then re-run this step to verify');
    }

    // PowerPlatform-Dataverse-Client SDK (requires Python)
    if (pythonCmd) {
      const hasSdk = tryRun(`${pythonCmd} -c "from PowerPlatform.Dataverse.client import DataverseClient; print('ok')"`) === 'ok';
      if (hasSdk) {
        checks.push({ name: 'Dataverse SDK', ok: true, value: 'installed', hint: null });
        log.ok('PowerPlatform-Dataverse-Client SDK installed');
      } else {
        const pip = pythonCmd === 'python3' ? 'pip3' : 'pip';
        checks.push({ name: 'Dataverse SDK', ok: false, value: null, hint: `Not installed — run: ${pip} install PowerPlatform-Dataverse-Client pandas`, optional: true });
        log.warn(`PowerPlatform-Dataverse-Client SDK — not installed`);
        log.info(`  → Install: ${pip} install PowerPlatform-Dataverse-Client pandas`);
        log.info('  → Required by the Dataverse-skills plugin:');
        log.info('    https://github.com/microsoft/Dataverse-skills');
        log.info('  → After installing, re-run this step to verify');
      }
    }

    return {
      stateUpdate: { HAS_OP: hasOp, PYTHON_CMD: pythonCmd },
      result: { allOk, checks },
      // Mark step complete only if no required tool is missing
      completedStep: allOk ? 1 : null,
    };
  },
};
