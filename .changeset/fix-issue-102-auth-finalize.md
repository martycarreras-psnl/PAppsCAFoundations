---
'@pacaf/wizard-ux': patch
---

Harden the Environments step against the "Could not finalize the auth profile" crash. Before renaming the discovery profile, the wizard now prunes stale same-user duplicate `pac` auth profiles that trigger an upstream pac CLI bug ("Sequence contains more than one matching element"), and surfaces an actionable `pac auth clear` remediation when the auth store is still corrupted. Closes #102.
