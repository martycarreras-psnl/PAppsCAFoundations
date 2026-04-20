import { writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSafe, IS_WIN } from './shell.mjs';

const noopLogger = {
  line() {},
  ok() {},
  warn() {},
};

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
    scripts: {
      dev: 'concurrently "vite --port 3000" "pac code run"',
      'dev:local': crossPlatformDevLocal,
      'prototype:seed': 'node scripts/seed-prototype-assets.mjs dataverse/planning-payload.json',
      typecheck: 'tsc --noEmit',
      prebuild: 'node scripts/patch-datasources-info.mjs',
      build: 'npm run typecheck && vite build',
      preview: 'vite preview',
      lint: 'eslint src/ --max-warnings 0',
      format: 'prettier --write "src/**/*.{ts,tsx,json,css}"',
      test: 'vitest run',
      'test:watch': 'vitest',
      'test:smoke': 'vitest run --reporter=verbose src/App.test.tsx',
      'test:e2e': 'playwright test',
      'setup:auth': 'node scripts/setup-auth.mjs',
      pac: 'node scripts/op-pac.mjs',
      'solution:export': 'node scripts/export-solution.mjs --name YourSolutionName --target dev',
      'solution:export:unmanaged': 'node scripts/export-solution.mjs --name YourSolutionName --target dev --unmanaged-only',
      deploy: 'npm run build && node scripts/pac-safe.mjs --target dev --profile-type spn --mutating code push',
      'validate:schema-plan': 'node scripts/validate-schema-plan.mjs dataverse/planning-payload.json',
      'generate:dataverse-plan': 'node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json',
      'register:dataverse': 'node scripts/register-dataverse-data-sources.mjs dataverse/register-datasources.plan.json',
      'sync:foundations': 'node scripts/sync-foundations.mjs',
    },
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
      types: ['vitest/globals', '@testing-library/jest-dom'],
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

  const crossPlatformDevLocal = IS_WIN
    ? 'set VITE_USE_MOCK=true && vite --port 3000'
    : 'VITE_USE_MOCK=true vite --port 3000';

  const requiredScripts = {
    dev: 'concurrently "vite --port 3000" "pac code run"',
    'dev:local': crossPlatformDevLocal,
    'prototype:seed': 'node scripts/seed-prototype-assets.mjs dataverse/planning-payload.json',
    typecheck: 'tsc --noEmit',
    prebuild: 'node scripts/patch-datasources-info.mjs',
    build: 'npm run typecheck && vite build',
    preview: 'vite preview',
    lint: 'eslint src/ --max-warnings 0',
    format: 'prettier --write "src/**/*.{ts,tsx,json,css}"',
    test: 'vitest run',
    'test:watch': 'vitest',
    'test:smoke': 'vitest run --reporter=verbose src/App.test.tsx',
    'test:e2e': 'playwright test',
    'setup:auth': 'node scripts/setup-auth.mjs',
    pac: 'node scripts/op-pac.mjs',
    'solution:export': 'node scripts/export-solution.mjs --name YourSolutionName --target dev',
    'solution:export:unmanaged': 'node scripts/export-solution.mjs --name YourSolutionName --target dev --unmanaged-only',
    deploy: 'npm run build && node scripts/pac-safe.mjs --target dev --profile-type spn --mutating code push',
    'validate:schema-plan': 'node scripts/validate-schema-plan.mjs dataverse/planning-payload.json',
    'generate:dataverse-plan': 'node scripts/generate-dataverse-plan.mjs dataverse/planning-payload.json',
    'register:dataverse': 'node scripts/register-dataverse-data-sources.mjs dataverse/register-datasources.plan.json',
    'sync:foundations': 'node scripts/sync-foundations.mjs',
  };

  pkg.scripts = { ...(pkg.scripts || {}), ...requiredScripts };
  if (!pkg.type) pkg.type = 'module';

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  logger.ok('package.json scripts merged (prebuild, deploy, dev, etc.)');
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

  // ── Smoke test infrastructure — ready to run from day one ──
  writeSmokeTestFiles(dir, appName, logger);
}

export function writeSmokeTestFiles(dir, appName, logger = noopLogger) {
  logger.line('Writing smoke test files...');

  // tests/setup/setup.ts — Vitest setup with jest-dom matchers
  mkdirSync(join(dir, 'tests', 'setup'), { recursive: true });
  writeFileSync(join(dir, 'tests', 'setup', 'setup.ts'), `import '@testing-library/jest-dom/vitest';
`);
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
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('shows prototype or connected mode badge', () => {
    render(<App />);
    expect(screen.getByText(/Prototype Mode|Connected Mode/)).toBeInTheDocument();
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
  logger.line('Copying instruction files...');
  const instrDir = join(rootDir, '.github', 'instructions');
  const destInstrDir = join(projectDir, '.github', 'instructions');
  if (existsSync(instrDir)) {
    for (const f of readdirSync(instrDir).filter((n) => n.endsWith('.md'))) {
      try {
        copyFileSync(join(instrDir, f), join(destInstrDir, f));
      } catch {
        // Skip files that cannot be copied so scaffolding can continue.
      }
    }
    logger.ok('Instruction files copied');
  } else {
    logger.warn('No instruction files found in foundations repo');
  }

  const scriptsDir = join(rootDir, 'scripts');
  if (existsSync(scriptsDir)) {
    mkdirSync(join(projectDir, 'scripts'), { recursive: true });
    for (const f of ['setup-auth.sh', 'setup-auth.mjs', 'op-pac.sh', 'op-pac.mjs', 'export-solution.mjs', 'decrypt-secret.mjs', 'pre-commit-hook.sh', 'sync-foundations.sh', 'sync-foundations.mjs', 'discover-copilot-connection.sh', 'discover-copilot-connection.mjs', 'schema-plan.example.json', 'validate-schema-plan.mjs', 'generate-dataverse-plan.mjs', 'register-dataverse-data-sources.sh', 'register-dataverse-data-sources.mjs', 'patch-datasources-info.mjs', 'seed-prototype-assets.mjs']) {
      const src = join(scriptsDir, f);
      if (existsSync(src)) copyFileSync(src, join(projectDir, 'scripts', f));
    }

    const schemaPlanExample = join(scriptsDir, 'schema-plan.example.json');
    const planningPayload = join(projectDir, 'dataverse', 'planning-payload.json');
    if (existsSync(schemaPlanExample) && !existsSync(planningPayload)) {
      copyFileSync(schemaPlanExample, planningPayload);
      logger.ok('dataverse/planning-payload.json seeded from schema plan example');
    }

    const seedResult = runSafe(process.execPath, ['scripts/seed-prototype-assets.mjs', 'dataverse/planning-payload.json'], { cwd: projectDir });
    if (seedResult !== null) {
      logger.ok('Prototype assets seeded from dataverse/planning-payload.json');
    } else {
      logger.warn('Prototype asset seeding failed. You can rerun it later with:');
      logger.line(`  cd ${projectDir}`);
      logger.line('  npm run prototype:seed');
    }

    logger.ok('Helper scripts copied');
  }

  const versionFile = join(rootDir, '.foundations-version.json');
  if (existsSync(versionFile)) {
    copyFileSync(versionFile, join(projectDir, '.foundations-version.json'));
    logger.ok('.foundations-version.json copied');
  }

  for (const f of ['.env.local', '.env', '.env.template']) {
    const src = join(rootDir, f);
    if (existsSync(src)) {
      copyFileSync(src, join(projectDir, f));
      logger.ok(`${f} copied`);
    }
  }
}