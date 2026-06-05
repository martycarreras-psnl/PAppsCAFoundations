---
'@pacaf/wizard-ux': patch
---

Add an "Ask your coding agent" helper banner that appears on any wizard step
when it errors out or completes with warnings. The banner explains what
commonly goes wrong for that specific step and provides a copy-to-clipboard
prompt the user can paste back to their coding agent for help — covering
prereqs (Node/.NET/Python/PAC/Dataverse plugin), auth, env selection,
publisher prefix, scaffold, connector binding, and build/deploy.
