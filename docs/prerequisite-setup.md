# Prerequisite Setup Guide

Everything you need to install before running the PACAF wizard for the first time. This takes about 10 minutes on a fresh machine.

> **You need VS Code first.** This whole guide assumes you're running **[VS Code](https://code.visualstudio.com/)** with a coding‑agent extension (GitHub Copilot Chat, Claude Code, Cursor, …) signed in — it's how you talk to the agent that drives the wizard. If you don't have VS Code yet, install it before continuing.
>
> **Where to run commands:** Every command in this guide runs inside the **VS Code terminal**. To open it, press `` Ctrl+` `` on Windows or `` ⌃` `` on macOS. You'll see a panel appear at the bottom of VS Code — that's your terminal.

---

## Quick Check — Do I Already Have Everything?

Run these in your VS Code terminal:

```
node --version
git --version
dotnet --version
pac help
```

Then check Python with `python3 --version` on macOS/Linux or `py -3 --version` on Windows (fall back to a real `python.exe`, not a Microsoft Store alias). If every command succeeds and Node is a supported LTS below, skip to the [wizard](../README.md#-i-just-want-to-build-a-code-app).

If anything fails, work through the sections below in order.

---

## 1. Node.js — runs the wizard and all build tooling

You need **Node.js 22 or 24 LTS**; **24 is recommended**. This also installs `npm`, the package manager that downloads everything else. The supported lines were checked against the [official release schedule](https://github.com/nodejs/Release/blob/main/schedule.json) on 2026-09-19: Node 20 is EOL, odd releases are unsupported, and Node 26 is not yet LTS.

### Check

```
node --version
```

If you see `v22.x.x` or `v24.x.x`, move on to [Git](#2-git--version-control). The wizard checks its **running process**, not another Node executable on PATH. It hard-blocks unsupported versions but never installs or switches Node for you.

### Install

<details>
<summary><strong>macOS</strong></summary>

Use the [official Node installer](https://nodejs.org/) or your existing version manager. If you already use [Homebrew](https://brew.sh/):

```bash
brew install node@24
brew link --overwrite --force node@24
```

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Go to [https://nodejs.org](https://nodejs.org/)
2. Choose the supported **24.x LTS** line
3. Run the downloaded installer — accept all defaults, click Next through every screen
4. **Close and reopen your VS Code terminal** after the install finishes

</details>

### Switching an existing installation

Choose **one** method matching your machine; Homebrew is not a universal prerequisite. These commands are for you to run, not an automatic wizard action:

| Existing tool | Command |
|---|---|
| nvm (macOS/Linux) or nvm-windows | `nvm install 24` then `nvm use 24` |
| fnm | `fnm install 24` then `fnm use 24` |
| Volta | `volta install node@24` |
| Homebrew (macOS only) | `brew install node@24` then `brew link --overwrite --force node@24` |
| winget (Windows only) | `winget install OpenJS.NodeJS.LTS` |
| No version manager | [Official installer](https://nodejs.org/) |

After switching, close and reopen the terminal, verify the version, **stop and restart the wizard**, then retry. Clicking Re-run in an already-running wizard cannot switch its Node process.

### Verify

```
node --version   # should print v22.x.x or v24.x.x
npm --version    # should print 10.x.x or higher
```

If Step 8 wrote the project but smoke tests failed, the files are still there; verification has **not** passed. Inspect `npm run test:smoke` output before changing auth or recreating the app. A Vitest worker crash is not proof of a PAC/solution problem. Vitest 2 already defaults to the forks pool; setting it again is not a demonstrated fix. Keep genuine verification warnings until a successful retry, and do not deploy an unverified scaffold.

---

## 2. Git — version control

Git tracks your code changes and lets the wizard commit the scaffolded project files automatically.

### Check

```
git --version
```

If you see a version number, move on to [GitHub CLI](#3-github-cli--optional-convenience).

### Install

<details>
<summary><strong>macOS</strong></summary>

macOS often includes Git already. If the check above failed:

```bash
brew install git
```

Or, if you don't have Homebrew, running `git --version` will prompt macOS to install the Xcode Command Line Tools which include Git. Click **Install** when prompted.

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Go to [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. The download starts automatically — run the installer
3. Accept all defaults. When it asks about the default editor, you can leave it as-is (you'll use VS Code anyway)
4. **Close and reopen your VS Code terminal** after the install finishes

</details>

### Verify

```
git --version   # should print git version 2.x.x or higher
```

**First-time Git setup:** If you've never used Git on this machine, tell it who you are (use the email associated with your GitHub account):

```
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"
```

---

## 3. GitHub CLI — optional convenience

The GitHub CLI (`gh`) is **optional**. Nothing in PACAF invokes it directly. Install it if you want to create your repo from this template, open PRs, or manage GitHub auth without leaving the terminal. If you'd rather do those things in the browser, skip this section.

### Check

```
gh --version
```

If you see a version number, you're set. If not — and you want it — install below. Otherwise move on to [.NET SDK](#4-net-sdk--required-by-the-pac-cli).

### Install

<details>
<summary><strong>macOS</strong></summary>

```bash
brew install gh
```

</details>

<details>
<summary><strong>Windows</strong></summary>

Using [winget](https://learn.microsoft.com/windows/package-manager/winget/) (built into Windows 10/11):

```powershell
winget install --id GitHub.cli
```

Or download the MSI installer from [https://cli.github.com/](https://cli.github.com/) and run it. **Close and reopen your VS Code terminal** after install.

</details>

### One-time auth (optional)

```
gh auth login
```

Follow the prompts — pick **GitHub.com**, **HTTPS**, and **Login with a web browser**. This stores credentials so `git push` and `gh` commands stop asking for them.

### Verify

```
gh --version          # prints gh version 2.x.x
gh auth status        # confirms you're signed in (only if you ran `gh auth login`)
```

---

## 4. .NET SDK — required by the PAC CLI

The Power Platform CLI (PAC) is built on .NET. You need the **.NET SDK version 8 or higher** installed before you can install PAC.

### Check

```
dotnet --version
```

If you see `8.x.x` or higher, move on to [PAC CLI](#4-pac-cli--connects-to-power-platform).

### Install

<details>
<summary><strong>macOS</strong></summary>

```bash
brew install dotnet-sdk
```

If you don't have Homebrew, download the macOS installer from [https://dotnet.microsoft.com/download](https://dotnet.microsoft.com/download) — choose **.NET 8** (or the latest LTS), click **macOS**, and run the `.pkg` file.

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Go to [https://dotnet.microsoft.com/download](https://dotnet.microsoft.com/download)
2. Under **.NET 8** (or the latest LTS), click **Windows** → **x64** → **Installer**
3. Run the downloaded installer — accept all defaults
4. **Close and reopen your VS Code terminal** after the install finishes

</details>

### Verify

```
dotnet --version   # should print 8.x.x or higher
```

---

## 5. PAC CLI — connects to Power Platform

The Power Platform CLI (`pac`) is how your Code App gets registered and deployed to Dataverse. It installs as a .NET global tool — that's why you needed .NET first.

### Check

```
pac help
```

If you see a help screen listing commands like `auth`, `solution`, `code`, move on to [Python](#6-python-3--recommended-for-dataverse-skills).

### Install

This is the same command on both macOS and Windows:

```
dotnet tool install -g Microsoft.PowerApps.CLI.Tool
```

> **On a Microsoft-managed device?** Direct access to the public NuGet registry (`api.nuget.org`, `nuget.org/api/v2`) may be blocked by policy (Central Feed Services). If this install fails with a **connection refused / DNS / 403** error — *not* a certificate error — point NuGet at the approved proxy feed and retry:
>
> ```bash
> dotnet nuget add source https://packagefeedproxy.microsoft.io/nuget/v3/index.json -n CFS
> dotnet nuget disable source nuget.org   # only if nuget.org is still listed and blocked
> dotnet tool install -g Microsoft.PowerApps.CLI.Tool
> ```
>
> Many managed devices already have this configured by policy — in that case the plain install just works and no action is needed. This proxy is Microsoft-internal; it is not reachable from non-Microsoft networks.

> **"command not found" after installing?** The .NET global tools directory may not be on your system PATH yet. Close and reopen your VS Code terminal. If it still doesn't work:
>
> - **macOS:** Add this to your shell config (`~/.zshrc` or `~/.bashrc`):
>   ```bash
>   export PATH="$PATH:$HOME/.dotnet/tools"
>   ```
>   Then run `source ~/.zshrc` (or restart the terminal).
>
> - **Windows:** The installer usually handles PATH, but if not, add `%USERPROFILE%\.dotnet\tools` to your system PATH via Settings → System → About → Advanced system settings → Environment Variables.

### Verify

```
pac help   # should show the PAC CLI help screen
```

---

## 6. Python 3 — recommended for Dataverse skills

Python powers the [Dataverse-skills plugin](https://github.com/microsoft/Dataverse-skills), which teaches your coding agent how to provision Dataverse schema, import data, and manage solutions. The wizard will run without Python, but you'll want it soon after.

> **Installing the full Dataverse-skills chain?** This section covers only Python itself. For the complete linear walkthrough — Python → `pip` → `PowerPlatform-Dataverse-Client` + `pandas` → PAC auth → `/plugin install dataverse` → MCP verification → smoke test, each with a verify command and failure/fix — follow [docs/dataverse-skills-setup.md](dataverse-skills-setup.md).

### Check

Use the recorded `PYTHON_CMD` from `.wizard-state.json` if available. Otherwise run `python3 --version` on macOS/Linux, or `py -3 --version` on Windows. Only fall back to a non-Store `python.exe` on Windows; never bare `python` on macOS.

Python 3 is installed if that command prints its version. The Dataverse SDK requires **3.10+**; a working 3.9 is incompatible, not missing. Before reinstalling, probe the canonical paths in the [Dataverse setup guide](dataverse-skills-setup.md#step-1--install-python-3). Missing SDK packages are a separate diagnosis.

### Install

<details>
<summary><strong>macOS</strong></summary>

```bash
brew install python@3
```

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Go to [https://www.python.org/downloads/](https://www.python.org/downloads/)
2. Click **Download Python 3.x.x**
3. Run the installer — **check the box that says "Add python.exe to PATH"** (this is important!)
4. Click **Install Now**
5. **Close and reopen your VS Code terminal** after the install finishes

</details>

### Verify

```
python3 --version   # macOS/Linux — Python 3.10+ for SDK work
py -3 --version     # Windows — Python 3.10+ for SDK work
```

> **On a Microsoft-managed device?** Direct access to the public Python Package Index (`pypi.org/simple`, `files.pythonhosted.org`) may be blocked by policy (Central Feed Services), which affects `pip install` (e.g. the Dataverse-skills `PowerPlatform-Dataverse-Client` + `pandas` step). If a `pip install` fails with a **connection refused / DNS / 403** error — *not* a certificate error — point pip at the approved proxy feed:
>
> ```bash
> pip config set global.index-url https://packagefeedproxy.microsoft.io/pypi/simple
> ```
>
> Many managed devices already have this configured by policy — in that case `pip install` just works and no action is needed. This proxy is Microsoft-internal; it is not reachable from non-Microsoft networks. See [docs/dataverse-skills-setup.md](dataverse-skills-setup.md) for the full Dataverse SDK install walkthrough.

---

## 7. Python Launcher (`py`) — Windows only

**macOS/Linux users: skip this section.** The Python Launcher is a Windows-only shim that lets you run `py -3` regardless of how Python was installed, and it's how the PACAF wizard finds Python on Windows when `python3` resolves to the Microsoft Store stub (a placeholder that exits non-zero and tries to send you to the Store).

If you installed Python from [python.org](https://www.python.org/downloads/) **and** ticked **"Add python.exe to PATH"** during install, the launcher is already there — you don't need to do anything else.

### Check (Windows only)

```powershell
py --version
py -3 --version
```

Both should print `Python 3.x.x`. If you see that, you're done.

### Fix: "py is not recognized" or the Microsoft Store opens

This means either the launcher isn't installed, or the Store stub is intercepting the call.

1. **Check for a working non-Store `python.exe` or canonical launcher path first** (see [the setup guide](dataverse-skills-setup.md#step-1--install-python-3)). If none works, install from [python.org](https://www.python.org/downloads/) with **`py launcher`** and **`Add python.exe to PATH`** checked.
2. **Disable the Store stub** — Settings → **Apps** → **Advanced app settings** → **App execution aliases** → turn **off** the entries for `python.exe` and `python3.exe`.
3. **Close and reopen your VS Code terminal**, then re-run the check.

### Verify

```powershell
py -3 --version    # Python 3.x.x
```

---

## All Done!

Run the full check one more time to confirm everything is installed:

```
node --version
git --version
dotnet --version
pac help
```

Check the recorded Python command separately (`python3 --version` on macOS/Linux or `py -3 --version` on Windows). With supported Node LTS and working tools, you're ready to [create your repo and run the wizard](../README.md#-i-just-want-to-build-a-code-app).

---

## Troubleshooting

### "command not found" after installing something

Close your VS Code terminal and reopen it (`` Ctrl+` `` twice, or click the trash icon and open a new terminal). Installers modify your system PATH, but the terminal only picks up PATH changes when it starts a new session.

### macOS asks for permission / password during Homebrew install

This is normal. Homebrew needs admin rights to install into `/usr/local` (Intel Macs) or `/opt/homebrew` (Apple Silicon). Type your Mac login password when prompted — you won't see characters as you type, that's expected.

### Windows: "npm" or "node" works in one terminal but not another

Make sure you're using the VS Code terminal, not a separate PowerShell or Command Prompt window. If VS Code was open during the install, close and reopen the entire VS Code window (not just the terminal).

### PAC CLI shows a version with a known bug

If `pac` reports version `2.3.2`, it has a known issue. Downgrade to a stable version:

```
dotnet tool update -g Microsoft.PowerApps.CLI.Tool --version 2.2.1
```

### I'm behind a corporate proxy

If downloads fail or time out, your network may route through a proxy. Ask your IT team for the proxy URL, then set it:

**macOS:**
```bash
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port
```

**Windows (PowerShell):**
```powershell
$env:HTTP_PROXY = "http://your-proxy:port"
$env:HTTPS_PROXY = "http://your-proxy:port"
```

Then retry the install command.
