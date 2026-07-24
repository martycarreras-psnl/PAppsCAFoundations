---
"@pacaf/agent-instructions": patch
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
---

Add Central Feed Services (CFS) blocked-registry guidance for Microsoft-managed devices. Microsoft-managed devices now block direct access to public PyPI (`pypi.org/simple`, `files.pythonhosted.org`) and NuGet (`api.nuget.org`, `nuget.org/api/v2`) registries — which affects the `dotnet tool install -g Microsoft.PowerApps.CLI.Tool` (PAC CLI) and `pip install PowerPlatform-Dataverse-Client pandas` (Dataverse-skills) prerequisite steps.

- Prereq-gate instructions now distinguish a **CFS registry block** (connection refused / DNS / 403) from **SSL inspection** (certificate errors), so the agent stops advising `--trusted-host` for a domain block and instead points at the approved `packagefeedproxy.microsoft.io` feeds.
- Both wizards (`@pacaf/wizard`, `@pacaf/wizard-ux`) now emit a CFS-aware hint when the PAC CLI install fails.
- The internal proxy is kept strictly in a "Microsoft-managed device" conditional branch so external template users are unaffected.
