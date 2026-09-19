// Step 1 — Prerequisites. Read-only checks, no questions.
import { platform, homedir } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { pacPath, runSafe } from '@pacaf/wizard/lib/shell.mjs';
import { checkNode, resolvePython, checkPythonSdk, pythonDisplayCommand } from '@pacaf/wizard/lib/prerequisites.mjs';

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
    const node = checkNode();
    checks.push({ name: 'Node.js', ok: node.ok, value: node.version, hint: node.ok ? null : `${node.message}\n${node.remediation}` });
    if (node.ok) {
      log.ok(`Node.js ${node.version} (running wizard process)`);
    } else {
      log.fail(node.message);
      log.info(node.remediation);
      allOk = false;
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
      checks.push({ name: 'PAC CLI', ok: false, value: null, hint: 'Run: dotnet tool install -g Microsoft.PowerApps.CLI.Tool  (on a Microsoft-managed device where NuGet is blocked, first add the CFS proxy: dotnet nuget add source https://packagefeedproxy.microsoft.io/nuget/v3/index.json -n CFS)' });
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

    const python = resolvePython(_state.PYTHON_CMD);
    const pythonCmd = python.command;
    const pythonVersion = python.version;
    if (pythonCmd) {
      checks.push({ name: 'Python', ok: true, value: pythonVersion, hint: null });
      log.ok(`Python ${pythonVersion} (${pythonCmd})`);
    } else {
      const winHint = platform() === 'win32'
        ? ' On Windows, ensure "Add python.exe to PATH" was checked during install, or disable the Microsoft Store python3 alias in Settings → Apps → Advanced app settings → App execution aliases.'
        : '';
      checks.push({ name: 'Python', ok: false, value: null, hint: `Required for Dataverse-skills plugin (https://www.python.org/downloads/).${winHint}` });
      log.warn('Python 3 — no working interpreter found (required for Dataverse-skills plugin)');
      for (const attempt of python.attempts) log.info(`${attempt.command}: ${attempt.diagnostic}`);
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

    // Dataverse Python SDK (PowerPlatform-Dataverse-Client + pandas) — purely
    // informational. It is NOT needed for scaffold/build/deploy, and the
    // Dataverse-skills plugin installs it on demand via dv-connect. Emit at
    // info level (not warn) so its absence never trips the step's warning /
    // triage banner — telling the user to pip-install something they don't
    // need yet is exactly the noise we want to avoid.
    const sdk = checkPythonSdk(python);
    const sdkInstall = pythonCmd
      ? `${pythonDisplayCommand(pythonCmd)} -m pip install PowerPlatform-Dataverse-Client pandas`
      : 'Resolve Python first, then use that interpreter with -m pip (docs/dataverse-skills-setup.md)';
    if (sdk.ok) {
      checks.push({ name: 'Dataverse Python SDK', ok: true, value: 'available', hint: null });
      log.ok('Dataverse Python SDK (PowerPlatform-Dataverse-Client + pandas)');
    } else {
      checks.push({
        name: 'Dataverse Python SDK',
        ok: false,
        value: null,
        hint: `${sdk.diagnostic}\nOptional until Dataverse work. ${sdk.status === 'missing' ? sdkInstall : 'See docs/dataverse-skills-setup.md.'}`,
        optional: true,
      });
      log.info(`Dataverse Python SDK ${sdk.status} (optional until Dataverse work). ${pythonCmd ? 'Python is installed.' : ''}`);
      log.info(sdk.diagnostic);
      if (sdk.status === 'missing') log.info(`Install with the same interpreter: ${sdkInstall}`);
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
        hint: `Required (${agent.label}). Install: ${agent.install} — SDK setup: ${sdkInstall}; restart your editor.`,
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
        log.info(`     4. SDK setup (when needed): ${sdkInstall}`);
        log.info('     5. Close and reopen Claude Code, then click "Run checks".');
      } else {
        log.info('  ▶ GitHub Copilot CLI (default):');
        log.info('     1. Open your terminal.');
        log.info('     2. (If you don\'t have it) install the CLI: npm install -g @github/copilot');
        log.info('     3. Start it: type  copilot  and press Enter. First time: follow the sign-in prompt.');
        log.info('     4. At the Copilot prompt, type:  /plugin install dataverse@awesome-copilot');
        log.info('     5. Wait for "Installed", then type  /exit');
        log.info(`     6. SDK setup (when needed): ${sdkInstall}`);
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
