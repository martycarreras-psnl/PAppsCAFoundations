// Step 4 — Auth Setup. Terminal handoff (device-code flow).
export default {
  meta: {
    number: 4,
    title: 'PAC Auth Profiles',
    description: 'Create the PAC SPN auth profile and the interactive user profile required for pac code commands.',
    canRunInBrowser: false,
    terminalHandoff: {
      command: 'cd wizard && node index.mjs --from 4',
      explanation: [
        'Auth setup runs `pac auth create` — for the user profile, this opens a',
        'device-code login flow that needs your terminal. WizardUX delegates to the',
        'CLI here. Run the command shown; come back when both profiles are listed in',
        '`pac auth list`.',
      ].join('\n'),
    },
  },
  questions() { return []; },
  async apply() { throw new Error('Step 4 must be run via the CLI. See terminal handoff.'); },
};
