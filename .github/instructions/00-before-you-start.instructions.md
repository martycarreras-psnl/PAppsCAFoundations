---
applyTo: "**"
---

# Power Apps Code Apps — Before You Write a Single Line of Code

This is the complete list of manual steps that must be done in the Power Platform Admin Center and Power Apps Maker Portal before any script, scaffolding, or development work begins. Most of these are one-time team-level decisions. Skipping any of them causes downstream pain that is expensive to unwind.

Work through these in order. Record every value in the table at the bottom of this file.

---

## Step 1 (HARD GATE): Install the Dataverse-skills Plugin

> **Do this before anything else.** Every Dataverse operation in this template — schema, data, queries, solution lifecycle, environment admin, security — is delegated to the [microsoft/Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin. It is the first-class, only-supported path. None of the steps below (publisher, solution, connections) can be completed reliably until the plugin is installed and its MCP tools are reachable. If you skip this, the agent will **stop** the moment any Dataverse work is requested (see `00-prereq-gate.instructions.md`, Step 8).

### Prerequisites

1. **Python 3** must be installed (`python3 --version` or `python --version`)
2. Install the Python SDK and pandas:
   ```bash
   pip install PowerPlatform-Dataverse-Client pandas
   ```

### Install the plugin

The install command depends on which coding agent you use. **Note:** the GitHub Copilot **CLI** (a terminal app) is a different tool from the Copilot chat inside VS Code — the CLI is what installs the Dataverse plugin reliably.

| Agent | Install command |
|---|---|
| **GitHub Copilot CLI** (default) | At the `copilot` prompt: `/plugin install dataverse@awesome-copilot` |
| **Claude Code** | `claude plugin install dataverse@claude-plugins-official` |
| **Cursor / Windsurf / Other** | See [Dataverse-skills README](https://github.com/microsoft/Dataverse-skills) for manual MCP configuration |

> Don't have the Copilot CLI yet? Install it once with `npm install -g @github/copilot`, then run `copilot` and follow the sign-in prompt.

### Verify

After installing, **restart your editor / CLI** so the MCP tools load, then ask your agent:

> "Connect to Dataverse"

The `dv-connect` skill walks through tool checks, authentication, and MCP server registration. When it finishes, `pac auth list` should show your active environment and a Dataverse MCP call (e.g. `list_tables`) should succeed.

> **Stuck on any prerequisite?** [`docs/dataverse-skills-setup.md`](../../docs/dataverse-skills-setup.md) is the single linear walkthrough for the entire Dataverse-skills chain — Python, `pip`, the `PowerPlatform-Dataverse-Client` SDK, PAC auth, the plugin install, MCP verification, and an end-to-end smoke test — each with an official reference, a verify command, and the most common failure/fix.

---

## Step 2: Decide Your Publisher Prefix

Your publisher prefix is the most consequential naming decision in the entire project. It becomes the namespace for every Dataverse table, column, option set, environment variable, connection reference, and security role your team creates. It cannot be changed after data exists.

Rules:
- 2–8 characters, lowercase letters only
- No numbers, no hyphens, no underscores
- Must be unique to your organization or team (avoid generic names like `app` or `new`)
- Should be recognizable but short: `agtpo`, `prjmgr`, `contso`, `hr`, `fin`

Once you decide, record it in the **Project Values** table at the bottom of this file and propagate it to:
- Your `.env` file as `PP_PUBLISHER_PREFIX=yourprefix`
- Your `setup.sh` / `setup.ps1` scripts
- Your solution init command (`pac solution init --publisher-prefix yourprefix`)
- Your `07-dataverse-schema.instructions.md` examples

Every Copilot session that touches this repo will use the value in this file as the authoritative prefix. Update the placeholder `yourprefix` in the Project Values table before committing.

---

## Step 3: Create the Solution Publisher

The publisher owns your prefix and must exist before any solution, table, or column is created. **You no longer create it by hand in the Maker Portal.** It is created for you by whichever path you are using:

- **Setup wizard (default):** The **Solution & Publisher** step discovers existing publishers in your dev environment and, if none matches your prefix from Step 2, creates one — recording the display name, unique name, prefix, and choice-value prefix back into your project.
- **Agent-driven Dataverse work:** With the Dataverse-skills plugin installed (Step 1), ask your agent to create the publisher via the **dv-solution** skill. It queries existing publishers first (reuse over duplication) and creates a new one only when needed.

Whichever path runs, capture the resulting values in the **Project Values** table at the bottom of this file:
- **Display name** (e.g. `Contoso Engineering`)
- **Name** — lowercase, no spaces (e.g. `contosoengineering`)
- **Prefix** — your chosen prefix from Step 2 (e.g. `csoeng`)
- **Choice value prefix** — the auto-assigned number (e.g. `10000`); option-set integer values start at `<CHOICE_VALUE_PREFIX>0000`

> Do not create the publisher manually in the Maker Portal — a hand-made publisher can drift from the prefix your wizard, plugin, and scripts expect.

---

## Step 4: Create Your Power Platform Environments

You need at minimum a **development** environment and a **production** environment. A **test/staging** environment is strongly recommended.

For each environment:

1. Go to [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com) → **Environments** → **New**
2. Set:
   - **Name**: `<ProjectName> - Dev` / `<ProjectName> - Test` / `<ProjectName> - Prod`
   - **Type**: Developer (for personal dev) or Sandbox (for shared dev/test); Production (for prod)
   - **Region**: Match your organization's data residency requirements
   - **Add Dataverse**: Yes (required for Code Apps)
   - **Language / Currency**: Set appropriately for your org
3. Record the environment URL for each (format: `https://yourorg-dev.crm.dynamics.com`).

   > When you copy the URL straight from the Power Platform Admin Center it will be shown without a scheme (e.g. `yourorg-dev.crm.dynamics.com`). The wizard accepts either form — it will normalize the value and prepend `https://` automatically.

---

## Step 5: Create the Solution in Your Development Environment

Like the publisher, the solution is **created for you** — not hand-built in the Maker Portal — so it is correctly bound to your publisher and prefix:

- **Setup wizard (default):** The **Solution & Publisher** step detects an existing solution or creates a new one bound to the publisher from Step 3, then writes `SOLUTION_NAME` (and the publisher prefix) into `.env` / `power.config.json`.
- **Agent-driven Dataverse work:** With the Dataverse-skills plugin installed, ask your agent to detect or create the solution via the **dv-solution** skill, bound to your publisher.

Record the **Solution Unique Name** in the **Project Values** table below — every `pac solution` command and the `-s` flag on `pac code push` uses it.

> The Code App is added to this solution on the first `pac code push` (the Power SDK requires a target solution). You do not need to add it manually.

---

## Step 6: Create Connections in Each Environment

Connection references in your solution are pointers — they say "this app uses the Office 365 Users connector." The actual connection (the authenticated instance) must exist separately in each environment and be mapped to the reference at import time.

**Create connections before importing the solution.** If the connection doesn't exist when the solution is imported, the connection reference will be unmapped and the app won't function.

For each connector your app uses, in each environment (dev, test, prod):

1. Go to [make.powerapps.com](https://make.powerapps.com) → select the target environment
2. Navigate to **Connections** (left nav → Data → Connections, or directly at `make.powerapps.com/environments/<env-id>/connections`)
3. Click **New connection**
4. Search for and select your connector (e.g. **Office 365 Users**, **SQL Server**, **SharePoint**)
5. Authenticate / fill in connection details
6. Once created, click the connection to open its details page. The browser URL will look like:
   ```
   https://make.powerapps.com/environments/xxx/connections/shared_office365users/<CONNECTION_ID>/details
   ```
   The Connection ID is the last UUID segment before `/details`.

   **You don't need to pick the GUID out by hand.** When the wizard prompts for a Connection ID, you can paste **the entire URL** above — the wizard will extract the Connection ID for you. Pasting just the GUID also works.

7. Record the Connection ID for each connector in each environment in the **Project Values** table below

> Connection IDs are environment-specific. You need a separate ID for dev, test, and prod. These IDs go into your deployment settings files (see `04-deployment.instructions.md`).

**Common connectors and their internal names:**

| Connector | Internal name (ConnectorId suffix) |
|---|---|
| Office 365 Users | `shared_office365users` |
| Office 365 Outlook | `shared_office365` |
| SharePoint | `shared_sharepointonline` |
| Microsoft Dataverse | `shared_commondataserviceforapps` |
| SQL Server | `shared_sql` |
| Microsoft Teams | `shared_teams` |
| Azure Blob Storage | `shared_azureblob` |
| HTTP with Entra ID | `shared_webcontents` |

> The wizard's connector step shows the list above as a checklist, then asks **"Add another connector by URL or apiId"** in a loop. Paste the full Maker Portal connection URL of any other connector (e.g. Approvals, Outlook Tasks, a custom connector you've published to the environment) and the wizard will register it as a data source — extracting the apiId and the connection ID from the URL in one shot. You can also paste a bare `shared_xxx` apiId if you only want to create the connection reference now and bind the connection later.

---

## Step 7: Register the App Registration as an Application User

For each environment, the App Registration you created for headless auth (see `00-environment-setup.instructions.md`) must be registered as an Application User:

1. Go to [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com) → select the environment → **Settings** → **Users + permissions** → **Application users**
2. Click **New app user** → **Add an app**
3. Search for your App Registration by name → select it
4. Assign the appropriate security role:
   - Dev: **System Administrator**
   - Test: **System Administrator** (or a scoped deployment role)
   - Prod: A custom role with minimum required privileges

Repeat for every environment. Without this step, `pac auth create` with SPN credentials will fail.

---

## Step 8: Verify PAC CLI Can Connect

After completing Steps 1–7, confirm your toolchain works before writing any code:

```bash
# Confirm PAC CLI can reach each environment (adjust profile names as needed)
pac auth select --name "Dev"
pac org who
# Expected: org name, environment URL, connected user = your App Registration name

pac solution list
# Expected: your solution appears in the list
```

If `pac org who` shows an interactive user instead of your App Registration name, the SPN auth profile was not created correctly. Re-run `npm run setup:auth` from `00-environment-setup.instructions.md`.

---

## Project Values — Fill This In Before Committing

Replace every placeholder below with your actual values. These are referenced throughout all instruction files and scripts. The **publisher** and **solution** values (`PUBLISHER_*`, `CHOICE_VALUE_PREFIX`, `SOLUTION_*`) are produced for you by the setup wizard or the Dataverse-skills `dv-solution` skill (Steps 3 and 5) — record them here once they exist. The remaining values (prefix decision, environment URLs, connection IDs) you supply or capture as you go.

```
PUBLISHER_DISPLAY_NAME=   # e.g. "Contoso Engineering"
PUBLISHER_NAME=           # e.g. "contosoengineering"
PUBLISHER_PREFIX=         # e.g. "csoeng"  ← the most important one
CHOICE_VALUE_PREFIX=      # e.g. "100000000" (from publisher creation, Step 3)

SOLUTION_UNIQUE_NAME=     # e.g. "ProjectTracker"
SOLUTION_DISPLAY_NAME=    # e.g. "Project Tracker"

PP_ENV_DEV=               # e.g. "https://contoso-dev.crm.dynamics.com"
PP_ENV_TEST=              # e.g. "https://contoso-test.crm.dynamics.com"
PP_ENV_PROD=              # e.g. "https://contoso.crm.dynamics.com"

# Connection IDs per environment (get from Power Apps Maker Portal URL — see Step 6)
# Format: one row per connector per environment

# Dev environment connection IDs
CONN_DEV_OFFICE365USERS=
CONN_DEV_SHAREPOINT=
CONN_DEV_SQL=

# Test environment connection IDs
CONN_TEST_OFFICE365USERS=
CONN_TEST_SHAREPOINT=
CONN_TEST_SQL=

# Prod environment connection IDs
CONN_PROD_OFFICE365USERS=
CONN_PROD_SHAREPOINT=
CONN_PROD_SQL=
```

> Keep this file committed to the repo — it contains no secrets, only structural metadata. It is the single source of truth for your project's Power Platform identity.
