// Step 8 - Scaffold. Browser-native long-running scaffold with live logs.
import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(__dirname, '..', '..', '..');
const SCAFFOLD = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'scaffold-foundations.mjs')).href);
const SHELL = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(PACKAGE_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);

function makeFoundationLogger(log) {
  return {
    line: (message = '') => log.info(message),
    ok: (message) => log.ok(message),
    warn: (message) => log.warn(message),
    info: (message) => log.info(message),
  };
}

function runCommand(log, command, opts = {}) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${command}`);
    const child = process.platform === 'win32'
      ? spawn(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', command], { cwd: opts.cwd || process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('sh', ['-c', command], { cwd: opts.cwd || process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => log.info(String(chunk).trimEnd()));
    // Subprocess stderr is normal progress/notices, not an error signal. Tag it
    // info so a successful step doesn't raise the "finished with warnings"
    // banner; genuine failure is detected from the non-zero exit code.
    child.stderr.on('data', (chunk) => log.info(String(chunk).trimEnd()));
    child.on('error', (error) => {
      log.fail(`Failed to start command: ${error.message}`);
      resolvePromise(false);
    });
    child.on('close', (code) => resolvePromise(code === 0));
  });
}

function runFile(log, file, args, opts = {}) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${SHELL.formatCommandForLog(file, args)}`);
    const spawnOpts = { cwd: opts.cwd || process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] };
    if (opts.env) spawnOpts.env = opts.env;
    const child = SHELL.spawnSafe(file, args, spawnOpts);
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    let output = '';
    // Subprocesses (pnpm, npm, git, pac) all write normal progress, update
    // notices, and deprecation warnings to stderr. Tag that chatter as info,
    // not warn — otherwise a fully successful step raises the yellow
    // "finished with warnings" banner. Genuine failure is signalled by a
    // non-zero exit code, which the caller already handles.
    child.stdout.on('data', (chunk) => { output += chunk; log.info(String(chunk).trimEnd()); });
    child.stderr.on('data', (chunk) => { output += chunk; log.info(String(chunk).trimEnd()); });
    child.on('error', (error) => {
      log.fail(`Failed to start ${file}: ${error.message}`);
      resolvePromise(false);
    });
    child.on('close', (code) => {
      // pnpm v11 exits non-zero on ERR_PNPM_IGNORED_BUILDS even when the build
      // scripts are pre-approved in package.json — the install itself still
      // completed. Treat that specific case as success so it doesn't surface a
      // false failure. Any other non-zero exit is a real failure.
      if (code !== 0 && opts.tolerateIgnoredBuilds && /ERR_PNPM_IGNORED_BUILDS/.test(output)) {
        log.info('Note: pnpm deferred some optional build scripts (ERR_PNPM_IGNORED_BUILDS). Dependencies installed successfully; this is safe to ignore.');
        resolvePromise(true);
        return;
      }
      resolvePromise(code === 0);
    });
  });
}

// Build a noisy-but-reassuring env for `npm install` / `pnpm install` so the
// SSE-piped output stops looking frozen during long cold installs:
//  - `npm_config_loglevel=http` is added at the CLI level (so it shows the
//    `npm http fetch ...` per-package line).
//  - `npm_config_progress=true` keeps progress hints on (npm still suppresses
//    its TTY bar but at least won't strip extra hints).
//  - `FORCE_COLOR=0` keeps ANSI escapes out of the SSE stream.
//  - `CI` is unset to avoid npm dropping output thinking it is in CI.
function installEnv() {
  const env = { ...process.env, npm_config_progress: 'true', FORCE_COLOR: '0' };
  delete env.CI;
  return env;
}

// Detect whether `pnpm` is available on PATH. pnpm prints staged progress
// (`Progress: resolved X, reused Y, downloaded Z`) even in non-TTY mode and
// is materially faster on a cold cache, so prefer it when present.
function detectPnpm() {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['pnpm'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function runInstall(log, { stage, label, projectDir, pnpm, mode, packages = [], workspaceRoot = false }) {
  log.info('');
  log.info(`[${stage}] ${label} (typically 30s–3min on a cold cache)…`);
  const bin = pnpm
    ? toolCommand('pnpm')
    : toolCommand('npm');
  // When scaffolding into a pnpm workspace root (pnpm-workspace.yaml present),
  // `pnpm add` aborts with ERR_PNPM_ADDING_TO_ROOT unless -w is passed. See
  // issue #76.
  const rootFlag = pnpm && workspaceRoot ? ['-w'] : [];
  const baseArgs = pnpm
    ? (mode === 'base' ? ['install'] : mode === 'dev' ? ['add', '-D', ...rootFlag, ...packages] : ['add', ...rootFlag, ...packages])
    : (mode === 'base' ? ['install'] : mode === 'dev' ? ['install', '-D', ...packages] : ['install', ...packages]);
  // Freshness of the first-party @pacaf/* packages is guaranteed by pinning
  // their exact latest version at spec-build time (see
  // SCAFFOLD.freshDevPackageSpecs / resolveFirstPartyLatest), NOT by a
  // package-manager flag. `--prefer-online` is npm-only — pnpm aborts on it —
  // so it must never be passed to the actual install. See issue #81 follow-up.
  const noisyArgs = pnpm
    ? ['--reporter=append-only', ...baseArgs]
    : ['--loglevel=http', '--no-audit', '--no-fund', ...baseArgs];
  return runFile(log, bin, noisyArgs, { cwd: projectDir, env: installEnv(), tolerateIgnoredBuilds: Boolean(pnpm) });
}

function toolCommand(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function hasCommand(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function resolveCredentialValues(state) {
  return PAC_TARGET.resolveCredentialValues({
    rootDir: state.PROJECT_DIR || process.cwd(),
    opBin: process.env.OP_BIN || (hasCommand('op') ? 'op' : null),
    source: state.AUTH_MODE || 'auto',
  });
}

function verifyPacTarget({ pac, projectDir, state, credentialValues, profileType, requirePowerConfig, requirePowerConfigTarget }) {
  return PAC_TARGET.selectAndVerifyPacProfile({
    pac,
    rootDir: projectDir || process.cwd(),
    wizardState: {
      WIZARD_TARGET_ENV: state.WIZARD_TARGET_ENV || 'dev',
      PP_ENV_DEV: state.PP_ENV_DEV || '',
      PP_ENV_TEST: state.PP_ENV_TEST || '',
      PP_ENV_PROD: state.PP_ENV_PROD || '',
    },
    targetKey: state.WIZARD_TARGET_ENV || 'dev',
    profileType,
    credentialValues,
    powerConfigPath: join(projectDir, 'power.config.json'),
    requireCredentialMatch: credentialValues !== null,
    requirePowerConfig,
    requirePowerConfigTarget,
  });
}

function writeProjectReadme(projectDir, state) {
  const appName = state.APP_NAME || 'Power Apps Code App';
  const prefix = state.PUBLISHER_PREFIX || 'yourprefix';
  const solutionName = state.SOLUTION_DISPLAY_NAME || state.SOLUTION_UNIQUE_NAME || appName;
  const envRows = [
    state.PP_ENV_DEV ? `| Dev | ${state.PP_ENV_DEV} |` : '',
    state.PP_ENV_TEST ? `| Test | ${state.PP_ENV_TEST} |` : '',
    state.PP_ENV_PROD ? `| Prod | ${state.PP_ENV_PROD} |` : '',
  ].filter(Boolean).join('\n');

  writeFileSync(join(projectDir, 'README.md'), `# ${appName}

A Power Apps Code App built with React, Fluent UI v9, TanStack Query, and TypeScript.

## Development

\`\`\`bash
npm install
npm run dev:local
npm run prototype:seed
npm run dev
\`\`\`

## Build and Deploy

\`\`\`bash
npm run build
pac code push
\`\`\`

## Power Platform

| Property | Value |
|----------|-------|
| Solution | ${solutionName} |
| Publisher Prefix | \`${prefix}\` |

| Environment | URL |
|-------------|-----|
${envRows}

Connector binding is intentionally deferred until the prototype is stable. Use WizardUX step 9 or \`pac code add-data-source\` when you are ready for real data.
`, 'utf-8');
}

export default {
  meta: {
    number: 8,
    title: 'Scaffold the Code App',
    description: 'Generate the project, install dependencies, register with Power Platform, and run smoke tests.',
    canRunInBrowser: true,
  },

  questions(state) {
    const rootDefault = state.PROJECT_DIR || process.cwd();
    const existingOrigin = SHELL.run('git remote get-url origin', { cwd: rootDefault }) || '';
    const needsRemote = !existingOrigin || /PAppsCAFoundations/i.test(existingOrigin);
    return [
      {
        id: 'PROJECT_DIR',
        type: 'text',
        label: 'Project path',
        help: 'Use the repo root for in-place scaffold, or enter an absolute path for a separate app folder.',
        defaultValue: rootDefault,
        required: true,
      },
      {
        id: 'CONTINUE_NONEMPTY',
        type: 'confirm',
        label: 'Continue if the project directory is not empty',
        help: 'Existing files may be overwritten. Leave this on when scaffolding into this template-derived repo.',
        defaultValue: true,
        advanced: true,
      },
      {
        id: 'GIT_REMOTE',
        type: 'text',
        label: 'Git remote URL for this app repository',
        help: needsRemote
          ? 'Optional. Paste the GitHub/Azure DevOps remote for the app you are creating, such as https://github.com/org/repo.git. Leave blank to keep everything local for now.'
          : 'Optional. The existing origin will be kept unless you enter a replacement remote URL.',
        defaultValue: needsRemote ? '' : existingOrigin,
        why: [
          'This is only for source control. It does not affect Power Platform, Dataverse, or PAC auth.',
          'Use it when you already created an empty repository for the new app and want the wizard to set it as git origin.',
          'Leave it blank if you have not created a repo yet or do not want the wizard to touch git remotes.',
        ].join('\n'),
        advanced: true,
      },
      {
        id: 'PUSH_INITIAL_COMMIT',
        type: 'confirm',
        label: 'Push the generated scaffold to that Git remote now',
        help: 'Optional. Turn this on only if the remote URL above points to an empty repo you can push to. Otherwise leave it off and push manually later.',
        defaultValue: false,
        hideIf: { id: 'GIT_REMOTE', equals: '' },
        advanced: true,
      },
    ];
  },

  async apply(answers, state, log) {
    const appName = state.APP_NAME || 'Power Apps Code App';
    const projectDir = resolve(String(answers.PROJECT_DIR || process.cwd()).trim());
    const foundationLogger = makeFoundationLogger(log);

    if (existsSync(projectDir) && readdirSync(projectDir).length > 0 && answers.CONTINUE_NONEMPTY !== true) {
      throw new Error(`${projectDir} is not empty. Confirm that you want to continue, or choose a different path.`);
    }

    mkdirSync(projectDir, { recursive: true });
    log.ok(`Project path: ${projectDir}`);

    // Write the starter project locally. We own this payload end-to-end
    // (createMinimalProject + writeConfig + writeStarterFiles below) and do
    // not fetch from an upstream template repo: that path shipped surplus
    // files (e.g. src/router.tsx with BrowserRouter, an unrelated setup-wizard
    // app) that broke fresh scaffolds whenever upstream reshaped itself.
    // See issues #47, #63, and the follow-up that removed degit entirely.
    log.info('Writing starter project...');
    SCAFFOLD.createMinimalProject(projectDir, appName);
    log.ok('Starter project written');
    SCAFFOLD.normalizePackageJsonDependencies(projectDir, foundationLogger);

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
      log.ok('vite-env.d.ts created');
    }

    log.info('Installing dependencies...');
    const pnpm = detectPnpm();
    if (pnpm) {
      log.info('Detected pnpm — using it for faster installs and shared dependency cache.');
    } else {
      log.info('pnpm not found — using npm. Tip: `corepack enable && corepack prepare pnpm@latest --activate` makes Step 8 noticeably faster.');
    }

    // pnpm refuses `pnpm add` at a workspace root (pnpm-workspace.yaml present)
    // without -w, which would silently fail the runtime/dev installs. See issue #76.
    const workspaceRoot = pnpm && SCAFFOLD.isPnpmWorkspaceRoot(projectDir);
    if (workspaceRoot) {
      log.warn('This is a pnpm workspace root (pnpm-workspace.yaml present) — adding packages with --workspace-root (-w).');
    }

    if (await runInstall(log, { stage: '1/3', label: 'Installing base dependencies', projectDir, pnpm, mode: 'base', workspaceRoot })) {
      log.ok('[1/3] Base dependencies installed');
    } else {
      log.warn('[1/3] Base dependency install reported errors; continuing to merge required packages.');
    }

    const prodPkgs = SCAFFOLD.packageSpecs(SCAFFOLD.REQUIRED_RUNTIME_PACKAGES);
    if (await runInstall(log, { stage: '2/3', label: 'Installing runtime packages (React, Fluent UI, TanStack Query, SDK)', projectDir, pnpm, mode: 'prod', packages: prodPkgs, workspaceRoot })) {
      log.ok('[2/3] Runtime packages installed');
    } else {
      log.warn('[2/3] Some runtime packages failed to install.');
    }

    const devPkgs = SCAFFOLD.freshDevPackageSpecs();
    if (await runInstall(log, { stage: '3/3', label: 'Installing dev dependencies (Vitest, ESLint, Playwright, @pacaf/scripts)', projectDir, pnpm, mode: 'dev', packages: devPkgs, workspaceRoot })) {
      log.ok('[3/3] Dev packages installed');
    } else {
      log.warn('[3/3] Some dev packages failed to install.');
    }

    SCAFFOLD.writeConfig(projectDir, foundationLogger);
    SCAFFOLD.mergePackageJsonScripts(projectDir, foundationLogger);

    for (const folder of [
      'src/components', 'src/pages', 'src/hooks', 'src/generated', 'src/utils', 'src/types', 'src/constants', 'src/mockData',
      'dataverse', 'tests/e2e', 'tests/setup', 'tests/fixtures', '.github/instructions', '.github/workflows', 'solution',
    ]) {
      mkdirSync(join(projectDir, folder), { recursive: true });
    }
    log.ok('Folder structure created');

    SCAFFOLD.writeStarterFiles(projectDir, appName, foundationLogger);
    SCAFFOLD.copyFoundationFiles(PACKAGE_DIR, projectDir, foundationLogger);

    const pac = SHELL.pacPath();
    if (pac) {
      log.info('Registering Code App in Power Platform...');
      const isUserAuth = (state.AUTH_PROFILE_TYPE || 'user') === 'user';
      const credentialValues = isUserAuth ? null : resolveCredentialValues(state);
      try {
        verifyPacTarget({ pac, projectDir, state, credentialValues, profileType: 'user', requirePowerConfig: false, requirePowerConfigTarget: false });
      } catch (error) {
        throw new Error(`${error.message}\n\npac code init requires the repo-scoped interactive PAC profile. Return to Step 4, enable user profile creation, complete browser/device sign-in, then retry Step 8.`);
      }
      const powerConfigPath = join(projectDir, 'power.config.json');
      let skipInit = false;
      if (existsSync(powerConfigPath)) {
        const existing = PAC_TARGET.loadPowerConfigInfo(powerConfigPath);
        const whoOut = SHELL.runSafe(pac, ['org', 'who']);
        const whoInfo = whoOut ? PAC_TARGET.parsePacOrgWho(whoOut) : null;
        if (existing.environmentId && whoInfo?.environmentId && existing.environmentId === whoInfo.environmentId.toLowerCase()) {
          skipInit = true;
          log.ok('power.config.json already matches active environment; skipping pac code init');
        } else {
          const quarantinePath = PAC_TARGET.quarantinePowerConfig(powerConfigPath);
          log.warn(`Quarantined stale power.config.json at ${quarantinePath}`);
        }
      }
      if (!skipInit) {
        const initOk = await runFile(log, pac, [
          'code', 'init',
          '--displayName', appName,
          '--buildPath', './dist',
          '--fileEntryPoint', 'index.html',
        ], { cwd: projectDir });
        if (!initOk) throw new Error('pac code init failed. Check the live output above, then retry this step.');
        if (!existsSync(powerConfigPath)) throw new Error('pac code init completed without creating power.config.json. Check the PAC output above, then retry Step 8 after resolving that PAC error.');
        const repair = PAC_TARGET.repairPowerConfigDisplayNames(powerConfigPath);
        if (repair.changed) log.warn(`Repaired quoted display name fields in power.config.json: ${repair.fields.join(', ')}`);
      }
      verifyPacTarget({ pac, projectDir, state, credentialValues, profileType: 'user', requirePowerConfig: true, requirePowerConfigTarget: true });
      log.ok('power.config.json created and verified');
    } else {
      log.warn('PAC CLI not found; skipping pac code init.');
    }

    log.info('Connector binding is deferred to step 9 after prototype validation.');

    log.info('Running smoke tests...');
    if (await runCommand(log, 'npm run test:smoke', { cwd: projectDir })) log.ok('Smoke tests passed');
    else log.warn('Smoke tests did not pass. Continue development, then rerun npm run test:smoke.');

    if (existsSync(join(projectDir, '.git'))) {
      log.ok('Git repo already initialized');
    } else if (await runFile(log, 'git', ['init', '-b', 'main'], { cwd: projectDir })) {
      log.ok('Git repo initialized');
    } else {
      log.warn('git init failed');
    }

    const existingOrigin = SHELL.runSafe('git', ['remote', 'get-url', 'origin'], { cwd: projectDir }) || '';
    const remoteUrl = String(answers.GIT_REMOTE || '').trim();
    let finalRemoteUrl = existingOrigin;
    if (existingOrigin && /PAppsCAFoundations/i.test(existingOrigin)) {
      SHELL.runSafe('git', ['remote', 'remove', 'origin'], { cwd: projectDir });
      finalRemoteUrl = '';
    }
    if (remoteUrl && remoteUrl !== finalRemoteUrl) {
      SHELL.runSafe('git', ['remote', 'remove', 'origin'], { cwd: projectDir });
      SHELL.runSafe('git', ['remote', 'add', 'origin', remoteUrl], { cwd: projectDir });
      finalRemoteUrl = remoteUrl;
      log.ok(`Remote origin set to ${remoteUrl}`);
    } else if (finalRemoteUrl) {
      log.ok(`Remote origin: ${finalRemoteUrl}`);
    }

    writeProjectReadme(projectDir, state);
    log.ok('Project README generated');

    await runFile(log, 'git', ['add', '-A'], { cwd: projectDir });
    if (await runFile(log, 'git', ['commit', '-m', 'Initial scaffold from PAppsCAFoundations wizard', '--quiet'], { cwd: projectDir })) {
      log.ok('Initial commit created');
    } else {
      log.warn('Initial commit skipped or failed. Git user.name/user.email may not be configured, or there may be no changes.');
    }

    if (finalRemoteUrl && answers.PUSH_INITIAL_COMMIT === true) {
      if (await runFile(log, 'git', ['push', '-u', 'origin', 'main'], { cwd: projectDir })) log.ok('Pushed to origin/main');
      else log.warn('Push failed. You can push later with git push -u origin main.');
    }

    return {
      stateUpdate: {
        PROJECT_DIR: projectDir,
        GIT_REMOTE: finalRemoteUrl || state.GIT_REMOTE || '',
      },
      completedStep: 8,
    };
  },
};
