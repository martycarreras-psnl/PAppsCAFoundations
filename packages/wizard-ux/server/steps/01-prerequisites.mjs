// Step 1 — Prerequisites. Read-only checks, no questions.
import { platform } from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { pacPath, runSafe } from '@pacaf/wizard/lib/shell.mjs';

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

    // Python 3 (used by Dataverse-skills plugin)
    // On Windows, `python3` may resolve to the Microsoft Store App Execution Alias stub
    // (%LOCALAPPDATA%\Microsoft\WindowsApps\python3.exe) which exits non-zero and prints
    // "Python was not found; run without arguments to install from the Microsoft Store..."
    // We treat any command whose --version output doesn't start with "Python 3" as absent
    // and fall through to the next candidate. Priority order:
    //   python3 → python → py -3   (py launcher is Windows-only)
    function tryPythonCmd(cmd) {
      const raw = tryRun(`${cmd} --version`) || '';
      // Store stub returns empty (non-zero exit trapped by tryRun) or the "not found" message
      if (!raw.startsWith('Python 3')) return null;
      return raw.replace('Python ', '').trim();
    }

    let pythonCmd = null;
    let pythonVersion = null;

    const candidates = ['python3', 'python'];
    if (platform() === 'win32') candidates.push('py');

    for (const candidate of candidates) {
      if (!hasCommand(candidate)) continue;
      const ver = candidate === 'py' ? tryRun('py -3 --version')?.replace('Python ', '').trim() || null
                                     : tryPythonCmd(candidate);
      if (ver) {
        pythonCmd = candidate === 'py' ? 'py' : candidate;
        pythonVersion = ver;
        break;
      }
    }

    if (pythonCmd) {
      checks.push({ name: 'Python', ok: true, value: pythonVersion, hint: null });
      log.ok(`Python ${pythonVersion}${pythonCmd === 'py' ? ' (via py launcher)' : ''}`);
    } else {
      const winHint = platform() === 'win32'
        ? ' On Windows, ensure "Add python.exe to PATH" was checked during install, or disable the Microsoft Store python3 alias in Settings → Apps → Advanced app settings → App execution aliases.'
        : '';
      checks.push({ name: 'Python', ok: false, value: null, hint: `Required for Dataverse-skills plugin (https://www.python.org/downloads/).${winHint}` });
      log.warn('Python 3 — not found (required for Dataverse-skills plugin)');
      if (platform() === 'win32') {
        log.info('  → Install Python 3 from https://www.python.org/downloads/ — check "Add python.exe to PATH"');
        log.info('  → Or disable the Store stub: Settings → Apps → Advanced app settings → App execution aliases → turn off python3.exe');
      } else {
        log.info('  → Install Python 3: https://www.python.org/downloads/');
      }
      log.info('  → Then re-run this step to verify');
    }

    // Note: The Dataverse-skills plugin manages its own Python SDK installation
    // via the dv-connect skill. No separate pip install needed here.

    return {
      stateUpdate: { HAS_OP: hasOp, PYTHON_CMD: pythonCmd },
      result: { allOk, checks },
      // Mark step complete only if no required tool is missing
      completedStep: allOk ? 1 : null,
    };
  },
};
