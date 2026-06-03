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

During the planning phase (00a → 00b → 00c), the default interview style is the **grilling cadence** defined in [.github/instructions/00e-grill-and-document.instructions.md](.github/instructions/00e-grill-and-document.instructions.md): one question at a time with the agent's recommended answer, depth-first dependency resolution, a living glossary in `CONTEXT.md` at the repo root, and lightweight ADRs in `docs/adr/` for hard-to-reverse decisions. Consult `CONTEXT.md` before introducing any new business term and update it inline as terms are sharpened.

## Mandatory Starting Move For A Fresh Clone

If the repository has no `src/`, no `power.config.json`, and no `package.json` at the root, the user has not yet run the setup wizard. Before generating any application code, direct them to run the **browser-based Wizard UX**:

```bash
npx @pacaf/wizard-ux@latest
```

This opens a guided UI at `http://127.0.0.1:5174` in the browser. It is the default and preferred experience for all users — no flags, no extra arguments needed.

**Only fall back to the CLI wizard if the environment is headless or SSH-only** (no browser available):

```bash
npx @pacaf/wizard@latest
```

Do not suggest the CLI wizard unless the user explicitly asks for it or confirms they cannot open a browser. Do not attempt to manually scaffold a Code App by hand. The wizard handles publisher, solution, App Registration, auth profile, `pac code init`, and the initial smoke tests in the correct order. Skipping it produces apps that cannot be deployed.

### Consumer vs. monorepo source contributor

The `npx @pacaf/wizard-ux@latest` flow above is the **consumer** path — it pulls a self-contained published artifact from npm and is what every downstream Code App user runs. It has no workspace prerequisites beyond Node.js. **It is also the right default when the user says "run the wizard" from inside the PACAF monorepo itself** — the published artifact does not read the local workspace, so cwd is irrelevant. Do not stop and demand `pnpm install` just because the cwd happens to be the source tree.

The contributor / source-tree path is different. You are a **contributor** only when the user has explicitly asked for a source-tree invocation such as `pnpm --filter @pacaf/wizard-ux dev`, `node packages/wizard-ux/bin/...`, `node packages/wizard/index.mjs`, or any other `pnpm --filter @pacaf/...` / `node packages/...` command. In that case — and only that case — the workspace must be installed and built first:

```bash
pnpm install
pnpm --filter @pacaf/wizard-ux build
```

Without these, source-tree invocations crash with `Cannot find package 'fastify'` (or similar missing-dependency errors) which look like PACAF bugs but are not. Step 7 of [.github/instructions/00-prereq-gate.instructions.md](.github/instructions/00-prereq-gate.instructions.md) gates on this — but only for explicit source-tree invocations, never for `npx @pacaf/...`.

## Architectural Rules That Must Never Be Violated

These are enforced by the detailed instruction files but must be respected even before those files load:

1. **Solution-first.** Every Code App lives inside a dedicated Power Platform solution from day one. Never use the default solution.
2. **`src/generated/` is read-only.** Files there are produced by `pac code add-data-source`. Never edit them. Wrap them in provider adapters under `src/services/`.
3. **Three-layer architecture.** Components render, hooks orchestrate, services/providers expose contracts, generated services stay behind adapters. Components never call generated services directly.
4. **Port 3000 for local dev.** The Power Apps SDK requires it. Do not change the Vite port.
5. **Relative asset base for production builds.** `vite.config.ts` must set `base: './'` for `command === 'build'`, or the deployed app will 404 assets inside the Power Apps iframe.
6. **HashRouter, never BrowserRouter.** Use `react-router-dom`'s `HashRouter` (or `createHashRouter`) for client-side routing. The Power Apps host owns the URL path; only the fragment is reliably owned by the iframe. `BrowserRouter` 404s on first load and on every deep link. The `pacaf-patch-datasources` prebuild hook fails the build if `src/main.tsx` or `src/router.tsx` still references `BrowserRouter` / `createBrowserRouter`. See [.github/instructions/01-scaffold.instructions.md](.github/instructions/01-scaffold.instructions.md) and issue #47.
7. **No secrets in source.** No tokens, client secrets, or connection strings in committed files. See [.github/instructions/06-security.instructions.md](.github/instructions/06-security.instructions.md).
8. **Plan before schema.** For non-trivial apps, complete the narrative planning and prototype validation phases before provisioning Dataverse tables or binding real connectors.
9. **Instruction files are shipped artifacts.** Anything you edit under `.github/instructions/`, `.claude/rules/`, `.cursor/rules/`, `agent-guidance.config.json`, top-level `AGENTS.md`, or top-level `CLAUDE.md` is the **payload of the `@pacaf/agent-instructions` npm package**. Forks, downstream repos, and every new `npx @pacaf/wizard-ux@latest` scaffold receive your edit. You **must** follow the full publishing flow in [.github/instructions/10-publishing.instructions.md](.github/instructions/10-publishing.instructions.md) \u2014 sync the package payload via `node packages/agent-instructions/scripts/sync-from-root.mjs`, add an `@pacaf/agent-instructions` changeset, commit canonical + projections + manifest + payload + changeset atomically, and let the Release workflow publish. Do not edit `packages/agent-instructions/{instructions,claude,cursor}/` directly \u2014 those are overwritten by the sync script. Do not skip the changeset on the assumption that \"it's just documentation.\"

## Dataverse-skills Plugin Integration

For Dataverse schema provisioning, data operations, solution lifecycle, and environment administration, this template defers to the [microsoft/Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin. That plugin teaches coding agents to use the Dataverse MCP server, Python SDK, and PAC CLI through specialist skills (`dv-metadata`, `dv-data`, `dv-query`, `dv-solution`, `dv-admin`, `dv-security`).

### Scope split

| Responsibility | Owner |
|---|---|
| Schema provisioning (tables, columns, relationships, option sets) | **Dataverse-skills plugin** (`dv-metadata`) |
| Data operations (CRUD, bulk import, sample data) | **Dataverse-skills plugin** (`dv-data`, `dv-query`) |
| Solution lifecycle (export, import, deploy) | **Dataverse-skills plugin** (`dv-solution`) |
| Environment admin (bulk delete, settings, security roles) | **Dataverse-skills plugin** (`dv-admin`, `dv-security`) |
| Business planning workflow (00a → 00b → 00c → 00d) | **This repo** |
| Planning artifact validation & generation | **This repo** (`validate-schema-plan.mjs`, `generate-dataverse-plan.mjs`) |
| Code App scaffold (`pac code init`, Vite, Fluent UI) | **This repo** |
| Connector adapter pattern & `pac code add-data-source` | **This repo** |
| Form field metadata pattern (`DataverseFieldLabel`) | **This repo** |
| Deployment settings & CI/CD | **This repo** |

### When the plugin is installed

If the Dataverse-skills plugin is installed, prefer it for all Dataverse environment operations. The planning workflow in this repo (00a → 00c → planning-payload.json) feeds *into* the plugin's execution — the agent uses `dv-metadata` to provision the schema described by the planning artifact, then returns to this repo's `pac code add-data-source` registration to generate TypeScript services.

### When the plugin is NOT installed

The instruction files in this repo (`07-dataverse-schema.instructions.md`) still contain enough guidance for agents to provision schema via the Web API directly. The plugin is strongly recommended but not a hard requirement.

### Install commands

- **GitHub Copilot**: `/plugin install dataverse@awesome-copilot`
- **Claude Code**: `/plugin install dataverse@claude-plugins-official`

### Additional prerequisites

The plugin requires **Python 3** and the **PowerPlatform-Dataverse-Client** SDK (`pip install PowerPlatform-Dataverse-Client pandas`). The setup wizard checks for these.

For the complete, linear, OS-specific install walkthrough — Python → `pip` → SDK + pandas → PAC auth → `/plugin install dataverse` → MCP verification → end-to-end smoke test, each with a verify command and the most common failure/fix — point the user to [docs/dataverse-skills-setup.md](docs/dataverse-skills-setup.md). That file is the single source of truth; do not restate its steps inline or invent alternative install commands.

## When In Doubt

If the user's request is ambiguous about whether they want a Code App or a generic web app, **ask**. Do not silently produce a generic app. The entire value of this template is its Code-App specificity.

If a requested pattern conflicts with a rule in this file or in `.github/instructions/`, surface the conflict to the user and propose the Code-App-compliant alternative rather than silently ignoring the rule.

## Form Field Pattern (REQUIRED — Dataverse Metadata-Backed Labels)

Every editable field whose value is written to Dataverse **must** use a shared `DataverseFieldLabel` primitive backed by live Dataverse metadata. This is how a Code App stays consistent with each column's `RequiredLevel` setting without per-field hardcoding, and without drifting when a schema owner flips a column from Optional to Business Required.

Rules (non-negotiable, apply from the very first Dataverse-bound input in every new project):

1. **Never** render a plain `<Label>`, raw `<label>`, or hardcoded `*` asterisk for a Dataverse-bound field. Use `<DataverseFieldLabel tableLogicalName="..." fieldLogicalName="..." fallback="..." />`.
2. Domain-model keys map to Dataverse logical names via a single `toDataverseFieldName(key)` helper in `src/lib/dataverse-field-name.ts` (convention: `<publisherPrefix>_` + key.toLowerCase()). Pass an explicit `fieldLogicalName` only for out-of-convention columns (e.g. OOTB Dataverse attributes).
3. Set `aria-required={required || undefined}` on the input/select/textarea using `useDataverseFieldRequired(table, field)` from the label module.
4. For client-only fields that are not Dataverse-backed (e.g. a dialog comment that is computed into another record), use `<DataverseFieldLabel required>...</DataverseFieldLabel>` — still go through the primitive so the visual indicator stays consistent.
5. When writing a form mutation for a Business-Required (`ApplicationRequired`) column, guard client-side using the metadata and throw a clear `"<Display Name> is required."` error when the value is empty. The Web API does **not** enforce `ApplicationRequired` — the app must.
6. Also guard the submit button: `disabled={(required && !(value ?? '').trim()) || mutation.isPending}`.
7. When adding a new Dataverse table to the app, register its `getMetadata` call in `fieldMetadataServiceRegistry` in the same PR. Without that entry, metadata lookups for that table return `null` and the asterisk will not appear.

Critical gotcha: The Power Apps SDK `getMetadata` result returns `RequiredLevel.Value` as a **string name** (`"None" | "SystemRequired" | "ApplicationRequired" | "Recommended"`), not a numeric value. Your `mapRequiredLevel` function must accept both shapes.

Full pattern — including provider contract, provider implementation, shared primitive, hook, and canonical form helper shape — is in [.github/instructions/09-form-field-pattern.instructions.md](.github/instructions/09-form-field-pattern.instructions.md). Read that file before introducing the first Dataverse-bound editable field in a new project, and scaffold all three building blocks (`FieldMetadataRepository`, `DataverseFieldLabel`, `toDataverseFieldName`) at once.

Do not ask the user whether to apply this pattern. It is the default for every editable Dataverse-bound field in every Code App built from this template, forever.
