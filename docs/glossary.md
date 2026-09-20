# Glossary — Power Platform & Code App Terms

A one-page reference for the Power Platform terminology used across this repo. If a term in an instruction file or wizard prompt is unfamiliar, look here first.

Terms are grouped by the part of the stack they belong to.

---

## Power Platform fundamentals

**Environment** — A container in Power Platform that holds apps, flows, Dataverse data, and connections. Teams typically have separate dev, test, and production environments so changes can be promoted safely. Every environment has a unique URL like `https://your-org-dev.crm.dynamics.com`.

**Dataverse** — The managed relational database built into Power Platform. When you hear "Dataverse table" think "SQL table with metadata, security, and APIs included." Code Apps can read and write Dataverse tables through the Dataverse connector.

**Solution** — A versioned package that groups related Power Platform artifacts (Code App, tables, columns, option sets, connection references, environment variables, security roles, flows) so they can be exported from one environment and imported into another. **Every Code App must live inside a solution from day one.** The default solution is not exportable and should never be used.

**Managed vs unmanaged solution** — Unmanaged solutions are editable in place and used in dev. Managed solutions are the exported, locked version used in test and prod. You edit unmanaged, export to managed, import managed downstream.

**Publisher** — The owner identity behind a solution. Its **prefix** (a 2–8 character lowercase string like `csoeng`) becomes the namespace for every table, column, option set, and connection reference the solution contains. The prefix cannot be changed after data exists, so pick carefully.

## Code Apps specifically

**Code App** — A Power Apps app whose UI is hand-written code (React + Vite + TypeScript in this template) instead of the Power Apps canvas designer. It deploys through guarded local `pa app push`, runs inside a Power Platform-provided iframe, and uses Power Platform connectors for all data access.

**`pa app init`** — Initializes local Code App metadata using `--display-name` and `--environment-id`. The wizard invokes it through the pinned local CLI; it does not select an "active solution." Never reinitialize an existing app as a migration step.

**`pacaf-deploy` / `pa app push`** — The PACAF helper validates target/auth, builds, and publishes through the local CLI with `--solution-id <GUID>`. Push alone does not build. Updates preserve the existing app ID; initial creation needs explicit `--allow-create` in user mode.

**`pa app add data-source`** — Registers a connector or Dataverse table and generates TypeScript services/models. Uses `--connector`, `--connection-id`, `--table`, and `--dataset`; solution-aware bindings use `--connection-ref` plus `--solution-id <GUID>`. Refresh uses `app refresh data-source --name`.

**`pa app run`** — Starts the Power Apps local host on port 8080. PACAF runs it with `--config-only --port 8080 --local-app-url http://localhost:3000` beside a separate Vite server on 3000, with companion shutdown. Mock-only dev does not need it.

**`power.config.json`** — CLI-managed app/environment identity, bindings, and build metadata. Preserve it across migration. Push uses its verified environment; do not append `--environment-id` to push.

**`.power-apps-targets.json`** — Durable, non-secret expected target identities (`version: 1`, named `targets` with environment ID/URL, tenant, account, app ID, solution ID/name). Deployment checks it against the app config rather than relying only on ignored wizard state.

**`src/generated/`** — CLI-generated service classes and model types. Never edit these files — regeneration overwrites them. Verify actual output after CLI changes and wrap services in provider adapters under `src/services/`.

## Connectors

**Connector** — A pre-built integration between Power Platform and an external system (Dataverse, SharePoint, SQL, Office 365 Users, Teams, etc., plus any custom connector you or your org publishes). Code Apps call connectors through generated service classes.

**Connection** — A specific, authenticated instance of a connector inside a specific environment. One connector can back many connections. Each connection has a unique Connection ID scoped to its environment.

**Connection reference** — A solution-aware pointer from a Code App to "some connection that implements this connector." The reference travels with the solution. The actual connection must be created per environment and mapped to the reference at import time.

**Connection ID** — The UUID that identifies a specific connection in a specific environment. Found in the Power Apps Maker Portal URL when viewing the connection: `…/connections/shared_office365users/<CONNECTION_ID>/details`. Environment-specific — dev, test, and prod all have different IDs for "the same" connection.

**Custom connector** — An OpenAPI-described integration you author to wrap an arbitrary REST API. Once published it behaves like any built-in connector.

## Dataverse schema

**Table** — A Dataverse entity. Has a logical name (always prefixed, e.g., `csoeng_project`) and a set of columns.

**Column** — A field on a table. Called "attribute" in older APIs.

**Option set / Choice** — An enumerated list of values (e.g., Status = Active | Archived | Deleted). Can be local to one column or global and reused across tables.

**Lookup** — A relationship column that points to a row in another table. The Code App equivalent of a foreign key.

**Security role** — A Dataverse-level permission set. Controls who can read, write, update, or delete rows in which tables.

## Authentication and secrets

**App Registration** — An identity in Microsoft Entra ID that represents an application (not a human). Has a client ID, tenant ID, and one or more client secrets. Used for headless authentication in CI/CD and local dev.

**Service Principal (SPN)** — The instantiated identity of an App Registration inside a specific tenant. When you grant an App Registration access to a Dataverse environment as an "Application User," you are granting its SPN access.

**Application User** — The Dataverse-level record that links an App Registration to an environment and assigns it security roles. Required for SPN auth to work against that environment.

**Client credentials / SPN flow** — PAC ALM uses `PP_TENANT_ID`, `PP_APP_ID`, `PP_CLIENT_SECRET`. Separately, opted-in Power Apps CLI updates use `PA_CLI_USE_SP_AUTH=true` and `PA_CLI_SP_CLIENT_ID`, `PA_CLI_SP_CLIENT_SECRET`, `PA_CLI_SP_TENANT_ID`. The Code App must already be published, with environment access and maker-granted app edit access. Never enable SPN or grant access automatically.

**Interactive user sign-in** — The Power Apps CLI uses `pa auth login --account <email>`, `auth status --json`, and `auth switch --account <email>`. It is separate from PAC's browser/device-code sign-in and cached profiles.

**Home-account identity** — CLI 1.0.2 exposes `activeAccount.username` and MSAL `homeAccountId`, not the token's resource tenant. Even equality with the expected home tenant is insufficient: the cached account may acquire a token for another tenant. Use it only for stable account identity.

**Global Discovery Service (GDS)** — Provides authoritative environment discovery. Guarded user publishing requires separate explicit Azure CLI login, then a read-only query to the fixed cloud-specific endpoint matching `EnvironmentId`, `TenantId`, and `Url`. This verifies the environment's tenant independently, not the opaque `pa` token's tenant. Missing rows/access fail closed.

**PAC auth profile** — A named credential set created with `pac auth create` and switched with `pac auth select`. It serves ALM/admin operations, not the separate `pa` account.

**Enterprise Application object ID** — The SPN object identifier a maker uses for `pa app share --principal <id> --access edit`. It is neither the App Registration object ID nor the application/client ID used for authentication.

## Adjacent concepts

**Copilot Studio** — Microsoft's platform for building custom conversational agents. Code Apps can invoke a published Copilot Studio agent through the Copilot Studio connector. See [../.github/instructions/08-copilot-studio.instructions.md](../.github/instructions/08-copilot-studio.instructions.md).

**Power Automate flow** — A cloud workflow triggered by events (record created, button clicked, schedule). Code Apps can trigger flows through the Power Automate connector or instantly-triggered child flows.

**DLP (Data Loss Prevention) policy** — Environment-level rules that restrict which connectors can be combined in the same app. Set by Power Platform admins. If a DLP policy blocks your connector pair, the app will fail at runtime with a connector-unavailable error.

**BAP (Business Application Platform) API** — Part of the Power Platform control plane. Historical PAC publishing restrictions must not be generalized to the current Power Apps CLI's documented existing-app SPN update flow.

## Tools and CLIs

**Power Apps CLI (`pa`)** — `@microsoft/power-apps-cli@1.0.2`, exact-pinned as a local devDependency. Use `pacaf-pa` via npm scripts or the verified local binary, never bare `npx pa`. Separate from runtime SDK `@microsoft/power-apps@1.4.0`.

**PAC CLI (`pac`)** — Power Platform CLI, retained for solution export/import/pack/unpack and environment/admin operations. It is not the Code App lifecycle CLI.

**1Password CLI (`op`)** — Optional credential manager. Resolves `op://vault/item/field` references in `.env` at runtime so secrets never touch disk. Recommended but not required — `.env.template` is the alternative.

**`pa connection list`** — Lists connections for the verified app environment. Invoke through `npm run pa -- connection list --json` when selecting Code App bindings; do not assume a PAC-selected environment establishes the `pa` target.
