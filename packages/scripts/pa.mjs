#!/usr/bin/env node
import { runPa, toolName } from './lib/pa.mjs';

const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.log(`Usage: ${toolName('pa.mjs')} <pa command and options>\nRuns only the project-local pinned @microsoft/power-apps-cli. Use ${toolName('deploy.mjs')} for guarded publishing.`);
} else {
  try {
    if (args[0] === 'app' && args[1] === 'push') {
      throw new Error(`Use ${toolName('deploy.mjs')} --target <name> for guarded build and publish.`);
    }
    runPa(args);
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  }
}
