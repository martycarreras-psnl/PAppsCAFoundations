// Step 7 — Solution confirmation (auto-skip).
// Publisher is now resolved in Step 6. This step just confirms and moves on.
import { clearSecret } from '../lib/dataverse-bridge.mjs';

export default {
  meta: {
    number: 7,
    title: 'Solution Confirmed',
    description: 'Solution and publisher details were resolved in Step 6.',
    canRunInBrowser: true,
  },

  async questions(state) {
    const hasSolution = state.SOLUTION_UNIQUE_NAME && state.PUBLISHER_PREFIX;
    if (hasSolution) {
      return [{
        id: '__auto',
        type: 'confirm',
        label: `Solution: "${state.SOLUTION_DISPLAY_NAME}" — Publisher prefix: ${state.PUBLISHER_PREFIX}`,
        help: 'These were set in Step 6. Click Apply to continue.',
        defaultValue: true,
      }];
    }
    return [{
      id: '__missing',
      type: 'confirm',
      label: 'Go back to Step 6 to select a solution first.',
      defaultValue: false,
    }];
  },

  async apply(answers, state, log) {
    if (!state.SOLUTION_UNIQUE_NAME || !state.PUBLISHER_PREFIX) {
      throw new Error('Solution and publisher not set. Go back to Step 6.');
    }
    log.ok(`Solution: ${state.SOLUTION_DISPLAY_NAME} (${state.SOLUTION_UNIQUE_NAME})`);
    log.ok(`Publisher prefix: ${state.PUBLISHER_PREFIX}`);
    clearSecret();
    return { stateUpdate: {}, completedStep: 7 };
  },
};
