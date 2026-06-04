// Step 11 — Add the Code App to your Solution (manual).
//
// This is a MANUAL step, not a terminal/automation step. `pac code push -s`
// only associates the Code App with a solution when that solution already
// exists in the target environment, and even then the binding can silently
// fall back to the Default solution. Rather than pretend that automation is
// reliable, this step hands the user a direct Maker Portal deep link and the
// exact clicks needed to add the Code App to their target solution by hand.
//
// Because it is manual, it has no questions and no apply(): `canRunInBrowser`
// is false and `manual` is true so the WizardUX StepRunner renders a guided
// panel (deep link + "Outside Dataverse" guidance + illustration) instead of
// the question/run machinery. The deep link and solution display name are
// supplied to the frontend by GET /api/state (see routes/state.mjs).
export default {
  meta: {
    number: 11,
    title: 'Add App to Solution',
    description:
      'Required manual step — open the Maker Portal and add your deployed Code App to your target solution.',
    canRunInBrowser: false,
    manual: true,
  },

  questions() {
    return [];
  },
};
