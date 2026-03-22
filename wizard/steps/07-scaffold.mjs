// wizard/steps/07-scaffold.mjs — Scaffold the Code App project
import { input, confirm, select } from '@inquirer/prompts';
import {
  writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import * as ui from '../lib/ui.mjs';
import { stateGet, stateSet, setCompletedStep, TOTAL_STEPS, getRootDir } from '../lib/state.mjs';
import { pacPath, runLive, run, runSafeLive, runSafe, IS_WIN } from '../lib/shell.mjs';

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

  let templateOk = false;
  try {
    templateOk = runLive(`npx --yes degit microsoft/PowerAppsCodeApps/templates/starter "${projectDir}"`);
    if (templateOk) ui.ok('Template downloaded');
  } catch { /* fall through */ }

  if (!templateOk) {
    ui.warn('Template download failed (network issue or repo changed).');
    ui.line('  Creating minimal project structure instead...');
    createMinimalProject(projectDir, appName);
    ui.ok('Minimal structure created');
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
    for (const f of ['setup-auth.sh', 'op-pac.sh']) {
      const src = join(scriptsDir, f);
      if (existsSync(src)) copyFileSync(src, join(projectDir, 'scripts', f));
    }
    ui.ok('Helper scripts copied');
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

  // ── Data sources ──
  ui.line('');
  ui.divider();
  ui.line('');
  ui.line('Add data sources now? (You can always add more later)');
  ui.line('');
  let addMore = true;
  while (addMore && pac) {
    const dsType = await select({
      message: 'What type of data source?',
      choices: [
        { name: 'Dataverse table', value: 'dataverse' },
        { name: 'Office 365 Users', value: 'shared_office365users' },
        { name: 'SharePoint', value: 'shared_sharepointonline' },
        { name: 'SQL Server', value: 'shared_sql' },
        { name: 'Other connector (enter API ID)', value: '__other__' },
        { name: 'Skip — no more data sources', value: '__skip__' },
      ],
    });
    if (dsType === '__skip__') break;

    let args;
    if (dsType === 'dataverse') {
      const table = await input({ message: 'Dataverse table logical name (e.g. agtpo_agentidea)', validate: (v) => v.trim() ? true : 'Required' });
      args = ['code', 'add-data-source', '-a', 'dataverse', '-t', table.trim()];
    } else if (dsType === '__other__') {
      const apiId = await input({ message: 'Connector API ID (e.g. shared_office365)', validate: (v) => v.trim() ? true : 'Required' });
      const connId = await input({ message: 'Connection ID (from Power Apps Maker Portal URL, or Enter to skip)', default: '' });
      args = ['code', 'add-data-source', '-a', apiId.trim()];
      if (connId.trim()) args.push('-c', connId.trim());
    } else {
      // Named connector (shared_office365users, shared_sharepointonline, shared_sql)
      const connId = await input({ message: `Connection ID for ${dsType} (from Power Apps Maker Portal URL, or Enter to skip)`, default: '' });
      args = ['code', 'add-data-source', '-a', dsType];
      if (connId.trim()) args.push('-c', connId.trim());
    }

    ui.line('');
    ui.line(`Running: pac ${args.join(' ')}`);
    const dsOk = runSafeLive(pac, args, { cwd: projectDir });
    if (dsOk) {
      ui.ok('Data source added (TypeScript SDK generated in src/generated/)');
    } else {
      ui.warn('Data source command failed. You can add it manually later:');
      ui.line(`  pac ${args.join(' ')}`);
    }

    ui.line('');
    addMore = await confirm({ message: 'Add another data source?', default: false });
  }
  if (!pac) {
    ui.warn('PAC CLI not found. Add data sources manually later:');
    ui.line('  pac code add-data-source -a dataverse -t <table_name>');
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
    if (runLive('git init -b main', { cwd: projectDir })) {
      ui.ok('Git repo initialized (branch: main)');
    } else {
      ui.warn('git init failed');
    }
  }

  ui.line('');
  ui.line('Do you have a remote repository URL?');
  ui.line('(e.g. https://github.com/your-org/my-brain.git)');
  ui.line('Press Enter to skip — you can add one later with:');
  ui.line('  git remote add origin <url>');
  ui.line('');
  const remoteUrl = await input({ message: 'Remote URL (Enter to skip)', default: '' });
  if (remoteUrl) {
    run('git remote remove origin', { cwd: projectDir });
    run(`git remote add origin "${remoteUrl}"`, { cwd: projectDir });
    ui.ok(`Remote 'origin' set to ${remoteUrl}`);
    stateSet('GIT_REMOTE', remoteUrl);
  }

  ui.line('');
  ui.line('Making initial commit...');
  run('git add -A', { cwd: projectDir });
  if (run('git commit -m "Initial scaffold from PAppsCAFoundations wizard" --quiet', { cwd: projectDir }) !== null) {
    ui.ok('Initial commit created');
  } else {
    ui.warn('Commit failed (git user.name/user.email may not be configured)');
  }

  if (remoteUrl) {
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
      build: 'tsc && vite build',
      preview: 'vite preview',
      lint: 'eslint src/ --ext .ts,.tsx --max-warnings 0',
      format: 'prettier --write "src/**/*.{ts,tsx,json,css}"',
      test: 'vitest run',
      'test:watch': 'vitest',
      'test:e2e': 'playwright test',
      deploy: 'npm run build && pac code push',
      generate: 'pac code generate',
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

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
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
