// Step 7 — Scaffold. Long-running. Browser support is limited to "delegate to CLI",
// because scaffolding interleaves npm installs, pac code init, smoke tests, and
// git initialization that's better watched through a terminal.
//
// In v0 the WizardUX shows a "Run scaffold in terminal" handoff card and detects
// successful completion when COMPLETED_STEP advances to 7 in the state file.
export default {
  meta: {
    number: 7,
    title: 'Scaffold the Code App',
    description: 'Generate the project, install dependencies, register with Power Platform, and run smoke tests.',
    canRunInBrowser: false,
    terminalHandoff: {
      command: 'node wizard-ux/server/run-cli-step.mjs 7',
      explanation: [
        'Scaffolding takes several minutes (npm install, pac code init, smoke tests).',
        'Run the command in your terminal so you can watch progress and answer any',
        'sub-prompts. WizardUX will detect completion automatically — refresh the',
        'state panel after the CLI reports "Scaffold complete".',
      ].join('\n'),
    },
  },
  questions() { return []; },
  async apply() {
    throw new Error('Run scaffolding via the CLI handoff. WizardUX detects completion from the state file.');
  },
};
