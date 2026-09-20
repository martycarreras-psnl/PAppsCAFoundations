import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const sources = [
  ['instructions', '.github/instructions'],
  ['claude', '.claude/rules'],
  ['cursor', '.cursor/rules'],
];
export const metaFiles = [
  ['meta/copilot-instructions.md', '.github/copilot-instructions.md'],
  ['meta/AGENTS.md', 'AGENTS.md'],
  ['meta/CLAUDE.md', 'CLAUDE.md'],
];
const hash = (content) => createHash('sha256').update(content).digest('hex');
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file) : null;

export function guidanceFiles(packageRoot) {
  const files = new Map();
  function walk(source, destination) {
    for (const entry of fs.readdirSync(path.join(packageRoot, source), { withFileTypes: true })) {
      const from = `${source}/${entry.name}`;
      const to = `${destination}/${entry.name}`;
      if (entry.isDirectory()) walk(from, to);
      else if (entry.isFile()) files.set(to, fs.readFileSync(path.join(packageRoot, from)));
    }
  }
  for (const [source, destination] of sources) walk(source, destination);
  for (const [source, destination] of metaFiles) {
    const content = read(path.join(packageRoot, source));
    if (content) files.set(destination, content);
  }
  return files;
}

function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\')) {
    throw new Error(`Invalid guidance path: ${relative}`);
  }
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Path escapes project: ${relative}`);
  let current = path.resolve(root);
  for (const part of path.relative(root, resolved).split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) {
      throw new Error(`Refusing symlink in guidance path: ${relative}`);
    }
  }
  return resolved;
}

export function policyOverlays(target, files) {
  const manifest = safePath(target, '.pacaf/policy-overlays.json');
  if (!fs.existsSync(manifest)) return new Map();
  const config = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (config.version !== 1 || !config.files || Array.isArray(config.files) || typeof config.files !== 'object') {
    throw new Error('Expected .pacaf/policy-overlays.json with version: 1 and a files object.');
  }
  const overlays = new Map();
  for (const [destination, source] of Object.entries(config.files)) {
    if (!files.has(destination)) throw new Error(`Overlay destination is not shipped guidance: ${destination}`);
    if (typeof source !== 'string' || !source.startsWith('.pacaf/policy/')) {
      throw new Error(`Overlay source must live under .pacaf/policy/: ${source}`);
    }
    const sourcePath = safePath(target, source);
    if (!sourcePath.startsWith(`${path.resolve(target, '.pacaf/policy')}${path.sep}`)) {
      throw new Error(`Overlay source escapes .pacaf/policy/: ${source}`);
    }
    overlays.set(destination, fs.readFileSync(sourcePath));
  }
  return overlays;
}

export function assertCodeAppPolicyReady(target, files, overlays) {
  const packagePath = safePath(target, 'package.json');
  const project = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, 'utf8')) : {};
  const scripts = Object.entries(project.scripts || {});
  const legacyScripts = scripts.filter(([, value]) => {
    const command = String(value);
    return /\bpac(?:\.exe|\.cmd)?["']?\s+code\b/i.test(command)
      || /\b(?:[\w-]+-pac(?:-safe)?|(?:op-pac|pac-safe)\.mjs)\b[^;&|\n]*\bcode(?:\s|$)/i.test(command);
  }).map(([name]) => name);
  const codeApp = fs.existsSync(safePath(target, 'power.config.json'))
    || project.dependencies?.['@microsoft/power-apps']
    || project.devDependencies?.['@microsoft/power-apps']
    || legacyScripts.length;
  if (!codeApp) return;
  const pinned = project.devDependencies?.['@microsoft/power-apps-cli'] === '1.0.2';
  if (pinned && !legacyScripts.length) return;

  const manifestPath = safePath(target, '.pacaf/policy-overlays.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const policyFiles = [...files].filter(([, content]) =>
    /@microsoft\/power-apps-cli|\bpa (?:app|auth)\b|pacaf-(?:pa|deploy|migrate-pa)\b/.test(content.toString())).map(([relative]) => relative);
  if (manifest.codeAppCliPolicy === 'reviewed-local' && policyFiles.length
    && policyFiles.every((relative) => overlays.has(relative))) return;

  throw new Error(
    'Refusing to replace legacy Code App policy with Power Apps CLI guidance before explicit migration.'
    + `\n${pinned ? '' : 'Required: exact devDependency "@microsoft/power-apps-cli": "1.0.2".\n'}`
    + `${legacyScripts.length ? `Legacy PAC Code App scripts remain: ${legacyScripts.join(', ')}.\n` : ''}`
    + 'Run pacaf-migrate-pa --help, review its dry-run, apply the migration, then retry sync.'
    + '\nFor a deliberately retained local CLI policy, register overlays for every CLI-policy file and set codeAppCliPolicy: "reviewed-local"; --force does not bypass this gate.'
    + (manifest.codeAppCliPolicy === 'reviewed-local'
      ? `\nMissing CLI-policy overlays:\n  ${policyFiles.filter((relative) => !overlays.has(relative)).join('\n  ') || '(package has no identifiable CLI-policy files)'}` : ''),
  );
}

export function inspectGuidance({ target, packageRoot }) {
  const files = guidanceFiles(packageRoot);
  const overlays = policyOverlays(target, files);
  assertCodeAppPolicyReady(target, files, overlays);
  const stampPath = safePath(target, '.foundations-version.json');
  const previousStamp = read(stampPath);
  const previous = previousStamp ? JSON.parse(previousStamp.toString()) : {};
  const originals = new Map();
  const conflicts = [];
  for (const [relative, content] of files) {
    const existing = read(safePath(target, relative));
    originals.set(relative, existing);
    if (existing && !existing.equals(content) && !existing.equals(overlays.get(relative) ?? content)
      && hash(existing) !== previous.hashes?.[relative]) conflicts.push(relative);
  }
  return { files, overlays, originals, conflicts, stampPath, previousStamp };
}

export function assertNoLocalEdits(conflicts) {
  if (conflicts.length) {
    throw new Error(`Local guidance edits would be overwritten:\n  ${conflicts.join('\n  ')}\nRegister explicit .pacaf/policy-overlays.json replacements, or use --force to back up local files before replacing them.`);
  }
}

export function syncGuidance({ target, packageRoot, pkg, force = false }) {
  const { files, overlays, originals, conflicts, stampPath, previousStamp } = inspectGuidance({ target, packageRoot });
  if (!force) assertNoLocalEdits(conflicts);
  if (conflicts.length) {
    const backup = `.pacaf/guidance-backups/${Date.now()}-${process.pid}`;
    for (const relative of conflicts) {
      const file = safePath(target, `${backup}/${relative}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, originals.get(relative), { flag: 'wx' });
    }
    console.log(`Backed up ${conflicts.length} locally modified files to ${backup}/`);
  }
  function write(relative, content) {
    const file = safePath(target, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  try {
    for (const [relative, content] of files) write(relative, content);
    for (const [relative, content] of overlays) write(relative, content);
    const effective = new Map([...files, ...overlays]);
    const stamp = {
      package: pkg.name, version: pkg.version, installedAt: new Date().toISOString(), layout: 'thin',
      hashes: Object.fromEntries([...effective].map(([relative, content]) => [relative, hash(content)])),
    };
    fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
    return files.size;
  } catch (error) {
    const recoveryErrors = [];
    for (const [relative, content] of originals) {
      try {
        if (content === null) fs.rmSync(safePath(target, relative), { force: true });
        else write(relative, content);
      } catch (recoveryError) { recoveryErrors.push(recoveryError.message); }
    }
    // Explicit policy remains authoritative even if copying upstream guidance failed.
    for (const [relative, content] of overlays) {
      try { write(relative, content); } catch (recoveryError) { recoveryErrors.push(recoveryError.message); }
    }
    try {
      if (previousStamp) fs.writeFileSync(stampPath, previousStamp);
      else fs.rmSync(stampPath, { force: true });
    } catch (recoveryError) { recoveryErrors.push(recoveryError.message); }
    throw new Error(`Guidance sync failed: ${error.message}${recoveryErrors.length ? `\nRecovery also failed: ${recoveryErrors.join('; ')}` : '\nPrevious guidance restored; explicit policy overlays reapplied.'}`);
  }
}

export function checkGuidance({ target, packageRoot, pkg }) {
  const stampPath = safePath(target, '.foundations-version.json');
  if (!fs.existsSync(stampPath)) return { status: 1, message: 'No .foundations-version.json. Run pacaf-instructions sync.' };
  const stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  const files = guidanceFiles(packageRoot);
  const overlays = policyOverlays(target, files);
  assertCodeAppPolicyReady(target, files, overlays);
  const effective = new Map([...files, ...overlays]);
  const drift = [...effective].filter(([relative, content]) => !read(safePath(target, relative))?.equals(content)).map(([relative]) => relative);
  if (stamp.version !== pkg.version || drift.length) {
    return { status: 2, message: `Guidance drift: installed ${stamp.version}, package ${pkg.version}${drift.length ? `\n  ${drift.join('\n  ')}` : ''}` };
  }
  return { status: 0, message: `Up to date: ${pkg.name}@${pkg.version} (including local policy overlays)` };
}
