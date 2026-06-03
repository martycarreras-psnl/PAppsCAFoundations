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

**Do:** Install Python 3 and put it on PATH.

**Command:**

🍎 macOS:

```bash
brew install python@3
```

🪟 Windows — download from [python.org/downloads](https://www.python.org/downloads/), run the installer, and **tick "Add python.exe to PATH"** before clicking **Install Now**. Then close and reopen the terminal.

**Reference:** [python.org/downloads](https://www.python.org/downloads/) · [PowerPlatform-Dataverse-Client requires Python 3.10+ (PyPI)](https://pypi.org/project/PowerPlatform-Dataverse-Client/).

**Verify:**

```bash
python3 --version    # 🍎 prints: Python 3.x.x
py -3 --version      # 🪟 prints: Python 3.x.x
```

**If it fails:** 🪟 On Windows, `python3` often resolves to the **Microsoft Store stub** — a placeholder that exits without printing a version (or opens the Store). Always test with `py -3 --version` on Windows. If even `py` is missing, reinstall from python.org with **`py launcher`** and **`Add python.exe to PATH`** both checked, and disable the Store aliases under Settings → Apps → Advanced app settings → App execution aliases (turn off `python.exe` and `python3.exe`). See [docs/prerequisite-setup.md → section 7](prerequisite-setup.md#7-python-launcher-py--windows-only).

---

## Step 2 — Confirm `pip` works

**Do:** Verify Python's package installer is available before installing anything with it.

**Command:**

```bash
pip --version          # 🍎
py -m pip --version    # 🪟 (most reliable on Windows)
```

**Reference:** [pip — Installation](https://pip.pypa.io/en/stable/installation/).

**Verify:** Prints something like `pip 24.x from .../pip (python 3.x)`. The Python version in parentheses must be 3.10 or newer.

**If it fails:**
- *"No module named pip"* → bootstrap it: `python3 -m ensurepip --upgrade` (🍎) or `py -m ensurepip --upgrade` (🪟).
- **Corporate SSL inspection** (errors mentioning `SSLError`, `CERTIFICATE_VERIFY_FAILED`, or a proxy) → your network intercepts TLS. As a scoped workaround for installs from PyPI:
  ```bash
  pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org <package>
  ```
  The durable fix is to have IT add your corporate root CA to the certifi store; the trusted-host flags are a stopgap.

---

## Step 3 — Install the Python SDK and pandas

**Do:** Install the two Python packages the plugin imports.

**Command:**

```bash
pip install PowerPlatform-Dataverse-Client pandas          # 🍎
py -m pip install PowerPlatform-Dataverse-Client pandas     # 🪟
```

**Reference:** [PowerPlatform-Dataverse-Client (PyPI)](https://pypi.org/project/PowerPlatform-Dataverse-Client/) · [pandas (PyPI)](https://pypi.org/project/pandas/).

**Verify:**

```bash
python3 -c "import pandas; from microsoft_powerplatform_dataverse_client import __name__ as n; print('ok', pandas.__version__)"   # 🍎
py -c "import pandas; from microsoft_powerplatform_dataverse_client import __name__ as n; print('ok', pandas.__version__)"        # 🪟
```

Prints `ok <pandas-version>`. If the import line errors, the install didn't land in the same interpreter you're testing with.

**If it fails:**
- **Multiple Pythons** → the most common cause. `pip` installed into a different interpreter than the one running your verify command. Pin them together: use `python3 -m pip install ...` (🍎) / `py -m pip install ...` (🪟) so the installer and the runtime are the same interpreter.
- **SSL / proxy** → re-run with the `--trusted-host` flags from Step 2.
- **`pip install` succeeds but import fails** → close and reopen the terminal, then re-run the verify (a stale shell can mask a freshly installed package).

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

When Step 7 returns real tables, the agent can provision and query Dataverse. From here, the normal PACAF flow takes over: plan the schema (00a → 00c), then let the agent use `dv-metadata` to create tables and this repo's `pac code add-data-source` to generate the TypeScript services.

## Keeping this guide authoritative

This page is the **one** place that lists the full Dataverse-skills prerequisite chain. Other files (README, AGENTS.md, the prerequisite gate, and `docs/prerequisite-setup.md` section 6) link here rather than duplicating the steps. If the upstream [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin renames its marketplace sources, update Step 5 here and the cross-links keep pointing at the corrected source.
