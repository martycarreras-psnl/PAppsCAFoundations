---
applyTo: "**"
---

# Prerequisite Gate — Stop Before You Help

This file fires **first**, before any other instruction file, on every interaction with a fresh repo. Its job is to make sure the human in front of you has installed the things only a human can install — *before* you try to run any `npx`, `pac`, `dotnet`, or `python` command that will fail cryptically without them.

You **cannot** install Node.js, .NET SDK, PowerShell, Python, the PAC CLI, or Git for the user. These require admin rights, EULAs, OS-level package managers, and PATH manipulation that no terminal command from a coding-agent session can reliably perform on Windows or macOS. Pretending otherwise wastes the user's time and produces error spirals that look like bugs in PACAF when they are actually missing prerequisites.

## When this rule applies

Apply it whenever **any** of these are true:

- The repo has no `package.json` at root, or no `src/` directory, or no `power.config.json` — i.e. a freshly cloned template.
- The user's first request is "set up this Code App", "run the wizard", "get me started", or any similar bootstrap intent.
- A command in this session has just failed with `command not found`, `is not recognized as an internal or external command`, `'X' is not recognized`, `npx: command not found`, `dotnet: command not found`, `pac: command not found`, `python3 was not found`, or PowerShell's `The term 'X' is not recognized as a name of a cmdlet`.
- The user mentions they are on a **new machine**, a **new Windows laptop**, a **fresh install**, or a **work laptop with restricted permissions**.

If any of the above match, **run the prerequisite check before anything else**. Do not skip it on the assumption that "they probably have it." Most cryptic wizard failures reported as bugs are missing prerequisites.

## Step 1 — Run the precheck

Run these commands one at a time in the user's integrated terminal and read the output. Do **not** chain them with `&&` — you want to see which one actually fails first.

```bash
node --version
npm --version
git --version
dotnet --version
pac help
```

On **Windows**, also run:

```powershell
py -V
```

On **macOS / Linux**, run:

```bash
python3 --version
```

For each command that fails or returns a Microsoft Store stub (Windows `python3` often resolves to a stub that prompts to install — that counts as a fail), record it.

## Step 2 — If everything passes

Proceed normally. The user is set up. Move on to the wizard or whichever step they asked for. Do not lecture them about prerequisites they already have.

## Step 2.5 — Before declaring a tool missing, probe its canonical install path

Many "command not found" reports are actually **`PATH` problems, not install problems**. The classic case on macOS/Linux is a `PATH` entry containing a literal unexpanded tilde (e.g. `~/.dotnet/tools` instead of `$HOME/.dotnet/tools` or `/Users/<me>/.dotnet/tools`). Neither zsh nor bash tilde-expand inside `PATH` — the entry must use `$HOME` or an absolute path. The binary exists, runs fine when called with its absolute path, and the agent still concludes it is "missing" if it only trusts `which`.

**Before** rendering the "🛑 Prerequisite missing" stop block in Step 3, for every tool that failed the precheck in Step 1, probe its canonical install path. If the binary is present and runs from its absolute path, switch the diagnosis from **missing tool** to **broken PATH** and emit the PATH-fix block in Step 3a instead.

### Canonical install paths to probe (when `which <tool>` fails)

| Tool | macOS / Linux | Windows |
|---|---|---|
| `pac` | `$HOME/.dotnet/tools/pac` | `%USERPROFILE%\.dotnet\tools\pac.exe` |
| `dotnet` | `/usr/local/share/dotnet/dotnet`, `$HOME/.dotnet/dotnet` | `%ProgramFiles%\dotnet\dotnet.exe` |
| `node` | `/usr/local/bin/node`, `/opt/homebrew/bin/node`, `$HOME/.nvm/versions/node/*/bin/node` | `%ProgramFiles%\nodejs\node.exe` |
| `python3` | `/usr/local/bin/python3`, `/opt/homebrew/bin/python3` | (use `py -V` instead) |
| `git` | `/usr/bin/git`, `/usr/local/bin/git`, `/opt/homebrew/bin/git` | `%ProgramFiles%\Git\cmd\git.exe` |

### Diagnostic checks to run

```bash
# macOS / Linux — pac example
[ -x "$HOME/.dotnet/tools/pac" ] && "$HOME/.dotnet/tools/pac" --version
echo "$PATH" | tr ':' '\n' | grep -n '^~' && echo "⚠️  PATH contains literal ~ — these entries are broken in zsh/bash"
echo "$PATH" | tr ':' '\n' | grep -F "$HOME/.dotnet/tools" || echo "ℹ️  \$HOME/.dotnet/tools is not on PATH"
```

```powershell
# Windows — pac example
$pac = "$env:USERPROFILE\.dotnet\tools\pac.exe"
if (Test-Path $pac) { & $pac --version }
$env:Path -split ';' | Where-Object { $_ -like "*\.dotnet\tools*" }
```

If the binary runs from its absolute path **and** `which`/`Get-Command` cannot find it, you have a broken `PATH`, not a missing tool. Skip Step 3 (which would recommend reinstalling) and go to Step 3a.

## Step 3 — If a tool is genuinely missing

**Stop. Do not run `npx @pacaf/wizard-ux@latest` or any other tool.** Output a single, structured block that the user can act on without back‑and‑forth. Use this exact format:

```
🛑 Prerequisite missing — only you can install this

Before the wizard (or any PACAF tool) can run on this machine, you need to install:

  ❌ <Tool name>  — <one-sentence why it's needed>
       Install: <official download link>
       Verify:  <command they should be able to run after install>

  ❌ <next missing tool>
       …

✅ Already installed: <tools that passed, comma-separated>

Why I can't do this for you: <Node.js / .NET SDK / Python / PAC CLI> require an
installer with admin rights and PATH changes that a coding-agent terminal
session cannot perform on <Windows / macOS>. Once you install the missing
items, close and reopen your VS Code terminal so the new PATH takes effect,
then say "ready" and I'll re-run the precheck.

Full guide with copy-paste commands for each OS:
  docs/prerequisite-setup.md
```

Then **stop**. Do not try to install anything. Do not suggest `winget`, `brew`, `choco`, or `apt` as a one-liner unless the user explicitly asks — those have their own prerequisites and failure modes, and on a corporate Windows laptop `winget install` often fails with elevation or repository errors that the user then asks you to debug. The single source of truth for install instructions is [`docs/prerequisite-setup.md`](../../docs/prerequisite-setup.md); link to it and stop.

## Step 3a — If a tool is installed but not on `PATH`

When Step 2.5 finds the binary at its canonical install path and `which`/`Get-Command` still fails, **do not** tell the user to reinstall. Output a different stop block:

```
🛑 <Tool> installed but not on PATH

<Tool> exists at <canonical path> but the shell cannot find it. This is almost
always a PATH problem, not an install problem.

Most common cause on macOS/Linux: a PATH entry that contains a literal
unexpanded `~` (for example `~/.dotnet/tools`). zsh and bash do NOT
tilde-expand inside PATH — every entry must use `$HOME` or an absolute path.

One-line fix for the most common case (PAC CLI):

  # zsh (macOS default)
  echo 'export PATH="$HOME/.dotnet/tools:$PATH"' >> ~/.zshrc && exec zsh

  # bash
  echo 'export PATH="$HOME/.dotnet/tools:$PATH"' >> ~/.bash_profile && exec bash

  # PowerShell (Windows)
  [Environment]::SetEnvironmentVariable(
    'Path', "$env:Path;$env:USERPROFILE\.dotnet\tools", 'User')
  # Then close and reopen the terminal.

After applying the fix, close and reopen the VS Code terminal so the new PATH
takes effect, then say "ready" and I'll re-run the precheck.
```

Then **stop**. Do **not** advise the user to run `dotnet tool install`, `npm install -g`, or any other re-install. Re-installing on top of a broken `PATH` produces two copies of the same tool and a longer support thread.

## Step 4 — Common Windows gotchas you must surface

On Windows, the following situations are mistaken for PACAF bugs almost weekly. When the user is on Windows, name them up front instead of letting them surprise the user later:

1. **`python3` resolves to the Microsoft Store stub.** Running `python3 --version` opens the Store. Always test with `py -V` on Windows. The wizard's prereq check already handles this fallback — but only after Node.js + `npx` work.
2. **PowerShell not the default terminal.** VS Code on Windows may default to `cmd.exe` or Git Bash. Some commands (notably `pac auth create` and `dotnet tool install`) behave better in PowerShell. Tell the user: open the VS Code Command Palette (`Ctrl+Shift+P`) → **Terminal: Select Default Profile** → choose **PowerShell** (not Windows PowerShell 5.1 if Pwsh 7 is installed) → open a new terminal.
3. **`pac` installed but not on PATH.** `dotnet tool install -g Microsoft.PowerApps.CLI.Tool` puts `pac.exe` in `%USERPROFILE%\.dotnet\tools`. That folder must be on PATH, which the .NET SDK installer adds — but only after the terminal is restarted. If `pac help` fails right after `dotnet tool install`, the fix is **close and reopen the terminal**, not reinstall.
4. **`npx` exits with code 9009 ("not recognized").** Means Node.js is not on PATH. Don't try to `npx` again with different syntax — Node.js is missing or the terminal needs restarting.
5. **Corporate proxy / SSL inspection.** If `npm install`, `dotnet tool install`, or `pip install` fail with certificate errors, the user is behind an SSL-inspecting proxy. PACAF cannot fix this — the user (or their IT team) must configure `NODE_EXTRA_CA_CERTS`, the .NET cert store, and `pip` trusted hosts. Surface this as the diagnosis; do not loop trying retry flags.
6. **OneDrive-synced workspace path.** If the repo lives under `C:\Users\<you>\OneDrive\…` and OneDrive is set to "Files On‑Demand", `pnpm install` and the wizard's auth scrub can fail with permission errors. The fix is to either move the repo out of OneDrive or set the folder to "Always keep on this device." Detect this from the workspace path.

## Step 5 — Common macOS gotchas

1. **`xcode-select` not installed.** First `git --version` on a fresh Mac triggers the Xcode Command Line Tools installer. That's a GUI prompt only the user can accept — do not try to script it.
2. **Homebrew on Apple Silicon vs Intel.** On Apple Silicon, Homebrew installs to `/opt/homebrew`; on Intel, to `/usr/local`. After install, the user must run `eval "$(/opt/homebrew/bin/brew shellenv)"` (or the equivalent for Intel) and add it to their shell rc. Until they do, `brew` works only in the install window's terminal.
3. **`python3` on macOS without Xcode CLT.** Same trigger as #1 — the first `python3` invocation prompts the GUI installer.
4. **`PATH` entries with literal `~` are silently broken in zsh/bash.** A `PATH` segment of `~/.dotnet/tools` (typed by an installer, an old shell rc, or a GUI tool) is *not* tilde-expanded by zsh or bash — `which pac` will fail even though `~/.dotnet/tools/pac` exists. Always use `$HOME/.dotnet/tools` or a fully-expanded absolute path. Detect with:
   ```bash
   echo "$PATH" | tr ':' '\n' | grep -n '^~' && echo "⚠️  PATH contains literal ~ — these entries are broken"
   ```
   This is what Step 2.5 / Step 3a is designed to catch — do not skip those steps on macOS.

## Step 6 — When the user comes back

When the user replies "ready" or "done" after installing, re-run only the commands that previously failed. Confirm each is now passing **before** moving on. If any are still failing, repeat Step 3 with only the still-missing items. Do not assume "ready" means everything works.

## Step 7 — Only if the user is invoking the wizard *from source*, gate on workspace install + build

The system-level checks above cover the **default scenario**: the user (or you) runs `npx @pacaf/wizard-ux@latest`. That is a self-contained, published npm artifact — it does **not** read the local workspace, it does **not** need `pnpm install`, and it does **not** need anything to be built. It works the same whether the cwd is an empty folder, a downstream Code App, or even the PACAF monorepo itself.

**Do not block on Step 7 just because the cwd looks like the PACAF source tree.** When the user says "run the wizard", "start the wizard", "set me up", or any similar bootstrap intent, your default action is `npx @pacaf/wizard-ux@latest` — no workspace check, no build, no questions about the monorepo. Run it and let the published artifact handle the rest.

Step 7 fires **only** when the user has explicitly asked to run the wizard, scripts, or rebrand tool **from source**. The unambiguous source-tree invocations are:

- `pnpm --filter @pacaf/wizard-ux dev`
- `pnpm --filter @pacaf/wizard-ux start`
- `node packages/wizard-ux/bin/...`
- `node packages/wizard/index.mjs`
- `node packages/scripts/...`
- `node packages/rebrand/bin/...`
- Any command the user typed that begins with `pnpm --filter @pacaf/...` or `node packages/...`

If — and only if — the user has asked for one of those, and **all three** of these files exist at the workspace root, run the workspace check:

- `pnpm-workspace.yaml`
- `packages/wizard-ux/package.json`
- `packages/agent-instructions/package.json`

```bash
# Are workspace deps installed?
[ -d node_modules ] && [ -d packages/wizard-ux/node_modules ] && echo "✅ workspace installed" || echo "❌ run: pnpm install"

# Are the publishable packages built?
[ -d packages/wizard-ux/dist ] && echo "✅ wizard-ux built" || echo "❌ run: pnpm --filter @pacaf/wizard-ux build"
```

If either check fails, output:

```
🛑 Monorepo source tree — workspace not ready

You asked to run the wizard from source (`pnpm --filter ...` / `node packages/...`),
which needs the workspace installed and built first:

  pnpm install
  pnpm --filter @pacaf/wizard-ux build

After both succeed, re-run your command.

NOTE: if you just want to *use* the wizard, you don't need any of this —
`npx @pacaf/wizard-ux@latest` is self-contained and works from any cwd.
```

Then run `pnpm install` / `pnpm --filter ... build` yourself **only if the user has confirmed they want to develop against source**. Do not silently install in a workspace the user might have intentionally left in a partial state (e.g. mid-bisect).

This gate does **not** apply to:
- Downstream Code App repos generated by the wizard — they have no `pnpm-workspace.yaml` and no `packages/wizard-ux/`. Skip Step 7 for those.
- Any `npx @pacaf/...` invocation, regardless of cwd. Those use the published artifact and never need the local workspace.

## Step 8 — Dataverse intent? HARD GATE on the Dataverse-skills plugin

All Dataverse work in this template is delegated to the **[microsoft/Dataverse-skills](https://github.com/microsoft/Dataverse-skills)** plugin (schema, data, queries, solution lifecycle, environment admin, security). The plugin is **not optional** — it is the first-class, only-supported path. If the user has any Dataverse intent and the plugin is **not installed and verified**, you must **STOP** before attempting any Dataverse operation.

### When this gate fires

Fire it whenever **any** of these are true:

- The user asks to provision, create, modify, or query Dataverse tables, columns, relationships, option sets, forms, or views.
- The user asks to import, seed, export, or bulk-edit Dataverse data.
- The user asks to create or manage a publisher, solution, business unit, owner team, or security role.
- The user reaches the schema / data phase of the planning workflow (07, 07a, 07b).
- A Dataverse MCP tool call (`list_tables`, `describe_table`, etc.) fails with "tool not found" / "no such tool" / "MCP server not connected".

This gate does **not** fire for pure Code App scaffold, connector binding for non-Dataverse connectors, or planning phases 00a–00e that have not yet reached schema design.

### Detection (read-only — do this before declaring the plugin missing)

The plugin install is **manual** (see why below). Detect it without trying to install it:

1. **Plugin files present.** Check the agent's installed-plugins cache:
   - **GitHub Copilot (VS Code or CLI):** `~/.copilot/installed-plugins/awesome-copilot/dataverse/skills/` exists, and `~/.copilot/config.json` lists an `installedPlugins[]` entry with `name == "dataverse"`, `enabled == true`, and an existing `cache_path`.
   - **Claude Code:** the equivalent installed-plugins path under `~/.claude*` (e.g. the `dataverse@claude-plugins-official` plugin cache).
   ```bash
   # macOS / Linux — Copilot
   [ -d "$HOME/.copilot/installed-plugins/awesome-copilot/dataverse/skills" ] \
     && echo "✅ Dataverse-skills plugin files present" \
     || echo "❌ Dataverse-skills plugin not found"
   ```
2. **Python 3 + SDK importable.** The plugin's runtime needs Python 3 and the `PowerPlatform-Dataverse-Client` SDK plus `pandas`:
   ```bash
   python3 -c "import pandas, PowerPlatform_Dataverse_Client" 2>/dev/null \
     && echo "✅ Dataverse Python SDK present" \
     || echo "❌ Dataverse Python SDK missing — pip install PowerPlatform-Dataverse-Client pandas"
   ```
3. **MCP verified.** Confirm the Dataverse MCP tools are actually reachable from your session (e.g. a `list_tables` call succeeds). A freshly installed plugin only exposes its MCP tools **after the editor/CLI is restarted**.

If all three pass, proceed with the Dataverse work normally.

### If the plugin is missing — STOP

You **cannot** reliably install the Copilot plugin for the user: `/plugin install` is an interactive slash command, not a scriptable shell subcommand, and hand-editing `~/.copilot/config.json` is fragile and unsupported. Detect only, then output a single STOP block. Branch the install command by detected agent (use `packages/scripts/detect-agent.mjs`):

```
🛑 Dataverse-skills plugin required — install it before any Dataverse work

All Dataverse operations in this template go through the Dataverse-skills plugin.
It is not installed (or its Python SDK / MCP tools aren't available yet).

IMPORTANT: these steps use the GitHub Copilot CLI (a terminal app), NOT the
Copilot chat inside VS Code. They are different tools. The CLI is what installs
the Dataverse plugin reliably.

▶ GitHub Copilot CLI (default):
  1. Open your terminal.
  2. (If you don't have it) install the CLI: npm install -g @github/copilot
  3. Start it: type  copilot  and press Enter. First time: follow the sign-in prompt.
  4. At the Copilot prompt, type:  /plugin install dataverse@awesome-copilot
  5. Wait for "Installed", then type  /exit
  6. Run:  pip install PowerPlatform-Dataverse-Client pandas
  7. Restart your editor so the MCP tools load, then say "ready".

▶ Claude / Claude Code:
  1. Open your terminal.
  2. Add the catalog:   claude plugin marketplace add <claude-plugins-official repo>
  3. Install:           claude plugin install dataverse@claude-plugins-official
  4. Run:               pip install PowerPlatform-Dataverse-Client pandas
  5. Close and reopen Claude Code, then say "ready".

Why I can't do this for you: the plugin install is an interactive command and a
freshly installed plugin only exposes its MCP tools after an editor restart — a
coding-agent session cannot perform either step.

Full guide: docs/dataverse-skills-setup.md
```

Then **stop**. Do not attempt Dataverse operations, do not hand-roll Web API / FetchXML calls as a workaround, and do not try to script the plugin install. The `pip install PowerPlatform-Dataverse-Client pandas` step is safe and agent-agnostic — you may run that one for the user — but the plugin install itself is manual.

### When the user says "ready"

Re-run the three detection checks above. Only proceed once the plugin files are present, the SDK imports, **and** a Dataverse MCP tool call actually succeeds. If MCP tools still aren't reachable, the most common cause is a missing editor restart — say so and wait.

## Step 9 — Code App scaffold / deploy / connector intent? HARD GATE on the Code Apps plugin

All Code App scaffolding, deployment, and connector-binding work in this template is delegated to the **[microsoft/power-platform-skills Code Apps plugin](https://github.com/microsoft/power-platform-skills/tree/main/plugins/code-apps)**. The plugin is **not optional** — it is the first-class, only-supported path for these operations. If the user has any scaffold, deploy, or connector intent and the plugin is **not installed and verified**, you must **STOP** before attempting the operation.

### When this gate fires

Fire it whenever **any** of these are true:

- The user asks to scaffold, create, or initialize a new Code App.
- The user asks to build and deploy (`pac code push` or equivalent).
- The user asks to add a data source, connector, or data binding of any kind (Dataverse, SharePoint, Teams, SQL, Excel, OneDrive, Office 365, Azure DevOps, or any other connector).
- The user asks to list connections or get a connection ID.
- A connector registration command (`pac code add-data-source`) fails or the user asks why generated files weren't created.

This gate does **not** fire for planning phases (00a–00e), TypeScript/React component work inside `src/`, or reading and discussing existing code.

### Detection (read-only — do this before declaring the plugin missing)

The plugin install is **manual** (see why below). Detect it without trying to install it:

1. **Plugin files present.** Check the agent's installed-plugins cache:
   - **GitHub Copilot (VS Code or CLI):** `~/.copilot/installed-plugins/power-platform-skills/code-apps-preview/` exists, and `~/.copilot/config.json` lists an `installedPlugins[]` entry with `name == "code-apps-preview"` and `enabled == true`.
   - **Claude Code:** the equivalent installed-plugins path under `~/.claude*` (e.g. `~/.claude/plugins/power-platform-skills/code-apps-preview/`).
   ```bash
   # macOS / Linux — Copilot
   [ -d "$HOME/.copilot/installed-plugins/power-platform-skills/code-apps" ] \
     && echo "✅ Code Apps plugin files present" \
     || echo "❌ Code Apps plugin not found"
   ```
   > **Note:** The marketplace lists this plugin as `code-apps-preview`. If you see "not found" when searching for `code-apps`, use `code-apps-preview@power-platform-skills` instead.
2. **Skills reachable.** Confirm the plugin's skills are available in your session (e.g. `/list-connections` is recognized). A freshly installed plugin only exposes its skills **after the editor/CLI is restarted**.

If both pass, proceed with the Code App work normally by invoking the relevant skill.

### If the plugin is missing — STOP

You **cannot** reliably install the plugin for the user: `/plugin install` is an interactive slash command, not a scriptable shell subcommand, and hand-editing `~/.copilot/config.json` is fragile and unsupported. Detect only, then output a single STOP block:

```
🛑 Code Apps plugin required — install it before scaffold / deploy / connector work

All Code App scaffolding, deployment, and connector operations in this template
go through the power-platform-skills Code Apps plugin. It is not installed (or
its skills aren't available yet).

Install it in two steps — run these inside Claude Code or GitHub Copilot chat
(not in the terminal):

  Step 1 — Add the marketplace:
    /plugin marketplace add microsoft/power-platform-skills

  Step 2 — Install the plugin:
    /plugin install code-apps-preview@power-platform-skills

After installing, restart your editor so the plugin's skills load, then say
"ready" and I'll verify before continuing.

Why I can't do this for you: /plugin install is an interactive slash command
that only works inside the agent chat UI. A terminal session cannot run it, and
hand-editing config files is unsupported and fragile.

Plugin README: https://github.com/microsoft/power-platform-skills/tree/main/plugins/code-apps
```

Then **stop**. Do not attempt to hand-roll `pac code add-data-source` steps, manually scaffold connector files, or work around the missing plugin. The plugin is the supported path.

### Scaffolding override — wizard takes precedence over plugin degit

The plugin's `/create-code-app` skill scaffolds using `npx degit microsoft/PowerAppsCodeApps/templates/vite`. **Do not use this for PACAF repos.** Instead, use `npx @pacaf/wizard-ux@latest` — it wires up publisher, solution, App Registration, and auth in the correct order. For all other plugin skills (`/deploy`, `/add-*`, `/list-connections`), invoke the plugin as normal.

### When the user says "ready"

Re-run the detection checks above. Only proceed once the plugin files are present **and** a plugin skill (e.g. `/list-connections`) is recognized in the session. If skills still aren't reachable, the most common cause is a missing editor restart — say so and wait.

---

## Why this rule exists

A coding agent's superpower is *speed inside a working environment*. Inside a *broken* environment, that same speed produces a flurry of confident-sounding terminal commands that all fail in slightly different ways, and the user ends up convinced PACAF is broken. The agent should refuse to play that game. One clear stop, one clear list, one link to a guide — then wait.

Full setup instructions for each tool, with OS-specific copy‑paste commands and verification checks: [`docs/prerequisite-setup.md`](../../docs/prerequisite-setup.md).
