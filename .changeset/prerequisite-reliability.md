---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
"@pacaf/agent-instructions": patch
---

Fix #125 and #126: require supported Node 22/24 LTS without changing the machine's Node installation, separate Python interpreter detection from Dataverse SDK imports, reuse the recorded OS-aware interpreter for pip, and correct the SDK namespace. Preserve scaffold-versus-verification outcomes and clear stale retry banners while retaining real warnings. Failed smoke verification persists across reloads and blocks deployment; its verification-only retry preserves existing project files. Align generated CI and setup guidance with the supported runtime policy.
