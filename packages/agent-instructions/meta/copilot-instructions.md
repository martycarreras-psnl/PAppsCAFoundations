# Power SDK Instructions Start
## Overview

This guide explains how to initialize an app, add a data source using the Power SDK CLI and generate the corresponding Models and Services, and publish the app.

**Always continue immediately** without asking for confirmation at each step.

## Planning Interview Style — ALWAYS ON

Whenever the user is describing an app idea, business problem, workflow, scope, or any not-yet-built behavior — i.e. the conversation is in planning, not implementation — interview them using the **grilling cadence**, not a structured questionnaire:

1. **Ask one atomic question at a time.** Never batch multiple questions. A compound question joined by "and", "also", "plus", or a comma is two questions — split it and ask the first one.
2. **Always supply your own recommended answer** with the question. The user can accept, reject, or refine. This is faster than open-ended prompts and exposes your assumptions for challenge.
3. **Present options as a lettered list — every time.** When the question has more than one plausible answer, lay choices out as `**A)** …`, `**B)** …`, `**C)** …` (one per line), mark your recommendation with `*(recommended)*`, and invite the user to reply with just a letter — or multiple like `A, C` if more than one applies. Never bury options inline in the question text.
4. **Walk depth-first.** When an answer reveals a dependency, resolve the dependency before moving sideways to the next topic.
5. **Read before you ask.** If a question can be answered by exploring the codebase, reading existing solution metadata, querying Dataverse schema, or consulting `CONTEXT.md`, do that and surface what you found; only ask if it's still ambiguous.
6. **Sharpen fuzzy language into `CONTEXT.md`** at the repo root as terms are resolved. Update inline, not in batches. When a glossary term is canonicalized, propose the bridge: `CONTEXT.md` term → Dataverse `DisplayName` in `planning-payload.json` → `DataverseFieldLabel` `fallback` prop.
7. **Offer an ADR in `docs/adr/`** only when all three hold: hard to reverse + surprising without context + real trade-off.

Full protocol — including PACAF-specific ADR triggers, the `CONTEXT.md` format, and integration with the 00a → 00b → 00c → 00d phases — lives in `.github/instructions/00e-grill-and-document.instructions.md`. Read it whenever a planning conversation starts; do not skip to implementation while the business narrative is still unstable.

## CLI boundary

Use the PACAF wizard for new projects, never manually reinitialize an existing app. Code App operations use exact-pinned local `@microsoft/power-apps-cli@1.0.2` via `pacaf-pa`, separate from runtime SDK `@microsoft/power-apps@1.4.0`. PAC remains for solution ALM/admin; Dataverse-skills ownership is unchanged. Auth caches are separate.

The following are npm-script/local-bin command shapes, not global executables or download-on-demand commands. Never use bare `npx pa`.

```bash
# Wizard initialization only
pacaf-pa app init --display-name "Asset Tracker" --environment-id "<environment-id>"

# After planning and invoking the matching Code Apps plugin skill
pacaf-pa app add data-source --connector shared_office365users --connection-id "<connection-id>"
pacaf-pa app add data-source --connector shared_sql --connection-id "<connection-id>" --table "[dbo].[MobileDeviceInventory]" --dataset "<server>,<database>"
pacaf-pa app add data-source --connector dataverse --table "<logical-table-name>"
pacaf-pa app refresh data-source --name "<data-source-name>"
pacaf-pa app remove data-source --connector "<connector-id>" --name "<data-source-name>"

# Non-mutating checks, then guarded build and publish
pacaf-deploy --target dev --preflight
pacaf-deploy --target dev
```

`pacaf-deploy` validates `.power-apps-targets.json` against `power.config.json` and the selected account/tenant, builds, then publishes with a solution **GUID**. Never use a solution unique name as `--solution-id`, append `--environment-id` to push, or bypass target checks. SPN updates require explicit opt-in plus an existing published app with environment access and maker-granted edit access. No automatic permission grants.

CLI 1.0.2 user status does **not** prove the resource tenant; even home-account equality is insufficient. User publish/first creation requires separate explicit Azure CLI login and read-only fixed-cloud Global Discovery Service evidence matching environment ID, tenant, and URL. Missing evidence fails closed, with no auto-login or unguarded fallback. Offline preflight makes no Azure/auth calls.

Connected dev uses separate Vite (3000) and local host (8080) processes: `pacaf-pa app run --config-only --port 8080 --local-app-url http://localhost:3000`, with companion shutdown. Keep mock-only development, HashRouter, relative production assets, and metadata-backed form labels. See `01-scaffold`, `02-connectors`, and `04-deployment` for full contracts.

## Using Model and Service

- Read generated models/services under `src/generated/` and metadata under `.power/schemas/`; verify actual generated paths after registration. Generated files are read-only.
- Wrap generated services in `src/services/` providers; hooks orchestrate and components render. Use `DataverseFieldLabel` and live metadata validation for editable Dataverse fields.
# Power SDK Instructions End