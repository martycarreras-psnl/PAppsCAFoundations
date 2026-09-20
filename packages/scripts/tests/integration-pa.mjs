#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deploy, loadTarget, assertAccount, deploymentEnv, discoverEnvironment, assertEnvironmentDiscovery } from '../lib/pa-deploy.mjs';
import { readJson, projectPath, runPa, runBuild, SDK_VERSION } from '../lib/pa.mjs';

export function parseIntegrationArgs(args) {
  const options = { phase: 'connectors', execute: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`Duplicate argument ${flag}`);
    seen.add(flag);
    if (flag === '--execute') options.execute = true;
    else if (['--plan', '--phase', '--confirm-environment', '--confirm-app'].includes(flag)) {
      const value = args[++i];
      if (!value || value.startsWith('-')) throw new Error(`Missing value for ${flag}`);
      options[flag.slice(2)] = value;
    } else throw new Error(`Unsupported integration argument ${flag}`);
  }
  if (!options.plan) throw new Error('Provide a reviewed --plan file in a disposable consumer project.');
  if (!['connectors', 'user-publish', 'spn-publish'].includes(options.phase)) throw new Error('Unsupported integration phase.');
  return options;
}

export function runIntegration({ root = process.cwd(), options, env = process.env, pa = runPa, build = runBuild, discovery = discoverEnvironment }) {
  const plan = readJson(projectPath(root, options.plan, 'integration plan'));
  const auth = options.phase === 'spn-publish' ? 'spn' : 'user';
  const deployOptions = { target: plan.target || 'dev', auth, preflight: true, allowCreate: false };
  const { target } = loadTarget(root, deployOptions);
  deploy({ root, options: deployOptions, env, pa, build, discovery });
  if (!options.execute) return { executed: false, phase: options.phase, message: 'Offline validation only. No cloud calls, connector generation or publish performed.' };
  if (options['confirm-environment'] !== target.environmentId || options['confirm-app'] !== target.appId) {
    throw new Error('Execution requires exact --confirm-environment and --confirm-app matching the reviewed disposable target.');
  }
  if (options.phase !== 'connectors') return deploy({ root, options: { ...deployOptions, preflight: false }, env, pa, build, discovery });
  const childEnv = deploymentEnv(target, 'user', env);
  const dv = plan.dataverse;
  const connector = plan.connector;
  if (!/^[a-z][a-z0-9_]*$/i.test(dv?.table || '') || !/^shared_[a-z0-9_-]+$/i.test(connector?.connector || '') || !connector.connectionId) {
    throw new Error('Plan requires one Dataverse table and one non-Dataverse connector with an existing connectionId.');
  }
  if (connector.connector === 'shared_commondataserviceforapps') throw new Error('The second connector must be non-Dataverse.');
  const files = [dv, connector].flatMap(source => {
    if (!Array.isArray(source.generatedFiles) || source.generatedFiles.length === 0) throw new Error('Each source must declare expected generatedFiles for review and verification.');
    return source.generatedFiles.map(file => projectPath(root, file, 'generated file'));
  });
  const sdk = readJson(join(root, 'node_modules/@microsoft/power-apps/package.json'));
  if (sdk.version !== SDK_VERSION) throw new Error(`Integration requires the tested runtime SDK ${SDK_VERSION}.`);
  const status = JSON.parse(pa(['auth', 'status', '--json', '--non-interactive'], { root, env: childEnv, capture: true }));
  assertAccount(status, target);
  assertEnvironmentDiscovery(discovery(target, { root, env: childEnv }), target);
  const commands = [
    ['app', 'add', 'data-source', '--connector', 'dataverse', '--table', dv.table, '--org-url', target.environmentUrl, '--non-interactive'],
    ['app', 'add', 'data-source', '--connector', connector.connector, '--connection-id', connector.connectionId, '--non-interactive'],
  ];
  for (const [key, flag] of [['table', '--table'], ['dataset', '--dataset']]) {
    if (connector[key]) commands[1].push(flag, connector[key]);
  }
  for (const args of commands) {
    loadTarget(root, deployOptions);
    pa(args, { root, env: childEnv });
    loadTarget(root, deployOptions);
  }
  for (const file of files) if (!existsSync(file) || !readFileSync(file, 'utf8').trim()) throw new Error(`Generator did not produce expected output: ${file}`);
  build(root, childEnv);
  return {
    executed: true, phase: 'connectors', generatedFilesVerified: files.length,
    message: 'Connector generation and SDK build passed. Provider behavior, local-play, metadata-backed labels and published runtime still require explicit integration evidence.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (process.argv.includes('--help')) {
    console.log('Usage: node integration-pa.mjs --plan <project-relative.json> [--phase connectors|user-publish|spn-publish] [--execute --confirm-environment <id> --confirm-app <id>]\nDefault is offline. Execute only in a disposable, explicitly authorized consumer project. Never grants access or initializes an app.');
  } else {
    try {
      console.log(JSON.stringify(runIntegration({ options: parseIntegrationArgs(process.argv.slice(2)) }), null, 2));
    } catch (error) {
      console.error(`Integration did not complete: ${error.message}\nReview partial generated changes/cloud outcome before retrying; no automatic rollback or access grants were attempted.`);
      process.exitCode = error.exitCode || 1;
    }
  }
}
