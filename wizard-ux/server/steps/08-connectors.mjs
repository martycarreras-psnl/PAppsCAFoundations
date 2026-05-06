// Step 8 - Connectors. Browser-native connector selection and optional data-source binding.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dvGet, dvPost, hasUsableSecret, setSecret } from '../lib/dataverse-bridge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..', '..', '..');
const VALIDATE = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'validate.mjs')).href);
const CONNECTIONS = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'connection-discovery.mjs')).href);
const SHELL = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'shell.mjs')).href);
const PAC_TARGET = await import(pathToFileURL(resolve(ROOT_DIR, 'wizard', 'lib', 'pac-target.mjs')).href);

const CREATE_MANUAL = '__manual__';
const SKIP_CONNECTION = '__skip__';
const BAP_PERMISSION_RE = /does not have permission to access|checkAccess|HTTP error status: 403/i;

const COMMON_CONNECTORS = [
  { apiId: 'shared_commondataserviceforapps', name: 'Dataverse' },
  { apiId: 'shared_office365users', name: 'Office 365 Users' },
  { apiId: 'shared_sharepointonline', name: 'SharePoint' },
  { apiId: 'shared_office365', name: 'Office 365 Outlook' },
  { apiId: 'shared_teams', name: 'Microsoft Teams' },
  { apiId: 'shared_sql', name: 'SQL Server' },
  { apiId: 'shared_azureblob', name: 'Azure Blob Storage' },
];

function hasCommand(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return String(value || '').split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean);
}

function connectionQuestionId(apiId) {
  return `CONNECTION_${apiId.replace(/[^a-z0-9_]/gi, '_')}`;
}

function connectorToggleId(apiId) {
  return `CONNECTOR_${apiId.replace(/[^a-z0-9_]/gi, '_')}`;
}

function manualQuestionId(apiId) {
  return `${connectionQuestionId(apiId)}_MANUAL`;
}

async function listConnectionReferences(prefix) {
  if (!prefix) return [];
  const data = await dvGet(
    `connectionreferences?$filter=startswith(connectionreferencelogicalname,'${prefix}_')` +
    '&$select=connectionreferenceid,connectionreferencelogicalname,connectorid,connectionreferencedisplayname',
  );
  return data.value || [];
}

function connectorApiIdFromReference(reference) {
  return String(reference.connectorid || '').split('/').pop() || '';
}

function connectorLabel(connector, existingApiIds) {
  return existingApiIds.has(connector.apiId) ? `${connector.name} (connection reference exists)` : connector.name;
}

function connectorGroup(connector) {
  return {
    id: `connector-${connector.apiId}`,
    label: connector.name,
    help: 'Choose whether this app should bind this connector, then pick its environment connection when data-source registration is enabled.',
  };
}

function discoverConnections(pac, apiId) {
  if (!pac) return [];
  try {
    return CONNECTIONS.discoverConnectionsForApiId(pac, apiId);
  } catch {
    return [];
  }
}

function connectionOptions(connections, savedConnectionId = '') {
  const savedOption = savedConnectionId && !connections.some((entry) => entry.connectionId === savedConnectionId)
    ? [{ value: savedConnectionId, label: 'Saved connection from prior setup' }]
    : [];
  return [
    ...savedOption,
    ...connections.map((entry) => ({
      value: entry.connectionId,
      label: entry.displayName || 'Environment connection',
    })),
    { value: CREATE_MANUAL, label: 'Paste a connection URL or ID' },
    { value: SKIP_CONNECTION, label: 'Create connection reference only' },
  ];
}

function resolveCredentialValues(state) {
  return PAC_TARGET.resolveCredentialValues({
    rootDir: ROOT_DIR,
    opBin: process.env.OP_BIN || (hasCommand('op') ? 'op' : null),
    source: state.AUTH_MODE || 'auto',
  });
}

function verifyUserProfile(pac, projectDir, state, credentialValues) {
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
    profileType: 'user',
    credentialValues,
    powerConfigPath: join(projectDir, 'power.config.json'),
    requireCredentialMatch: true,
    requirePowerConfig: true,
    requirePowerConfigTarget: true,
  });
}

function runFileCapture(log, file, args, opts = {}) {
  return new Promise((resolvePromise) => {
    log.info(`$ ${SHELL.formatCommandForLog(file, args)}`);
    const child = SHELL.spawnSafe(file, args, { cwd: opts.cwd || ROOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
      log.info(String(chunk).trimEnd());
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
      log.warn(String(chunk).trimEnd());
    });
    child.on('error', (error) => {
      log.fail(`Failed to start ${file}: ${error.message}`);
      resolvePromise({ ok: false, stdout, stderr: `${stderr}\n${error.message}` });
    });
    child.on('close', (code) => resolvePromise({ ok: code === 0, stdout, stderr }));
  });
}

function parseCustomConnectors(rawEntries) {
  const connectors = [];
  const seen = new Set();

  for (const raw of rawEntries) {
    const parsed = VALIDATE.parseConnectionUrl(raw);
    const apiId = parsed.apiId || VALIDATE.extractConnectorApiId(raw);
    if (!apiId || seen.has(apiId)) continue;
    seen.add(apiId);
    connectors.push({
      apiId,
      name: VALIDATE.humanizeConnectorApiId(apiId),
      connectionId: parsed.connectionId || '',
      raw,
    });
  }

  return connectors;
}

async function createConnectionReference(log, connector, prefix, solutionName, existingRefs) {
  const logicalName = `${prefix}_${connector.apiId}`;
  const existing = existingRefs.find((reference) => reference.connectionreferencelogicalname === logicalName);
  if (existing) {
    log.ok(`${connector.name} - connection reference already exists`);
    return existing;
  }

  const result = await dvPost('connectionreferences', {
    connectionreferencedisplayname: connector.name,
    connectionreferencelogicalname: logicalName,
    connectorid: `/providers/Microsoft.PowerApps/apis/${connector.apiId}`,
  }, { solutionName });
  log.ok(`${connector.name} - connection reference created`);
  return result;
}

function connectionIdFromAnswers(answers, connector) {
  const selected = String(answers[connectionQuestionId(connector.apiId)] || '').trim();
  if (selected && selected !== CREATE_MANUAL && selected !== SKIP_CONNECTION) return selected;
  if (selected === CREATE_MANUAL) return VALIDATE.extractConnectionId(answers[manualQuestionId(connector.apiId)]);
  return connector.connectionId || '';
}

export default {
  meta: {
    number: 8,
    title: 'Bind Connectors',
    description: 'Choose connector references and optionally register connector data sources for the Code App.',
    canRunInBrowser: true,
    optional: true,
    needsSecret: true,
  },

  async questions(state) {
    const questions = [];
    const prefix = state.PUBLISHER_PREFIX || '';
    const pac = SHELL.pacPath();
    const hasSecret = hasUsableSecret();
    let existingRefs = [];

    if (hasSecret) {
      try {
        existingRefs = await listConnectionReferences(prefix);
      } catch (err) {
        // Missing discovery should not block users from choosing connector intent.
      }
    }

    const existingApiIds = new Set(existingRefs.map(connectorApiIdFromReference).filter(Boolean));
    const savedApiIds = Array.isArray(state.CONNECTOR_API_IDS) ? state.CONNECTOR_API_IDS : [];
    const selectedDefaults = Array.from(new Set([...savedApiIds, ...existingApiIds]));

    questions.push({
      id: 'DEFER_CONNECTORS',
      type: 'confirm',
      label: 'Keep real connector binding deferred',
      help: 'Recommended until the prototype and planning payload are stable. Turn this off to choose connectors now.',
      defaultValue: state.CONNECTOR_BINDING_DEFERRED !== false,
    });

    if (!hasSecret) {
      questions.push({
        id: 'PP_CLIENT_SECRET',
        type: 'secret',
        label: 'Client secret',
        help: 'Needed once to create connection references in the selected solution. Not stored here — held in memory for this server only. If you entered this in Step 3, it may have been cleared by a server restart.',
        required: true,
        defaultValue: '',
        showIf: { id: 'DEFER_CONNECTORS', equals: false },
        savedHint: state.PP_CLIENT_SECRET ? 'Saved in Step 3 — re-enter if server was restarted' : undefined,
      });
    }

    questions.push({
      id: 'REGISTER_DATA_SOURCES',
      type: 'confirm',
      label: 'Register selected non-Dataverse connectors as Code App data sources now',
      help: 'Requires the user PAC auth profile from Step 4 and power.config.json from Step 7. Leave off to create solution connection references only.',
      defaultValue: false,
      showIf: { id: 'DEFER_CONNECTORS', equals: false },
    });

    for (const connector of COMMON_CONNECTORS) {
      const toggleId = connectorToggleId(connector.apiId);
      const referenceExists = existingApiIds.has(connector.apiId);
      const group = connectorGroup(connector);
      questions.push({
        id: toggleId,
        type: 'confirm',
        label: `Set up ${connectorLabel(connector, existingApiIds)}`,
        help: referenceExists
          ? 'This connector already has a connection reference in the selected solution. Leave on to keep it in this app setup.'
          : 'Creates a solution connection reference for this connector when you save Step 8.',
        defaultValue: selectedDefaults.includes(connector.apiId),
        group,
        showIf: { id: 'DEFER_CONNECTORS', equals: false },
      });

      if (connector.apiId === 'shared_commondataserviceforapps') continue;

      const discovered = discoverConnections(pac, connector.apiId);
      const savedConnectionId = state.CONNECTOR_CONNECTION_IDS?.[connector.apiId] || '';
      const defaultValue = savedConnectionId || (discovered.length === 1 ? discovered[0].connectionId : SKIP_CONNECTION);
      questions.push({
        id: connectionQuestionId(connector.apiId),
        type: 'select',
        label: `${connector.name} connection`,
        help: discovered.length > 0
          ? 'Choose an existing environment connection, paste one manually, or create only the connection reference for now.'
          : 'No existing environment connection was discovered. Paste a connection URL/ID, or create only the connection reference for now.',
        defaultValue,
        options: connectionOptions(discovered, savedConnectionId),
        group,
        showIf: [
          { id: 'DEFER_CONNECTORS', equals: false },
          { id: 'REGISTER_DATA_SOURCES', equals: true },
          { id: toggleId, equals: true },
        ],
      });
      questions.push({
        id: manualQuestionId(connector.apiId),
        type: 'text',
        label: `${connector.name} connection URL or ID`,
        help: 'Paste the full Maker Portal connection details URL or connection ID.',
        defaultValue: '',
        group,
        showIf: [
          { id: 'DEFER_CONNECTORS', equals: false },
          { id: 'REGISTER_DATA_SOURCES', equals: true },
          { id: toggleId, equals: true },
          { id: connectionQuestionId(connector.apiId), equals: CREATE_MANUAL },
        ],
      });
    }

    questions.push({
      id: 'CUSTOM_CONNECTORS',
      type: 'multiselect',
      label: 'Other connector URLs or apiIds',
      help: 'Optional. Paste uncommon/custom connector apiIds or full Maker Portal connection URLs. Full URLs let WizardUX capture both the connector and connection ID.',
      defaultValue: Array.isArray(state.CUSTOM_CONNECTORS) ? state.CUSTOM_CONNECTORS : [],
      showIf: { id: 'DEFER_CONNECTORS', equals: false },
    });

    return questions;
  },

  async apply(answers, state, log) {
    const selectedCommon = COMMON_CONNECTORS
      .filter((connector) => answers[connectorToggleId(connector.apiId)] === true)
      .map((connector) => connector.apiId);
    const customRaw = normalizeList(answers.CUSTOM_CONNECTORS);

    if (answers.DEFER_CONNECTORS !== false) {
      log.ok('Connector binding deferred until prototype validation is complete');
      if (customRaw.length > 0) log.info(`Recorded connector notes: ${customRaw.join(', ')}`);
      return {
        stateUpdate: {
          CONNECTOR_BINDING_DEFERRED: true,
          CUSTOM_CONNECTORS: customRaw,
        },
        completedStep: 8,
      };
    }

    if (answers.PP_CLIENT_SECRET) {
      setSecret(answers.PP_CLIENT_SECRET);
    } else if (!hasUsableSecret()) {
      throw new Error('Client secret is required to create connection references. Provide it or defer connector binding.');
    }

    const connectorMap = new Map(COMMON_CONNECTORS.map((connector) => [connector.apiId, { ...connector }]));
    const customConnectors = parseCustomConnectors(customRaw);
    for (const connector of customConnectors) connectorMap.set(connector.apiId, connector);

    const selectedApiIds = Array.from(new Set([
      ...selectedCommon,
      ...customConnectors.map((connector) => connector.apiId),
    ])).filter((apiId) => connectorMap.has(apiId));

    if (selectedApiIds.length === 0) {
      log.warn('No connectors selected. Nothing to bind.');
      return {
        stateUpdate: {
          CONNECTOR_BINDING_DEFERRED: false,
          CONNECTOR_API_IDS: [],
          CUSTOM_CONNECTORS: customRaw,
        },
        completedStep: 8,
      };
    }

    const prefix = state.PUBLISHER_PREFIX || '';
    const solutionName = state.SOLUTION_UNIQUE_NAME || '';
    if (!prefix) throw new Error('Publisher prefix is missing. Complete Step 5 before binding connectors.');
    if (!solutionName) throw new Error('Solution unique name is missing. Complete Step 6 before binding connectors.');

    log.info('Checking existing connection references...');
    let existingRefs = [];
    try {
      existingRefs = await listConnectionReferences(prefix);
    } catch (err) {
      log.warn(`Could not query connection references: ${err.message}`);
    }

    log.info('Creating missing connection references in the selected solution...');
    for (const apiId of selectedApiIds) {
      const connector = connectorMap.get(apiId);
      try {
        const created = await createConnectionReference(log, connector, prefix, solutionName, existingRefs);
        existingRefs.push(created);
      } catch (err) {
        if (/already exists|database constraint/i.test(err.message)) log.ok(`${connector.name} - connection reference already exists`);
        else log.warn(`${connector.name} - connection reference failed: ${err.message}`);
      }
    }

    const connectionIds = {};
    if (answers.REGISTER_DATA_SOURCES === true) {
      const pac = SHELL.pacPath();
      if (!pac) throw new Error('PAC CLI was not found. Install PAC CLI before registering data sources.');

      const projectDir = resolve(String(state.PROJECT_DIR || ROOT_DIR));
      if (!existsSync(join(projectDir, 'power.config.json'))) {
        throw new Error(`power.config.json was not found in ${projectDir}. Complete Step 7 before registering data sources.`);
      }

      const credentialValues = resolveCredentialValues(state);
      const verification = verifyUserProfile(pac, projectDir, state, credentialValues);
      log.ok(`Verified user profile ${verification.profileName}`);

      for (const apiId of selectedApiIds.filter((id) => id !== 'shared_commondataserviceforapps')) {
        const connector = connectorMap.get(apiId);
        const connectionId = connectionIdFromAnswers(answers, connector);
        if (!connectionId) {
          log.info(`${connector.name} - data-source registration skipped. Add later with: pac code add-data-source -a ${apiId} -c <connection_id>`);
          continue;
        }

        connectionIds[apiId] = connectionId;
        const result = await runFileCapture(log, pac, ['code', 'add-data-source', '-a', apiId, '-c', connectionId], { cwd: projectDir });
        if (!result.ok || BAP_PERMISSION_RE.test(result.stderr)) {
          log.warn(`${connector.name} - data-source registration failed. You can retry later with pac code add-data-source -a ${apiId} -c ${connectionId}`);
        } else {
          log.ok(`${connector.name} - data source registered`);
        }
      }
    } else {
      log.info('Data-source registration skipped. Connection references were handled in the solution.');
    }

    return {
      stateUpdate: {
        CONNECTOR_BINDING_DEFERRED: false,
        CONNECTOR_API_IDS: selectedApiIds,
        CUSTOM_CONNECTORS: customRaw,
        CONNECTOR_CONNECTION_IDS: connectionIds,
      },
      completedStep: 8,
    };
  },
};
