// Step 7 - Scaffold. Browser-native long-running scaffold with live logs.
import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const SCAFFOLD = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'scaffold-foundations.mjs')).href);
const SHELL = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);

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
      ? spawn(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', command], { cwd: opts.cwd || ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('sh', ['-c', command], { cwd: opts.cwd || ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => log.info(String(chunk).trimEnd()));
    child.stderr.on('data', (chunk) => log.warn(String(chunk).trimEnd()));
    child.on('error', (error) => {
      log.fail(`Failed to start command: ${error.message}`);
      resolvePromise(false);
    });
    child.on('close', (code) => resolvePromise(code === 0));
  });
}

function runFile(log, file, args, opts = {}) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${file} ${args.join(' ')}`);
    const child = SHELL.spawnSafe(file, args, { cwd: opts.cwd || ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => log.info(String(chunk).trimEnd()));
    child.stderr.on('data', (chunk) => log.warn(String(chunk).trimEnd()));
    child.on('error', (error) => {
      log.fail(`Failed to start ${file}: ${error.message}`);
      resolvePromise(false);
    });
    child.on('close', (code) => resolvePromise(code === 0));
  });
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
    rootDir: ROOT_DIR,
    opBin: process.env.OP_BIN || (hasCommand('op') ? 'op' : null),
    source: state.AUTH_MODE || 'auto',
  });
}

function verifyPacTarget({ pac, projectDir, state, credentialValues, profileType, requirePowerConfig, requirePowerConfigTarget }) {
  return PAC_TARGET.selectAndVerifyPacProfile({
    pac,
    rootDir: ROOT_DIR,
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
    requireCredentialMatch: true,
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

Connector binding is intentionally deferred until the prototype is stable. Use WizardUX step 8 or \`pac code add-data-source\` when you are ready for real data.
`, 'utf-8');
}

export default {
  meta: {
    number: 7,
    title: 'Scaffold the Code App',
    description: 'Generate the project, install dependencies, register with Power Platform, and run smoke tests.',
    canRunInBrowser: true,
  },

  questions(state) {
    const rootDefault = state.PROJECT_DIR || ROOT_DIR;
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
      },
      {
        id: 'PUSH_INITIAL_COMMIT',
        type: 'confirm',
        label: 'Push the generated scaffold to that Git remote now',
        help: 'Optional. Turn this on only if the remote URL above points to an empty repo you can push to. Otherwise leave it off and push manually later.',
        defaultValue: false,
        hideIf: { id: 'GIT_REMOTE', equals: '' },
      },
    ];
  },

  async apply(answers, state, log) {
    const appName = state.APP_NAME || 'Power Apps Code App';
    const projectDir = resolve(String(answers.PROJECT_DIR || ROOT_DIR).trim());
    const foundationLogger = makeFoundationLogger(log);

    if (existsSync(projectDir) && readdirSync(projectDir).length > 0 && answers.CONTINUE_NONEMPTY !== true) {
      throw new Error(`${projectDir} is not empty. Confirm that you want to continue, or choose a different path.`);
    }

    mkdirSync(projectDir, { recursive: true });
    log.ok(`Project path: ${projectDir}`);

    const dirNotEmpty = existsSync(projectDir) && readdirSync(projectDir).length > 0;
    log.info('Downloading starter template...');
    const templateArgs = ['--yes', 'degit', 'microsoft/PowerAppsCodeApps/templates/starter', projectDir];
    if (dirNotEmpty) templateArgs.push('--force');
    const templateOk = await runFile(log, toolCommand('npx'), templateArgs, { cwd: ROOT_DIR });
    if (!templateOk) {
      log.warn('Template download failed. Creating minimal project structure instead.');
      SCAFFOLD.createMinimalProject(projectDir, appName);
    } else {
      log.ok('Starter template downloaded');
    }

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
    if (await runFile(log, toolCommand('npm'), ['install'], { cwd: projectDir })) log.ok('Base dependencies installed');
    else log.warn('Base dependency install reported errors; continuing to merge required packages.');

    const prodPkgs = [
      'react@^18.3.1', 'react-dom@^18.3.1', '@fluentui/react-components@^9.56.0',
      '@tanstack/react-query@^5.62.0', 'react-router-dom@^7.1.0',
      '@microsoft/power-apps@^1.0.3', 'concurrently@^9.1.0',
    ];
    if (await runFile(log, toolCommand('npm'), ['install', ...prodPkgs], { cwd: projectDir })) log.ok('Runtime packages installed');
    else log.warn('Some runtime packages failed to install.');

    const devPkgs = [
      'typescript@^5.7.0', '@types/react@^18.3.12', '@types/react-dom@^18.3.1',
      'vite@^5.4.0', '@vitejs/plugin-react@^4.3.0',
      'vitest@^2.1.0', '@testing-library/react@^16.1.0', '@testing-library/jest-dom@^6.6.0', 'jsdom@^25.0.0',
      '@playwright/test@^1.49.0',
      'eslint@^9.16.0', 'typescript-eslint@^8.18.0', '@eslint/js@^9.16.0', 'eslint-plugin-react-hooks@^5.1.0',
      'prettier@^3.4.0',
    ];
    if (await runFile(log, toolCommand('npm'), ['install', '-D', ...devPkgs], { cwd: projectDir })) log.ok('Dev packages installed');
    else log.warn('Some dev packages failed to install.');

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
    SCAFFOLD.copyFoundationFiles(ROOT_DIR, projectDir, foundationLogger);

    const pac = SHELL.pacPath();
    if (pac) {
      log.info('Registering Code App in Power Platform...');
      const credentialValues = resolveCredentialValues(state);
      verifyPacTarget({ pac, projectDir, state, credentialValues, profileType: 'spn', requirePowerConfig: false, requirePowerConfigTarget: false });
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
        if (!existsSync(powerConfigPath)) throw new Error('pac code init completed without creating power.config.json. Check the PAC output above, then retry Step 7 after resolving that PAC error.');
      }
      verifyPacTarget({ pac, projectDir, state, credentialValues, profileType: 'spn', requirePowerConfig: true, requirePowerConfigTarget: true });
      log.ok('power.config.json created and verified');
    } else {
      log.warn('PAC CLI not found; skipping pac code init.');
    }

    log.info('Connector binding is deferred to step 8 after prototype validation.');

    log.info('Running smoke tests...');
    if (await runCommand(log, 'npm run test:smoke', { cwd: projectDir })) log.ok('Smoke tests passed');
    else log.warn('Smoke tests did not pass. Continue development, then rerun npm run test:smoke.');

    if (existsSync(join(projectDir, '.git'))) {
      log.ok('Git repo already initialized');
    } else if (await runCommand(log, 'git init -b main', { cwd: projectDir })) {
      log.ok('Git repo initialized');
    } else {
      log.warn('git init failed');
    }

    const existingOrigin = SHELL.run('git remote get-url origin', { cwd: projectDir }) || '';
    const remoteUrl = String(answers.GIT_REMOTE || '').trim();
    let finalRemoteUrl = existingOrigin;
    if (existingOrigin && /PAppsCAFoundations/i.test(existingOrigin)) {
      SHELL.run('git remote remove origin', { cwd: projectDir });
      finalRemoteUrl = '';
    }
    if (remoteUrl && remoteUrl !== finalRemoteUrl) {
      SHELL.run('git remote remove origin', { cwd: projectDir });
      SHELL.run(`git remote add origin "${remoteUrl}"`, { cwd: projectDir });
      finalRemoteUrl = remoteUrl;
      log.ok(`Remote origin set to ${remoteUrl}`);
    } else if (finalRemoteUrl) {
      log.ok(`Remote origin: ${finalRemoteUrl}`);
    }

    writeProjectReadme(projectDir, state);
    log.ok('Project README generated');

    await runCommand(log, 'git add -A', { cwd: projectDir });
    if (await runCommand(log, 'git commit -m "Initial scaffold from PAppsCAFoundations wizard" --quiet', { cwd: projectDir })) {
      log.ok('Initial commit created');
    } else {
      log.warn('Initial commit skipped or failed. Git user.name/user.email may not be configured, or there may be no changes.');
    }

    if (finalRemoteUrl && answers.PUSH_INITIAL_COMMIT === true) {
      if (await runCommand(log, 'git push -u origin main', { cwd: projectDir })) log.ok('Pushed to origin/main');
      else log.warn('Push failed. You can push later with git push -u origin main.');
    }

    return {
      stateUpdate: {
        PROJECT_DIR: projectDir,
        GIT_REMOTE: finalRemoteUrl || state.GIT_REMOTE || '',
      },
      completedStep: 7,
    };
  },
};
