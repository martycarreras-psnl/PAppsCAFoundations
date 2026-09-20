---
"@pacaf/scripts": minor
"@pacaf/wizard": major
"@pacaf/wizard-ux": major
"@pacaf/agent-instructions": major
---

Migrate Code App lifecycle and data-source guidance to the pinned project-local Power Apps CLI 1.0.2 with SDK 1.4.0, while retaining PAC for solution ALM/admin and existing Dataverse skills (#129). New wizard projects use separate Power Apps authentication, Vite port 3000 plus a config-only local host, durable environment/app/solution identities, and guarded publishing. User publishing requires separate, explicit Azure CLI access to Microsoft's Global Discovery Service for authoritative environment-to-tenant verification; it never infers the resource tenant from a cached account's home tenant.

Add a reviewable, reversible existing-consumer migration and offline deployment preflight. Existing apps are never reinitialized; SPN publishing is opt-in and limited to existing apps with maker-granted edit access. Fix standalone helper packaging without a wizard dependency, and make updates report failures while preserving policy overlays and local guidance edits. Existing consumers must explicitly migrate before accepting the new policy; force cannot bypass that gate. The wizard and instruction major versions deliberately signal this CLI/authentication workflow change; legacy PAC helpers remain supported by the additive scripts release.
