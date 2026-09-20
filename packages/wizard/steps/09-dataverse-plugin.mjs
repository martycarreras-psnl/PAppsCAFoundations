// wizard/steps/09-dataverse-plugin.mjs — Dataverse-skills plugin guidance
import { select } from '@inquirer/prompts';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, setCompletedStep, TOTAL_STEPS } from '../lib/state.mjs';
import { pythonDisplayCommand } from '../lib/prerequisites.mjs';
import { detectAgent, agentChoices } from '@pacaf/scripts/detect-agent.mjs';

export default async function stepDataversePlugin() {
  ui.stepHeader(9, TOTAL_STEPS, 'Dataverse-skills Plugin');

  ui.line('The Dataverse-skills plugin teaches your coding agent to provision');
  ui.line('Dataverse schema, import data, manage solutions, and administer');
  ui.line('environments through the MCP server, Python SDK, and PAC CLI.');
  ui.line('');
  ui.line('It replaces hand-written bash/curl scripts with tested, idempotent,');
  ui.line('agent-native operations.');
  ui.line('');

  // ── Detect the coding agent ──
  const choices = agentChoices();
  const detected = detectAgent();

  const agentId = await select({
    message: 'Which coding agent are you using?',
    choices: choices.map((agent) => ({
      name: agent.detected ? `${agent.label}  ← detected` : agent.label,
      value: agent.id,
    })),
    default: detected.confidence !== 'none' ? detected.id : 'copilot',
  });

  stateSet('CODING_AGENT', agentId);
  const agent = choices.find((a) => a.id === agentId);

  ui.line('');
  ui.divider();
  ui.line('');

  // ── Show install instructions ──
  if (agent.pluginInstall) {
    ui.ok(`Install command for ${agent.label}:`);
    ui.line('');
    ui.line(`  ${agent.pluginInstall}`);
    ui.line('');
    ui.line(agent.pluginCheckHint);
  } else {
    ui.info(`${agent.label}: No automated plugin install available.`);
    ui.line('');
    ui.line(agent.pluginCheckHint);
  }

  ui.line('');
  ui.divider();
  ui.line('');

  // ── Python SDK reminder ──
  ui.line('Prerequisites for the plugin:');
  ui.line('');
  ui.line('  1. Python 3.10+ must be installed (a missing SDK does not mean Python is missing)');
  const pythonCmd = stateGet('PYTHON_CMD');
  ui.line(pythonCmd
    ? `  2. ${pythonDisplayCommand(pythonCmd)} -m pip install PowerPlatform-Dataverse-Client pandas`
    : '  2. Resolve Python in Step 1, then use its recorded PYTHON_CMD with -m pip; see docs/dataverse-skills-setup.md');
  ui.line('');
  ui.line('After installing the plugin, ask your agent:');
  ui.line('');
  ui.line('  "Connect to Dataverse"');
  ui.line('');
  ui.line('The dv-connect skill will verify tools, authenticate, and');
  ui.line('register the Dataverse MCP server with your agent.');

  setCompletedStep(10);
}
