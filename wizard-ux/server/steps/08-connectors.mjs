// Step 8 — Connectors. Terminal handoff (interactive `pac connection list` rescans).
export default {
  meta: {
    number: 8,
    title: 'Bind Connectors',
    description: 'Pick connectors, create connection references, and register data sources. Optional during initial scaffold.',
    canRunInBrowser: false,
    optional: true,
    terminalHandoff: {
      command: 'cd wizard && node index.mjs --from 8',
      explanation: [
        'Connector binding interacts with `pac connection list` and may need',
        'interactive auth refreshes. Run it in the terminal. You can also skip this',
        'step entirely and let your coding agent wire up data sources later with',
        '`pac code add-data-source` when needed.',
      ].join('\n'),
    },
  },
  questions() { return []; },
  async apply() { throw new Error('Run via CLI or skip — see handoff card.'); },
};
