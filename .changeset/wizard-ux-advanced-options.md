---
"@pacaf/wizard-ux": minor
---

Add an `advanced: true` flag on wizard questions, and render flagged questions inside a collapsed **Advanced options** accordion at the bottom of the step form.

Applied to step 7 (Scaffold the Code App): the **Project path** field stays visible, while **Continue if directory not empty**, **Git remote URL**, and **Push to remote** are now hidden by default so users can power through with just the path. Any step can opt into the same treatment by adding `advanced: true` to a question definition.
