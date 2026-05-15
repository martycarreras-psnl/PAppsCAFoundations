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

## Step 3 — If anything fails

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

## Step 6 — When the user comes back

When the user replies "ready" or "done" after installing, re-run only the commands that previously failed. Confirm each is now passing **before** moving on. If any are still failing, repeat Step 3 with only the still-missing items. Do not assume "ready" means everything works.

## Why this rule exists

A coding agent's superpower is *speed inside a working environment*. Inside a *broken* environment, that same speed produces a flurry of confident-sounding terminal commands that all fail in slightly different ways, and the user ends up convinced PACAF is broken. The agent should refuse to play that game. One clear stop, one clear list, one link to a guide — then wait.

Full setup instructions for each tool, with OS-specific copy‑paste commands and verification checks: [`docs/prerequisite-setup.md`](../../docs/prerequisite-setup.md).
