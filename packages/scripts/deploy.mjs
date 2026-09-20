#!/usr/bin/env node
import { deploy, parseDeployArgs } from './lib/pa-deploy.mjs';
import { toolName } from './lib/pa.mjs';

if (process.argv.includes('--help')) {
  console.log(`Usage: ${toolName('deploy.mjs')} [--target dev] [--auth user|spn] [--preflight] [--allow-create]\nPreflight is offline: no build, login, cloud access, or publish. Actual publishing builds, verifies identity and solution, then pushes using only the pinned project-local CLI.`);
} else {
  try {
    const result = deploy({ options: parseDeployArgs(process.argv.slice(2)) });
    console.log(result.preflight ? `Offline preflight passed; authentication/cloud access remain unverified.\n${JSON.stringify(result)}` : 'Code App published successfully.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  }
}
