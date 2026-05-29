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
  // The generated src/App.tsx imports icons from @fluentui/react-icons, so it
  // must be a runtime dependency. Without it the smoke test fails with
  // "Failed to resolve import \"@fluentui/react-icons\" from src/App.tsx".
  // See issue #76.
  '@fluentui/react-icons': '^2.0.270',
  '@tanstack/react-query': '^5.62.0',
  'react-router-dom': '^7.1.0',
  '@microsoft/power-apps': '^1.0.3',
  concurrently: '^9.1.0',
};

// Packages whose postinstall build scripts pnpm blocks by default. pnpm v9+
// reads `pnpm.onlyBuiltDependencies` from package.json and runs the build
// scripts of exactly these packages without the interactive
// `pnpm approve-builds` prompt. esbuild is Vite's bundler and keytar/node-pty
// back PAC auth credential storage, so their build scripts must run for the
// app to build and deploy. See issue #76.
export const PNPM_ALLOWED_BUILD_DEPENDENCIES = [
  '@azure/msal-node-extensions',
  '@azure/msal-node-runtime',
  'esbuild',
  'keytar',
  'node-pty',
];

// Devs deps are computed dynamically so forks can rebrand the @pacaf scope.
export function buildRequiredDevPackages(config = loadPacafConfig()) {
  return {
    [scopedPackageName('scripts', config)]: '^3.0.0',
    [scopedPackageName('agent-instructions', config)]: '^3.0.0',
    typescript: '5.7.3',
    '@types/react': '^18.3.12',
    '@types/react-dom': '^18.3.1',
    vite: '^5.4.0',
    '@vitejs/plugin-react': '^4.3.0',
    // Tailwind v4 split the PostCSS plugin in two: `tailwindcss` is the core,
    // and `@tailwindcss/vite` is the Vite plugin that wires `@import "tailwindcss"`
    // into the build. Both are required — without the Vite plugin, the
    // `@import` directive in `src/index.css` is treated as a literal CSS
    // `@import` and silently produces an empty stylesheet. See issue #48 and
    // `.github/instructions/01-scaffold.instructions.md`.
    tailwindcss: '^4.0.0',
    '@tailwindcss/vite': '^4.0.0',
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

// Detect whether `dir` (or any ancestor) is a pnpm workspace root, i.e. it
// contains a `pnpm-workspace.yaml`. When scaffolding into such a directory,
// plain `pnpm add` aborts with ERR_PNPM_ADDING_TO_ROOT and the `-w` /
// `--workspace-root` flag is required. See issue #76.
export function isPnpmWorkspaceRoot(dir) {
  let current = dir;
  // Walk up to the filesystem root.
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return true;
    const parent = dirname(current);
    if (parent === current) return false;
    current = parent;
  }
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

  // Pre-approve pnpm-blocked build scripts (esbuild, keytar, node-pty, …) so
  // installs don't stall on the interactive `pnpm approve-builds` step. Merge
  // with any existing list rather than clobbering it. See issue #76.
  pkg.pnpm = pkg.pnpm || {};
  pkg.pnpm.onlyBuiltDependencies = Array.from(new Set([
    ...(pkg.pnpm.onlyBuiltDependencies || []),
    ...PNPM_ALLOWED_BUILD_DEPENDENCIES,
  ]));

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
    // Pre-approve the build scripts pnpm blocks by default so installs don't
    // require the interactive `pnpm approve-builds` step. See issue #76.
    pnpm: {
      onlyBuiltDependencies: PNPM_ALLOWED_BUILD_DEPENDENCIES,
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
      types: ['vitest/globals'],
    },
    include: ['src/**/*', 'tests/**/*', '.power/**/*'],
    exclude: ['node_modules', 'dist'],
  }, null, 2) + '\n');
  logger.ok('tsconfig.json');

  logger.line('Writing vite.config.ts...');
  writeFileSync(join(dir, 'vite.config.ts'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  // The Tailwind v4 Vite plugin is REQUIRED — without it, the
  // \`@import "tailwindcss"\` directive in src/index.css is treated as a
  // literal CSS @import and silently produces an empty stylesheet. The app
  // will render but every element will be unstyled. See issue #48.
  plugins: [react(), tailwindcss()],
  server: { port: 3000 },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
}));
`);
  logger.ok('vite.config.ts (port 3000, Tailwind v4 plugin registered)');

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
// HashRouter (NOT BrowserRouter) is required for Code Apps. The Power Apps host
// owns the URL path (apps.powerapps.com/play/e/<env>/app/<app>/...) so only the
// fragment is reliably owned by the iframe. BrowserRouter 404s on first load
// and on every deep link. Do not change this — see issue #47 and
// .github/instructions/01-scaffold.instructions.md.
import { HashRouter } from 'react-router-dom';
import { App } from './App';
// Required: imports the Tailwind v4 stylesheet so the CSS pipeline emits a
// non-empty chunk. Without this line the app renders but every element is
// unstyled. See issue #48 and .github/instructions/01-scaffold.instructions.md.
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FluentProvider theme={webLightTheme}>
        <HashRouter>
          <App />
        </HashRouter>
      </FluentProvider>
    </QueryClientProvider>
  </StrictMode>,
);
`);
  logger.ok('src/main.tsx');

  // src/index.css — Tailwind v4 entrypoint. The @tailwindcss/vite plugin
  // (registered in vite.config.ts) processes this @import at build time
  // and emits the actual utility classes. Without the plugin the @import
  // is treated as a literal CSS @import and resolves to nothing — see #48.
  const indexCssPath = join(dir, 'src', 'index.css');
  if (!existsSync(indexCssPath)) {
    writeFileSync(indexCssPath, `@import "tailwindcss";\n`);
    logger.ok('src/index.css');
  }

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

  writeFileSync(join(dir, 'src', 'App.tsx'), `import { useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Subtitle1,
  Subtitle2,
  Text,
  Title1,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowLeft24Regular,
  Clipboard24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';

type Path = null | 'new-tables' | 'existing-tables';

// ── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    gap: tokens.spacingVerticalXXL,
    boxSizing: 'border-box',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: tokens.spacingVerticalM,
    maxWidth: '720px',
  },
  burst: {
    fontSize: '72px',
    lineHeight: '1',
    display: 'block',
    animationName: {
      '0%': { transform: 'scale(0.5) rotate(-10deg)', opacity: '0' },
      '60%': { transform: 'scale(1.25) rotate(4deg)', opacity: '1' },
      '80%': { transform: 'scale(0.95) rotate(-2deg)' },
      '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
    },
    animationDuration: '0.9s',
    animationFillMode: 'both',
    animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  appName: {
    color: tokens.colorBrandForeground1,
  },
  tagline: {
    color: tokens.colorNeutralForeground2,
    maxWidth: '600px',
  },
  question: {
    color: tokens.colorNeutralForeground1,
    marginTop: tokens.spacingVerticalL,
  },
  paths: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingHorizontalL,
    width: '100%',
    maxWidth: '800px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
    cursor: 'pointer',
    transitionProperty: 'box-shadow, transform',
    transitionDuration: '0.2s',
    ':hover': {
      boxShadow: tokens.shadow28,
      transform: 'translateY(-2px)',
    },
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  cardEmoji: {
    fontSize: '32px',
    lineHeight: '1',
  },
  cardBody: {
    color: tokens.colorNeutralForeground2,
  },
  // Next-steps detail view
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    width: '100%',
    maxWidth: '800px',
  },
  stepCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow8,
  },
  stepNumber: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightBold,
    fontSize: tokens.fontSizeBase300,
    flexShrink: 0,
  },
  stepHead: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  stepBody: {
    color: tokens.colorNeutralForeground2,
    paddingLeft: '44px',
  },
  prompt: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderLeftStyle: 'solid',
    borderLeftWidth: '3px',
    borderLeftColor: tokens.colorBrandStroke1,
    marginLeft: '44px',
    position: 'relative',
  },
  promptLabel: {
    display: 'block',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXS,
  },
  promptText: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground1,
  },
  copyButton: {
    position: 'absolute',
    top: tokens.spacingVerticalXS,
    right: tokens.spacingHorizontalXS,
  },
  backRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    maxWidth: '800px',
  },
  goldenPath: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusXLarge,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  step: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  arrow: {
    color: tokens.colorNeutralForeground4,
  },
  divider: {
    width: '100%',
    maxWidth: '800px',
  },
  footer: {
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
    maxWidth: '560px',
  },
});

// ── Copy-to-clipboard button ────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const styles = useStyles();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button
      className={styles.copyButton}
      appearance="subtle"
      size="small"
      icon={copied ? <Checkmark24Regular /> : <Clipboard24Regular />}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      onClick={handleCopy}
    />
  );
}

// ── Step card ───────────────────────────────────────────────────────────────

interface StepProps {
  number: number;
  title: string;
  description: string;
  agentPrompt?: string;
}

function StepItem({ number, title, description, agentPrompt }: StepProps) {
  const styles = useStyles();

  return (
    <Card className={styles.stepCard}>
      <div className={styles.stepHead}>
        <span className={styles.stepNumber}>{number}</span>
        <Subtitle2>{title}</Subtitle2>
      </div>
      <Text className={styles.stepBody}>{description}</Text>
      {agentPrompt && (
        <div className={styles.prompt}>
          <span className={styles.promptLabel}>Paste this in your agent chat:</span>
          <Text className={styles.promptText}>{agentPrompt}</Text>
          <CopyButton text={agentPrompt} />
        </div>
      )}
    </Card>
  );
}

// ── Next steps: New tables (idea-first) ─────────────────────────────────────

function NewTablesSteps() {
  const styles = useStyles();

  return (
    <div className={styles.stepsContainer}>
      <div className={styles.hero}>
        <Title2>Building something new</Title2>
        <Text className={styles.tagline}>
          You have a business problem but no data model yet. Here is the path from idea
          to working app — each step feeds the next.
        </Text>
      </div>

      <StepItem
        number={1}
        title="Describe your business problem"
        description="Open VS Code, start a chat with your coding agent, and describe what you want to build in plain language. The agent will decompose your narrative into business dimensions — roles, workflows, approvals, data, and reporting — without jumping to implementation."
        agentPrompt="I want to build a [describe your app]. Help me plan it as a Power Apps Code App. Walk me through business problem decomposition first — don't jump to code."
      />

      <StepItem
        number={2}
        title="Grill the plan"
        description="Once the agent has a draft understanding, ask it to grill you. It will challenge your assumptions one question at a time, sharpen your terminology into a CONTEXT.md glossary, and surface decisions that need recording as ADRs. This is where fuzzy ideas become precise requirements."
        agentPrompt="Grill me on this plan. Challenge my assumptions one question at a time, sharpen the terminology, and build the CONTEXT.md glossary as we go."
      />

      <StepItem
        number={3}
        title="Generate the planning payload"
        description="When the scope is stable, the agent translates your refined narrative into a Dataverse planning payload — candidate tables, columns, relationships, and lifecycle states. Every entity traces back to a glossary term in CONTEXT.md."
        agentPrompt="The scope is stable. Translate it into a Dataverse planning payload. Make sure every entity traces back to a CONTEXT.md term."
      />

      <StepItem
        number={4}
        title="Build a clickable prototype"
        description="Before provisioning any Dataverse schema, the agent scaffolds a mock-data-backed prototype you can click through. This validates the UX against real business scenarios without touching your environment."
        agentPrompt="Build a clickable prototype against mock data so I can validate the UX before we create any Dataverse tables."
      />

      <StepItem
        number={5}
        title="Connect and deploy"
        description="Once the prototype validates, provision the Dataverse schema, register data sources with pac code add-data-source, swap mock providers for real ones, and deploy with pac code push."
        agentPrompt="The prototype looks good. Provision the Dataverse schema from the planning payload, register the data sources, and help me deploy."
      />

      <Divider className={styles.divider} />

      <div className={styles.goldenPath} role="list" aria-label="The golden path">
        <Text className={styles.step}>📋 Plan</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🔥 Grill</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🖼️ Prototype</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🔌 Connect</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🚀 Deploy</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🔁 Iterate</Text>
      </div>
    </div>
  );
}

// ── Next steps: Existing tables (data-first) ────────────────────────────────

function ExistingTablesSteps() {
  const styles = useStyles();

  return (
    <div className={styles.stepsContainer}>
      <div className={styles.hero}>
        <Title2>Building on existing data</Title2>
        <Text className={styles.tagline}>
          You already have Dataverse tables, a SharePoint list, or a data model. Here is the
          fastest path from existing schema to a working Code App.
        </Text>
      </div>

      <StepItem
        number={1}
        title="Discover your existing schema"
        description="Open VS Code and ask your agent to examine what already exists in your environment. It will query Dataverse metadata, identify tables, columns, relationships, and OOB entities you can reuse — so you don't accidentally recreate something that already exists."
        agentPrompt="Examine my Dataverse environment and show me what tables, columns, and relationships already exist. Highlight any OOB entities I should reuse instead of recreating."
      />

      <StepItem
        number={2}
        title="Build the glossary from your schema"
        description="The agent reverse-engineers a CONTEXT.md glossary from your existing tables — mapping Dataverse display names to canonical business terms. This grounds all future development in your actual data model."
        agentPrompt="Build a CONTEXT.md glossary from my existing Dataverse tables. Map each table and key column to a canonical business term."
      />

      <StepItem
        number={3}
        title="Grill for gaps"
        description="Even with existing tables, there are usually gaps — missing relationships, lifecycle states that aren't modelled, or new entities needed for the app you're building. The grilling process surfaces these before you write any UI code."
        agentPrompt="Grill me on whether my existing schema is complete for the app I want to build. Surface any gaps — missing tables, columns, relationships, or lifecycle states."
      />

      <StepItem
        number={4}
        title="Register data sources and prototype"
        description="Register your existing tables with pac code add-data-source to generate TypeScript services. Then scaffold a prototype backed by real data — you get a working app against your actual schema immediately."
        agentPrompt="Register my existing Dataverse tables as data sources and scaffold a prototype using the generated services. Show me real data from my environment."
      />

      <StepItem
        number={5}
        title="Iterate and deploy"
        description="Refine the UI, add any new tables the grilling process identified, and deploy. Each iteration follows the same loop — plan any changes, grill the plan, prototype, connect, deploy."
        agentPrompt="The prototype is working. Help me refine the UI and deploy to my environment with pac code push."
      />

      <Divider className={styles.divider} />

      <div className={styles.goldenPath} role="list" aria-label="The golden path">
        <Text className={styles.step}>🔍 Discover</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>📖 Glossary</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🔥 Grill</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🔌 Connect</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🚀 Deploy</Text>
        <Text className={styles.arrow}>→</Text>
        <Text className={styles.step}>🔁 Iterate</Text>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────

export function App() {
  const styles = useStyles();
  const [selectedPath, setSelectedPath] = useState<Path>(null);

  // ── Detail view (after a choice is made) ──
  if (selectedPath) {
    return (
      <div className={styles.root}>
        <div className={styles.backRow}>
          <Button
            appearance="subtle"
            icon={<ArrowLeft24Regular />}
            onClick={() => setSelectedPath(null)}
          >
            Back
          </Button>
        </div>

        {selectedPath === 'new-tables' ? <NewTablesSteps /> : <ExistingTablesSteps />}

        <Text className={styles.footer}>
          Every iteration brings you back to this loop. This screen is your pitstop, not
          your finish line. 🏁
        </Text>
      </div>
    );
  }

  // ── Choice screen ──
  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <span className={styles.burst} role="img" aria-label="Party popper">
          🎉
        </span>
        <Title1 as="h1">
          <span className={styles.appName}>${appName}</span> is live!
        </Title1>
        <Subtitle1 as="p" className={styles.tagline}>
          You just deployed a real Power Apps Code App to Dataverse. That is not a demo —
          that is a production-grade Microsoft 365 integration running on your tenant.
        </Subtitle1>

        <Title3 className={styles.question}>What are you building?</Title3>
      </div>

      <div className={styles.paths}>
        <Card
          className={styles.card}
          onClick={() => setSelectedPath('new-tables')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedPath('new-tables')}
        >
          <div className={styles.cardHead}>
            <span className={styles.cardEmoji}>🧠</span>
            <Title3>A brand new app</Title3>
          </div>
          <Text className={styles.cardBody}>
            I have a business problem or app idea. I need to design the data model, plan
            the workflows, and build from scratch.
          </Text>
        </Card>

        <Card
          className={styles.card}
          onClick={() => setSelectedPath('existing-tables')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setSelectedPath('existing-tables')}
        >
          <div className={styles.cardHead}>
            <span className={styles.cardEmoji}>📊</span>
            <Title3>An app on existing data</Title3>
          </div>
          <Text className={styles.cardBody}>
            I already have Dataverse tables, a SharePoint list, or a data model. I want to
            build a new Code App on top of what I have.
          </Text>
        </Card>
      </div>

      <Divider className={styles.divider} />

      <Text className={styles.footer}>
        Pick a path and we will show you exactly what to ask your coding agent in VS Code
        to get started. You can always come back.
      </Text>
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
import { render, screen, fireEvent } from '../tests/setup/test-utils';
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

  it('shows the celebratory launch screen', () => {
    render(<App />);
    expect(screen.getByText(/is live!/i)).toBeTruthy();
  });

  it('shows the path selection question', () => {
    render(<App />);
    expect(screen.getByText(/What are you building/i)).toBeTruthy();
  });

  it('navigates to new-tables steps when first card is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByText('A brand new app'));
    expect(screen.getByText('Building something new')).toBeTruthy();
    expect(screen.getByText('Describe your business problem')).toBeTruthy();
  });

  it('navigates to existing-tables steps when second card is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByText('An app on existing data'));
    expect(screen.getByText('Building on existing data')).toBeTruthy();
    expect(screen.getByText('Discover your existing schema')).toBeTruthy();
  });

  it('returns to the choice screen when Back is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByText('A brand new app'));
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText(/What are you building/i)).toBeTruthy();
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

  test('shows the celebratory launch screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/is live!/i)).toBeVisible();
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