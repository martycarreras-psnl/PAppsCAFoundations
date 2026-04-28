# Stop scaffolding Code Apps from scratch. Start with Foundations.

**Power Apps Code Apps — Foundations** is now public on GitHub. It's a template repository, an opinionated setup wizard, a complete GitHub Copilot instruction set, and a methodology — all designed so your **next** Power Apps Code App feels like your hundredth.

→ **[github.com/martycarreras-psnl/PAppsCAFoundations](https://github.com/martycarreras-psnl/PAppsCAFoundations)**

If you've ever sat down to start a Power Apps Code App and felt the weight of every decision in front of you — publisher prefix, App Registration, auth profile, solution, connection references, connector flow, Dataverse schema, generated SDKs, three-layer architecture, security roles, deployment story — this is for you.

---

## The problem with starting from zero

Power Apps Code Apps are a real platform leap. You write modern React + TypeScript, bundled with Vite, deployed straight into a Power Platform environment, with Entra ID auth handed to you by the host and 1000+ connectors at your fingertips. It's the best of both worlds: developer freedom **and** governed enterprise data.

But the runway is brutal. Before your first deploy you have to:

- Decide a publisher prefix that will namespace your tables forever
- Create the publisher in the Maker Portal — without that, your solution is orphaned
- Provision a Dataverse-enabled environment for dev (and ideally test and prod)
- Create an App Registration in Microsoft Entra and grant it Power Platform API permissions
- Register that app as an Application User in **every** environment with the right security role
- Create a PAC CLI auth profile with the right credentials, in the right shape
- Spin up a solution **inside** the Maker Portal so it inherits the publisher
- Create connections (the authenticated instances) **before** you import your solution, in every environment, and capture their GUIDs from URLs
- Run `pac code init`, set up `power.config.json`, configure Vite for port 3000 and relative asset paths, set up the right testing harness, and write smoke tests
- Then — finally — start writing UI code

Get any of that wrong in the wrong order and you spend a day or two unwinding it. There's no autopilot.

**Until now.**

---

## What Foundations gives you

Three things, working together.

### 1. A GitHub template repository

Click **Use this template**. Give your new repo a name. Clone it. You now have:

- A complete `.github/instructions/` set that GitHub Copilot reads automatically — every file, every chat, every agent invocation, in the right order
- A `wizard-ux/` directory with a beautiful Fluent UI v9 browser wizard built on the **same** stack you're about to use
- An `AGENTS.md` at the root that puts non-negotiable guardrails in place for any coding agent that enters the repo (GitHub Copilot, Cursor, Claude Code, Aider, Cline)
- A `docs/` folder with a glossary, a visual guide, and a marketing landing page

You don't read most of it. **Copilot reads it for you.** The point is that the repo encodes a methodology, and any agent that opens it inherits the methodology automatically.

### 2. A nine-step setup wizard — terminal *or* browser

Run it the classic way:

```bash
cd wizard
npm install
node index.mjs
```

Or run it as a beautiful browser experience:

```bash
npm run wizard:ux
```

Both share the same `.wizard-state.json`, so you can switch surfaces mid-flow without losing progress. You quit anytime with Ctrl+C and the wizard picks up exactly where you left off.

The nine steps are self-contained, idempotent, and re-runnable:

1. **Prerequisites** — Node, .NET, PAC CLI, Git, optional 1Password CLI
2. **Project & Environment** — publisher prefix, solution name, app name, environment URLs (dev / test / prod)
3. **App Registration** — Azure Portal walk-through with copy-paste-ready values
4. **PAC Auth Profiles** — secrets stored in 1Password or `.env.local`, profiles created and verified
5. **Publisher** — created via API, no portal click-through needed
6. **Solution** — created via API, linked to the publisher
7. **Scaffold the Code App** — React + Fluent UI v9 + TanStack Query + TypeScript, with Vitest, smoke tests, and prototype assets all wired up — and the smoke tests run automatically before the wizard moves on
8. **Bind Connectors** — discover existing environment connections, create connection references, register data sources
9. **Verify & Deploy** — `npm run build`, optional `pac code push`

### 3. A "plan first, prototype second, connect later" methodology

This is the part that most people don't realize they need until they're three months in.

Foundations doesn't assume you already know what you're building. It treats Code Apps the way a senior consultant would treat any non-trivial business app:

1. **Decompose the business problem** — actors, workflows, approvals, exceptions, reporting, governance — from the user's freeform narrative, not a rigid questionnaire
2. **Refine the solution scope** — challenge the happy path before it solidifies into schema
3. **Convert to technical planning inputs** — candidate entities, relationships, ownership, lifecycle states
4. **Validate with a clickable prototype** against mock providers — pressure-test the UX with stakeholders, capture findings, refine the planning payload **before** you provision a single Dataverse table
5. **Then** schema, connectors, real data, build, deploy

The result: you don't discover missing requirements after you've shipped. You don't make table choices you can't unwind. You don't bind connectors before the workflow has been tested.

---

## What just shipped (the highlights from the last few weeks)

The repo has been moving fast. Recent additions:

### Embedded terminal in the browser wizard

Some steps need real interactive auth — device-code prompts, biometric prompts, browser sign-in. Instead of bouncing you out to your shell, the browser wizard ships with a **real PTY-backed terminal** (your zsh on macOS/Linux, your pwsh on Windows) embedded right in the page. You see the prompts. You click the OS modal. You come back to the same window.

### Unified design language across every screen

The Welcome page, the Step Runner, the Summary page, and the Diagnostics page all share a single `PageHero` component and the same Fluent UI v9 visual identity. Whichever surface you're on, the wizard feels like one product — and one designed by people who care about how it looks.

### Smart paste handling — never hand-edit a URL again

This one is small in code and huge in friction reduction.

- **Environment URLs.** Paste straight from the Power Platform Admin Center. PPAC shows env URLs without a scheme — `contoso-dev.crm.dynamics.com`. The wizard accepts it, normalizes it, and prepends `https://` for you. It also strips trailing slashes and any leftover path segments. Pasting `https://contoso.crm.dynamics.com/main.aspx` works too.
- **Connection IDs.** A Maker Portal connection-details URL embeds two GUIDs (the environment ID and the connection ID) and a connector apiId. Instead of asking you to pick the right GUID out by hand, the wizard takes the **whole URL** and extracts the connection ID for you. Pasting just the GUID still works.

### Add *any* connector by URL — even ones that aren't on the shortlist

The connector step starts with a curated checklist of the seven most common connectors (Office 365 Users, SharePoint, Dataverse, SQL Server, Teams, Blob, Outlook). After that, it asks **"Add another connector by URL or apiId (blank to finish)"** in a loop.

Paste a Maker Portal connection-details URL like:

```
https://make.powerapps.com/environments/<env>/connections/shared_approvals/<GUID>/details
```

…and the wizard extracts **both** the connector apiId (`shared_approvals`) **and** the connection GUID in one shot — no separate Connection-ID prompt for that connector. Custom connectors. Approvals. Outlook Tasks. Your custom-built APIs. Anything you've published to the environment.

Or paste a bare `shared_xxx` apiId if you only want to create the connection reference now and bind the connection later. The wizard suggests a friendly display name automatically.

---

## Who this is for

- **Power Platform developers** who already know Code Apps exist and want to skip 90% of the boilerplate
- **Consulting teams** building Code Apps for clients, who need a predictable, auditable starting point that survives handover
- **Pro-code developers** new to Power Platform who want to plug into Dataverse and connectors without becoming canvas-app experts
- **Coding agents** (Copilot, Cursor, Claude Code, Aider) — `AGENTS.md` and the instruction set keep them on the rails so they generate Code-App-shaped code, not generic SPAs
- **Microsoft 365 Developer Program tenants** who want to learn Code Apps end-to-end in a free sandbox

---

## What you do *not* have to think about

A short list of things Foundations decides for you so you don't have to:

- The build tool (Vite — required by Code Apps, configured for port 3000 and relative asset paths)
- The component library (Fluent UI v9 — first-party, future-proof, accessible by default)
- The state library (TanStack Query — caching, invalidation, mutations done right)
- The folder structure (three layers: components → hooks → providers + services, with `src/generated/` read-only)
- The auth model (Power Platform host hands you Entra-authenticated identity; no MSAL, no Auth0)
- The data model (connectors and Dataverse — never bypass the generated SDK with a raw fetch)
- The testing stack (Vitest + Testing Library + MSW for connector mocking; Playwright when you need it)
- The deployment story (`pac code push` for dev, solution export/import for test/prod CI/CD)

You disagree with a choice? You can override it. But if you don't disagree, you don't have to think about it. That's the deal.

---

## Get started in two minutes

```bash
# Use the GitHub template (recommended), or:
npx degit martycarreras-psnl/PAppsCAFoundations my-code-app
cd my-code-app

# Pick your wizard:
npm run wizard:ux           # ✨ browser
# OR
cd wizard && npm install && node index.mjs   # classic terminal
```

Both wizards work natively on Windows, macOS, and Linux. Both save progress as you go. Both walk you through everything from prerequisites to your first deploy.

→ **[github.com/martycarreras-psnl/PAppsCAFoundations](https://github.com/martycarreras-psnl/PAppsCAFoundations)**

If you build something with it, I'd love to hear about it. Open an issue, send a PR, or just tell me where the friction was — Foundations is meant to be the kind of repo that gets sharper every time someone uses it.
