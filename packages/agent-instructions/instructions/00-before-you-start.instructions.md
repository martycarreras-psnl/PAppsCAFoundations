---
applyTo: "**"
---

# Power Apps Code Apps — Before You Write a Single Line of Code

This is the complete list of manual steps that must be done in the Power Platform Admin Center and Power Apps Maker Portal before any script, scaffolding, or development work begins. Most of these are one-time team-level decisions. Skipping any of them causes downstream pain that is expensive to unwind.

Work through these in order. Record every value in the table at the bottom of this file.

---

## Step 1: Decide Your Publisher Prefix

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

## Step 2: Create the Solution Publisher

This is done once per team in the Power Apps Maker Portal. The publisher owns the prefix.

1. Go to [make.powerapps.com](https://make.powerapps.com) → select your **development** environment
2. Navigate to **Solutions** → **Publishers** → **New Publisher**
3. Fill in:
   - **Display name**: Something human-readable (e.g. `Contoso Engineering`)
   - **Name**: Lowercase, no spaces (e.g. `contosoengineering`)
   - **Prefix**: Your chosen prefix from Step 1 (e.g. `csoeng`)
   - **Choice value prefix**: This will auto-populate to a number like `10000` — record this as your `CHOICE_VALUE_PREFIX`. Your option set integer values start at `<CHOICE_VALUE_PREFIX>0000` (e.g. if prefix is `10000`, values start at `100000000`)
4. Click **Save**

> The publisher must exist before you create a solution. The solution inherits the publisher's prefix.

---

## Step 3: Create Your Power Platform Environments

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

## Step 4: Create the Solution in Your Development Environment

Do this in the Power Apps Maker Portal — not via CLI — so the solution is linked to your publisher.

1. Go to [make.powerapps.com](https://make.powerapps.com) → select your **dev** environment
2. Navigate to **Solutions** → **New Solution**
3. Fill in:
   - **Display name**: Your project name (e.g. `Project Tracker`)
   - **Name**: Auto-populates from display name — you can adjust
   - **Publisher**: Select the publisher you created in Step 2
   - **Version**: `1.0.0.0`
4. Click **Create**
5. Record the **Solution Unique Name** (shown in the URL and solution list) — you'll use this in every `pac solution` command

---

## Step 5: Create Connections in Each Environment

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

## Step 6: Register the App Registration as an Application User

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

## Step 7: Verify PAC CLI Can Connect

After completing Steps 1–6, confirm your toolchain works before writing any code:

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

## Step 8: Install the Dataverse-skills Plugin

The [Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin teaches your coding agent how to provision Dataverse schema, import data, manage solutions, and administer environments through the Dataverse MCP server, Python SDK, and PAC CLI. It replaces hand-written bash/curl scripts with tested, idempotent, agent-native operations.

### Prerequisites

1. **Python 3** must be installed (`python3 --version` or `python --version`)
2. Install the Python SDK and pandas:
   ```bash
   pip install PowerPlatform-Dataverse-Client pandas
   ```

### Install the plugin

The install command depends on which coding agent you use:

| Agent | Install command |
|---|---|
| **GitHub Copilot** | `/plugin install dataverse@awesome-copilot` |
| **Claude Code** | `/plugin install dataverse@claude-plugins-official` |
| **Cursor / Windsurf / Other** | See [Dataverse-skills README](https://github.com/microsoft/Dataverse-skills) for manual MCP configuration |

### Verify

After installation, ask your agent:

> "Connect to Dataverse"

The `dv-connect` skill walks through tool checks, authentication, and MCP server registration. When it finishes, `pac auth list` should show your active environment.

> The setup wizard detects your coding agent and provides the correct install command. If you haven't run the wizard yet, it will prompt you during setup.

---

## Project Values — Fill This In Before Committing

Replace every placeholder below with your actual values. These are referenced throughout all instruction files and scripts.

```
PUBLISHER_DISPLAY_NAME=   # e.g. "Contoso Engineering"
PUBLISHER_NAME=           # e.g. "contosoengineering"
PUBLISHER_PREFIX=         # e.g. "csoeng"  ← the most important one
CHOICE_VALUE_PREFIX=      # e.g. "100000000" (from publisher creation, Step 2)

SOLUTION_UNIQUE_NAME=     # e.g. "ProjectTracker"
SOLUTION_DISPLAY_NAME=    # e.g. "Project Tracker"

PP_ENV_DEV=               # e.g. "https://contoso-dev.crm.dynamics.com"
PP_ENV_TEST=              # e.g. "https://contoso-test.crm.dynamics.com"
PP_ENV_PROD=              # e.g. "https://contoso.crm.dynamics.com"

# Connection IDs per environment (get from Power Apps Maker Portal URL — see Step 5)
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
