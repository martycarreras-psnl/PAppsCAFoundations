// Ensures node-pty's prebuilt `spawn-helper` binary is executable after npm install.
// Some npm/tarball extraction paths drop the +x bit on Linux/macOS, which causes
// `posix_spawnp failed` at runtime. Idempotent and silent on Windows.
import { chmodSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform === 'win32') process.exit(0);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ptyDir = resolve(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds');
if (!existsSync(ptyDir)) process.exit(0);

const arch = process.arch;
const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
const candidates = [
  `${platform}-${arch}`,
  `${platform}-x64`,
  `${platform}-arm64`,
];

for (const folder of candidates) {
  const helper = resolve(ptyDir, folder, 'spawn-helper');
  if (!existsSync(helper)) continue;
  try {
    const mode = statSync(helper).mode;
    if ((mode & 0o111) === 0) {
      chmodSync(helper, mode | 0o755);
      console.log(`[wizard-ux] chmod +x ${helper.replace(process.cwd(), '.')}`);
    }
  } catch (err) {
    console.warn(`[wizard-ux] could not chmod ${helper}: ${err.message}`);
  }
}
