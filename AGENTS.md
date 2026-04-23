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
