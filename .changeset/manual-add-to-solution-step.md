---
"@pacaf/wizard-ux": minor
---

Add a required manual "Add app to solution" step (step 10) to the WizardUX. After deploy, the wizard now guides users through adding their Code app to the target solution in the Maker Portal — with a direct deep link to the solution, an inline illustration of the **Add existing → App → Code app** menu, and an explicit reminder to switch the picker to the **Outside Dataverse** filter and search for the app by name. The deploy step (step 9) no longer auto-advances, so users can read the `pac code push` log before continuing.
