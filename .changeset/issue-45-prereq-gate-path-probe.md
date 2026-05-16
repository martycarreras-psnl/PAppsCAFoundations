---
"@pacaf/agent-instructions": minor
---

Prereq gate now probes the canonical install path before declaring a tool missing, so a working `pac`/`dotnet`/`node`/`git` install that simply isn't on `PATH` is no longer misdiagnosed as "Prerequisite missing — please reinstall". The classic macOS/zsh trigger — a `PATH` entry with a literal unexpanded `~` (e.g. `~/.dotnet/tools`, which neither zsh nor bash tilde-expand inside `PATH`) — is now called out explicitly with a one-line zsh / bash / PowerShell fix. New Step 2.5 + Step 3a in `.github/instructions/00-prereq-gate.instructions.md`, mirrored to the Claude and Cursor projections. Closes #45.
