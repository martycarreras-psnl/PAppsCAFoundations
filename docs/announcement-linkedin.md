# LinkedIn announcement post

> Tone: confident, technical-but-accessible, value-first. Audience: Power Platform devs, M365 architects, consulting practice leads, pro-code developers exploring Code Apps. Aim for ~1,800 characters so it fits comfortably with room for a comment-bait line at the end.

---

I've been quietly building something for the last few months. Today it's public.

🚀 **Power Apps Code Apps — Foundations** is a GitHub template repository that turns "I want to build a Code App" into a working, deployable, opinionated React + TypeScript + Fluent UI app — in the time it takes to drink a coffee.

If you've ever started a Power Apps Code App from scratch, you know the runway:

→ Pick a publisher prefix that will namespace your tables forever
→ Create the publisher, the solution, the App Registration, the Application User in every environment
→ Wire up PAC auth profiles, connection references, connection IDs, security roles
→ Configure Vite, Vitest, the right folder structure, the three-layer architecture
→ *Then* finally write some UI

Foundations does all of that for you — and packages it as a template you click "Use this template" on.

What's inside:

✅ A nine-step setup wizard you can run as **terminal** or as a **beautiful Fluent UI browser app** at `npm run wizard:ux` — same state file, switch surfaces anytime
✅ A complete GitHub Copilot instruction set so any coding agent that opens the repo (Copilot, Cursor, Claude Code, Aider) automatically generates *Code-App-shaped* code, not generic React
✅ A "plan first, prototype second, connect later" methodology that pressure-tests the UX with stakeholders before you provision a single Dataverse table
✅ Smart paste handling — paste an environment URL straight from PPAC (with or without `https://`), or paste a Maker Portal connection-details URL and the wizard extracts both the connector apiId and the connection GUID in one shot
✅ Add *any* connector by URL — Approvals, Outlook Tasks, custom connectors, your own APIs — not just the curated shortlist
✅ Smoke tests pass on the very first scaffold

It runs natively on Windows, macOS, and Linux. It works with the free Microsoft 365 Developer Program tenant. It's MIT-licensed and ready to fork.

If you build Power Apps Code Apps — or if you've been waiting to start — this is for you.

🔗 https://github.com/martycarreras-psnl/PAppsCAFoundations

What's the one thing you wish someone had handed you on day one of your last Code App project? I'm collecting feedback for v2. 👇

#PowerPlatform #PowerApps #CodeApps #Dataverse #FluentUI #React #TypeScript #LowCode #ProCode #Microsoft365
