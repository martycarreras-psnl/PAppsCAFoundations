#!/usr/bin/env node

/**
 * scripts/detect-agent.mjs — Cross-platform coding-agent detection.
 *
 * Checks process.env for IDE / agent signals and returns a best-guess agent
 * identifier. Works identically on Windows and macOS.
 *
 * Usage:
 *   import { detectAgent, AGENTS } from './detect-agent.mjs';
 *   const agent = detectAgent();          // e.g. { id: 'copilot', ... }
 *
 * CLI:
 *   node scripts/detect-agent.mjs        // prints JSON to stdout
 */

/** Canonical agent definitions with plugin install commands. */
export const AGENTS = {
  copilot: {
    id: 'copilot',
    label: 'GitHub Copilot (VS Code)',
    pluginInstall: '/plugin install dataverse@awesome-copilot',
    pluginCheckHint: 'Run "/plugin list" in Copilot Chat to verify.',
    pythonRequired: true,
  },
  claude: {
    id: 'claude',
    label: 'Claude Code',
    pluginInstall: '/plugin install dataverse@claude-plugins-official',
    pluginCheckHint: 'Run "claude mcp list" to verify the Dataverse MCP server.',
    pythonRequired: true,
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    pluginInstall: null, // Plugin mechanism TBD — install Copilot-style or manually
    pluginCheckHint: 'Cursor does not yet have a native plugin install command for Dataverse-skills. Install the Copilot plugin or configure MCP manually.',
    pythonRequired: true,
  },
  windsurf: {
    id: 'windsurf',
    label: 'Windsurf',
    pluginInstall: null,
    pluginCheckHint: 'Windsurf does not yet have a native plugin install command for Dataverse-skills. Configure MCP manually.',
    pythonRequired: true,
  },
  other: {
    id: 'other',
    label: 'Other / Manual',
    pluginInstall: null,
    pluginCheckHint: 'See https://github.com/microsoft/Dataverse-skills for install instructions for your agent.',
    pythonRequired: true,
  },
};

/**
 * Detect the coding agent from environment variables.
 * Returns an AGENTS entry with an added `confidence` field.
 */
export function detectAgent() {
  const env = process.env;

  // VS Code (Copilot) — VSCODE_PID is injected by the VS Code integrated terminal
  if (env.VSCODE_PID || env.TERM_PROGRAM === 'vscode' || env.VSCODE_GIT_IPC_HANDLE) {
    // Double-check it's not Cursor masquerading — Cursor also sets some VSCODE_ vars
    if (!env.CURSOR_TRACE_ID && !env.CURSOR_CHANNEL) {
      return { ...AGENTS.copilot, confidence: 'high' };
    }
  }

  // Cursor — sets its own env vars even though it's VS Code-based
  if (env.CURSOR_TRACE_ID || env.CURSOR_CHANNEL) {
    return { ...AGENTS.cursor, confidence: 'high' };
  }

  // Claude Code CLI — sets CLAUDE env var
  if (env.CLAUDE) {
    return { ...AGENTS.claude, confidence: 'high' };
  }

  // Windsurf
  if (Object.keys(env).some((k) => k.startsWith('WINDSURF_'))) {
    return { ...AGENTS.windsurf, confidence: 'high' };
  }

  // Fallback — couldn't determine from env
  return { ...AGENTS.other, confidence: 'none' };
}

/** Return all agent options as a list, with the detected one marked. */
export function agentChoices() {
  const detected = detectAgent();
  return Object.values(AGENTS).map((agent) => ({
    ...agent,
    detected: agent.id === detected.id && detected.confidence !== 'none',
  }));
}

// CLI mode — print detection result as JSON
if (process.argv[1] && process.argv[1].endsWith('detect-agent.mjs')) {
  const result = detectAgent();
  console.log(JSON.stringify(result, null, 2));
}
