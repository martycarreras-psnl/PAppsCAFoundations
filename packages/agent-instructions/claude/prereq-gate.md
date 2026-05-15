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

## If anything fails — STOP

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

## When the user says "ready"
Re-run **only** the previously-failing commands. Confirm each one passes before proceeding. Repeat the stop block with the still-missing items if anything is still failing.

Full details: `.github/instructions/00-prereq-gate.instructions.md`
