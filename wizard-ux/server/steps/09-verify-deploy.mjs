// Step 9 — Verify & deploy. Long-running pac code push.
// Same delegation as step 7: WizardUX shows a handoff card and surfaces the deploy URL
// once the state file is fully populated. A future iteration can stream pac code push
// output through SSE and offer one-click deploy.
export default {
  meta: {
    number: 9,
    title: 'Verify & Deploy',
    description: 'Build the project, push it to Power Platform, and surface the live app URL.',
    canRunInBrowser: false,
    terminalHandoff: {
      command: 'cd wizard && node index.mjs --from 9',
      explanation: [
        '`pac code push` requires interactive (user) auth and benefits from terminal',
        'visibility while it uploads. Run the command, then return to WizardUX — the',
        'Summary screen will show the deployed app URL once power.config.json contains',
        'an appId.',
      ].join('\n'),
    },
  },
  questions() { return []; },
  async apply() { throw new Error('Run via CLI handoff.'); },
};
