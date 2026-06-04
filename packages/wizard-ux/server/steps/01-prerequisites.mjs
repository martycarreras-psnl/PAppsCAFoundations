// Step 1 — Prerequisites. Read-only checks, no questions.
import { platform, homedir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * Best-effort coding-agent detection (env-only, read-only).
 * Used to surface the correct Dataverse-skills plugin install command.
 * Defaults to GitHub Copilot CLI when the agent can't be determined.
 */
function detectAgentInstall() {
  const env = process.env;
  if (env.CLAUDE) {
    return {
      id: 'claude',
      label: 'Claude Code',
      install: 'claude plugin install dataverse@claude-plugins-official',
    };
  }
  // Default — GitHub Copilot CLI is the recommended path for the plugin.
  return {
    id: 'copilot',
    label: 'GitHub Copilot CLI',
    install: '/plugin install dataverse@awesome-copilot',
  };
}

/**
 * Detect whether the Dataverse-skills plugin is installed (filesystem + config),
 * without attempting to install it. The install is interactive/manual.
 */
function detectDataversePlugin() {
  const home = homedir();

  // GitHub Copilot — git-clone cache path
  const copilotSkills = join(home, '.copilot', 'installed-plugins', 'awesome-copilot', 'dataverse', 'skills');
  if (existsSync(copilotSkills)) return true;

  // GitHub Copilot — config.json installedPlugins[] entry
  try {
    const cfgPath = join(home, '.copilot', 'config.json');
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf-8'));
      const entry = (cfg.installedPlugins || []).find((p) => p && p.name === 'dataverse');
      if (entry && entry.enabled !== false && entry.cache_path && existsSync(entry.cache_path)) {
        return true;
      }
    }
  } catch { /* ignore malformed config */ }

  // Claude Code — installed-plugins cache (best-effort path candidates)
  const claudeCandidates = [
    join(home, '.claude', 'installed-plugins', 'claude-plugins-official', 'dataverse'),
    join(home, '.claude', 'plugins', 'dataverse'),
  ];
  if (claudeCandidates.some((p) => existsSync(p))) return true;

  return false;
}

/** Verify the Dataverse Python SDK (PowerPlatform-Dataverse-Client + pandas) imports. */
function detectDataverseSdk(pythonCmd) {
  if (!pythonCmd) return false;
  const exec = pythonCmd === 'py' ? 'py -3' : pythonCmd;
  const out = tryRun(`${exec} -c "import pandas, PowerPlatform_Dataverse_Client"`);
  // tryRun returns '' on success (no stdout), null on non-zero exit.
  return out !== null;
}

export default {
  meta: {
    number: 1,
    title: 'Prerequisites',
    description: 'Verify Node, Git, .NET SDK, PAC CLI, Python 3, the Dataverse-skills plugin, and optional tools are present.',
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

    // Dataverse Python SDK (PowerPlatform-Dataverse-Client + pandas) — warning only.
    // dv-connect can install this, so it does not block, but we surface it.
    const sdkOk = detectDataverseSdk(pythonCmd);
    if (sdkOk) {
      checks.push({ name: 'Dataverse Python SDK', ok: true, value: 'available', hint: null });
      log.ok('Dataverse Python SDK (PowerPlatform-Dataverse-Client + pandas)');
    } else {
      checks.push({
        name: 'Dataverse Python SDK',
        ok: false,
        value: null,
        hint: 'Run: pip install PowerPlatform-Dataverse-Client pandas',
        optional: true,
      });
      log.warn('Dataverse Python SDK — not found (pip install PowerPlatform-Dataverse-Client pandas)');
    }

    // Dataverse-skills plugin — HARD GATE. All Dataverse work in this template
    // (schema, data, queries, solution lifecycle, env admin, security) is delegated
    // to this plugin. It is the first-class, only-supported path.
    const pluginOk = detectDataversePlugin();
    if (pluginOk) {
      checks.push({ name: 'Dataverse-skills plugin', ok: true, value: 'installed', hint: null });
      log.ok('Dataverse-skills plugin installed');
      log.info('  → Reminder: MCP tools only load after restarting your editor / CLI');
    } else {
      const agent = detectAgentInstall();
      checks.push({
        name: 'Dataverse-skills plugin',
        ok: false,
        value: null,
        hint: `Required (${agent.label}). Install: ${agent.install} — then run: pip install PowerPlatform-Dataverse-Client pandas, and restart your editor.`,
      });
      log.fail('Dataverse-skills plugin — not installed');
      // Plain-language hard-block guidance. The FIRST thing the user reads is the
      // Copilot CLI vs VS Code Copilot chat distinction, which trips up most people.
      log.info('');
      log.info('  ── Install the Dataverse-skills plugin ─────────────────────────');
      log.info('  IMPORTANT: these steps use the GitHub Copilot CLI (a terminal app),');
      log.info('  NOT the Copilot chat inside VS Code. They are different tools. The');
      log.info('  CLI is what installs the Dataverse plugin reliably.');
      log.info('');
      if (agent.id === 'claude') {
        log.info('  ▶ Claude / Claude Code (detected):');
        log.info('     1. Open your terminal.');
        log.info('     2. claude plugin marketplace add <claude-plugins-official repo>');
        log.info('     3. claude plugin install dataverse@claude-plugins-official');
        log.info('     4. pip install PowerPlatform-Dataverse-Client pandas');
        log.info('     5. Close and reopen Claude Code, then click "Run checks".');
      } else {
        log.info('  ▶ GitHub Copilot CLI (default):');
        log.info('     1. Open your terminal.');
        log.info('     2. (If you don\'t have it) install the CLI: npm install -g @github/copilot');
        log.info('     3. Start it: type  copilot  and press Enter. First time: follow the sign-in prompt.');
        log.info('     4. At the Copilot prompt, type:  /plugin install dataverse@awesome-copilot');
        log.info('     5. Wait for "Installed", then type  /exit');
        log.info('     6. Run:  pip install PowerPlatform-Dataverse-Client pandas');
        log.info('     7. Restart your editor so the MCP tools load, then click "Run checks".');
      }
      log.info('');
      log.info('  Full guide: docs/dataverse-skills-setup.md');
      log.info('  ────────────────────────────────────────────────────────────────');
      allOk = false;
    }

    return {
      stateUpdate: { HAS_OP: hasOp, PYTHON_CMD: pythonCmd },
      result: { allOk, checks },
      // Mark step complete only if no required tool is missing
      completedStep: allOk ? 1 : null,
    };
  },
};
