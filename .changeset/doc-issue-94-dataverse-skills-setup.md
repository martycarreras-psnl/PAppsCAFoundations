---
"@pacaf/agent-instructions": patch
---

Point agents at a single authoritative Dataverse-skills setup walkthrough. AGENTS.md and the "before you start" instruction now link to docs/dataverse-skills-setup.md — one linear, OS-specific guide covering Python, pip, the PowerPlatform-Dataverse-Client SDK, PAC auth, the /plugin install dataverse step, MCP verification, and an end-to-end smoke test, each with an official reference, a verify command, and the most common failure/fix. Agents are instructed to send users there rather than improvising install commands. Closes #94.
