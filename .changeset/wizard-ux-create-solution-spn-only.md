---
'@pacaf/wizard-ux': patch
---

Step 6 (Solution & Publisher) now only offers "+ Create new solution" when authenticating with a service principal, which can create solutions via the Dataverse API. User-auth sessions no longer see the option (and the unreachable manual create-and-enter-details flow was removed); they create the solution in the Maker Portal and paste its URL instead.
