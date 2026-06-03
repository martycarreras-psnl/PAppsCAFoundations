---
'@pacaf/wizard-ux': patch
---

Fix: clicking **Finish** on the manual "Add app to solution" step (Step 10) now marks the step complete before navigating to the Summary, so the Summary recognizes setup as done and renders the launch card with the deployed **App URL**. Previously the manual step had no `apply()` to persist `COMPLETED_STEP`, so `completed` stayed at 9 while `totalSteps` was 10 — the Summary read `isDone=false` and showed an "in progress / Continue setup" page instead of the App URL.
