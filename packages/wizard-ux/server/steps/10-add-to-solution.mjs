// Step 10 — Verify solution membership in the Maker Portal.
//
// Guarded deployment supplies the recorded solution GUID to pa app push.
// Keep a manual verification/recovery path rather than claiming membership
// without checking the deployed environment.
//
// Because it is manual, it has no questions and no apply(): `canRunInBrowser`
// is false and `manual` is true so the WizardUX StepRunner renders a guided
// panel (deep link + "Outside Dataverse" guidance + illustration) instead of
// the question/run machinery. The deep link and solution display name are
// supplied to the frontend by GET /api/state (see routes/state.mjs).
export default {
  meta: {
    number: 10,
    title: 'Verify App in Solution',
    description:
      'Verify the deployed Code App appears in the recorded target solution; add it manually only if missing.',
    canRunInBrowser: false,
    manual: true,
  },

  questions() {
    return [];
  },
};
