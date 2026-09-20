#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncGuidance, checkGuidance, sources, metaFiles } from './guidance-files.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

function usage() {
  console.log(`pacaf-instructions <command> [--target DIR] [--force]
  sync     Install guidance, preserving explicit .pacaf/policy-overlays.json policies.
           Refuse unregistered local edits; --force saves backups before replacing.
  check    Check version and file contents, including policy overlays.
  list     Show provided paths.
  version  Print package version.
`);
}

try {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    usage();
  } else {
    const cmd = argv.shift();
    let target = process.cwd();
    let force = false;
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--target' || argv[i] === '-t') {
        if (!argv[i + 1] || argv[i + 1].startsWith('-')) throw new Error('--target requires a directory');
        target = path.resolve(argv[++i]);
      } else if (argv[i] === '--force' || argv[i] === '-f') force = true;
      else throw new Error(`Unknown argument: ${argv[i]}`);
    }
    if (cmd === 'sync') {
      const total = syncGuidance({ target, packageRoot, pkg, force });
      console.log(`Installed ${total} guidance files from ${pkg.name}@${pkg.version}.`);
    } else if (cmd === 'check') {
      const result = checkGuidance({ target, packageRoot, pkg });
      console.log(result.message);
      process.exitCode = result.status;
    } else if (cmd === 'list') {
      for (const [from, to] of [...sources, ...metaFiles]) console.log(`${from} → ${to}`);
    } else if (cmd === 'version') console.log(pkg.version);
    else throw new Error(`Unknown command: ${cmd}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
