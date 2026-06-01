// wizard/steps/07-scaffold.mjs — Scaffold the Code App project
import { input, confirm, select, checkbox } from '@inquirer/prompts';
import {
  writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS, getRootDir } from '../lib/state.mjs';
import { pacPath, runLive, run, runSafeLive, runSafe, runSafeCapture, IS_WIN, hasCommand } from '../lib/shell.mjs';
import { dvGet, dvPost } from '../lib/dataverse.mjs';
import { getSecret, recoverSecret, setSecret } from '../lib/secrets.mjs';
import { discoverConnectionsForApiId } from '../lib/connection-discovery.mjs';
import {
  extractConnectionId,
  extractConnectorApiId,
  parseConnectionUrl,
  humanizeConnectorApiId,
} from '../lib/validate.mjs';
import {
  copyFoundationFiles,
  createMinimalProject,
  freshDevPackageSpecs,
  isPnpmWorkspaceRoot,
  mergePackageJsonScripts,
  normalizePackageJsonDependencies,
  packageSpecs,
  REQUIRED_DEV_PACKAGES,
  REQUIRED_RUNTIME_PACKAGES,
  writeConfig,
  writeStarterFiles,
} from '../lib/scaffold-foundations.mjs';
import {
  buildPacProfileName,
  getWizardStateSnapshot,
  loadPowerConfigInfo,
  parsePacOrgWho,
  quarantinePowerConfig,
  repairPowerConfigDisplayNames,
  resolveCredentialValues,
  selectAndVerifyPacProfile,
} from '../lib/pac-target.mjs';

export {
  copyFoundationFiles,
  createMinimalProject,
  mergePackageJsonScripts,
  normalizePackageJsonDependencies,
  packageSpecs,
  REQUIRED_DEV_PACKAGES,
  REQUIRED_RUNTIME_PACKAGES,
  writeConfig,
  writeStarterFiles,
  writeSmokeTestFiles,
} from '../lib/scaffold-foundations.mjs';

export default async function stepScaffold() {
  ui.stepHeader(7, TOTAL_STEPS, 'Scaffolding Your Code App');

  const ROOT = getRootDir();
  const appName = stateGet('APP_NAME');
  const prefix = stateGet('PUBLISHER_PREFIX');

  ui.line('Where should the app project live?');
  ui.line('');
  ui.line(`Default: ${ROOT} (this repo — scaffold in-place)`);
  ui.line('If you want a separate directory, enter an absolute path.');
  ui.line('');

  let projectDir = await input({ message: 'Project path', default: ROOT });
  projectDir = resolve(projectDir);
  stateSet('PROJECT_DIR', projectDir);

  if (existsSync(projectDir) && readdirSync(projectDir).length > 0) {
    ui.line('');
    ui.warn(`Directory ${projectDir} already exists and is not empty.`);
    const cont = await confirm({ message: 'Continue anyway? (existing files may be overwritten)', default: true });
    if (!cont) {
      ui.line('Choose a different path and re-run the wizard.');
      process.exit(0);
    }
  }

  // ── Write starter project ──
  // The wizard owns the entire starter payload locally (createMinimalProject +
  // writeConfig + writeStarterFiles below). We do NOT fetch from an upstream
  // template repo: that path produced surplus files (e.g. src/router.tsx with
  // BrowserRouter, an unrelated setup-wizard app shipped from microsoft/
  // PowerAppsCodeApps/templates/starter) that broke fresh scaffolds whenever
  // upstream reshaped itself. See issues #47, #63, and the follow-up that
  // removed degit entirely.
  ui.line('');
  ui.line('Writing starter project...');
  mkdirSync(projectDir, { recursive: true });
  createMinimalProject(projectDir, appName, stateGet('SOLUTION_UNIQUE_NAME', ''));
  ui.ok('Starter project written');
  normalizePackageJsonDependencies(projectDir, ui);

  // ── Ensure vite-env.d.ts exists (declares SVG/asset imports for TypeScript) ──
  const viteEnvPath = join(projectDir, 'src', 'vite-env.d.ts');
  if (!existsSync(viteEnvPath)) {
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(viteEnvPath, [
      '/// <reference types="vite/client" />',
      '',
      'declare module "*.svg" {',
      '  const src: string;',
      '  export default src;',
      '}',
      '',
    ].join('\n'));
    ui.ok('vite-env.d.ts created (SVG + asset type declarations)');
  }

  // ── npm install ──
  ui.line('');
  ui.line('Installing dependencies...');

  // Prefer pnpm if available (much smaller per-project node_modules via the
  // content-addressable store, and visible per-package progress in non-TTY
  // mode). Fall back to npm.
  const usePnpm = hasCommand('pnpm');
  const installBin = usePnpm ? (IS_WIN ? 'pnpm.cmd' : 'pnpm') : (IS_WIN ? 'npm.cmd' : 'npm');

  if (usePnpm) {
    ui.line('Detected pnpm — using it for faster installs and shared dependency cache.');
  } else {
    ui.line('Tip: install pnpm (`corepack enable && corepack prepare pnpm@latest --activate`) for ~10x less disk usage per project and much chattier install output.');
  }

  // When scaffolding into a pnpm workspace root (a directory with
  // pnpm-workspace.yaml), `pnpm add` aborts with ERR_PNPM_ADDING_TO_ROOT
  // unless the -w / --workspace-root flag is passed. Detect it and add the
  // flag so the runtime/dev installs don't silently fail. See issue #76.
  const pnpmWorkspaceRoot = usePnpm && isPnpmWorkspaceRoot(projectDir);
  if (pnpmWorkspaceRoot) {
    ui.warn('This is a pnpm workspace root (pnpm-workspace.yaml present) — adding packages with --workspace-root (-w).');
  }
  const pnpmAddRootFlag = pnpmWorkspaceRoot ? ['-w'] : [];

  // Make `npm install` less silent on cold installs (npm suppresses its
  // progress bar in non-TTY mode). `--loglevel=http` prints one line per HTTP
  // request, `--no-audit --no-fund` keeps the post-install summary from
  // making the wait feel longer than it is, and the env vars keep ANSI
  // escape noise out of any captured log file.
  //
  // Freshness of the first-party @pacaf/* packages is guaranteed by pinning
  // their exact latest version at spec-build time (freshDevPackageSpecs /
  // resolveFirstPartyLatest), NOT by a package-manager flag. `--prefer-online`
  // is npm-only — pnpm aborts with "Unknown option: 'prefer-online'" — so it
  // must never be passed to the actual install. See issue #81 follow-up.
  const npmFlags = usePnpm
    ? ['--reporter=append-only']
    : ['--loglevel=http', '--no-audit', '--no-fund'];
  const installEnv = { ...process.env, npm_config_progress: 'true', FORCE_COLOR: '0' };
  delete installEnv.CI;
  const installOpts = { cwd: projectDir, env: installEnv };

  ui.line('');
  ui.line('[1/3] Installing base dependencies (typically 30s–3min on a cold cache)…');
  runSafeLive(installBin, [...npmFlags, 'install'], installOpts) && ui.ok('[1/3] Base dependencies installed');

  ui.line('');
  ui.line('[2/3] Installing runtime packages (React, Fluent UI, TanStack Query, SDK)…');
  const prodPkgs = packageSpecs(REQUIRED_RUNTIME_PACKAGES);
  const installArgs = usePnpm ? ['add', ...pnpmAddRootFlag, ...prodPkgs] : ['install', ...prodPkgs];
  runSafeLive(installBin, [...npmFlags, ...installArgs], installOpts)
    ? ui.ok('[2/3] React + Fluent UI + TanStack Query + SDK installed')
    : ui.warn('[2/3] Some packages failed to install');

  ui.line('');
  ui.line('[3/3] Installing dev dependencies (Vitest, ESLint, Playwright, @pacaf/scripts)…');
  const devPkgs = freshDevPackageSpecs();
  const devInstallArgs = usePnpm ? ['add', '-D', ...pnpmAddRootFlag, ...devPkgs] : ['install', '-D', ...devPkgs];
  runSafeLive(installBin, [...npmFlags, ...devInstallArgs], installOpts)
    ? ui.ok('[3/3] Dev dependencies installed (incl. @pacaf/scripts, @pacaf/agent-instructions)')
    : ui.warn('[3/3] Some dev packages failed to install');

  // ── Config files ──
  writeConfig(projectDir, ui);

  // ── Merge required scripts into package.json ──
  mergePackageJsonScripts(projectDir, ui);

  // ── Folder structure ──
  ui.line('Creating folder structure...');
  const dirs = [
    'src/components', 'src/pages', 'src/hooks', 'src/generated',
    'src/utils', 'src/types', 'src/constants', 'src/mockData',
    'dataverse',
    'tests/e2e', 'tests/setup', 'tests/fixtures',
    '.github/instructions', '.github/workflows', 'solution',
  ];
  for (const d of dirs) mkdirSync(join(projectDir, d), { recursive: true });
  ui.ok('Folder structure created');

  // ── Starter files ──
  writeStarterFiles(projectDir, appName, ui);

  // ── Copy instruction files ──
  copyFoundationFiles(ROOT, projectDir, ui);

  // ── pac code init ──
  ui.line('');
  ui.line('Registering Code App in Power Platform...');
  const pac = pacPath();
  if (pac) {
    try {
      const credentialValues = resolvePacCredentialValues(ROOT);
      verifyPacMutationTarget({
        pac,
        rootDir: ROOT,
        projectDir,
        credentialValues,
        profileType: 'user',
        requirePowerConfig: false,
        requirePowerConfigTarget: false,
      });

      // ── Pre-quarantine stale power.config.json before pac code init ──
      const powerConfigPath = join(projectDir, 'power.config.json');
      let skipInit = false;
      if (existsSync(powerConfigPath)) {
        const existing = loadPowerConfigInfo(powerConfigPath);
        const whoOut = runSafe(pac, ['org', 'who']);
        const whoInfo = whoOut ? parsePacOrgWho(whoOut) : null;
        if (existing.environmentId && whoInfo?.environmentId
            && existing.environmentId === whoInfo.environmentId.toLowerCase()) {
          ui.ok('power.config.json already exists and matches active environment — skipping pac code init');
          skipInit = true;
        } else {
          const qPath = quarantinePowerConfig(powerConfigPath);
          ui.warn(`Quarantined stale power.config.json (env ${existing.environmentId || 'unknown'}) at ${qPath}`);
        }
      }

      if (!skipInit) {
        const initResult = runSafeCapture(pac, [
          'code', 'init',
          '--displayName', appName,
          '--buildPath', './dist',
          '--fileEntryPoint', 'index.html',
        ], { cwd: projectDir });
        if (!initResult.ok) {
          const detail = (initResult.stderr || '').trim();
          throw new Error(
            'pac code init failed.' + (detail ? `\n  PAC error: ${detail}` : ' No additional error details available.')
          );
        }
        const repair = repairPowerConfigDisplayNames(powerConfigPath);
        if (repair.changed) ui.warn(`Repaired quoted display name fields in power.config.json: ${repair.fields.join(', ')}`);
      }

      verifyPacMutationTarget({
        pac,
        rootDir: ROOT,
        projectDir,
        credentialValues,
        profileType: 'user',
        requirePowerConfig: true,
        requirePowerConfigTarget: true,
      });
      ui.ok('power.config.json created and verified');
    } catch (error) {
      const powerConfigPath = join(projectDir, 'power.config.json');
      if (existsSync(powerConfigPath)) {
        const quarantinePath = quarantinePowerConfig(powerConfigPath);
        ui.warn(`Quarantined invalid power.config.json at ${quarantinePath}`);
      }
      ui.warn(error.message);
      ui.warn('pac code init requires the repo-scoped interactive PAC profile. Re-run Step 4, create the user profile, complete browser/device sign-in, then retry Step 7.');
      ui.warn('pac code init failed. You can run it manually later:');
      ui.line(`  cd ${projectDir}`);
      ui.line(`  pac code init --displayName "${appName}" --buildPath "./dist" --fileEntryPoint "index.html"`);
      process.exit(1);
    }
  } else {
    ui.warn('PAC CLI not found — skipping pac code init.');
  }

  // ── Connectors & Connection References ──
  ui.line('');
  ui.divider();
  ui.line('');
  ui.line('Connector binding is now a dedicated later step.');
  ui.line('The expected flow is plan → prototype → refine the planning payload → bind real connectors.');
  ui.line('');
  ui.line('Skipping connector setup during initial scaffold.');
  ui.line('When the prototype is stable, move to the dedicated connector step:');
  ui.line('  node wizard/index.mjs --from 8');

  // ── Smoke tests — verify the scaffold is healthy before proceeding ──
  ui.line('');
  ui.divider();
  ui.line('');
  ui.line('Running smoke tests to verify scaffold health...');
  const smokeOk = runLive('npm run test:smoke', { cwd: projectDir });
  if (smokeOk) {
    ui.ok('Smoke tests passed — scaffold is healthy and ready to develop');
  } else {
    ui.warn('Smoke tests did not pass. This is usually a dependency issue.');
    ui.line('  You can diagnose later with: npm run test:smoke');
    ui.line('  Continuing with scaffold — tests can be fixed before deployment.');
  }

  // ── Git initialization ──
  ui.line('');
  ui.divider();
  ui.line('');
  ui.line('Your project files are ready. Let\'s put them under version control.');
  ui.line('');

  if (existsSync(join(projectDir, '.git'))) {
    ui.ok('Git repo already initialized');
  } else {
    ui.line('Initializing Git repo...');
    if (runSafeLive('git', ['init', '-b', 'main'], { cwd: projectDir })) {
      ui.ok('Git repo initialized (branch: main)');
    } else {
      ui.warn('git init failed');
    }
  }

  // ── Remote URL — detect existing origin (template repos) or prompt ──
  const existingOrigin = runSafe('git', ['remote', 'get-url', 'origin'], { cwd: projectDir });
  const templateRepoPattern = /PAppsCAFoundations/i;
  let finalRemoteUrl = '';

  if (existingOrigin && !templateRepoPattern.test(existingOrigin)) {
    // User came via "Use this template" — origin already points to their repo
    finalRemoteUrl = existingOrigin.trim();
    ui.ok(`Remote 'origin' already set to ${finalRemoteUrl}`);
    stateSet('GIT_REMOTE', finalRemoteUrl);
  } else {
    // No origin, or origin still points to the template repo — prompt for the real one
    if (existingOrigin && templateRepoPattern.test(existingOrigin)) {
      ui.warn('Current origin points to the PAppsCAFoundations template repo.');
      ui.line('You need to set origin to your own repository.');
      runSafe('git', ['remote', 'remove', 'origin'], { cwd: projectDir });
    }

    ui.line('');
    ui.line('Do you have a remote repository URL?');
    ui.line('(e.g. https://github.com/your-org/my-app.git)');
    ui.line('Press Enter to skip — you can add one later with:');
    ui.line('  git remote add origin <url>');
    ui.line('');
    const remoteUrl = await input({ message: 'Remote URL (Enter to skip)', default: '' });
    if (remoteUrl) {
      runSafe('git', ['remote', 'remove', 'origin'], { cwd: projectDir });  // remove any stale origin
      runSafe('git', ['remote', 'add', 'origin', remoteUrl], { cwd: projectDir });
      ui.ok(`Remote 'origin' set to ${remoteUrl}`);
      stateSet('GIT_REMOTE', remoteUrl);
      finalRemoteUrl = remoteUrl;
    }
  }

  // ── Generate project-specific README ──
  ui.line('');
  ui.line('Generating project README...');
  const readmePath = join(projectDir, 'README.md');
  const solutionDisplayName = stateGet('SOLUTION_DISPLAY_NAME', appName);
  const publisherPrefix = stateGet('PUBLISHER_PREFIX', prefix);
  const devEnv = stateGet('PP_ENV_DEV', '');
  const testEnv = stateGet('PP_ENV_TEST', '');
  const prodEnv = stateGet('PP_ENV_PROD', '');

  const envTable = [
    devEnv  ? `| Dev  | ${devEnv}  |` : '',
    testEnv ? `| Test | ${testEnv} |` : '',
    prodEnv ? `| Prod | ${prodEnv} |` : '',
  ].filter(Boolean).join('\n');

  const readmeContent = `# ${appName}

A Power Apps Code App built with React, Fluent UI v9, TanStack Query, and TypeScript.

## Tech Stack

- **React 18** + **TypeScript**
- **Fluent UI v9** — Microsoft's design system
- **TanStack Query** — server state & caching
- **Vite** — build tooling
- **Power Platform connectors** via \`@microsoft/power-apps\` SDK

## Getting Started

## Recommended Method

1. Plan the workflow and conceptual model.
2. Prototype the UX with mock providers.
3. Capture feedback in dataverse/prototype-feedback.md.
4. Update dataverse/planning-payload.json and rerun npm run prototype:seed.
5. Bind real connectors only when the model is stable.

The initial scaffold intentionally does not ask for connection IDs. When you are ready for real data, run:

\`\`\`bash
node wizard/index.mjs --from 8
\`\`\`

That later flow can inspect existing environment connections with \`pac connection list\` and let you choose one when matches exist.

### Prerequisites

- Node.js 18+
- [PAC CLI](https://learn.microsoft.com/power-platform/developer/cli/introduction) (\`dotnet tool install -g Microsoft.PowerApps.CLI.Tool\`)
- An authenticated PAC profile (\`pac auth list\` to verify)

### Development

\`\`\`bash
npm install
npm run dev:local    # Prototype mode with mock providers
npm run prototype:seed  # Regenerate prototype assets after editing dataverse/planning-payload.json
npm run dev          # Connected mode (Vite + pac code run)
\`\`\`

### Build & Deploy

\`\`\`bash
npm run build                     # Build to dist/
~/.dotnet/tools/pac code push     # Deploy to Power Platform
\`\`\`

The app URL after deployment:
\`https://apps.powerapps.com/play/e/{environmentId}/a/{appId}?hideNavBar=true\`

> The \`?hideNavBar=true\` query string hides the Power Apps "purple bar" by default. See \`.github/instructions/04-deployment.instructions.md\`.

## Project Structure

\`\`\`
${appName.toLowerCase().replace(/\\s+/g, '-')}/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/             # Route-level pages
│   ├── hooks/             # Custom React hooks
│   ├── generated/         # Auto-generated connector SDK (do not edit)
│   ├── services/          # Provider contracts, mock providers, real adapters
│   ├── mockData/          # Prototype data generated from planning payload
│   ├── types/             # Domain contracts used by the UI
│   └── App.tsx            # Root component
├── .github/instructions/  # Coding agent instruction files (canonical source)
├── .claude/rules/         # Claude Code path-scoped rules
├── .cursor/rules/         # Cursor project rules
├── .power/                # Power Platform metadata
├── power.config.json      # Code App configuration
├── vite.config.ts         # Build configuration
└── package.json
\`\`\`

## Power Platform

| Property | Value |
|----------|-------|
| Solution | ${solutionDisplayName} |
| Publisher Prefix | \`${publisherPrefix}\` |

### Environments

| Environment | URL |
|-------------|-----|
${envTable}

### Connectors

Data sources are managed via Power Platform connectors, but real connector binding is a later step after prototype validation.

Preferred path:

\`\`\`bash
node wizard/index.mjs --from 8
\`\`\`

Manual fallback:

\`\`\`bash
# Add a Dataverse table
~/.dotnet/tools/pac code add-data-source -a dataverse -t ${publisherPrefix}_tablename

# Add a non-Dataverse connector once you know the Connection ID
~/.dotnet/tools/pac code add-data-source -a shared_office365users -c <connection_id>
\`\`\`

> **Never edit files in \`src/generated/\`** — PAC refreshes them when connector output is regenerated.

## Coding Agent Guidance

This project includes native guidance for **GitHub Copilot**, **Claude Code**, **Cursor**, and **Codex**:

| Agent | Files |
|-------|-------|
| GitHub Copilot | \`.github/instructions/*.instructions.md\` (canonical source) |
| Claude Code | \`CLAUDE.md\` + \`.claude/rules/\` |
| Cursor | \`AGENTS.md\` + \`.cursor/rules/\` |
| Codex | \`AGENTS.md\` + nested \`AGENTS.md\` in subdirectories |
| Cline / Aider | \`AGENTS.md\` (fallback) |

See \`docs/agent-support.md\` for the full support matrix and verification steps.

> **Do not edit** \`.claude/rules/\`, \`.cursor/rules/\`, or nested \`AGENTS.md\` files directly. Edit the canonical \`.github/instructions/\` files, then run \`npm run guidance:generate\`.

## Scripts

| Command | Description |
|---------|-------------|
| \`npm run dev\` | Start Vite dev server |
| \`npm run build\` | Production build to \`dist/\` |
| \`npm run preview\` | Preview production build locally |
| \`npm run test\` | Run unit tests (Vitest) |
| \`npm run lint\` | Lint with ESLint |
| \`npm run setup:auth\` | Create PAC auth profiles from 1Password or .env.local |
| \`npm run pac -- <args>\` | Run pac with 1Password-injected credentials when using op:// references |
| \`npm run validate:schema-plan\` | Validate the Dataverse planning artifact before provisioning |
| \`npm run generate:dataverse-plan\` | Generate normalized Dataverse execution plans from the planning artifact |
| \`npm run register:dataverse\` | Register planned Dataverse tables with pac code add-data-source and refresh generated connector output |
| \`npm run sync:foundations\` | Pull latest instruction files, wizard, and scripts from the template repo |
| \`npm run guidance:generate\` | Regenerate agent-native guidance from canonical instructions |
| \`npm run guidance:check\` | Verify projected guidance files match canonical source |

## Staying Updated

This project was created from the **PAppsCAFoundations** template. As the template improves (new instruction files, wizard fixes, security updates), you can pull those updates:

\`\`\`bash
npm run sync:foundations          # Preview + apply updates
npm run sync:foundations -- --dry-run  # Preview only, no changes
\`\`\`

This syncs foundation files (\`.github/instructions/\`, \`wizard/\`, \`scripts/\`, \`docs/\`) without touching your project code (\`src/\`, \`package.json\`, \`power.config.json\`). Changes are shown as a diff before applying.

## Foundations Version

This project includes a \`.foundations-version.json\` file copied from the template so you can track which bundle version of instructions, wizard logic, and helper scripts the project was scaffolded from.
`;

  writeFileSync(readmePath, readmeContent, 'utf-8');
  ui.ok('Project README generated');

  ui.line('');
  ui.line('Making initial commit...');
  runSafe('git', ['add', '-A'], { cwd: projectDir });
  if (runSafeCapture('git', ['commit', '-m', 'Initial scaffold from PAppsCAFoundations wizard', '--quiet'], { cwd: projectDir }).ok) {
    ui.ok('Initial commit created');
  } else {
    ui.warn('Commit failed (git user.name/user.email may not be configured)');
  }

  if (finalRemoteUrl) {
    const push = await confirm({ message: 'Push to remote now?', default: true });
    if (push) {
      if (runSafeLive('git', ['push', '-u', 'origin', 'main'], { cwd: projectDir })) {
        ui.ok('Pushed to origin/main');
      } else {
        ui.warn('Push failed. You can push later: git push -u origin main');
      }
    }
  }

  setCompletedStep(7);
}

// ─────────── Connector / Connection Reference Setup ───────────

const COMMON_CONNECTORS = [
  { apiId: 'shared_commondataserviceforapps', name: 'Dataverse', hasTable: false },
  { apiId: 'shared_office365users', name: 'Office 365 Users', hasTable: false },
  { apiId: 'shared_sharepointonline', name: 'SharePoint', hasTable: false },
  { apiId: 'shared_office365', name: 'Office 365 Outlook', hasTable: false },
  { apiId: 'shared_teams', name: 'Microsoft Teams', hasTable: false },
  { apiId: 'shared_sql', name: 'SQL Server', hasTable: false },
  { apiId: 'shared_azureblob', name: 'Azure Blob Storage', hasTable: false },
];

export async function setupConnectors(pac, projectDir) {
  const rootDir = getRootDir();
  const prefix = stateGet('PUBLISHER_PREFIX');
  const solutionName = stateGet('SOLUTION_UNIQUE_NAME');
  const credentialValues = resolvePacCredentialValues(rootDir);

  // Try to recover the client secret for Dataverse API calls
  let hasApiAccess = false;
  let secret = getSecret();
  if (!secret) secret = recoverSecret();
  if (secret) {
    hasApiAccess = true;
  }

  // ── 1. Discover existing connection references in our solution ──
  let existingRefs = [];
  if (hasApiAccess) {
    try {
      ui.line('Checking for existing connection references...');
      const data = await dvGet(
        `connectionreferences?$filter=startswith(connectionreferencelogicalname,'${prefix}_')` +
        '&$select=connectionreferenceid,connectionreferencelogicalname,connectorid,connectionreferencedisplayname',
      );
      existingRefs = data.value || [];
      if (existingRefs.length > 0) {
        ui.ok(`Found ${existingRefs.length} existing connection reference(s):`);
        for (const ref of existingRefs) {
          ui.info(`${ref.connectionreferencedisplayname} (${ref.connectorid.split('/').pop()})`);
        }
      }
    } catch (err) {
      ui.warn(`Could not query connection references: ${err.message}`);
    }
  }
  ui.line('');

  // ── 2. Present connector checklist ──
  const existingApiIds = new Set(existingRefs.map((r) => r.connectorid.split('/').pop()));
  const choices = COMMON_CONNECTORS.map((c) => ({
    name: existingApiIds.has(c.apiId)
      ? `${c.name}  (already set up ✓)`
      : c.name,
    value: c.apiId,
    checked: existingApiIds.has(c.apiId),
  }));

  const selectedFromList = await checkbox({
    message: 'Which connectors does your app need? (Space to toggle, Enter to confirm)',
    choices,
  });

  // Build a connector-meta map keyed by apiId. Common connectors come from
  // COMMON_CONNECTORS; custom connectors are added below from URL/apiId input.
  // Custom entries may also carry a pre-extracted connectionId (when the user
  // pastes a full Maker Portal connection-details URL) so we can skip the
  // separate connection-ID prompt for that connector.
  const connectorMeta = new Map();
  for (const c of COMMON_CONNECTORS) connectorMeta.set(c.apiId, { ...c });
  const selected = [...selectedFromList];
  // Pre-extracted connection IDs harvested from custom-URL paste, keyed by apiId.
  const prefilledConnectionIds = new Map();

  // ── 2b. Custom connectors via URL or apiId ──
  ui.line('');
  ui.line('You can add any other connector by pasting its Maker Portal');
  ui.line('connection URL (or its apiId, e.g. shared_approvals).');
  ui.line('');
  while (true) {
    const raw = await input({
      message: 'Add another connector by URL or apiId (blank to finish)',
      default: '',
      validate: (v) => {
        const t = (v || '').trim();
        if (!t) return true;
        return extractConnectorApiId(t)
          ? true
          : 'Could not detect a connector apiId. Paste the full connection URL or a "shared_xxx" id.';
      },
    });
    const trimmed = (raw || '').trim();
    if (!trimmed) break;
    const { apiId, connectionId } = parseConnectionUrl(trimmed);
    if (!apiId) {
      ui.warn('No connector apiId detected — skipped.');
      continue;
    }
    if (selected.includes(apiId) || existingApiIds.has(apiId)) {
      ui.info(`${apiId} — already in the list, skipping`);
      if (connectionId && !prefilledConnectionIds.has(apiId)) {
        prefilledConnectionIds.set(apiId, connectionId);
        ui.line(`    Captured connection ID from URL: ${connectionId}`);
      }
      continue;
    }
    const defaultName = humanizeConnectorApiId(apiId);
    const displayName = await input({
      message: `Friendly display name for ${apiId}`,
      default: defaultName,
      validate: (v) => ((v || '').trim() ? true : 'Display name is required.'),
    });
    const meta = { apiId, name: displayName.trim(), hasTable: false, custom: true };
    connectorMeta.set(apiId, meta);
    selected.push(apiId);
    if (connectionId) {
      prefilledConnectionIds.set(apiId, connectionId);
      ui.ok(`${displayName.trim()} — added (connection ID extracted from URL)`);
    } else {
      ui.ok(`${displayName.trim()} — added`);
    }
  }
  ui.line('');

  if (selected.length === 0) {
    ui.line('No connectors selected. You can add them later.');
    ui.line('');
    return;
  }

  // ── 3. Create connection references for new selections ──
  const newSelections = selected.filter((apiId) => !existingApiIds.has(apiId));
  const createdRefs = [];

  if (newSelections.length > 0 && hasApiAccess) {
    ui.line('');
    ui.line('Creating connection references in your solution...');
    for (const apiId of newSelections) {
      const connector = connectorMeta.get(apiId) || { apiId, name: humanizeConnectorApiId(apiId) };
      const logicalName = `${prefix}_${apiId}`;
      try {
        const result = await dvPost('connectionreferences', {
          connectionreferencedisplayname: connector.name,
          connectionreferencelogicalname: logicalName,
          connectorid: `/providers/Microsoft.PowerApps/apis/${apiId}`,
        }, { solutionName });
        createdRefs.push({ apiId, connRefId: result.connectionreferenceid, name: connector.name });
        ui.ok(`${connector.name} — connection reference created`);
      } catch (err) {
        if (err.message.includes('database constraint') || err.message.includes('already exists')) {
          ui.ok(`${connector.name} — connection reference already exists`);
          // Find its ID from existing refs or query it
          const existing = existingRefs.find((r) => r.connectionreferencelogicalname === logicalName);
          if (existing) createdRefs.push({ apiId, connRefId: existing.connectionreferenceid, name: connector.name });
        } else {
          ui.warn(`${connector.name} — failed: ${err.message}`);
        }
      }
    }
  } else if (newSelections.length > 0) {
    ui.line('');
    ui.warn('No API access — cannot create connection references automatically.');
    ui.line('Create them manually in the Power Apps Maker Portal:');
    ui.line('  Solutions → your solution → + Add existing → Connection Reference');
    for (const apiId of newSelections) {
      const c = connectorMeta.get(apiId) || { apiId, name: humanizeConnectorApiId(apiId) };
      ui.line(`  • ${c.name} (${apiId})`);
    }
  }

  // ── 4. Add data sources via pac code add-data-source ──
  //    ALL pac code commands require user (interactive) auth.
  //    The BAP checkAccess API rejects service principal tokens.
  if (pac) {
    ui.line('');

    // Detect SPN auth and switch to user auth before running any pac code commands
    const authSwitched = await ensureUserAuthForCodeCommands(pac, rootDir, projectDir, credentialValues);
    if (!authSwitched) {
      ui.warn('Cannot add data sources without user auth.');
      ui.line('  Switch to user auth and re-run: node wizard/index.mjs --from 8');
      ui.line('');
      return;
    }

    ui.line('Adding data sources to your Code App...');

    // Dataverse table registration is handled by the coding agent
    // at development time (pac code add-data-source -a dataverse -t <table>).
    // The wizard only handles non-Dataverse connectors that need a Connection ID.

    // Add non-Dataverse connectors as data sources.
    // Non-Dataverse connectors REQUIRE a Connection ID (-c flag).
    // A connection ID comes from an actual connection created in the
    // Maker Portal — it is NOT the same as a connection reference.
    const nonDvSelected = selected.filter((id) => id !== 'shared_commondataserviceforapps');
    if (nonDvSelected.length > 0) {
      ui.line('');
      ui.line('Non-Dataverse connectors require a Connection ID to register');
      ui.line('as data sources.');
      ui.line('');
      ui.line('HOW TO FIND A CONNECTION ID:');
      ui.line('  1. Go to make.powerapps.com and select your environment');
      ui.line('  2. In the left nav, go to Connections (under Data, or use');
      ui.line('     the direct URL: make.powerapps.com/environments/<env-id>/connections)');
      ui.line('  3. Find the connector you need (e.g. Office 365 Users)');
      ui.line('  4. Click on the connection row to open its details');
      ui.line('  5. Copy the URL from your browser — it will look like:');
      ui.line('     .../connections/shared_office365users/<CONNECTION_ID>/details');
      ui.line('');
      ui.line('TIP: Paste the FULL URL when prompted — the wizard will pull out the');
      ui.line('Connection ID for you. You can also paste just the GUID if you prefer.');
      ui.line('');
      ui.line('If the connection does not exist yet, create it first:');
      ui.line('  Connections → + New connection → search for the connector → authenticate');
      ui.line('');
      ui.line('TIP: The wizard will also try to auto-discover connections via');
      ui.line('pac connection list. If a match is found, you can pick it from a list.');
      ui.line('');

      for (const apiId of nonDvSelected) {
        const connector = connectorMeta.get(apiId) || { apiId, name: humanizeConnectorApiId(apiId) };
        const prefilled = prefilledConnectionIds.get(apiId);
        let connectionId;
        if (prefilled) {
          ui.line(`${connector.name} — using connection ID extracted from the URL you pasted.`);
          connectionId = prefilled;
        } else {
          connectionId = await resolveConnectionIdForConnector(pac, apiId, connector.name);
        }
        if (!connectionId) {
          ui.info(`${connector.name} — skipped`);
          ui.line(`    Add later: pac code add-data-source -a ${apiId} -c <CONNECTION_ID>`);
          continue;
        }
        const args = ['code', 'add-data-source', '-a', apiId, '-c', connectionId.trim()];
        ui.line(`  Running: pac ${args.join(' ')}`);
        const ok = runPacCodeDataSource(pac, args, rootDir, projectDir, credentialValues);
        if (ok) {
          ui.ok(`${connector.name} — data source added`);
        } else {
          ui.warn(`${connector.name} — failed. Try manually:`);
          ui.line(`    pac code add-data-source -a ${apiId} -c ${connectionId.trim()}`);
        }
      }
    }
  } else {
    ui.warn('PAC CLI not found. Add data sources manually after installing pac:');
    ui.line('  pac code add-data-source -a dataverse -t <table_name>');
  }

  ui.line('');
  if (hasApiAccess && createdRefs.length > 0) {
    ui.line('Connection references have been created in your solution.');
  }
  ui.line('After deploying, map each connection reference to an actual connection');
  ui.line('in the Power Apps Maker Portal → Solutions → your solution → Connection References.');
}

async function resolveConnectionIdForConnector(pac, apiId, connectorName) {
  while (true) {
    const discovered = discoverConnectionsForApiId(pac, apiId);

    if (discovered.length > 0) {
      const selected = await select({
        message: `Select the ${connectorName} connection to use`,
        choices: [
          ...discovered.map((entry) => ({
            name: `${entry.displayName} (${entry.connectionId})`,
            value: entry.connectionId,
          })),
          { name: 'Re-scan connections', value: '__rescan__' },
          { name: 'Paste a connection URL or GUID manually', value: '__manual__' },
          { name: 'Skip this connector for now', value: '__skip__' },
        ],
      });

      if (selected === '__rescan__') continue;
      if (selected === '__skip__') return '';
      if (selected === '__manual__') {
        const manual = await input({
          message: `Paste the connection URL or GUID for ${connectorName} (blank to skip)`,
          default: '',
          validate: (v) => {
            const t = (v || '').trim();
            if (!t) return true; // blank = skip
            return extractConnectionId(t) ? true : 'Could not find a GUID in that input. Paste the full connection URL or just the GUID.';
          },
        });
        return extractConnectionId(manual);
      }

      return selected;
    }

    ui.warn(`No existing ${connectorName} connections were found via pac connection list.`);
    ui.line('Create one in Power Apps Maker Portal → Data → Connections, then return here.');

    const nextAction = await select({
      message: `How do you want to continue for ${connectorName}?`,
      choices: [
        { name: 'Re-scan connections after creating one', value: '__rescan__' },
        { name: 'Paste a connection URL or GUID manually', value: '__manual__' },
        { name: 'Skip this connector for now', value: '__skip__' },
      ],
    });

    if (nextAction === '__rescan__') continue;
    if (nextAction === '__skip__') return '';

    const manual = await input({
      message: `Paste the connection URL or GUID for ${connectorName} (blank to skip)`,
      default: '',
      validate: (v) => {
        const t = (v || '').trim();
        if (!t) return true;
        return extractConnectionId(t) ? true : 'Could not find a GUID in that input. Paste the full connection URL or just the GUID.';
      },
    });
    return extractConnectionId(manual);
  }
}

// ─────────── PAC Code Helpers ───────────

const BAP_PERMISSION_RE = /does not have permission to access|checkAccess|HTTP error status: 403/i;

/**
 * Run pac code add-data-source and detect false-positive success.
 * PAC CLI may exit 0 but log a 403 error when SPN auth is active.
 * Returns true only if the command succeeded without BAP errors.
 */
function runPacCodeDataSource(pac, args, rootDir, projectDir, credentialValues) {
  verifyPacMutationTarget({
    pac,
    rootDir,
    projectDir,
    credentialValues,
    profileType: 'user',
    requirePowerConfig: true,
    requirePowerConfigTarget: true,
  });
  const { ok, stderr } = runSafeCapture(pac, args, { cwd: projectDir });
  if (!ok) return false;
  // PAC may exit 0 despite 403 — check stderr for BAP rejection
  if (BAP_PERMISSION_RE.test(stderr)) {
    ui.warn('PAC reported success but encountered a BAP permission error (403).');
    ui.line('  The data source was NOT actually registered.');
    return false;
  }
  return true;
}

/**
 * Detect SPN auth and switch to user auth before pac code commands.
 * ALL pac code commands require user (interactive) auth — the BAP
 * checkAccess API rejects service principal tokens.
 */
async function ensureUserAuthForCodeCommands(pac, rootDir, projectDir, credentialValues) {
  try {
    verifyPacMutationTarget({
      pac,
      rootDir,
      projectDir,
      credentialValues,
      profileType: 'user',
      requirePowerConfig: true,
      requirePowerConfigTarget: true,
    });
    return true;
  } catch {
    const proceed = await confirm({ message: 'Create the repo-scoped interactive PAC profile for pac code commands now?', default: true });
    if (!proceed) return false;

    const wizardState = getWizardStateSnapshot(stateGet);
    const targetKey = stateGet('WIZARD_TARGET_ENV', 'dev');
    const targetStateKey = targetKey === 'test' ? 'PP_ENV_TEST' : targetKey === 'prod' ? 'PP_ENV_PROD' : 'PP_ENV_DEV';
    const targetUrl = wizardState[targetStateKey];
    const expectedProfileName = buildPacProfileName({
      rootDir,
      targetKey,
      profileType: 'user',
      url: targetUrl,
    });

    ui.line('');
    ui.line(`Creating interactive profile ${expectedProfileName}...`);
    let createOk = runSafeLive(pac, [
      'auth', 'create',
      '--name', expectedProfileName,
      '--environment', targetUrl,
    ]);

    if (!createOk) {
      ui.warn('Browser sign-in failed. Trying device code flow...');
      ui.line('You will see a URL and code — open the URL in any browser and enter the code.');
      ui.line('');
      createOk = runSafeLive(pac, [
        'auth', 'create',
        '--name', expectedProfileName,
        '--environment', targetUrl,
        '--deviceCode',
      ]);
    }

    if (!createOk) {
      ui.warn('Could not establish the repo-scoped interactive PAC profile.');
      return false;
    }

    try {
      verifyPacMutationTarget({
        pac,
        rootDir,
        projectDir,
        credentialValues,
        profileType: 'user',
        requirePowerConfig: true,
        requirePowerConfigTarget: true,
      });
      ui.ok('User auth verified');
      return true;
    } catch (error) {
      ui.warn(error.message);
      return false;
    }
  }
}

function resolvePacCredentialValues(rootDir) {
  return resolveCredentialValues({
    rootDir,
    opBin: process.env.OP_BIN || (hasCommand('op') ? 'op' : null),
    source: stateGet('AUTH_MODE', 'auto'),
  });
}

function verifyPacMutationTarget({ pac, rootDir, projectDir, credentialValues, profileType, requirePowerConfig, requirePowerConfigTarget }) {
  return selectAndVerifyPacProfile({
    pac,
    rootDir,
    wizardState: getWizardStateSnapshot(stateGet),
    targetKey: stateGet('WIZARD_TARGET_ENV', 'dev'),
    profileType,
    credentialValues,
    powerConfigPath: join(projectDir, 'power.config.json'),
    requireCredentialMatch: true,
    requirePowerConfig,
    requirePowerConfigTarget,
  });
}

