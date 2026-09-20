import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export async function retrySmokeVerification(projectDir, run, log) {
  if (!projectDir || !existsSync(join(projectDir, 'package.json'))) {
    throw new Error('Cannot retry verification: the recorded PROJECT_DIR must contain the existing package.json. Restore that project path; do not recreate the scaffold over your changes.');
  }
  log.info('Retrying smoke verification only. Existing source, configuration, dependencies, and Power Platform registration will not be rewritten.');
  const passed = await run('npm run test:smoke', { cwd: resolve(projectDir) });
  if (!passed) {
    throw new Error('Smoke verification still failed. Fix the test/worker error in the existing project and retry verification. No scaffold files were rewritten; deployment remains blocked.');
  }
  log.ok('Smoke verification passed; existing project files preserved.');
  return { SMOKE_TEST_STATUS: 'passed' };
}
