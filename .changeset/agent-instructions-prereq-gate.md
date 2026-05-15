---
"@pacaf/agent-instructions": minor
---

Add `00-prereq-gate` instruction: force every coding agent to verify Node.js, npm, Git, .NET SDK, PAC CLI, and Python (or the `py` launcher on Windows) **before** running the wizard or any tool that depends on them.

On a fresh laptop — especially a new Windows machine — the wizard runs via `npx`, which itself requires Node.js. Agents historically tried to brute‑force around missing prerequisites and produced cryptic failure spirals that looked like PACAF bugs. This rule loads on every interaction (`applyTo: **`), runs a 5‑command precheck before any wizard attempt, and stops with a structured "🛑 Prerequisite missing — only you can install this" block listing the missing tools, official installer links, and OS‑specific gotchas (Microsoft Store python3 stub, VS Code terminal defaulting to cmd.exe, PATH refresh after `dotnet tool install`, npx exit 9009, corporate SSL inspection, OneDrive Files On‑Demand).

The README now also shows a prominent "Brand-new machine? Do this first" callout above the prerequisites table with the same 30‑second self-test, so humans get the same guardrail even before they invoke an agent. Projections shipped for Claude Code (`.claude/rules/prereq-gate.md`) and Cursor (`.cursor/rules/00-prereq-gate.mdc`).
