// Step 8 - Connectors. Native defer/acknowledge step.
export default {
  meta: {
    number: 8,
    title: 'Bind Connectors',
    description: 'Decide whether to bind real connectors now or defer until prototype validation is complete.',
    canRunInBrowser: true,
    optional: true,
  },

  questions() {
    return [
      {
        id: 'DEFER_CONNECTORS',
        type: 'confirm',
        label: 'Defer real connector binding until after prototype validation',
        help: 'Recommended. Keep the scaffold mock-backed until the planning payload and UX are stable.',
        defaultValue: true,
      },
      {
        id: 'CONNECTOR_NOTES',
        type: 'multiselect',
        label: 'Connector notes or planned apiIds',
        help: 'Optional. Enter comma-separated connectors or notes, such as shared_office365users, shared_sharepointonline, Dataverse tables later.',
        defaultValue: [],
      },
    ];
  },

  async apply(answers, _state, log) {
    const notes = Array.isArray(answers.CONNECTOR_NOTES) ? answers.CONNECTOR_NOTES : [];
    if (answers.DEFER_CONNECTORS !== true) {
      log.warn('Interactive connector binding is no longer delegated to the old CLI wizard.');
      log.info('Use a coding agent or PAC directly when the prototype is stable:');
      log.info('  pac code add-data-source -a dataverse -t <table_logical_name>');
      log.info('  pac code add-data-source -a <connector_api_id> -c <connection_id>');
    } else {
      log.ok('Connector binding deferred until prototype validation is complete');
    }
    if (notes.length > 0) log.info(`Recorded connector notes: ${notes.join(', ')}`);
    return {
      stateUpdate: {
        CONNECTOR_BINDING_DEFERRED: answers.DEFER_CONNECTORS !== false,
        CONNECTOR_NOTES: notes,
      },
      completedStep: 8,
    };
  },
};
