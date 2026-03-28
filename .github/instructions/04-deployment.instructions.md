---
applyTo: ".github/workflows/**,power.config.json,vite.config.ts"
---

# Power Apps Code Apps — Deployment, CI/CD & ALM

This instruction file defines how Code Apps are built, deployed, promoted across environments, and managed through their lifecycle. Every deployment follows these patterns — no manual deployments to production.

## Phase Contract — Build, Validate, Deploy

Deployment is the final phase in the delivery sequence:

`scaffold -> schema plan -> schema provision -> connector generation -> architecture/UI -> testing -> deploy`

**Inputs required:**
- App builds locally with no TypeScript errors
- Target environment is known and authenticated
- Test evidence exists for the current build

**Mandatory outputs:**
- Build artifact in `dist/`
- Deployment result with app URL
- Handoff notes including environment, app URL, tests run, and follow-up actions

**Hard gate:** no test evidence, no deploy.

If testing is incomplete, stop and complete `05-testing.instructions.md` first.

## CLI Strategy — Current Default vs Evaluation Track

Foundations currently uses **PAC CLI** as the default execution path because it aligns with the repo's existing wizard, user memory, and service-principal auth setup:

- `pac code init`
- `pac code add-data-source`
- `pac code push`

The npm CLI (`npx power-apps`) is a valid evaluation track and may replace parts of the PAC workflow later, but it is **not** the default in Foundations yet.

When documenting or implementing new automation:
- Keep PAC CLI as the default unless a repo-wide migration decision has been made
- If you mention `npx power-apps`, label it as an evaluation or future migration path
- Do not mix PAC and npm CLI commands in the same canonical flow without explaining why

## Deployment Model Overview

Code Apps deploy through the Power Platform CLI (`pac code push`), which packages your built web app and publishes it to a Dataverse environment. The app runs on Power Platform infrastructure with Microsoft Entra ID authentication handled automatically.

```
Local Dev (port 3000)  →  Build (Vite)  →  pac code push  →  Dataverse Environment
                                                                    ↓
                                                           Power Apps URL
```

For team projects with multiple environments, the flow becomes:

```
Feature Branch → PR → CI (build + lint + test) → Merge to main → Deploy to Dev
                                                                       ↓
                                            Deploy to Test → Validate → Deploy to Prod
```

## Local Development

```bash
# Start dev server + PAC Code Run simultaneously
npm run dev

# This runs concurrently:
#   - Vite dev server on port 3000 (HMR, fast refresh)
#   - PAC Code Run (proxies connector calls through Power Platform)
```

Port 3000 is required — the Power Apps SDK will not function on any other port during local development.

## Building for Deployment

```bash
# Type-check then build with Vite
npm run build

# Output goes to dist/ — this is what pac code push uploads
```

The build must produce a clean `dist/` folder with no TypeScript errors. The CI pipeline enforces this.

## Required Deployment Evidence

Before any deployment, record all of the following:

1. Build result: `npm run build` passed
2. Test result: unit tests and the required E2E / production validation checks passed
3. Environment confirmation: `pac org who` or equivalent environment check matches the target
4. Scope summary: what changed in schema, connectors, or UI

If any item is missing, do not deploy.

## Manual Deployment (Dev Environment Only)

For quick iteration during development, deploy directly from your machine.

> **SPN auth does not work for `pac code push`.** The BAP checkAccess API rejects service principal tokens. You need a **user** auth profile instead. The wizard creates one automatically during steps 7–9. **This is a one-time setup** — after the initial device-code sign-in, PAC CLI caches a refresh token that auto-renews (~90 days), so subsequent pushes work silently with no browser prompt.

```bash
# One-time: create a user auth profile for your dev environment
pac auth create --name pp-myrepo-d-u-abcd1234 --environment https://your-org-dev.crm.dynamics.com --deviceCode

# Select the user profile (NOT the SPN profile)
pac auth select --name pp-myrepo-d-u-abcd1234

# Verify you're connected to the right environment
pac org who

# Build and deploy — no sign-in prompt after the profile is created
npm run build
pac code push
```

The SPN profile you created during initial setup is still used for `pac solution export/import`, `pac org who`, and other non-`pac code` operations. Keep both profiles — switch between them as needed.

This manual flow is acceptable for personal dev environments only. Test and production deployments must go through CI/CD.

## CI/CD with GitHub Actions

### CI Pipeline (Every PR)

This pipeline runs on every pull request to validate code quality:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npx tsc --noEmit

      - name: Unit Tests
        run: npm run test

      - name: Build
        run: npm run build

      - name: E2E Tests
        run: npx playwright test
        env:
          VITE_USE_MOCK: 'true'  # E2E tests use mock data in CI
```

### Deploy Pipeline (After Merge)

This pipeline exports the unmanaged solution from dev, bumps the version, and commits the refreshed source back to the repo. Promotion to test and production is handled by **Power Platform Pipelines** (managed deployments configured in the admin center) — not by this GitHub pipeline.

> **Why not `pac code push` in CI/CD?** The BAP checkAccess API rejects SPN tokens for `pac code push`. Solution export sidesteps this entirely because the Code App is embedded inside the solution. Push to dev locally (user profile, one-time setup), then let the pipeline export and version-track the result.

```yaml
# .github/workflows/deploy.yml
name: Export Solution

on:
  push:
    branches: [main]

  workflow_dispatch:

env:
  SOLUTION_NAME: YourSolutionName  # Replace with your solution unique name

jobs:
  export:
    name: Export and version-track solution from dev
    runs-on: ubuntu-latest
    environment: development
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Install Power Platform CLI
        uses: microsoft/powerplatform-actions/actions-install@v1

      - name: Authenticate to dev
        uses: microsoft/powerplatform-actions/who-am-i@v1
        with:
          environment-url: ${{ vars.POWER_PLATFORM_URL }}
          app-id: ${{ secrets.PP_APP_ID }}
          client-secret: ${{ secrets.PP_CLIENT_SECRET }}
          tenant-id: ${{ secrets.PP_TENANT_ID }}

      - name: Export unmanaged solution
        run: |
          mkdir -p solution
          pac solution export \
            --path ./solution/solution-unmanaged.zip \
            --name ${{ env.SOLUTION_NAME }} \
            --managed false

      - name: Unpack and bump version
        run: |
          rm -rf ./solution-source/
          pac solution unpack \
            --zipfile ./solution/solution-unmanaged.zip \
            --folder ./solution-source/ \
            --process-canvas-apps

          # Auto-increment the build segment (1.0.3.0 → 1.0.4.0)
          node -e "
            const fs = require('fs');
            const p = './solution-source/Other/Solution.xml';
            let xml = fs.readFileSync(p,'utf8');
            const m = xml.match(/<Version>([\\d.]+)<\\/Version>/);
            if (m) {
              const parts = m[1].split('.').map(Number);
              parts[2] = (parts[2]||0) + 1;
              const nv = parts.join('.');
              xml = xml.replace('<Version>'+m[1]+'</Version>','<Version>'+nv+'</Version>');
              fs.writeFileSync(p, xml, 'utf8');
              console.log('Solution version: '+m[1]+' → '+nv);
            }
          "

      - name: Commit solution source
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add solution-source/
          git diff --cached --quiet || git commit -m "chore: export solution v$(grep -oP '(?<=<Version>)[\d.]+' solution-source/Other/Solution.xml)"
          git push
```

**What this pipeline does:**
1. Authenticates to dev (SPN), exports the unmanaged solution containing the Code App
2. Unpacks it and auto-increments the build version
3. Commits the refreshed `solution-source/` back to the repo so the version history is tracked in Git

**Promotion to test/prod** is handled by [Power Platform Pipelines](https://learn.microsoft.com/en-us/power-platform/alm/pipelines) — configure them in the Power Platform admin center to deploy managed solutions from dev to higher environments. This keeps the managed/unmanaged boundary clean: dev is always unmanaged, higher environments get managed through the platform's native deployment mechanism.

> **SPN auth works for all pipeline steps.** No user tokens, no browser prompts, no expiring refresh tokens.

### Required GitHub Secrets

Configure these in your repository settings (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `PP_APP_ID` | Azure AD App Registration (Service Principal) Application ID |
| `PP_CLIENT_SECRET` | Service Principal client secret |
| `PP_TENANT_ID` | Azure AD Tenant ID |

Configure these as environment variables (per environment):

| Variable | Description |
|----------|-------------|
| `POWER_PLATFORM_URL` | Environment URL (e.g., `https://org-dev.crm.dynamics.com`) |

### Service Principal Setup

The CI/CD pipeline uses the same Azure App Registration (Service Principal) that your developers use locally. This is the same App Registration configured in `00-environment-setup.instructions.md`. If you haven't completed that setup yet, do it first — the App Registration, API permissions, and Application User registrations must all be in place before the pipeline can deploy.

Once the App Registration exists, store its credentials in GitHub:

1. **Add repository secrets** (Settings → Secrets and variables → Actions → Repository secrets):
   - `PP_APP_ID` — Application (client) ID
   - `PP_CLIENT_SECRET` — Client secret value
   - `PP_TENANT_ID` — Directory (tenant) ID

2. **Add environment-specific variables** (Settings → Environments → [env name] → Add variable):
   - `POWER_PLATFORM_URL` — the environment URL (e.g., `https://your-org-dev.crm.dynamics.com`)
   - Create a separate GitHub Environment for each Power Platform environment (development, test, production)

## Environment Strategy

Maintain at least three environments:

| Environment | Purpose | Deployment |
|-------------|---------|------------|
| **Development** | Day-to-day coding, experimentation | `pac code push` (user profile, silent) |
| **Test/QA** | Validation, UAT, stakeholder demos | Power Platform Pipelines (managed) |
| **Production** | End users | Power Platform Pipelines (managed, with approval) |

### GitHub Environments with Protection Rules

Set up GitHub Environments to enforce approval gates:

```yaml
# In deploy.yml, the production job requires approval:
jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment:
      name: production  # This environment has required reviewers configured
    steps:
      # ... same deploy steps as above
```

Configure in GitHub: Settings → Environments → production → Add required reviewers.

## Solution Management & ALM

### The Foundational Rule: Everything Lives in a Solution

Code Apps, and every Dataverse artifact they depend on, must live in a dedicated Power Platform solution. This is not optional — it is the foundation that makes deployment, versioning, and environment promotion possible. See `01-scaffold.instructions.md` for the complete list of what must be in the solution and why.

The default solution is unmanageable. If anything your Code App touches is in the default solution, it cannot be exported, versioned, or deployed to another environment. Treat this as a blocking issue.

### Solution Structure

Your solution contains two categories of artifacts:

**1. The Code App itself** — your React/TypeScript application, deployed via `pac code push`. This is the "code" side.

**2. Platform artifacts** — everything in Dataverse that the Code App depends on:

```
YourSolution/
├── Code App                          # Your React app
├── Tables/
│   ├── yourprefix_Project            # Custom table
│   │   ├── Columns/
│   │   │   ├── yourprefix_name       # Custom columns
│   │   │   ├── yourprefix_status
│   │   │   └── yourprefix_duedate
│   │   ├── Views/
│   │   │   └── Active Projects       # Custom views
│   │   └── Forms/
│   │       └── Main Form             # If using model-driven alongside
│   └── yourprefix_ProjectTask        # Related table
├── Option Sets (Choices)/
│   ├── yourprefix_ProjectStatus      # (Active, On Hold, Completed, Cancelled)
│   └── yourprefix_TaskPriority       # (Low, Medium, High, Critical)
├── Connection References/
│   ├── yourprefix_SQLServerConn      # SQL Server connector
│   ├── yourprefix_Office365Conn      # Office 365 Users connector
│   └── yourprefix_CustomAPIConn      # Custom API connector
├── Environment Variables/
│   ├── yourprefix_ApiBaseUrl          # API endpoint (differs per environment)
│   ├── yourprefix_FeatureFlag_NewUI   # Feature toggle
│   └── yourprefix_MaxPageSize         # Configuration value
├── Security Roles/
│   ├── yourprefix_AppUser             # Basic read/write for standard users
│   ├── yourprefix_AppAdmin            # Full CRUD + admin operations
│   └── yourprefix_AppReadOnly         # Read-only access
└── Cloud Flows (if any)/
    └── yourprefix_NotifyOnNewProject  # Power Automate flow triggered by app
```

### Creating and Managing Dataverse Artifacts

When your Code App needs a new table, column, or option set, always create it from within the solution:

**Creating a new table:**
1. Power Apps Maker Portal → Solutions → Your Solution
2. Click "New" → "Table"
3. Use your publisher prefix (e.g., `yourprefix_ProjectTask`)
4. Add columns from within the table editor (still inside the solution context)

**Creating option sets (choices):**
1. Inside your solution → "New" → "Choice"
2. Define the values (e.g., `Active = 100000000`, `On Hold = 100000001`, etc.)
3. Reference this global choice from table columns rather than creating inline choices — global choices are reusable and travel with the solution

**Adding an existing Dataverse table to your solution:**

Sometimes a table already exists (e.g., a standard table like Account or Contact, or a table from another team). Add it to your solution so the dependency is tracked:

```bash
# Add an existing table
pac solution add-reference --component-name account --component-type Table

# Add with specific columns only (selective inclusion — reduces solution bloat)
pac solution add-reference --component-name account --component-type Table --include-metadata
```

In the Power Apps Maker Portal: Inside your solution → "Add existing" → "Table" → Select the table → Choose "Include all components" or "Select components" to pick specific columns/views.

**Critical:** When you add an existing table, only add the specific columns and views your app actually uses. Including "all components" of a large table like Account pulls in hundreds of columns you don't need, bloating your solution and increasing the chance of conflicts with other teams' solutions.

### Exporting and Source-Controlling the Solution

Your solution should be exported and stored in source control alongside your Code App code. This gives you version history for both the code and the platform artifacts:

**Canonical on-demand workflow:**

```bash
# Export from dev, bump version, rebuild solution-source/
node scripts/export-solution.mjs --name YourSolutionName

# If you also need a managed zip (not needed if using Power Platform Pipelines)
node scripts/export-solution.mjs --name YourSolutionName --include-managed
```

This script is the preferred entry point because it keeps the repo state consistent:

1. `solution/solution-unmanaged.zip` is exported from dev
2. `solution-source/` is rebuilt from that unmanaged zip so stale files are removed
3. Build version is auto-incremented in `Solution.xml`
4. `solution/solution-managed.zip` is packed only if `--include-managed` is set

**What goes into Git:**

- Commit `solution-source/`
- Leave `solution/*.zip` uncommitted; those binary artifacts are gitignored

**Equivalent manual PAC flow:**

```bash
# Export the unmanaged solution from your dev environment
pac auth select --name "Dev"
pac solution export --path ./solution/solution-unmanaged.zip --name YourSolutionName --managed false

# Unpack into individual files for meaningful git diffs
rm -rf ./solution-source/
pac solution unpack --zipfile ./solution/solution-unmanaged.zip --folder ./solution-source/ --process-canvas-apps

# Optional: build the managed deployment artifact from the unpacked source
pac solution pack --zipfile ./solution/solution-managed.zip --folder ./solution-source/ --type Managed

# The unpacked folder structure is human-readable:
# solution-source/
#   ├── Other/
#   │   ├── Solution.xml              # Solution metadata
#   │   └── Relationships.xml
#   ├── Entities/
#   │   ├── yourprefix_project/
#   │   │   ├── Entity.xml            # Table definition
#   │   │   ├── SavedQueries/         # Views
#   │   │   └── FormXml/              # Forms
#   │   └── yourprefix_projecttask/
#   ├── OptionSets/
#   │   └── yourprefix_projectstatus.xml
#   ├── Roles/
#   │   ├── yourprefix_appuser.xml
#   │   └── yourprefix_appadmin.xml
#   └── EnvironmentVariableDefinitions/
#       └── yourprefix_apibaseurl.json

# Commit the unpacked source to git
git add solution-source/
git commit -m "Export solution with updated ProjectTask table schema"
```

### Deploying the Full Solution (Code App + Artifacts)

The standard deployment cycle:

```bash
# Step 1: Push the Code App to dev (user profile — one-time setup, silent after)
npm run build
pac code push

# Step 2: Export the full solution from dev (SPN profile) — auto-bumps version
node scripts/export-solution.mjs --name YourSolutionName

# Step 3: Commit the refreshed solution source
git add solution-source/
git commit -m "chore: export solution after code push"
git push

# Step 4: Promote to test/prod via Power Platform Pipelines
#   Configure in Power Platform admin center → Pipelines
#   Deploys managed solution from dev to higher environments
```

The CI pipeline (above) automates steps 2–3 on every merge to main.

**Managed vs. Unmanaged solutions:**

| Type | Use In | Why |
|------|--------|-----|
| **Unmanaged** | Development environment | Allows editing, iteration, and schema changes |
| **Managed** | Test, staging, and production | Locks artifacts from accidental modification; supports clean uninstall |

Always deploy managed solutions to non-development environments. Power Platform Pipelines handle the unmanaged-to-managed conversion automatically when promoting across environments.

### Connection References

A connection reference is a solution component that says "this app uses the Office 365 Users connector." It is the pointer — not the actual authenticated connection. The actual connection is environment-specific and must be created manually in each target environment before the solution is imported. These two things are linked at import time via a **deployment settings file**.

**The flow:**
1. Developer adds a connector via `pac data-source add` → PAC creates a connection reference inside the solution
2. Before importing to any environment, an admin creates an actual connection in that environment (Power Apps Maker Portal → Connections)
3. At import time, a deployment settings file maps the connection reference logical name to the connection ID in that environment
4. After import, the connection reference is bound — the app works without any user consent prompt

**Missing this mapping is the #1 cause of "the app deployed but connectors don't work."**

#### Step 1: Find the connection reference logical name

After running `pac data-source add`, the connection reference appears in your solution. Find its logical name:

```bash
# List connection references in your solution
pac solution list-connection-references --solution-name YourSolutionName

# Or inspect the unpacked solution XML:
# solution/src/ConnectionReferences/<yourprefix>_office365users/ConnectionReference.xml
# The LogicalName attribute is what you need
```

Logical names follow the pattern `yourprefix_connectorname`, e.g.:
- `yourprefix_office365users`
- `yourprefix_sharepointonline`
- `yourprefix_sql`

#### Step 2: Find the connection ID in each environment

In each environment (dev, test, prod), the admin who created the connection can find its ID in the Power Apps Maker Portal URL:

```
https://make.powerapps.com/environments/<env-id>/connections/shared_office365users/<CONNECTION_ID>/details
                                                                                    ^^^^^^^^^^^^^^^^
                                                                                    This is the ID you need
```

Alternatively, use the Power Apps API to list connection IDs programmatically:

```bash
# Get a token for the Power Apps API
TOKEN=$(az account get-access-token --resource "https://service.powerapps.com/" --query accessToken -o tsv)

# List connections in an environment (replace <env-id> with the environment GUID)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.powerapps.com/providers/Microsoft.PowerApps/environments/<env-id>/connections?api-version=2016-11-01" \
  | jq '.value[] | {name: .name, displayName: .properties.displayName, connector: .properties.apiId}'
```

The `.name` field is the connection ID.

#### Step 3: Create deployment settings files

Create one deployment settings file per environment. These files are safe to commit — they contain connection IDs (not secrets) and environment variable values.

```
solution/
  deployment-settings-dev.json
  deployment-settings-test.json
  deployment-settings-prod.json
```

File format:

```json
{
  "EnvironmentVariables": [
    {
      "SchemaName": "yourprefix_ApiBaseUrl",
      "Value": "https://api-dev.example.com"
    },
    {
      "SchemaName": "yourprefix_MaxPageSize",
      "Value": "50"
    }
  ],
  "ConnectionReferences": [
    {
      "LogicalName": "yourprefix_office365users",
      "ConnectionId": "abc123def456abc123def456abc12345",
      "ConnectorId": "/providers/Microsoft.PowerApps/apis/shared_office365users"
    },
    {
      "LogicalName": "yourprefix_sharepointonline",
      "ConnectionId": "xyz789xyz789xyz789xyz789xyz78901",
      "ConnectorId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
    }
  ]
}
```

`LogicalName` → the connection reference name from Step 1
`ConnectionId` → the ID from the Power Apps Maker Portal URL (Step 2), specific to this environment
`ConnectorId` → the Power Platform internal connector ID (see table below)

**Common connector IDs:**

| Connector | ConnectorId |
|---|---|
| Office 365 Users | `/providers/Microsoft.PowerApps/apis/shared_office365users` |
| Office 365 Outlook | `/providers/Microsoft.PowerApps/apis/shared_office365` |
| SharePoint | `/providers/Microsoft.PowerApps/apis/shared_sharepointonline` |
| Microsoft Dataverse | `/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps` |
| SQL Server | `/providers/Microsoft.PowerApps/apis/shared_sql` |
| Microsoft Teams | `/providers/Microsoft.PowerApps/apis/shared_teams` |
| Azure Blob Storage | `/providers/Microsoft.PowerApps/apis/shared_azureblob` |

#### Step 4: Import with the deployment settings file

**Local (manual) import:**

```bash
# Import unmanaged to dev
pac solution import \
  --path ./solution/solution-unmanaged.zip \
  --settings-file ./solution/deployment-settings-dev.json \
  --activate-plugins true

# Import managed to test or prod
pac solution import \
  --path ./solution/solution-managed.zip \
  --settings-file ./solution/deployment-settings-test.json \
  --activate-plugins true
```

**CI/CD (GitHub Actions) — pass settings file per environment:**

```yaml
- name: Import Solution to Test
  uses: microsoft/powerplatform-actions/import-solution@v1
  with:
    environment-url: ${{ vars.POWER_PLATFORM_URL }}
    solution-file: ./solution/solution-managed.zip
    app-id: ${{ secrets.PP_APP_ID }}
    client-secret: ${{ secrets.PP_CLIENT_SECRET }}
    tenant-id: ${{ secrets.PP_TENANT_ID }}
    deployment-settings-file: ./solution/deployment-settings-test.json
    activate-plugins: true
```

Store environment-specific deployment settings files in the repo. Each GitHub environment (`development`, `test`, `production`) uses its own file. The connection IDs inside those files are not secrets — they're just identifiers, not credentials.

#### What happens if a connection reference is not mapped

If you import a solution without a deployment settings file (or with a missing entry), the connection reference lands in the environment in an **unmapped** state. The app will:
- Show an error when a user tries to use any feature that calls that connector
- Require an admin to manually open the connection reference in the Power Apps Maker Portal and bind it to a connection

You can check for unmapped connection references after import:

```bash
pac connection-reference list --environment $PP_ENV_TEST
# Any reference showing "Not configured" needs to be mapped
```

To fix an unmapped reference after the fact without re-importing the solution:

```bash
pac connection-reference update \
  --name yourprefix_office365users \
  --connection-id abc123def456 \
  --environment $PP_ENV_TEST
```

### Solution Versioning

The **build** segment (3rd number) is auto-incremented on every export — both by the deploy pipeline and by the local `export-solution.mjs` script. You never need to bump it manually.

For **major** or **minor** changes, bump those segments manually before exporting:

```bash
# Manual bump: edit solution-source/Other/Solution.xml directly,
# or use pac solution version:
pac solution version --strategy solution --value 2.0.0.0 --solutionPath ./solution-source
```

To skip the auto-bump (e.g., re-export without incrementing):
```bash
node scripts/export-solution.mjs --name YourSolutionName --skip-version-bump
```

| Change Type | Segment | Who Bumps | Example |
|-------------|---------|-----------|---------|
| Every export/deploy | Build (3rd) | **Automatic** | 1.2.3.0 → 1.2.4.0 |
| New table or major feature | Minor (2nd) | Developer | 1.2.4.0 → 1.3.0.0 |
| Breaking schema change | Major (1st) | Developer | 1.3.0.0 → 2.0.0.0 |

### Common Solution Pitfalls

**"I created a table but it's not in my solution"** — You created it from the top-level Tables view, not from within the solution. Fix: Open your solution → Add existing → Table → Select it. Going forward, always create from within the solution context.

**"My solution export doesn't include the new columns"** — Did you add the columns from within the solution? If you added columns to a table via the top-level Tables view, they may not be in the solution. Fix: Open your solution → Find the table → Add existing columns.

**"Solution import fails in test/prod"** — Check for dependency issues. If your solution references a table or option set from another solution, that solution must be imported first. Use `pac solution check` to validate dependencies before import.

**"Two developers modified the same table"** — This is a merge conflict in the solution source files. Coordinate schema changes — only one developer should modify a given table's schema at a time. Use PRs to review `solution-source/` changes just like code changes.

## Environment Variables

Create environment variables inside your solution, not at the environment level. This ensures they travel with the solution across environments:

1. In your solution → "New" → "Environment Variable"
2. Set the definition (name, type, default value) — this is what's in the solution
3. In each environment, set the current value — this is environment-specific and NOT exported

```typescript
// Access environment variables at runtime via the Power Apps SDK
// These are configured in the Power Platform admin center per environment
const apiBaseUrl = getEnvironmentVariable('ApiBaseUrl');
```

Never hardcode environment-specific values in your code. If a value changes between dev/test/prod, it belongs in an environment variable defined in the solution.

## Branching Strategy

Use trunk-based development with short-lived feature branches:

```
main (always deployable)
  ├── feature/add-project-dashboard
  ├── feature/update-sql-connector
  └── fix/pagination-off-by-one
```

- Feature branches are created from `main` and merged back via PR
- Every merge to `main` triggers deployment to the development environment
- Release to test/production is triggered manually or by tagging a release

## Pre-deployment Checklist

Before deploying to test or production, verify:

**Code Quality:**
- [ ] All TypeScript errors resolved (`npx tsc --noEmit`)
- [ ] Linting passes (`npm run lint`)
- [ ] Unit tests pass (`npm run test`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] Build succeeds (`npm run build`)
- [ ] No secrets or environment-specific values hardcoded in source

**Solution Completeness:**
- [ ] All Dataverse tables used by the app are in the solution
- [ ] All custom columns on those tables are in the solution
- [ ] All option sets (choices) are in the solution
- [ ] Connection references for every connector are in the solution
- [ ] Environment variables for all config values are in the solution
- [ ] Security roles are in the solution
- [ ] Solution version has been incremented
- [ ] `pac solution check` passes with no errors
- [ ] Solution source (`solution-source/`) is committed to Git and up to date

**Target Environment:**
- [ ] Connection references mapped to active connections in target environment
- [ ] Environment variable current values set in target environment
- [ ] Security roles assigned to users/groups in target environment
- [ ] Power Apps Premium licenses assigned to target users
- [ ] DLP policies in target environment allow all connectors used by the app
- [ ] Test evidence for this build is recorded and attached to the handoff
- [ ] App URL will be shared with `?hideNavBar=true` appended
- [ ] Handoff notes list schema/connectors touched and open risks

## Deployment Handoff Template

Use this template for every deployment summary:

```text
Environment:

App name / URL: https://apps.powerapps.com/...?...&hideNavBar=true
App version:
Dataverse table(s) / connector changes:
Tests run and result:
Open risks / next steps:
Deployment timestamp:
```

## Licensing

Power Apps Code Apps require **Power Apps Premium** licensing for production use. Ensure all users who will access the deployed app have appropriate licenses before deploying to production. Development and testing environments may use trial or developer licenses.
