# Dataverse-skills Setup — One Linear Walkthrough

This is the **single source of truth** for installing everything the [Dataverse-skills plugin](https://github.com/microsoft/Dataverse-skills) needs. Follow it top to bottom on a fresh machine and you will go from *"I cloned the repo"* to *"the agent can provision a Dataverse table"* with no guesswork.

The Dataverse-skills plugin is the engine your coding agent uses for schema provisioning (`dv-metadata`), data operations (`dv-data` / `dv-query`), solution lifecycle (`dv-solution`), and environment admin (`dv-admin` / `dv-security`). If the prerequisites below aren't installed **in this order**, the agent looks broken when the real cause is a missing prerequisite.

> **Already have the base toolchain?** If `node`, `git`, `dotnet`, and `pac` already pass their checks (see [docs/prerequisite-setup.md](prerequisite-setup.md)), you can start at [Step 1](#step-1--install-python-3) — this guide only covers the Dataverse-skills-specific chain plus the PAC auth it depends on.

Every step has the same five parts:

1. **Do** — one concrete action.
2. **Command / click path** — copy-pasteable, OS-specific where it matters.
3. **Reference** — the official doc that backs the step.
4. **Verify** — the exact command and the exact output that proves success.
5. **If it fails** — the single most common failure and how to recover.

Legend: 🍎 = macOS / Linux, 🪟 = Windows.

---

## Step 0 — Confirm the base toolchain (gate)

**Do:** Make sure Node.js, Git, the .NET SDK, and the PAC CLI are installed before touching Python. The Dataverse-skills plugin authenticates through the PAC CLI, so PAC must already work.

**Command:**

```bash
node --version
git --version
dotnet --version
pac help
```

**Reference:** [docs/prerequisite-setup.md](prerequisite-setup.md) — full base-tool install per OS.

**Verify:** Each of the first three prints a version; `pac help` prints a help screen listing `auth`, `solution`, `code`.

**If it fails:** Any *"command not found"* / *"is not recognized"* means that tool is missing or your terminal hasn't picked up a new PATH. Install the missing tool from [docs/prerequisite-setup.md](prerequisite-setup.md), then **close and reopen the VS Code terminal**. On macOS, if `pac` is missing even though you installed it, your PATH may contain a literal `~` — use `$HOME/.dotnet/tools` instead (see the prereq guide's PATH note).

---

## Step 1 — Install Python 3

**Do:** Resolve an existing Python before installing anything. The SDK requires **Python 3.10+**. A working 3.9 interpreter is installed but SDK-incompatible, not missing.

The wizard records **`PYTHON_CMD`** in `.wizard-state.json`. Verify and reuse that command for every check and install below. On macOS/Linux default to `python3`, never bare `python`. On Windows prefer `py -3`, then a real `python.exe`; skip executables under `Microsoft\WindowsApps` (Store aliases). Normalize old recorded `py` to `py -3`. If PATH lookup fails, check `/opt/homebrew/bin/python3`, `/usr/local/bin/python3`, `/usr/bin/python3` on POSIX or `%LOCALAPPDATA%\Programs\Python\Launcher\py.exe -3` / `%WINDIR%\py.exe -3` on Windows before calling Python missing.

When a canonical executable works, record its absolute path and report the PATH problem rather than asking for a reinstall. Quote paths containing spaces; in PowerShell use `& 'C:\path with spaces\python.exe'`. A launcher must be invoked as `py -3`, not `& 'py -3'`.

**Command:**

🍎 macOS:

```bash
brew install python@3
```

🪟 Windows — download from [python.org/downloads](https://www.python.org/downloads/), run the installer, and **tick "Add python.exe to PATH"** before clicking **Install Now**. Then close and reopen the terminal.

**Reference:** [python.org/downloads](https://www.python.org/downloads/) · [PowerPlatform-Dataverse-Client requires Python 3.10+ (PyPI)](https://pypi.org/project/PowerPlatform-Dataverse-Client/).

**Verify:**

```bash
python3 --version    # 🍎 prints: Python 3.10+ (or use the recorded executable)
py -3 --version      # 🪟 prints: Python 3.10+ (or use recorded python.exe)
```

**If it fails:** 🪟 On Windows, `python3` often resolves to the **Microsoft Store stub**. Try `py -3 --version`, then a non-Store `python.exe`, then the canonical paths above. Only if none works should you install from python.org with **`py launcher`** and **`Add python.exe to PATH`** checked. See [docs/prerequisite-setup.md → section 7](prerequisite-setup.md#7-python-launcher-py--windows-only).

---

## Step 2 — Confirm `pip` works

**Do:** Verify Python's package installer is available before installing anything with it.

**Command:**

```bash
python3 -m pip --version    # 🍎 substitute the recorded PYTHON_CMD if different
py -3 -m pip --version      # 🪟 same interpreter selected in Step 1
```

**Reference:** [pip — Installation](https://pip.pypa.io/en/stable/installation/).

**Verify:** Prints something like `pip 24.x from .../pip (python 3.x)`. The Python version in parentheses must be 3.10 or newer.

**If it fails:**
- *"No module named pip"* → Python is present; bootstrap pip in the selected interpreter: `python3 -m ensurepip --upgrade` (🍎) or `py -3 -m ensurepip --upgrade` (🪟).
- **Corporate SSL inspection** (errors mentioning `SSLError`, `CERTIFICATE_VERIFY_FAILED`, or a proxy) → your network intercepts TLS. As a scoped workaround for installs from PyPI:
  ```bash
  pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org <package>
  ```
  The durable fix is to have IT add your corporate root CA to the certifi store; the trusted-host flags are a stopgap.
- **Blocked public registry on a Microsoft-managed device** (errors are a **connection refused / DNS failure / 403** against `pypi.org` or `files.pythonhosted.org` — *not* a certificate error) → policy (Central Feed Services) blocks direct access to the public PyPI registry. The `--trusted-host` flags above will **not** help here — the domain itself is unreachable. Point pip at the approved proxy feed instead:
  ```bash
  pip config set global.index-url https://packagefeedproxy.microsoft.io/pypi/simple
  ```
  Many managed devices already have this configured by policy, in which case `pip install` just works. This proxy is Microsoft-internal and is not reachable from non-Microsoft networks.

---

## Step 3 — Install the Python SDK and pandas

**Do:** Install the two Python packages the plugin imports.

**Command:**

```bash
python3 -m pip install PowerPlatform-Dataverse-Client pandas  # 🍎
py -3 -m pip install PowerPlatform-Dataverse-Client pandas    # 🪟
```

**Reference:** [PowerPlatform-Dataverse-Client (PyPI)](https://pypi.org/project/PowerPlatform-Dataverse-Client/) · [pandas (PyPI)](https://pypi.org/project/pandas/).

**Verify:**

```bash
python3 -c "import pandas; from PowerPlatform.Dataverse.client import DataverseClient; print('ok', pandas.__version__)"  # 🍎
py -3 -c "import pandas; from PowerPlatform.Dataverse.client import DataverseClient; print('ok', pandas.__version__)"    # 🪟
```

Prints `ok <pandas-version>`. The PyPI distribution name is **`PowerPlatform-Dataverse-Client`**, but the import namespace is **`PowerPlatform.Dataverse`**. Neither `PowerPlatform_Dataverse_Client` nor `microsoft_powerplatform_dataverse_client` is the package's import name. Keep stderr visible; a failed import does not mean Python is missing.

**If it fails:**
- **`ModuleNotFoundError` for pandas or PowerPlatform** → Python is installed; the package is missing from that interpreter. Check `python3 -m pip show PowerPlatform-Dataverse-Client pandas` / `py -3 -m pip show PowerPlatform-Dataverse-Client pandas`, then install with the paired command above.
- **Multiple Pythons** → use the recorded `PYTHON_CMD` for both `-m pip` and the import; never bare `pip`. If you select a different interpreter, verify and update the recorded command first.
- **Externally managed environment (PEP 668)** → create a project virtual environment with the selected interpreter (`python3 -m venv .venv` or `py -3 -m venv .venv`). Record `.venv/bin/python` (POSIX) or `.venv\Scripts\python.exe` (Windows) as an absolute `PYTHON_CMD` and use it for installs/probes. Do not use `--break-system-packages`.
- **SSL / proxy** → re-run with the `--trusted-host` flags from Step 2.
- **Package is installed but import fails** → preserve the traceback. A missing transitive dependency, binary incompatibility, or permission error needs its own repair; a reinstall of Python or a hidden stderr check is not a diagnosis.

---

## Step 4 — Authenticate the PAC CLI

**Do:** Create (or confirm) a PAC auth profile pointing at your Dataverse environment. The plugin rides on this profile.

**Command:**

```bash
pac auth list
# If no profile for your environment exists, create one:
pac auth create --environment https://yourorg.crm.dynamics.com
```

**Reference:** [Microsoft Learn — pac auth](https://learn.microsoft.com/power-platform/developer/cli/reference/auth).

**Verify:**

```bash
pac auth list     # shows at least one profile with a * next to the active one
pac org who       # prints the connected org URL and user
```

**If it fails:** *"No profiles were found"* → run `pac auth create` as above. If `pac org who` shows the wrong environment, select the right profile with `pac auth select --index <n>`. The environment URL must be the Dataverse URL (`https://<org>.crm.dynamics.com`), not the Maker Portal URL.

---

## Step 5 — Install the Dataverse-skills plugin for your agent

**Do:** Install the plugin using the command that matches your coding agent.

**Command / click path:**

| Agent | Command |
|---|---|
| **GitHub Copilot** | `/plugin install dataverse@awesome-copilot` |
| **Claude Code** | `/plugin install dataverse@claude-plugins-official` |
| **Cursor / Windsurf / other** | Configure the Dataverse MCP server manually — see the [Dataverse-skills README](https://github.com/microsoft/Dataverse-skills) |

**Reference:** [microsoft/Dataverse-skills](https://github.com/microsoft/Dataverse-skills).

**Verify:** The agent lists the `dv-*` skills (`dv-connect`, `dv-metadata`, `dv-data`, `dv-query`, `dv-solution`, `dv-admin`, `dv-security`) as available.

**If it fails:** If the marketplace source name has changed upstream, open the [Dataverse-skills README](https://github.com/microsoft/Dataverse-skills) for the current install command — that README is the authoritative source for the per-agent marketplace identifiers.

---

## Step 6 — Connect and register the MCP server

**Do:** Ask the agent to connect to Dataverse. This runs the `dv-connect` skill, which checks tools, authenticates, and registers the MCP server.

**Command / click path:** In the agent chat, say:

> Connect to Dataverse

**Reference:** [Dataverse-skills — `dv-connect`](https://github.com/microsoft/Dataverse-skills).

**Verify:** After `dv-connect` finishes, `pac auth list` shows your active environment and the agent reports the Dataverse MCP server is registered.

**If it fails:** If `dv-connect` reports a missing tool, jump back to the matching step above (Python → Step 1, pip → Step 2, SDK → Step 3, PAC auth → Step 4). `dv-connect` is idempotent — re-run it after fixing the gap.

---

## Step 7 — End-to-end smoke test

**Do:** Prove the agent can actually reach Dataverse by listing tables (a tiny read).

**Command / click path:** In the agent chat, say:

> Using dv-query, list the first 5 tables in this environment.

**Reference:** [Dataverse-skills — `dv-query`](https://github.com/microsoft/Dataverse-skills).

**Verify:** The agent returns real table logical names from your environment (e.g. `account`, `contact`, plus any custom tables). That round trip confirms Python, the SDK, PAC auth, the plugin, and the MCP server are all wired correctly.

**If it fails:** A 401/403 means the PAC profile lacks access — confirm the App Registration / user is an Application User with a security role in that environment (see [00-before-you-start](../.github/instructions/00-before-you-start.instructions.md), Step 6). A connection/timeout error usually means `dv-connect` (Step 6) didn't complete — re-run it.

---

## You're done

When Step 7 returns real tables, the agent can provision and query Dataverse. From here, the normal PACAF flow takes over: plan the schema (00a → 00c), then let the agent use `dv-metadata` to create tables and the Code Apps plugin with local `pacaf-pa app add data-source --connector dataverse --table <table>` to generate TypeScript services. Dataverse-skills and PAC ALM authentication remain unchanged; the Power Apps CLI has separate auth.

## Keeping this guide authoritative

This page is the **one** place that lists the full Dataverse-skills prerequisite chain. Other files (README, AGENTS.md, the prerequisite gate, and `docs/prerequisite-setup.md` section 6) link here rather than duplicating the steps. If the upstream [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin renames its marketplace sources, update Step 5 here and the cross-links keep pointing at the corrected source.
