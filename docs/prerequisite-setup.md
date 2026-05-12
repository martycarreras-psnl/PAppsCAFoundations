# Prerequisite Setup Guide

Everything you need to install before running the PACAF wizard for the first time. This takes about 10 minutes on a fresh machine.

> **Where to run commands:** Every command in this guide runs inside the **VS Code terminal**. To open it, press `` Ctrl+` `` on Windows or `` ⌃` `` on macOS. You'll see a panel appear at the bottom of VS Code — that's your terminal.

---

## Quick Check — Do I Already Have Everything?

Paste this into your VS Code terminal to check all prerequisites at once:

```
node --version && git --version && dotnet --version && pac help && python3 --version
```

If every line prints a version number (no "command not found" errors), you're ready — skip to the [wizard](../README.md#-i-just-want-to-build-a-code-app).

If anything fails, work through the sections below in order.

---

## 1. Node.js — runs the wizard and all build tooling

You need **Node.js version 20 or higher**. This also installs `npm`, the package manager that downloads everything else.

### Check

```
node --version
```

If you see `v20.x.x` or higher, move on to [Git](#2-git--version-control).

### Install

<details>
<summary><strong>macOS</strong></summary>

The easiest way is with [Homebrew](https://brew.sh/), a package manager for macOS. If you don't have Homebrew yet, install it first:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the on-screen instructions — it will ask for your password. When it finishes, **close and reopen your VS Code terminal**, then install Node.js:

```bash
brew install node@20
```

</details>

<details>
<summary><strong>Windows</strong></summary>

1. Go to [https://nodejs.org](https://nodejs.org/)
2. Click the **LTS** download button (it will say something like "20.x.x LTS")
3. Run the downloaded installer — accept all defaults, click Next through every screen
4. **Close and reopen your VS Code terminal** after the install finishes

</details>

### Verify

```
node --version   # should print v20.x.x or higher
npm --version    # should print 10.x.x or higher
```

---

## 2. Git — version control

Git tracks your code changes and lets the wizard commit the scaffolded project files automatically.

### Check

```
git --version
```

If you see a version number, move on to [.NET SDK](#3-net-sdk--required-by-the-pac-cli).

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

## 3. .NET SDK — required by the PAC CLI

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

## 4. PAC CLI — connects to Power Platform

The Power Platform CLI (`pac`) is how your Code App gets registered and deployed to Dataverse. It installs as a .NET global tool — that's why you needed .NET first.

### Check

```
pac help
```

If you see a help screen listing commands like `auth`, `solution`, `code`, move on to [Python](#5-python-3--recommended-for-dataverse-skills).

### Install

This is the same command on both macOS and Windows:

```
dotnet tool install -g Microsoft.PowerApps.CLI.Tool
```

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

## 5. Python 3 — recommended for Dataverse skills

Python powers the [Dataverse-skills plugin](https://github.com/microsoft/Dataverse-skills), which teaches your coding agent how to provision Dataverse schema, import data, and manage solutions. The wizard will run without Python, but you'll want it soon after.

### Check

```
python3 --version
```

On Windows, also try:

```
python --version
```

If you see `Python 3.x.x`, you're done!

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
python3 --version   # macOS — should print Python 3.x.x
python --version    # Windows — should print Python 3.x.x
```

---

## All Done!

Run the full check one more time to confirm everything is installed:

```
node --version && git --version && dotnet --version && pac help && python3 --version
```

You should see version numbers for each tool and no errors. You're ready to [create your repo and run the wizard](../README.md#-i-just-want-to-build-a-code-app).

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
