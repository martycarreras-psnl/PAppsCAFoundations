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

**Do not treat the cadence as optional.** It is the default for any conversation in which the user is describing an idea, scope, workflow, or behavior that has not yet been built — even on a brand-new clone where no source files exist for `applyTo` globs to match. If you find yourself asking two questions in one turn, joining clauses with "and" / "also" / "plus" / a comma, listing options without a recommendation, burying choices inline in the question text, or producing a long requirements outline, you are violating the cadence. Stop and re-ask one **atomic** question with a recommended answer — and whenever there's more than one plausible answer, present the options as a lettered list (`**A)** …`, `**B)** …`, `**C)** …`, one per line, with `*(recommended)*` on your pick) so the user can reply with a letter or several like `A, C`.

## Mandatory Starting Move For A Fresh Clone

If the repository has no `src/`, no `power.config.json`, and no `package.json` at the root, the user has not yet run the setup wizard. Before generating any application code, direct them to run the **browser-based Wizard UX**:

```bash
npx @pacaf/wizard-ux@latest
```

This opens a guided UI at `http://127.0.0.1:5174` in the browser. It is the default and only supported setup experience for all users — no flags, no extra arguments needed.

Do not attempt to manually scaffold a Code App by hand. The wizard handles publisher, solution, App Registration, auth profile, `pac code init`, and the initial smoke tests in the correct order. Skipping it produces apps that cannot be deployed.

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

For Dataverse schema provisioning, data operations, solution lifecycle, and environment administration, this template **requires** the [microsoft/Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin. That plugin teaches coding agents to use the Dataverse MCP server, Python SDK, and PAC CLI through specialist skills (`dv-metadata`, `dv-data`, `dv-query`, `dv-solution`, `dv-admin`, `dv-security`). Any Dataverse work is gated on the plugin being installed and verified — see `.github/instructions/00-prereq-gate.instructions.md`.

### Scope split

| Responsibility | Owner |
|---|---|
| Schema provisioning (tables, columns, relationships, option sets) | **Dataverse-skills plugin** (`dv-metadata`) |
| Existing-schema discovery & OOB-first decision | **This repo** (`07a`) drives plugin `list_tables` / `describe_table` |
| Data operations (CRUD, bulk import, sample data) | **Dataverse-skills plugin** (`dv-data`, `dv-query`) |
| Solution lifecycle (export, import, deploy) | **Dataverse-skills plugin** (`dv-solution`); CI/CD pipeline keeps native `pac solution export` |
| Publisher & solution creation | **Dataverse-skills plugin** (`dv-solution`); the wizard also drives create via its Node Dataverse bridge |
| Environment admin (bulk delete, settings, security roles) | **Dataverse-skills plugin** (`dv-admin`, `dv-security`) |
| Business units, owner teams, Entra security groups, role mappings | **This repo** (`07b`) — plugin gap; agent drives the plugin's Python SDK + `az ad group` |
| Business planning workflow (00a → 00b → 00c → 00d) | **This repo** |
| Planning artifact (`dataverse/planning-payload.json`) — re-runnable source of truth | **This repo** (no `pacaf-validate`/`pacaf-generate`/`pacaf-register` scripts; the agent reads the payload and drives the plugin + PAC CLI directly) |
| Code App scaffold (`pac code init`, Vite, Fluent UI) | **This repo** |
| Connector adapter pattern & `pac code add-data-source` | **This repo** |
| Form field metadata pattern (`DataverseFieldLabel`) | **This repo** |
| Deployment settings & CI/CD | **This repo** |

### Extracting API ID and Connection ID from a Maker Portal URL

When a user pastes a Maker Portal connection URL, extract both values directly — **never ask the user for them**:

```
https://make.powerapps.com/environments/<env>/connections/<API_ID>/<CONNECTION_ID>/details
```

Example: `.../connections/shared_service-now/f8e0094f.../details` → API ID = `shared_service-now`, Connection ID = `f8e0094f...`

Pass directly to `/add-connector`. Works for any connector, known or unknown.

### When the Code Apps plugin is installed The planning workflow in this repo (00a → 00c → planning-payload.json) feeds *into* the plugin's execution — the agent uses `dv-metadata` to provision the schema described by the planning artifact, then returns to this repo's `pac code add-data-source` registration to generate TypeScript services.

### Organizational structure & security (plugin gap)

The plugin does not ship documented skills for **business units, owner teams, or Entra-group-linked teams**. When the planning payload's `orgStructure` section defines data-isolation boundaries, the agent provisions them itself per `.github/instructions/07b-org-structure-and-security.instructions.md` — driving the plugin's bundled Python SDK (`businessunit` / `team` records) plus `az ad group` for Entra security groups. Skip this entirely for flat, org-wide visibility; never custom-model org structure or authorization (`07a` enforces reuse of OOB `businessunit` / `team` / `role`).

### When the plugin is NOT installed

The plugin is a **hard requirement** for Dataverse work — `00-prereq-gate.instructions.md` blocks until it is installed and verified. As a last-resort fallback only, the instruction files in this repo (`07-dataverse-schema.instructions.md`) still contain enough Web API guidance for an agent to provision schema directly, but the supported path is the plugin.

### Install commands

- **GitHub Copilot**: `/plugin install dataverse@awesome-copilot`
- **Claude Code**: `/plugin install dataverse@claude-plugins-official`

### Additional prerequisites

The plugin requires **Python 3** and the **PowerPlatform-Dataverse-Client** SDK (`pip install PowerPlatform-Dataverse-Client pandas`). The setup wizard checks for these.

For the complete, linear, OS-specific install walkthrough — Python → `pip` → SDK + pandas → PAC auth → `/plugin install dataverse` → MCP verification → end-to-end smoke test, each with a verify command and the most common failure/fix — point the user to [docs/dataverse-skills-setup.md](docs/dataverse-skills-setup.md). That file is the single source of truth; do not restate its steps inline or invent alternative install commands.

## Power Apps Code Apps Skills Plugin Integration

For Code App scaffolding, deployment, and connector binding, this template **requires** the [microsoft/power-platform-skills Code Apps plugin](https://github.com/microsoft/power-platform-skills/tree/main/plugins/code-apps). That plugin teaches coding agents the correct patterns for creating, deploying, and extending Code Apps via specialist skills (`/create-code-app`, `/deploy`, `/add-datasource`, `/add-dataverse`, `/add-sharepoint`, and more). Any scaffold, deploy, or connector-binding work is gated on the plugin being installed and verified — see `.github/instructions/00-prereq-gate.instructions.md`.

### Scope split

| Responsibility | Owner |
|---|---|
| New Code App scaffold (`pac code init`, Vite, Fluent UI wiring) | **Code Apps plugin** (`/create-code-app`) |
| Build and deploy (`pac code push`) | **Code Apps plugin** (`/deploy`) |
| Connector routing — pick the right skill for what the user needs | **Code Apps plugin** (`/add-datasource`) |
| Add Dataverse tables as a data source | **Code Apps plugin** (`/add-dataverse`) drives `pac code add-data-source -a dataverse -t <table>` |
| Add SharePoint, Teams, Excel, OneDrive, Office 365, ADO connectors | **Code Apps plugin** (`/add-sharepoint`, `/add-teams`, `/add-excel`, `/add-onedrive`, `/add-office365`, `/add-azuredevops`) |
| Add any other Power Platform connector | **Code Apps plugin** (`/add-connector`) |
| List existing connections to get connection IDs | **Code Apps plugin** (`/list-connections`) |
| Connector adapter pattern & three-layer architecture rules | **This repo** (`02-connectors.instructions.md`) |
| Business planning workflow (00a → 00b → 00c → 00d) | **This repo** |
| Dataverse schema provisioning | **Dataverse-skills plugin** (gated separately — see above) |
| Form field metadata pattern (`DataverseFieldLabel`) | **This repo** (`09-form-field-pattern.instructions.md`) |
| Deployment pipeline, CI/CD, solution promotion | **This repo** (`04-deployment.instructions.md`) |
| Security patterns | **This repo** (`06-security.instructions.md`) |

### CLI compatibility note

This repo standardizes on the PAC CLI (`pac code push`, `pac code add-data-source`) — confirmed as the authoritative CLI by the plugin's own documentation linking to the [Power Apps CLI Reference](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/code). If a plugin skill emits a command in a different form (e.g. `npx power-apps push`), substitute the PAC CLI equivalent per this repo's custom instruction. Never introduce a second CLI tool into the project.

### Scaffolding override — wizard takes precedence

The plugin's `/create-code-app` skill uses `npx degit microsoft/PowerAppsCodeApps/templates/vite` to scaffold a new project. **Do not use this path for PACAF-based repos.** This template's scaffold is `npx @pacaf/wizard-ux@latest`, which sets up the publisher, solution, App Registration, auth profile, and PAC CLI in the correct order. Using `npx degit` directly produces a plain Microsoft template that is not PACAF-aligned and will diverge from this instruction set.

**Rule:** For all other skills (`/deploy`, `/add-*`, `/list-connections`), invoke the plugin skill as directed. For new project scaffold only, use the PACAF wizard and skip the plugin's degit step.

### When the plugin is installed

Invoke the appropriate skill **before** writing any connector-binding or deployment code:

| User intent | Invoke |
|---|---|
| Scaffold a new Code App | `/create-code-app` |
| Build and deploy / push | `/deploy` |
| Add a data source (unsure which type) | `/add-datasource` |
| Add Dataverse tables | `/add-dataverse` |
| Add SharePoint | `/add-sharepoint` |
| Add Teams | `/add-teams` |
| Add Excel | `/add-excel` |
| Add OneDrive | `/add-onedrive` |
| Add Office 365 Outlook | `/add-office365` |
| Add Azure DevOps | `/add-azuredevops` |
| Add Copilot Studio agent | `/add-mcscopilot` |
| Add any other connector | `/add-connector` |
| Get connection IDs | `/list-connections` |

Do **not** hand-roll connector registration steps when the plugin is installed. The skills know the correct `pac code add-data-source` flags, connection ID format, and generated-service adapter pattern for each connector type.

### When the plugin is NOT installed

The plugin is a **hard requirement** for scaffold, deploy, and connector work — `00-prereq-gate.instructions.md` blocks until it is installed and verified.

### Install commands

Both commands are run inside Claude Code or GitHub Copilot (in the agent chat, not the terminal):

```
/plugin marketplace add microsoft/power-platform-skills
/plugin install code-apps-preview@power-platform-skills
```

---

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
