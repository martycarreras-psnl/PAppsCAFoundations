# AGENTS.md — Top-Level Agent Directive

This file is read by every coding agent that opens this repository (GitHub Copilot, Cursor, Cline, Claude Code, Aider, and any other tool that honors `AGENTS.md` or loads root-level context). It sets non-negotiable guardrails that keep the agent aligned with the purpose of the repo.

If you are a coding agent reading this file: follow these directives before taking any action, suggesting any code, or answering any planning question.

---

## What This Repository Is

This is a **Power Apps Code App template repository**. Every project built from it is a Microsoft Power Platform **Code App**:

- Bundled with Vite
- Written in TypeScript + React 18 + Fluent UI v9
- Deployed via `pac code push` to a Dataverse-enabled Power Platform environment
- Authenticated by Microsoft Entra ID at runtime through the Power Platform host
- Bound to data through Power Platform **connectors** and/or **Dataverse tables** using `pac code add-data-source`

The deliverable is always a Code App. Not a standalone SPA. Not a generic React app.

## Non-Negotiable Constraints

Do **NOT** suggest, scaffold, recommend, or migrate toward any of the following:

- Vercel, Netlify, Cloudflare Pages, GitHub Pages, Firebase Hosting
- Azure Static Web Apps, Azure App Service, Azure Container Apps, Azure Functions (as a host for the UI)
- AWS Amplify, S3 static hosting, Lambda@Edge
- Any Node.js backend server (Express, Fastify, Next.js API routes, NestJS)
- Next.js, Remix, Gatsby, Astro, SvelteKit, Nuxt, Angular, Vue
- Webpack, Parcel, Rspack, Turbopack, esbuild standalone (Vite stays)
- CSS frameworks other than Fluent UI v9 (no Tailwind, Material UI, Chakra, Bootstrap, Ant Design)
- Auth libraries (no Auth0, Clerk, NextAuth, Firebase Auth, MSAL directly) — the Power Platform host handles auth
- Database clients that bypass connectors (no direct `pg`, `mysql2`, Prisma, Drizzle, Mongoose, Supabase client)
- REST or GraphQL clients that bypass the generated connector services in `src/generated/`

If a user asks for any of the above, explain that this is a Code App and redirect them to the Power Platform equivalent (connector, Dataverse table, Custom API, Power Automate flow, or Copilot Studio agent).

## How To Read The Repo

Before writing any code or answering any architectural question, load context in this order:

1. [README.md](README.md) — orientation and quick-start
2. [docs/glossary.md](docs/glossary.md) — Power Platform terminology
3. [.github/instructions/README.md](.github/instructions/README.md) — map of the instruction set
4. The specific `.github/instructions/*.instructions.md` files whose `applyTo` scope matches the files being edited

For a non-trivial app, also read [docs/prototype-golden-path.md](docs/prototype-golden-path.md) to understand the plan-first → prototype-second → connect-later delivery sequence.

## Mandatory Starting Move For A Fresh Clone

If the repository has no `src/`, no `power.config.json`, and no `package.json` at the root, the user has not yet run the setup wizard. Before generating any application code, direct them to run:

```bash
cd wizard
npm install
node index.mjs
```

Do not attempt to manually scaffold a Code App by hand. The wizard handles publisher, solution, App Registration, auth profile, `pac code init`, and the initial smoke tests in the correct order. Skipping it produces apps that cannot be deployed.

## Architectural Rules That Must Never Be Violated

These are enforced by the detailed instruction files but must be respected even before those files load:

1. **Solution-first.** Every Code App lives inside a dedicated Power Platform solution from day one. Never use the default solution.
2. **`src/generated/` is read-only.** Files there are produced by `pac code add-data-source`. Never edit them. Wrap them in provider adapters under `src/services/`.
3. **Three-layer architecture.** Components render, hooks orchestrate, services/providers expose contracts, generated services stay behind adapters. Components never call generated services directly.
4. **Port 3000 for local dev.** The Power Apps SDK requires it. Do not change the Vite port.
5. **Relative asset base for production builds.** `vite.config.ts` must set `base: './'` for `command === 'build'`, or the deployed app will 404 assets inside the Power Apps iframe.
6. **No secrets in source.** No tokens, client secrets, or connection strings in committed files. See [.github/instructions/06-security.instructions.md](.github/instructions/06-security.instructions.md).
7. **Plan before schema.** For non-trivial apps, complete the narrative planning and prototype validation phases before provisioning Dataverse tables or binding real connectors.

## When In Doubt

If the user's request is ambiguous about whether they want a Code App or a generic web app, **ask**. Do not silently produce a generic app. The entire value of this template is its Code-App specificity.

If a requested pattern conflicts with a rule in this file or in `.github/instructions/`, surface the conflict to the user and propose the Code-App-compliant alternative rather than silently ignoring the rule.
