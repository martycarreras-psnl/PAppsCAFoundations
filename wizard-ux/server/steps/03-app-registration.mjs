// Step 3 — App Registration. Terminal handoff (1Password + Azure interactive).
export default {
  meta: {
    number: 3,
    title: 'App Registration',
    description: 'Create or reuse an Entra ID App Registration with a client secret stored in 1Password.',
    canRunInBrowser: false,
    terminalHandoff: {
      command: 'cd wizard && node index.mjs --from 3',
      explanation: [
        'This step interacts with 1Password (which prompts in your terminal) and may',
        'walk you through Azure AD app registration. WizardUX delegates to the CLI for',
        'the secure parts. Run the command shown, then return here when complete.',
      ].join('\n'),
    },
  },
  questions() { return []; },
  async apply() { throw new Error('Step 3 must be run via the CLI. See terminal handoff.'); },
};
