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

## CLI Command

Use the following command to initialize an app:

```bash
pac code init -n <app name> -env <environmentId>
```

**Example:**

```bash
pac code init -n "Asset Tracker" -env "0aa4969d-c8e7-e0a7-9bf8-6925c5922de3"
```

Use the following command to add a data source:

```bash
pac code add-data-source -a <apiId> -c <connectionId>
```

**Example:**

```bash
pac code add-data-source -a "shared_office365users" -c "aa35d97110f747a49205461cbfcf8558"
```

If additional parameters such as table and dataset are required, use:

```bash
pac code add-data-source -a <apiId> -c <connectionId> -t <tableName> -d <datasetName>
```

**Example:**

```bash
pac code add-data-source -a "shared_sql" -c "12767db082494ab482618ce5703fe6e9" -t "[dbo].[MobileDeviceInventory]" -d "paconnectivitysql0425.database.windows.net,paruntimedb"
```

Use the following command to publish an app:

```bash
npm run build
pac code push
```

**Example:**

```bash
pac code push
```

## Using Model and Service

- Read the files under src\Models and src\Services folder for data binding.
- Read the files under .power\schemas folder for other schema reference.
# Power SDK Instructions End