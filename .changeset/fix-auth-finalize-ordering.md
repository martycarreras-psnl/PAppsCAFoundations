---
'@pacaf/wizard-ux': patch
---

Permanently fix the recurring "Could not finalize the auth profile" failure at the Environments step. The previous fix (#110) pruned duplicate profiles *after* retargeting the discovery profile onto Dev — by then the discovery profile already shared the same (user, environment, tenant) key as any leftover profile, forming the ambiguous auth store that crashes both `pac auth delete` and `pac auth name`. The cleanup now runs **before** `pac env select`, while keys are still distinct, and also removes any leftover profile already holding the target name. The discovery index is re-resolved against the live store (no out-of-range cached-index fallback), finalize is verified by re-listing, and pac's real error text (written to stdout) is now surfaced instead of the generic `Command failed: …` wrapper that previously shadowed it.
