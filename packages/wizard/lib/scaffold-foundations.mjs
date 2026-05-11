import { writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { runSafe, runSafeLive, IS_WIN } from './shell.mjs';
import { loadPacafConfig, scopedPackageName, binName } from './pacaf-config.mjs';

const noopLogger = {
  line() {},
  ok() {},
  warn() {},
};

export const REQUIRED_RUNTIME_PACKAGES = {
  react: '^18.3.1',
  'react-dom': '^18.3.1',
  '@fluentui/react-components': '^9.56.0',
  '@tanstack/react-query': '^5.62.0',
  'react-router-dom': '^7.1.0',
  '@microsoft/power-apps': '^1.0.3',
  concurrently: '^9.1.0',
};

// Devs deps are computed dynamically so forks can rebrand the @pacaf scope.
export function buildRequiredDevPackages(config = loadPacafConfig()) {
  return {
    [scopedPackageName('scripts', config)]: '^1.0.0',
    [scopedPackageName('agent-instructions', config)]: '^1.0.0',
    typescript: '5.7.3',
    '@types/react': '^18.3.12',
    '@types/react-dom': '^18.3.1',
    vite: '^5.4.0',
    '@vitejs/plugin-react': '^4.3.0',
    vitest: '^2.1.0',
    '@testing-library/react': '^16.1.0',
    jsdom: '^25.0.0',
    '@playwright/test': '^1.49.0',
    eslint: '^9.16.0',
    'typescript-eslint': '^8.18.0',
    '@eslint/js': '^9.16.0',
    'eslint-plugin-react-hooks': '^5.1.0',
    prettier: '^3.4.0',
  };
}

// Backwards compat — many call sites still import REQUIRED_DEV_PACKAGES.
export const REQUIRED_DEV_PACKAGES = buildRequiredDevPackages();

const REMOVED_DEV_PACKAGES = [
  '@testing-library/jest-dom',
];

// Standard scripts written by the wizard. All references to legacy
// in-repo helper scripts (node scripts/foo.mjs) are now <prefix>-* bins
// provided by the scripts package.
function buildRequiredScripts(config = loadPacafConfig()) {
  const crossPlatformDevLocal = IS_WIN
    ? 'set VITE_USE_MOCK=true && vite --port 3000'
    : 'VITE_USE_MOCK=true vite --port 3000';

  const b = (suffix) => binName(suffix, config);

  return {
    dev: 'concurrently "vite --port 3000" "pac code run"',
    'dev:local': crossPlatformDevLocal,
    'prototype:seed': `${b('seed')} dataverse/planning-payload.json`,
    typecheck: 'tsc --noEmit',
    prebuild: b('patch-datasources'),
    build: 'npm run typecheck && vite build',
    preview: 'vite preview',
    lint: 'eslint src/ --max-warnings 0',
    format: 'prettier --write "src/**/*.{ts,tsx,json,css}"',
    test: 'vitest run',
    'test:watch': 'vitest',
    'test:smoke': 'vitest run --reporter=verbose src/App.test.tsx',
    'test:e2e': 'playwright test',
    'setup:auth': b('setup-auth'),
    pac: b('pac'),
    'solution:export': `${b('export-solution')} --name YourSolutionName --target dev`,
    'solution:export:unmanaged': `${b('export-solution')} --name YourSolutionName --target dev --unmanaged-only`,
    deploy: `npm run build && ${b('pac-safe')} --target dev --profile-type spn --mutating code push`,
    'validate:schema-plan': `${b('validate')} dataverse/planning-payload.json`,
    'generate:dataverse-plan': `${b('generate')} dataverse/planning-payload.json`,
    'register:dataverse': `${b('register')} dataverse/register-datasources.plan.json`,
    'sync:foundations': b('update'),
    'sync:foundations:check': `${b('update')} --check`,
  };
}

export function packageSpecs(packages) {
  return Object.entries(packages).map(([name, version]) => `${name}@${version}`);
}

export function normalizePackageJsonDependencies(dir, logger = noopLogger) {
  const pkgPath = join(dir, 'package.json');
  let pkg = {};
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    } catch {
      pkg = {};
    }
  }

  pkg.dependencies = { ...(pkg.dependencies || {}), ...REQUIRED_RUNTIME_PACKAGES };
  pkg.devDependencies = { ...(pkg.devDependencies || {}), ...REQUIRED_DEV_PACKAGES };

  for (const name of Object.keys(REQUIRED_RUNTIME_PACKAGES)) {
    delete pkg.devDependencies[name];
  }
  for (const name of Object.keys(REQUIRED_DEV_PACKAGES)) {
    delete pkg.dependencies[name];
  }
  for (const name of REMOVED_DEV_PACKAGES) {
    delete pkg.dependencies[name];
    delete pkg.devDependencies[name];
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  logger.ok('package.json dependencies normalized');
}

export function createMinimalProject(dir, appName) {
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
    dependencies: REQUIRED_RUNTIME_PACKAGES,
    devDependencies: REQUIRED_DEV_PACKAGES,
    scripts: buildRequiredScripts(),
  }, null, 2) + '\n');
}

export function writeConfig(dir, logger = noopLogger) {
  logger.line('Writing tsconfig.json...');
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      verbatimModuleSyntax: true,
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
      types: ['vitest/globals'],
    },
    include: ['src/**/*', 'tests/**/*', '.power/**/*'],
    exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n');
  logger.ok('tsconfig.json');

  logger.line('Writing vite.config.ts...');
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
  logger.ok('vite.config.ts (port 3000)');

  logger.line('Writing vitest.config.ts...');
  writeFileSync(join(dir, 'vitest.config.ts'), `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/generated/**', 'src/mockData/**', 'src/**/*.test.*'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
});
`);
  logger.ok('vitest.config.ts');

  writeFileSync(join(dir, '.prettierrc'), '{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }\n');
  logger.ok('.prettierrc');

  writeFileSync(join(dir, '.prettierignore'), `dist/
node_modules/
src/generated/
.power/
coverage/
`);
  logger.ok('.prettierignore');

  logger.line('Writing eslint.config.mjs...');
  writeFileSync(join(dir, 'eslint.config.mjs'), `import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['dist/', 'src/generated/', '.power/', 'coverage/'] },
);
`);
  logger.ok('eslint.config.mjs');

  logger.line('Writing playwright.config.ts...');
  writeFileSync(join(dir, 'playwright.config.ts'), `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev:local',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_MOCK: 'true' },
  },
});
`);
  logger.ok('playwright.config.ts');
}

export function mergePackageJsonScripts(dir, logger = noopLogger) {
  const pkgPath = join(dir, 'package.json');
  let pkg = {};
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    } catch {
      // Start fresh if the template package.json is unreadable.
    }
  }

  pkg.scripts = { ...(pkg.scripts || {}), ...buildRequiredScripts() };
  if (!pkg.type) pkg.type = 'module';

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  logger.ok('package.json scripts merged (uses pacaf-* bins from @pacaf/scripts)');
}

export function writeStarterFiles(dir, appName, logger = noopLogger) {
  logger.line('Writing starter files...');

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
  logger.ok('src/main.tsx');

  writeFileSync(join(dir, 'src', 'prototypeManifest.ts'), `export const prototypeManifest = {
  generatedFrom: 'dataverse/planning-payload.json',
  feedbackPath: 'dataverse/prototype-feedback.md',
  entities: [
    {
      displayName: 'Planning Entity',
      collectionName: 'records',
      description: 'Update dataverse/planning-payload.json and run npm run prototype:seed to regenerate these assets.',
      mockDataFile: 'src/mockData/record.ts',
      repositoryName: 'RecordRepository',
    },
  ],
} as const;
`);
  logger.ok('src/prototypeManifest.ts');

  writeFileSync(join(dir, 'src', 'App.tsx'), `import { Badge, Card, Text, Title1, makeStyles, tokens } from '@fluentui/react-components';
import { prototypeManifest } from './prototypeManifest';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXL,
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  cards: {
    display: 'grid',
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  commands: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

export function App() {
  const styles = useStyles();
  const isPrototypeMode = import.meta.env.VITE_USE_MOCK === 'true';

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <Badge appearance="filled" color={isPrototypeMode ? 'success' : 'informative'}>
          {isPrototypeMode ? 'Prototype Mode' : 'Connected Mode'}
        </Badge>
        <Title1 as="h1">${appName}</Title1>
        <Text>
          Start with mock-backed UX, capture what the prototype changes in the data model,
          then add real providers and connectors once the planning payload is stable.
        </Text>
      </div>

      <div className={styles.cards}>
        {prototypeManifest.entities.map((entity) => (
          <Card key={entity.collectionName} className={styles.card}>
            <Title1 as="h2">{entity.displayName}</Title1>
            <Text>{entity.description}</Text>
            <Text>Provider contract: {entity.repositoryName}</Text>
            <Text>Mock data: {entity.mockDataFile}</Text>
          </Card>
        ))}
      </div>

      <Card className={styles.commands}>
        <Text>Commands</Text>
        <Text>1. npm run dev:local</Text>
        <Text>2. Edit dataverse/planning-payload.json</Text>
        <Text>3. npm run prototype:seed</Text>
        <Text>4. Review dataverse/prototype-feedback.md</Text>
        <Text>5. npm run dev once real providers exist</Text>
      </Card>
    </div>
  );
}
`);
  logger.ok('src/App.tsx');

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
  logger.ok('.gitignore');

  writeFileSync(join(dir, '.gitattributes'), `* text=auto

# Keep source and config files consistent across Windows, macOS, and Linux.
*.css text eol=lf
*.html text eol=lf
*.js text eol=lf
*.json text eol=lf
*.jsx text eol=lf
*.md text eol=lf
*.mjs text eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
`);
  logger.ok('.gitattributes');

  // ── Smoke test infrastructure — ready to run from day one ──
  writeSmokeTestFiles(dir, appName, logger);
}

export function writeSmokeTestFiles(dir, appName, logger = noopLogger) {
  logger.line('Writing smoke test files...');

  // tests/setup/setup.ts — Vitest setup hook for project-wide test config.
  mkdirSync(join(dir, 'tests', 'setup'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'setup', 'setup.ts'), '');
  logger.ok('tests/setup/setup.ts');

  // tests/setup/test-utils.tsx — custom render wrapping all providers
  writeFileSync(join(dir, 'tests', 'setup', 'test-utils.tsx'), `import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { MemoryRouter } from 'react-router-dom';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

function customRender(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { initialRoute = '/', ...renderOptions } = options;
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <FluentProvider theme={webLightTheme}>
          <MemoryRouter initialEntries={[initialRoute]}>
            {children}
          </MemoryRouter>
        </FluentProvider>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

export * from '@testing-library/react';
export { customRender as render };
`);
  logger.ok('tests/setup/test-utils.tsx');

  // src/App.test.tsx — smoke tests for the scaffolded App component
  writeFileSync(join(dir, 'src', 'App.test.tsx'), `import { describe, it, expect } from 'vitest';
import { render, screen } from '../tests/setup/test-utils';
import { App } from './App';

describe('App — smoke tests', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('displays the app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('shows prototype or connected mode badge', () => {
    render(<App />);
    expect(screen.getByText(/Prototype Mode|Connected Mode/)).toBeTruthy();
  });
});
`);
  logger.ok('src/App.test.tsx (smoke tests)');

  // tests/e2e/app.spec.ts — minimal Playwright E2E starter
  mkdirSync(join(dir, 'tests', 'e2e'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'e2e', 'app.spec.ts'), `import { test, expect } from '@playwright/test';

test.describe('App — E2E smoke', () => {
  test('renders the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows prototype or connected mode badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Prototype Mode|Connected Mode/)).toBeVisible();
  });
});
`);
  logger.ok('tests/e2e/app.spec.ts (E2E starter)');

  // .github/workflows/ci.yml — CI pipeline for every PR
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), `name: CI

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
        run: npm run typecheck

      - name: Unit Tests
        run: npm run test

      - name: Build
        run: npm run build
`);
  logger.ok('.github/workflows/ci.yml');
}

export function copyFoundationFiles(rootDir, projectDir, logger = noopLogger) {
  // Thin layout: instead of copying instruction files, helper scripts, and
  // agent guidance from the foundations repo, we delegate to the published
  // <scope>/agent-instructions package. This is invoked once during scaffold
  // and re-runnable later via `<binPrefix>-update`.
  //
  // The wizard at this point has already created the project's package.json
  // with <scope>/agent-instructions as a devDependency, so it is installed.

  const config = loadPacafConfig();
  const instructionsPkg = scopedPackageName('agent-instructions', config);
  const instructionsBin = binName('instructions', config);
  const seedBin = binName('seed', config);
  const updateBin = binName('update', config);

  logger.line(`Materializing agent guidance via ${instructionsPkg}...`);

  // Prefer the locally installed bin if present (we just ran install);
  // otherwise fall back to a fresh npx fetch from the registry.
  const localBin = join(projectDir, 'node_modules', '.bin', IS_WIN ? `${instructionsBin}.cmd` : instructionsBin);
  let ok = false;
  if (existsSync(localBin)) {
    ok = runSafeLive(localBin, ['sync', '--target', projectDir], { cwd: projectDir });
  }
  if (!ok) {
    const npxBin = IS_WIN ? 'npx.cmd' : 'npx';
    ok = runSafeLive(npxBin, ['--yes', instructionsPkg, 'sync', '--target', projectDir], { cwd: projectDir });
  }

  if (ok) {
    logger.ok('Agent guidance installed (.github/instructions/, .claude/rules/, .cursor/rules/, AGENTS.md, CLAUDE.md)');
  } else {
    logger.warn(`Failed to run ${instructionsBin} sync.`);
    logger.warn('Run it manually after the wizard finishes:');
    logger.line(`  cd ${projectDir}`);
    logger.line(`  npx ${instructionsPkg} sync`);
  }

  // Seed dataverse/planning-payload.json from the scripts package schema-plan example
  // if the user has no planning payload yet.
  const planningPayload = join(projectDir, 'dataverse', 'planning-payload.json');
  if (!existsSync(planningPayload)) {
    const scriptsPkgDir = join(projectDir, 'node_modules', ...scopedPackageName('scripts', config).split('/'));
    const schemaPlanExample = join(scriptsPkgDir, 'schema-plan.example.json');
    if (existsSync(schemaPlanExample)) {
      mkdirSync(join(projectDir, 'dataverse'), { recursive: true });
      copyFileSync(schemaPlanExample, planningPayload);
      logger.ok(`dataverse/planning-payload.json seeded from ${scopedPackageName('scripts', config)} schema-plan example`);
    }
  }

  // Seed prototype assets from the planning payload.
  if (existsSync(planningPayload)) {
    const localSeedBin = join(projectDir, 'node_modules', '.bin', IS_WIN ? `${seedBin}.cmd` : seedBin);
    let seedOk = false;
    if (existsSync(localSeedBin)) {
      seedOk = runSafe(localSeedBin, ['dataverse/planning-payload.json'], { cwd: projectDir }) !== null;
    }
    if (seedOk) {
      logger.ok('Prototype assets seeded');
    } else {
      logger.warn('Prototype asset seeding skipped (run `npm run prototype:seed` later).');
    }
  }

  // .env.template (no secrets) — only thing worth carrying through from the foundations repo.
  const envTemplate = join(rootDir, '.env.template');
  if (existsSync(envTemplate)) {
    copyFileSync(envTemplate, join(projectDir, '.env.template'));
    logger.ok('.env.template copied');
  }

  // Record the active branding in the project so subsequent invocations of
  // <binPrefix>-update know which scope to pull from.
  try {
    writeFileSync(
      join(projectDir, 'pacaf.client.json'),
      JSON.stringify({ scope: config.scope, binPrefix: config.binPrefix, docsUrl: config.docsUrl }, null, 2) + '\n',
    );
    logger.ok(`pacaf.client.json written (scope=${config.scope})`);
  } catch (e) {
    logger.warn(`Could not write pacaf.client.json: ${e.message}`);
  }

  // Suggest the user run the update bin next time.
  logger.line('');
  logger.line(`To update later: npx ${updateBin}`);
}