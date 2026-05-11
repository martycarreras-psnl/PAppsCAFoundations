// Routes for /api/system — environment & tooling diagnostics
import { execSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform, release } from 'node:os';
import { pacPath as resolvePacPath, runSafe } from '../../../wizard/lib/shell.mjs';

function safeRun(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch { return null; }
}

function which(name) {
  try {
    const cmd = platform() === 'win32' ? 'where' : 'which';
    execFileSync(cmd, [name], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function pacVersion() {
  const ext = platform() === 'win32' ? '.exe' : '';
  const dotnetTool = join(homedir(), '.dotnet', 'tools', `pac${ext}`);
  const pacPath = existsSync(dotnetTool) ? dotnetTool : resolvePacPath();
  if (!pacPath) return null;
  const out = runSafe(pacPath, []);
  const m = out?.match(/Version:\s*(\S+)/i);
  return m ? m[1] : (out ? 'unknown' : null);
}

export default async function systemRoutes(app, { rootDir }) {
  app.get('/', async () => ({
    os: { platform: platform(), release: release() },
    node: process.version,
    git: safeRun('git --version')?.replace('git version ', '') || null,
    dotnet: safeRun('dotnet --version'),
    pac: pacVersion(),
    op: which('op'),
    rootDir,
    branch: safeRun(`git -C "${rootDir}" rev-parse --abbrev-ref HEAD`) || null,
    repoIsClean: safeRun(`git -C "${rootDir}" status --porcelain`) === '',
  }));
}
