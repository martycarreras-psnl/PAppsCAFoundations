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

**Code App** — A Power Apps app whose UI is hand-written code (React + Vite + TypeScript in this template) instead of the Power Apps canvas designer. It deploys via `pac code push`, runs inside a Power Platform-provided iframe, and uses Power Platform connectors for all data access.

**`pac code init`** — One-time command that registers a new Code App in the active solution and generates `power.config.json`.

**`pac code push`** — Builds nothing itself. Uploads the contents of `./dist/` (produced by `npm run build`) to the environment and publishes the app. Idempotent — re-running overwrites.

**`pac code add-data-source`** — Registers a connector or Dataverse table with the Code App. Writes a connection reference into the solution and generates strongly-typed TypeScript service classes and models into `src/generated/`.

**`pac code run`** — Runs the local Power Platform proxy that wires `npm run dev` on port 3000 to real Power Platform connectors with the developer's auth context. Required for local dev against real data.

**`power.config.json`** — PAC-generated file at the repo root that records the Code App's environment binding, connection references, and build metadata. Do not hand-edit. The wizard and PAC CLI manage it.

**`src/generated/`** — Folder produced by `pac code add-data-source`. Contains one service class and matching model types per registered data source. Never edit these files — they are overwritten on every re-registration. Wrap them in provider adapters under `src/services/`.

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

**Client credentials / SPN flow** — Non-interactive authentication using `PP_TENANT_ID`, `PP_APP_ID`, `PP_CLIENT_SECRET`. Works for `pac solution export/import`, `pac org who`, and most operations. **Does not work for `pac code push`, `pac code add-data-source`, or `pac code run`** — the Power Platform BAP checkAccess API rejects SPN tokens for those.

**Device code flow** — Interactive auth where PAC CLI prints a URL and code, and the user completes login in a browser. Required once per machine for `pac code` commands. The cached refresh token auto-renews for ~90 days.

**PAC auth profile** — A named credential set stored by PAC CLI on the developer's machine. Created with `pac auth create`, switched with `pac auth select`. This template creates profiles named `PowerPlatform-Dev`, `PowerPlatform-Test`, `PowerPlatform-Prod`.

## Adjacent concepts

**Copilot Studio** — Microsoft's platform for building custom conversational agents. Code Apps can invoke a published Copilot Studio agent through the Copilot Studio connector. See [../.github/instructions/08-copilot-studio.instructions.md](../.github/instructions/08-copilot-studio.instructions.md).

**Power Automate flow** — A cloud workflow triggered by events (record created, button clicked, schedule). Code Apps can trigger flows through the Power Automate connector or instantly-triggered child flows.

**DLP (Data Loss Prevention) policy** — Environment-level rules that restrict which connectors can be combined in the same app. Set by Power Platform admins. If a DLP policy blocks your connector pair, the app will fail at runtime with a connector-unavailable error.

**BAP (Business Application Platform) API** — The Power Platform control plane API that `pac code` commands use for publishing. The API that rejects SPN tokens for `pac code push`.

## Tools and CLIs

**PAC CLI (`pac`)** — Power Platform CLI. Installed as a .NET global tool. The primary command-line interface for everything in this repo. This template pins version `2.2.1` because `2.3.2` has a known Code App push bug.

**1Password CLI (`op`)** — Optional credential manager. Resolves `op://vault/item/field` references in `.env` at runtime so secrets never touch disk. Recommended but not required — `.env.template` is the alternative.

**`pac connection list`** — Lists connections in the currently selected environment. Use this to discover existing Connection IDs instead of asking users to hunt them down in the portal.
