#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { homedir, platform } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const COPILOT_API_ID = 'shared_microsoftcopilotstudio';
const MAX_RETRIES = 5;

function info(message = '') {
  console.error(message);
}

function hr() {
  info('----------------------------------------------------------');
}

function fail(message) {
  info(message);
  process.exit(1);
}

function resolvePacBin() {
  if (process.env.PAC_BIN) {
    return process.env.PAC_BIN;
  }

  const ext = platform() === 'win32' ? '.exe' : '';
  const dotnetPac = path.join(homedir(), '.dotnet', 'tools', `pac${ext}`);
  if (fs.existsSync(dotnetPac)) {
    return dotnetPac;
  }

  try {
    const lookup = platform() === 'win32' ? 'where' : 'which';
    return execFileSync(lookup, ['pac'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
  } catch {
    fail('PAC CLI not found in PATH.');
  }
}

function listMatchingConnections(pacBin) {
  const output = execFileSync(pacBin, ['connection', 'list'], { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.includes(COPILOT_API_ID));
}

function parseConnectionLine(line) {
  const tokens = line.split(/\s+/);
  const connectionId = tokens[0];
  const name = tokens.length > 2 ? tokens.slice(1, -1).join(' ') : line;
  return { connectionId, name };
}

async function prompt(question) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(question);
  await rl.close();
  return answer.trim();
}

async function main() {
  const pacBin = resolvePacBin();

  hr();
  info('Resolving Microsoft Copilot Studio connection...');
  hr();

  let connectionId = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    info('');
    info(`Running: pac connection list (attempt ${attempt} / ${MAX_RETRIES})`);

    const matching = listMatchingConnections(pacBin);

    if (matching.length === 0) {
      info('');
      info('No Microsoft Copilot Studio connection was found in your environment.');
      info('');
      info('ACTION REQUIRED - Please create one manually:');
      info('  1. Open https://make.powerapps.com');
      info('  2. Go to Data -> Connections');
      info("  3. Click 'New connection'");
      info("  4. Search for 'Microsoft Copilot Studio'");
      info('  5. Authenticate and save the connection');
      info('');
      const answer = (await prompt("Press [Enter] when done, or type 'q' to quit: ")).toLowerCase();
      if (answer === 'q') {
        fail('Aborted by user.');
      }
      continue;
    }

    if (matching.length === 1) {
      connectionId = parseConnectionLine(matching[0]).connectionId;
      info(`Single Copilot Studio connection found: ${connectionId}`);
      break;
    }

    info('');
    info('Found multiple Copilot Studio connections:');
    const parsed = matching.map(parseConnectionLine);
    parsed.forEach((entry, index) => {
      info(`  [${index + 1}] Id   : ${entry.connectionId}`);
      info(`      Name : ${entry.name}`);
      info('');
    });

    const answer = await prompt('Reply with a number or paste the full Id: ');
    if (/^\d+$/.test(answer)) {
      const selected = parsed[Number(answer) - 1];
      if (!selected) {
        fail('Invalid number.');
      }
      connectionId = selected.connectionId;
    } else {
      const selected = parsed.find((entry) => entry.connectionId === answer);
      if (!selected) {
        fail('The value you entered was not in the list.');
      }
      connectionId = selected.connectionId;
    }

    info(`Selected: ${connectionId}`);
    break;
  }

  if (!connectionId) {
    fail('Maximum retries reached without resolving a connection.');
  }

  hr();
  info('Connection resolved. Returning connectionId to the caller.');
  hr();
  console.log(`COPILOT_CONNECTION_ID=${connectionId}`);
}

main();
