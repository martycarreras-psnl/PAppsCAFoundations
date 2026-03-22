// wizard/steps/07-scaffold.mjs — Scaffold the Code App project
import { input, confirm, select, checkbox } from '@inquirer/prompts';
import {
  writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, stateHas, setCompletedStep, TOTAL_STEPS, getRootDir } from '../lib/state.mjs';
import { pacPath, runLive, run, runSafeLive, runSafe, IS_WIN } from '../lib/shell.mjs';
import { dvGet, dvPost } from '../lib/dataverse.mjs';
import { getSecret, recoverSecret, setSecret } from '../lib/secrets.mjs';

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
    const cont = await confirm({ message: 'Continue anyway? (existing files may be overwritten)', default: false });
    if (!cont) {
      ui.line('Choose a different path and re-run the wizard.');
      process.exit(0);
    }
  }

  // ── Download template ──
  ui.line('');
  ui.line('Downloading starter template...');
  mkdirSync(projectDir, { recursive: true });

  const dirNotEmpty = existsSync(projectDir) && readdirSync(projectDir).length > 0;
  const degitForce = dirNotEmpty ? ' --force' : '';

  let templateOk = false;
  try {
    templateOk = runLive(`npx --yes degit microsoft/PowerAppsCodeApps/templates/starter "${projectDir}"${degitForce}`);
    if (templateOk) ui.ok('Template downloaded');
  } catch { /* fall through */ }

  if (!templateOk) {
    ui.warn('Template download failed (network issue or repo changed).');
    ui.line('  Creating minimal project structure instead...');
    createMinimalProject(projectDir, appName);
    ui.ok('Minimal structure created');
  }

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
  runLive('npm install', { cwd: projectDir }) && ui.ok('Base dependencies installed');

  ui.line('Installing required packages...');
  const prodPkgs = [
    'react', 'react-dom', '@fluentui/react-components',
    '@tanstack/react-query', 'react-router-dom',
    '@microsoft/power-apps', 'concurrently',
  ].join(' ');
  runLive(`npm install ${prodPkgs}`, { cwd: projectDir })
    ? ui.ok('React + Fluent UI + TanStack Query + SDK installed')
    : ui.warn('Some packages failed to install');

  const devPkgs = [
    'typescript', '@types/react', '@types/react-dom',
    'vite', '@vitejs/plugin-react',
    'vitest', '@testing-library/react', '@testing-library/jest-dom', 'jsdom',
    'eslint', 'prettier',
  ].join(' ');
  runLive(`npm install -D ${devPkgs}`, { cwd: projectDir })
    ? ui.ok('Dev dependencies installed')
    : ui.warn('Some dev packages failed to install');

  // ── Config files ──
  writeConfig(projectDir, appName);

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
  writeStarterFiles(projectDir, appName);

  // ── Copy instruction files ──
  ui.line('Copying instruction files...');
  const instrDir = join(ROOT, '.github', 'instructions');
  const destInstrDir = join(projectDir, '.github', 'instructions');
  if (existsSync(instrDir)) {
    for (const f of readdirSync(instrDir).filter((n) => n.endsWith('.md'))) {
      try {
        copyFileSync(join(instrDir, f), join(destInstrDir, f));
      } catch { /* skip */ }
    }
    ui.ok('Instruction files copied');
  } else {
    ui.warn('No instruction files found in foundations repo');
  }

  // ── Copy helper scripts ──
  const scriptsDir = join(ROOT, 'scripts');
  if (existsSync(scriptsDir)) {
    mkdirSync(join(projectDir, 'scripts'), { recursive: true });
    for (const f of ['setup-auth.sh', 'op-pac.sh', 'decrypt-secret.mjs', 'pre-commit-hook.sh', 'sync-foundations.sh', 'sync-foundations.mjs', 'discover-copilot-connection.sh', 'discover-copilot-connection.mjs', 'schema-plan.example.json', 'validate-schema-plan.mjs', 'generate-dataverse-plan.mjs', 'register-dataverse-data-sources.sh', 'register-dataverse-data-sources.mjs']) {
      const src = join(scriptsDir, f);
      if (existsSync(src)) copyFileSync(src, join(projectDir, 'scripts', f));
    }
    const schemaPlanExample = join(scriptsDir, 'schema-plan.example.json');
    const planningPayload = join(projectDir, 'dataverse', 'planning-payload.json');
    if (existsSync(schemaPlanExample) && !existsSync(planningPayload)) {
      copyFileSync(schemaPlanExample, planningPayload);
      ui.ok('dataverse/planning-payload.json seeded from schema plan example');
    }
    ui.ok('Helper scripts copied');
  }

  const versionFile = join(ROOT, '.foundations-version.json');
  if (existsSync(versionFile)) {
    copyFileSync(versionFile, join(projectDir, '.foundations-version.json'));
    ui.ok('.foundations-version.json copied');
  }

  // ── Copy credential files ──
  for (const f of ['.env.local', '.env', '.env.template']) {
    const src = join(ROOT, f);
    if (existsSync(src)) {
      copyFileSync(src, join(projectDir, f));
      ui.ok(`${f} copied`);
    }
  }

  // ── pac code init ──
  ui.line('');
  ui.line('Registering Code App in Power Platform...');
  const pac = pacPath();
  if (pac) {
    const initOk = runSafe(pac, [
      'code', 'init',
      '--displayName', appName,
      '--buildPath', './dist',
      '--fileEntryPoint', 'index.html',
    ], { cwd: projectDir });
    if (initOk !== null) {
      ui.ok('power.config.json created');
    } else {
      ui.warn('pac code init failed. You can run it manually later:');
      ui.line(`  cd ${projectDir}`);
      ui.line(`  pac code init --displayName "${appName}" --buildPath "./dist" --fileEntryPoint "index.html"`);
    }
  } else {
    ui.warn('PAC CLI not found — skipping pac code init.');
  }

  // ── Connectors & Connection References ──
  ui.line('');
  ui.divider();
  ui.line('');
  ui.line('Now let\'s set up connectors for your app.');
  ui.line('The wizard will create connection references in your solution');
  ui.line('so they travel with it across environments.');
  ui.line('');

  await setupConnectors(pac, projectDir);

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
    if (runLive('git init -b main', { cwd: projectDir })) {
      ui.ok('Git repo initialized (branch: main)');
    } else {
      ui.warn('git init failed');
    }
  }

  // ── Remote URL — detect existing origin (template repos) or prompt ──
  const existingOrigin = run('git remote get-url origin', { cwd: projectDir });
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
      run('git remote remove origin', { cwd: projectDir });
    }

    ui.line('');
    ui.line('Do you have a remote repository URL?');
    ui.line('(e.g. https://github.com/your-org/my-app.git)');
    ui.line('Press Enter to skip — you can add one later with:');
    ui.line('  git remote add origin <url>');
    ui.line('');
    const remoteUrl = await input({ message: 'Remote URL (Enter to skip)', default: '' });
    if (remoteUrl) {
      run('git remote remove origin', { cwd: projectDir });  // remove any stale origin
      run(`git remote add origin "${remoteUrl}"`, { cwd: projectDir });
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

### Prerequisites

- Node.js 18+
- [PAC CLI](https://learn.microsoft.com/power-platform/developer/cli/introduction) (\`dotnet tool install -g Microsoft.PowerApps.CLI.Tool\`)
- An authenticated PAC profile (\`pac auth list\` to verify)

### Development

\`\`\`bash
npm install
npm run dev          # Start local dev server (Vite)
\`\`\`

### Build & Deploy

\`\`\`bash
npm run build                     # Build to dist/
~/.dotnet/tools/pac code push     # Deploy to Power Platform
\`\`\`

The app URL after deployment:
\`https://apps.powerapps.com/play/e/{environmentId}/app/{appId}\`

## Project Structure

\`\`\`
${appName.toLowerCase().replace(/\\s+/g, '-')}/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/             # Route-level pages
│   ├── hooks/             # Custom React hooks
│   ├── generated/         # Auto-generated connector SDK (do not edit)
│   ├── services/          # Business logic & data layer
│   └── App.tsx            # Root component
├── .github/instructions/  # GitHub Copilot instruction files
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

Data sources are managed via Power Platform connectors. To add a new data source:

\`\`\`bash
# Add a Dataverse table
~/.dotnet/tools/pac code add-data-source -a dataverse -t ${publisherPrefix}_tablename

# Regenerate TypeScript SDK
~/.dotnet/tools/pac code generate
\`\`\`

> **Never edit files in \`src/generated/\`** — they are overwritten on every \`pac code generate\`.

## GitHub Copilot Instructions

This project includes \`.github/instructions/*.instructions.md\` files that guide GitHub Copilot to generate code following the team's standards. They cover scaffolding, connectors, components, deployment, testing, security, and Dataverse schema design.

## Scripts

| Command | Description |
|---------|-------------|
| \`npm run dev\` | Start Vite dev server |
| \`npm run build\` | Production build to \`dist/\` |
| \`npm run preview\` | Preview production build locally |
| \`npm run test\` | Run unit tests (Vitest) |
| \`npm run lint\` | Lint with ESLint |
| \`npm run validate:schema-plan\` | Validate the Dataverse planning artifact before provisioning |
| \`npm run generate:dataverse-plan\` | Generate normalized Dataverse execution plans from the planning artifact |
| \`npm run register:dataverse\` | Register planned Dataverse tables with pac code add-data-source and regenerate the SDK |
| \`npm run sync:foundations\` | Pull latest instruction files, wizard, and scripts from the template repo |

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
  run('git add -A', { cwd: projectDir });
  if (run('git commit -m "Initial scaffold from PAppsCAFoundations wizard" --quiet', { cwd: projectDir }) !== null) {
    ui.ok('Initial commit created');
  } else {
    ui.warn('Commit failed (git user.name/user.email may not be configured)');
  }

  if (finalRemoteUrl) {
    const push = await confirm({ message: 'Push to remote now?', default: true });
    if (push) {
      if (runLive('git push -u origin main', { cwd: projectDir })) {
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

async function setupConnectors(pac, projectDir) {
  const prefix = stateGet('PUBLISHER_PREFIX');
  const solutionName = stateGet('SOLUTION_UNIQUE_NAME');

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

  const selected = await checkbox({
    message: 'Which connectors does your app need? (Space to toggle, Enter to confirm)',
    choices,
  });

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
      const connector = COMMON_CONNECTORS.find((c) => c.apiId === apiId);
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
      const c = COMMON_CONNECTORS.find((conn) => conn.apiId === apiId);
      ui.line(`  • ${c.name} (${apiId})`);
    }
  }

  // ── 4. Add data sources via pac code add-data-source ──
  if (pac) {
    ui.line('');
    ui.line('Adding data sources to your Code App...');

    // Check if Dataverse was selected — ask for table names
    if (selected.includes('shared_commondataserviceforapps')) {
      ui.line('');
      ui.line('Dataverse selected — which tables do you need?');
      ui.line(`(logical names, e.g. ${prefix}_project, ${prefix}_task)`);
      ui.line('Enter them one at a time. Press Enter on a blank line when done.');
      ui.line('');
      let tableNum = 1;
      while (true) {
        const table = await input({ message: `Table ${tableNum} (blank to stop)`, default: '' });
        if (!table.trim()) break;
        const args = ['code', 'add-data-source', '-a', 'dataverse', '-t', table.trim()];
        ui.line(`  Running: pac ${args.join(' ')}`);
        const ok = runSafeLive(pac, args, { cwd: projectDir });
        if (ok) {
          ui.ok(`${table.trim()} — data source added`);
        } else {
          ui.warn(`${table.trim()} — failed. Add manually later: pac ${args.join(' ')}`);
        }
        tableNum++;
      }
    }

    // Add non-Dataverse connectors as data sources
    const nonDvSelected = selected.filter((id) => id !== 'shared_commondataserviceforapps');
    for (const apiId of nonDvSelected) {
      const connector = COMMON_CONNECTORS.find((c) => c.apiId === apiId);
      const ref = createdRefs.find((r) => r.apiId === apiId) ||
        existingRefs.find((r) => r.connectorid.endsWith(`/${apiId}`));
      const args = ['code', 'add-data-source', '-a', apiId];
      if (ref) {
        args.push('-cr', ref.connectionreferenceid || ref.connRefId);
        args.push('-s', stateGet('SOLUTION_ID', ''));
      }
      ui.line(`  Running: pac ${args.join(' ')}`);
      const ok = runSafeLive(pac, args, { cwd: projectDir });
      if (ok) {
        ui.ok(`${connector.name} — data source added`);
      } else {
        ui.warn(`${connector.name} — failed. Add manually later: pac code add-data-source -a ${apiId}`);
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

// ─────────── Helpers ───────────

function createMinimalProject(dir, appName) {
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'public'), { recursive: true });

  const kebab = appName.toLowerCase().replace(/ /g, '-');

  writeFileSync(join(dir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Code App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

  const crossPlatformDevLocal = IS_WIN
    ? 'set VITE_USE_MOCK=true && vite --port 3000'
    : 'VITE_USE_MOCK=true vite --port 3000';

  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: kebab,
    private: true,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'concurrently "vite --port 3000" "pac code run"',
      'dev:local': crossPlatformDevLocal,
      typecheck: 'tsc --noEmit',
      build: 'npm run typecheck && vite build',
      preview: 'vite preview',
      lint: 'eslint src/ --ext .ts,.tsx --max-warnings 0',
      format: 'prettier --write "src/**/*.{ts,tsx,json,css}"',
      test: 'vitest run',
      'test:watch': 'vitest',
      'test:e2e': 'playwright test',
      deploy: 'npm run build && pac code push',
      'validate:schema-plan': 'node scripts/validate-schema-plan.mjs dataverse/planning-payload.json',
      'generate:dataverse-plan': 'node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json',
      'register:dataverse': 'node scripts/register-dataverse-data-sources.mjs dataverse/register-datasources.plan.json',
      'sync:foundations': 'node scripts/sync-foundations.mjs',
    },
  }, null, 2) + '\n');
}

function writeConfig(dir, appName) {
  // tsconfig.json
  ui.line('Writing tsconfig.json...');
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      verbatimModuleSyntax: false,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
      skipLibCheck: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      isolatedModules: true,
      rootDir: '.',
      outDir: './dist',
      paths: { '@/*': ['./src/*'] },
    },
    include: ['src/**/*', '.power/**/*'],
    exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n');
  ui.ok('tsconfig.json');

  // vite.config.ts
  ui.line('Writing vite.config.ts...');
  writeFileSync(join(dir, 'vite.config.ts'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  server: { port: 3000 },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}));
`);
  ui.ok('vite.config.ts (port 3000)');

  // .prettierrc
  writeFileSync(join(dir, '.prettierrc'), '{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }\n');
  ui.ok('.prettierrc');
}

function writeStarterFiles(dir, appName) {
  ui.line('Writing starter files...');

  // src/main.tsx
  writeFileSync(join(dir, 'src', 'main.tsx'), `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={webLightTheme}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </FluentProvider>
    </QueryClientProvider>
  </StrictMode>,
);
`);
  ui.ok('src/main.tsx');

  // src/App.tsx
  // Escape the dollar sign so it doesn't get interpreted
  writeFileSync(join(dir, 'src', 'App.tsx'), `import { makeStyles, Title1, Text, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXL,
  },
});

export function App() {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Title1>${appName}</Title1>
      <Text>Your Code App is ready. Start building!</Text>
    </div>
  );
}
`);
  ui.ok('src/App.tsx');

  // .gitignore
  writeFileSync(join(dir, '.gitignore'), `# Secrets
.env.local
.env.*.local

# Power Platform
.pac/
auth.json

# Dependencies
node_modules/

# Build
dist/

# Tests
coverage/
test-results/
playwright-report/

# IDE
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db

# Solution zips
solution/*.zip

# Wizard state
.wizard-state.json

# Temp
*.tmp
*.log
`);
  ui.ok('.gitignore');
}
