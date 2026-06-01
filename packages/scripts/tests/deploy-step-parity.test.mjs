// Deploy-step parity guard — prevents CLI-wizard vs browser-wizard-UX drift.
//
// WHY THIS TEST EXISTS
// --------------------
// The "Verify & Deploy" step is implemented TWICE, because the two wizards have
// completely different I/O models:
//
//   • packages/wizard/steps/09-verify-deploy.mjs          (CLI — @inquirer prompts)
//   • packages/wizard-ux/server/steps/09-verify-deploy.mjs (browser — log stream)
//
// `npx @pacaf/wizard-ux@latest` (the DEFAULT scaffolder) runs the second copy.
// In issue #81 a critical `pac code push` solution-association fix was applied
// only to the CLI copy. The browser copy kept the broken logic and shipped to
// users as wizard-ux@3.3.5 — a silent regression that wasn't caught until a
// real deploy failed in the field (fixed in wizard-ux@3.3.6).
//
// The two files CANNOT be byte-identical (different prompt vs log APIs), so a
// plain diff won't work. Instead we pin the SAFETY INVARIANTS that BOTH copies
// must satisfy and the BROKEN PATTERNS that NEITHER may contain. If you edit
// one deploy step, this test forces you to edit the other in the same change.
//
// HOW TO EXTEND
// -------------
// • Adding a new shared safety rule? Add it to REQUIRED_IN_BOTH.
// • Banning a newly-discovered footgun? Add it to FORBIDDEN_IN_BOTH.
// • Adding another step that is duplicated across both wizards? Add a new entry
//   to PAIRED_STEPS with the same invariant/forbidden shape.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = join(__dirname, '..', '..'); // packages/scripts/tests -> packages/

/**
 * Each paired step lists the two physical copies that must stay in lock-step,
 * the invariants both must satisfy, and the patterns neither may contain.
 */
const PAIRED_STEPS = [
  {
    name: '09-verify-deploy (pac code push solution association)',
    files: [
      join(PACKAGES_DIR, 'wizard', 'steps', '09-verify-deploy.mjs'),
      join(PACKAGES_DIR, 'wizard-ux', 'server', 'steps', '09-verify-deploy.mjs'),
    ],
    requiredInBoth: [
      {
        label: 'pushes with the -s flag (so the app joins its solution)',
        re: /\.push\(\s*['"]-s['"]/,
      },
      {
        label: 'verifies solution membership after push (verifyAppInSolution)',
        re: /verifyAppInSolution\s*\(/,
      },
      {
        label: 'uses the shared authoritative membership check (checkAppInSolution)',
        re: /checkAppInSolution\b/,
      },
      {
        label: 'imports the shared solution-membership lib (no per-copy drift)',
        re: /solution-membership(\.mjs)?/,
      },
      {
        label: 'has a pre-push orphan guard (an UPDATE cannot associate an orphan)',
        re: /pre-push/,
      },
      {
        label: 'surfaces orphan recovery steps (orphanRecoverySteps)',
        re: /orphanRecoverySteps\b/,
      },
      {
        label: 'warns that -s must be the UNIQUE name, not the display name',
        re: /UNIQUE name/,
      },
      {
        label: 'keeps the issue #81 rationale anchor so the fix is traceable',
        re: /#81/,
      },
    ],
    // NOTE: both files intentionally KEEP a prose comment explaining why the old
    // `solution add-solution-component -ct 300` path was broken. We only ban the
    // EXECUTABLE form (quoted CLI args passed to pac), never the documentation —
    // so the patterns below match `'add-solution-component'` / `'-ct', '300'`,
    // not the backticked prose in the rationale comments.
    forbiddenInBoth: [
      {
        label: 'an executable `solution add-solution-component` call (issue #81)',
        re: /['"]add-solution-component['"]/i,
      },
      {
        label: 'an executable `-ct 300` component-type argument (issue #81)',
        re: /['"]-ct['"]\s*,\s*['"]?300/,
      },
      {
        label: 'the FALSE-POSITIVE `solution list` membership check (regressed orphan bug)',
        // The old broken check ran `pac solution list` and regex-matched the
        // unique name — proving only that the solution exists, not that the app
        // is a component. Membership MUST go through checkAppInSolution instead.
        re: /\[\s*['"]solution['"]\s*,\s*['"]list['"]\s*\]/i,
      },
    ],
  },
];

for (const step of PAIRED_STEPS) {
  test(`${step.name}: both copies exist`, () => {
    for (const file of step.files) {
      assert.ok(
        existsSync(file),
        `Expected paired deploy step at ${file}. If you renamed or moved one copy, ` +
          `update PAIRED_STEPS in this test AND keep the other copy in sync.`,
      );
    }
  });

  const sources = step.files.map((file) => ({
    file,
    text: existsSync(file) ? readFileSync(file, 'utf-8') : '',
  }));

  for (const invariant of step.requiredInBoth) {
    test(`${step.name}: BOTH copies ${invariant.label}`, () => {
      const missing = sources.filter(({ text }) => !invariant.re.test(text));
      assert.equal(
        missing.length,
        0,
        `Deploy-step DRIFT detected. The following copies are missing "${invariant.label}" ` +
          `(/${invariant.re.source}/):\n` +
          missing.map(({ file }) => `  - ${file}`).join('\n') +
          `\n\nFIX: apply the same change to BOTH deploy-step copies:\n` +
          step.files.map((f) => `  - ${f}`).join('\n'),
      );
    });
  }

  for (const banned of step.forbiddenInBoth) {
    test(`${step.name}: NEITHER copy contains ${banned.label}`, () => {
      const offending = sources.filter(({ text }) => banned.re.test(text));
      assert.equal(
        offending.length,
        0,
        `A banned pattern resurfaced. The following copies contain ${banned.label} ` +
          `(/${banned.re.source}/):\n` +
          offending.map(({ file }) => `  - ${file}`).join('\n'),
      );
    });
  }
}
