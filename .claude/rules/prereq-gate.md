---
paths:
  - "**"
---
<!-- Generated from .github/instructions/00-prereq-gate.instructions.md — do not edit directly -->
# Prerequisite Gate — Stop Before You Help

Loaded on every interaction. Before running any `npx`, `pac`, `dotnet`, or `python` command in a fresh repo, **verify that the user has the prerequisites installed**.

## When to gate
- Fresh repo (no `package.json`, no `src/`, no `power.config.json`)
- User asks to "set up", "run the wizard", "get me started"
- A command in this session failed with `command not found` / `is not recognized` / `npx: command not found` / `pac: command not found` / `python3 was not found`
- User mentions new machine, fresh install, new laptop, corporate/restricted laptop

## The check (run one at a time, do not chain with `&&`)
```bash
node --version
npm --version
git --version
dotnet --version
pac help
```
On Windows also: `py -V`. On macOS/Linux: `python3 --version`.

## Before declaring a tool missing — probe the canonical install path

Many "command not found" reports are actually **PATH problems, not install problems**. The classic case on macOS/Linux is a `PATH` entry that contains a literal unexpanded `~` (e.g. `~/.dotnet/tools`). zsh and bash do not tilde-expand inside `PATH`, so `which pac` fails even though the binary exists at `$HOME/.dotnet/tools/pac`.

For every tool that fails the precheck, **before** firing the missing-tool stop block, test the canonical install path directly:

| Tool | macOS / Linux canonical path | Windows canonical path |
|---|---|---|
| `pac` | `$HOME/.dotnet/tools/pac` | `%USERPROFILE%\.dotnet\tools\pac.exe` |
| `dotnet` | `/usr/local/share/dotnet/dotnet`, `$HOME/.dotnet/dotnet` | `%ProgramFiles%\dotnet\dotnet.exe` |
| `node` | `/usr/local/bin/node`, `/opt/homebrew/bin/node` | `%ProgramFiles%\nodejs\node.exe` |
| `git` | `/usr/bin/git`, `/usr/local/bin/git`, `/opt/homebrew/bin/git` | `%ProgramFiles%\Git\cmd\git.exe` |

If the binary runs from the absolute path but `which`/`Get-Command` cannot find it, you have a **broken PATH**, not a **missing tool**. Output the PATH-fix stop block below instead of the install-missing one — do **not** advise reinstalling.

```
🛑 <Tool> installed but not on PATH

<Tool> exists at <canonical path> but the shell cannot find it.

Most common cause on macOS/Linux: a PATH entry containing a literal `~`.
zsh and bash do NOT tilde-expand inside PATH — entries must use `$HOME`
or an absolute path.

  # zsh (macOS default)
  echo 'export PATH="$HOME/.dotnet/tools:$PATH"' >> ~/.zshrc && exec zsh

  # PowerShell (Windows)
  [Environment]::SetEnvironmentVariable(
    'Path', "$env:Path;$env:USERPROFILE\.dotnet\tools", 'User')
```

## If a tool is genuinely missing — STOP

You cannot install Node.js, .NET SDK, PowerShell, Python, the PAC CLI, or Git for the user. Output a single structured block:

```
🛑 Prerequisite missing — only you can install this

  ❌ <Tool>  — <why it's needed>
       Install: <official link>
       Verify:  <command>

✅ Already installed: <passing tools>

Why I can't do this for you: <tool> requires an installer with admin rights
and PATH changes that a coding-agent terminal cannot perform. After install,
close and reopen the VS Code terminal, then say "ready" and I'll re-check.

Full guide: docs/prerequisite-setup.md
```

Then **stop**. Do not suggest `winget`, `brew`, `choco`, or `apt` one-liners unless the user explicitly asks — those have their own elevation/proxy failure modes that you will end up debugging instead.

## Windows gotchas you must surface up front
- `python3` resolves to the Microsoft Store stub → always test with `py -V` on Windows.
- VS Code default terminal may be `cmd.exe`, not PowerShell. Tell the user: Command Palette → **Terminal: Select Default Profile** → **PowerShell**.
- `pac` installs into `%USERPROFILE%\.dotnet\tools` — must restart the terminal after `dotnet tool install`.
- `npx` exit code 9009 = Node.js missing or terminal not restarted.
- Corporate SSL inspection breaks `npm`/`dotnet`/`pip` with cert errors — name the diagnosis, don't retry.
- OneDrive-synced workspace under `Files On-Demand` causes permission errors — recommend "Always keep on this device" or move out of OneDrive.

## macOS gotchas
- First `git --version` triggers the Xcode Command Line Tools GUI installer — user-only.
- Homebrew on Apple Silicon = `/opt/homebrew`; on Intel = `/usr/local`. Must `eval "$(/opt/homebrew/bin/brew shellenv)"` and add to shell rc.
- **`PATH` entries with literal `~` are silently broken in zsh/bash.** `~/.dotnet/tools` is not tilde-expanded inside `PATH` — use `$HOME/.dotnet/tools`. This is the #1 cause of "pac not found" on a Mac that does have PAC installed; the canonical-path probe above is designed to catch it.

## When the user says "ready"
Re-run **only** the previously-failing commands. Confirm each one passes before proceeding. Repeat the stop block with the still-missing items if anything is still failing.

## Dataverse intent? HARD GATE on the Dataverse-skills plugin
All Dataverse work in this template is delegated to the **[microsoft/Dataverse-skills](https://github.com/microsoft/Dataverse-skills)** plugin — it is the first-class, only-supported path, **not optional**. If the user has any Dataverse intent (provision/modify/query tables, columns, relationships, option sets, forms, views; import/seed/export/bulk-edit data; solution lifecycle; org structure) and the plugin is **not installed and verified**, **STOP** before any Dataverse operation. Does **not** fire for pure Code App scaffold, non-Dataverse connector binding, or planning phases 00a–00e before schema design.

Detect (read-only — do not try to install):
1. **Files present** — `[ -d "$HOME/.copilot/installed-plugins/awesome-copilot/dataverse/skills" ]` (Copilot) or the `~/.claude*` `dataverse@claude-plugins-official` cache; `~/.copilot/config.json` `installedPlugins[]` entry `name=="dataverse"`, `enabled`, existing `cache_path`.
2. **Python SDK** — `python3 -c "import pandas, PowerPlatform_Dataverse_Client"`.
3. **MCP verified** — a `list_tables` call actually succeeds (MCP tools only load **after an editor/CLI restart**).

If missing, STOP with a single block; branch the install command by detected agent (`packages/scripts/detect-agent.mjs`). Copilot: run `copilot`, then `/plugin install dataverse@awesome-copilot`, then `pip install PowerPlatform-Dataverse-Client pandas`, restart editor. Claude: `claude plugin marketplace add <claude-plugins-official repo>` → `claude plugin install dataverse@claude-plugins-official` → same pip → restart. Do **not** hand-roll Web API / FetchXML as a workaround or script the plugin install (it's interactive). The `pip install` step is safe to run for the user. Re-detect on "ready"; if MCP still unreachable, the cause is usually a missing restart.

## Only if the user explicitly invokes the wizard *from source*, gate on `pnpm install` + build

When the user says "run the wizard", "start the wizard", "set me up" — or any similar bootstrap intent — your default action is `npx @pacaf/wizard-ux@latest`. That artifact is **self-contained from npm**: it does not read the local workspace, it does not need `pnpm install`, and it does not need anything to be built. It runs the same in an empty folder, in a downstream Code App, or inside the PACAF monorepo itself. **Do not gate on workspace install just because the cwd looks like the source tree.**

This source-tree gate fires **only** when the user explicitly typed a source-tree invocation:

- `pnpm --filter @pacaf/wizard-ux dev` / `start`
- `node packages/wizard-ux/bin/...`
- `node packages/wizard/index.mjs`
- `node packages/scripts/...`
- `node packages/rebrand/bin/...`
- Anything starting with `pnpm --filter @pacaf/...` or `node packages/...`

If the user asked for one of the above **and** the cwd contains all three of `pnpm-workspace.yaml`, `packages/wizard-ux/package.json`, `packages/agent-instructions/package.json`:

```bash
[ -d node_modules ] && [ -d packages/wizard-ux/node_modules ] && echo "✅ installed" || echo "❌ run: pnpm install"
[ -d packages/wizard-ux/dist ] && echo "✅ built" || echo "❌ run: pnpm --filter @pacaf/wizard-ux build"
```

If either fails:

```
🛑 Monorepo source tree — workspace not ready

You asked to run from source (`pnpm --filter ...` / `node packages/...`). Run:
  pnpm install
  pnpm --filter @pacaf/wizard-ux build

If you just want to *use* the wizard, you don't need any of this —
`npx @pacaf/wizard-ux@latest` is self-contained and works from any cwd.
```

Does **not** apply to:
- Downstream Code App repos (no `pnpm-workspace.yaml`, no `packages/wizard-ux/`).
- Any `npx @pacaf/...` invocation, regardless of cwd.

Full details: `.github/instructions/00-prereq-gate.instructions.md`
