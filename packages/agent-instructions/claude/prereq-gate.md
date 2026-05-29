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

## If this IS the PACAF monorepo source tree — gate on `pnpm install` + build

The checks above only cover **consumers** running `npx @pacaf/wizard-ux@latest` (published artifact, self-contained). They do **not** cover **contributors** working inside the PACAF source repo who try to run the wizard / scripts / rebrand tool from source. In that case the workspace `node_modules` and built artifacts are missing and the wizard crashes with `Cannot find package 'fastify'` (or similar) which looks like a PACAF bug. It isn't.

Detect the source tree: presence of **all** of `pnpm-workspace.yaml`, `packages/wizard-ux/package.json`, and `packages/agent-instructions/package.json` at the workspace root.

If detected, before suggesting `pnpm --filter ... dev`, `node packages/.../bin/...`, or any local wizard invocation:

```bash
[ -d node_modules ] && [ -d packages/wizard-ux/node_modules ] && echo "✅ installed" || echo "❌ run: pnpm install"
[ -d packages/wizard-ux/dist ] && echo "✅ built" || echo "❌ run: pnpm --filter @pacaf/wizard-ux build"
```

If either fails, stop and tell the user:

```
🛑 Monorepo source tree — workspace not ready

Run:
  pnpm install
  pnpm --filter @pacaf/wizard-ux build

End users do NOT need this — `npx @pacaf/wizard-ux@latest` is self-contained.
```

Does **not** apply to downstream Code App repos (no `pnpm-workspace.yaml`, no `packages/wizard-ux/`).

Full details: `.github/instructions/00-prereq-gate.instructions.md`
