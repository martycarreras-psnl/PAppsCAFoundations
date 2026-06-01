---
"@pacaf/scripts": patch
---

Add a deploy-step parity guard that prevents CLI-wizard vs browser-wizard-UX
drift. `packages/scripts/tests/deploy-step-parity.test.mjs` asserts that both
copies of the "Verify & Deploy" step
(`packages/wizard/steps/09-verify-deploy.mjs` and
`packages/wizard-ux/server/steps/09-verify-deploy.mjs`) satisfy the same
`pac code push` solution-association safety invariants and that neither
reintroduces the broken `solution add-solution-component -ct 300` repair path
(issue #81 / wizard-ux@3.3.5 regression).
