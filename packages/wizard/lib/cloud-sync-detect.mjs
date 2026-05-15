// wizard/lib/cloud-sync-detect.mjs
// Detects whether the project root is inside a known cloud-sync folder
// (OneDrive, Dropbox, iCloud Drive, Google Drive, Box).
//
// Why this matters: even though .env.local is AES-256-GCM-encrypted and
// gitignored, cloud-sync providers run content classifiers that pattern-match
// "PP_CLIENT_SECRET=..." regardless of whether the value is encrypted, and
// will surface DLP alerts on the file. .gitignore does NOT affect cloud sync.
//
// Recommendation surfaced by the wizard when this returns a non-null result:
//   1. Move the project out of the synced folder, OR
//   2. Use 1Password storage (no secret on disk)

const PROVIDERS = [
  { name: 'OneDrive', pattern: /(^|\/)CloudStorage\/OneDrive[^/]*(\/|$)|(^|\/)OneDrive( - [^/]+)?(\/|$)/ },
  { name: 'Dropbox', pattern: /(^|\/)Dropbox(\/|$)|(^|\/)CloudStorage\/Dropbox[^/]*(\/|$)/ },
  { name: 'iCloud Drive', pattern: /\/Library\/Mobile Documents\/com~apple~CloudDocs(\/|$)/ },
  { name: 'Google Drive', pattern: /(^|\/)Google Drive( - [^/]+)?(\/|$)|(^|\/)CloudStorage\/GoogleDrive[^/]*(\/|$)/ },
  { name: 'Box', pattern: /(^|\/)Box( Sync)?(\/|$)|(^|\/)CloudStorage\/Box[^/]*(\/|$)/ },
  { name: 'Sync.com', pattern: /(^|\/)Sync(\/|$)|(^|\/)CloudStorage\/Sync[^/]*(\/|$)/ },
];

/**
 * @param {string} absPath  Absolute path to check (typically the project root).
 * @returns {{detected: true, provider: string} | null}
 */
export function detectCloudSync(absPath) {
  if (!absPath) return null;
  const normalized = String(absPath).replace(/\\/g, '/');
  for (const { name, pattern } of PROVIDERS) {
    if (pattern.test(normalized)) return { detected: true, provider: name };
  }
  return null;
}

/**
 * Human-readable warning shown when a cloud-sync folder is detected.
 */
export function cloudSyncWarning(provider, projectPath) {
  return [
    '',
    '⚠  CLOUD-SYNC FOLDER DETECTED',
    `   Project path: ${projectPath}`,
    `   Provider:     ${provider}`,
    '',
    `   Files written to this folder are synced to ${provider} — including .env.local.`,
    `   Even though .env.local is gitignored and the client secret is AES-256-GCM`,
    `   encrypted, ${provider} content scanners may flag the "PP_CLIENT_SECRET=" line`,
    `   pattern and surface a DLP alert.`,
    '',
    '   Recommendations (in order):',
    '     1. Move this project OUT of the cloud-sync folder (e.g. ~/Code/...).',
    '     2. Use 1Password credential storage (no secret on disk at all).',
    `     3. Exclude this folder from ${provider} sync at the OS level.`,
    '',
  ].join('\n');
}
