<!-- Generated from .github/instructions/00-before-you-start.instructions.md — do not edit directly -->
# Before You Start

1. **Step 1 (HARD GATE) — Install the Dataverse-skills plugin.** Every Dataverse operation (schema, data, queries, solution lifecycle, env admin, security) is delegated to the [microsoft/Dataverse-skills](https://github.com/microsoft/Dataverse-skills) plugin — the first-class, only-supported path. Do this before anything else; the agent stops on any Dataverse work until it's installed and its MCP tools are reachable (`00-prereq-gate.instructions.md`, Step 8). Needs Python 3 + `pip install PowerPlatform-Dataverse-Client pandas`. Install (note: Copilot **CLI** ≠ VS Code Copilot chat): Copilot CLI → at the `copilot` prompt `/plugin install dataverse@awesome-copilot`; Claude → `claude plugin install dataverse@claude-plugins-official`. Restart the editor so MCP tools load, then verify.
2. **Step 2 — Decide your publisher prefix** (2–8 lowercase letters, no numbers/hyphens). The most consequential naming decision — namespace for every table, column, option set, env var, connection reference, and role. Cannot change after data exists. Record as `PUBLISHER_PREFIX`.
3. **Step 3 — Create the publisher (no longer by hand in the Maker Portal).** The wizard's **Solution & Publisher** step discovers/creates it; or ask your agent to use the **dv-solution** skill (reuse over duplication). A hand-made publisher can drift from the expected prefix.
4. **Step 4 — Create environments** — Dev (required), Test, Prod, each Dataverse-enabled, in the Power Platform Admin Center. Record each URL (the wizard normalizes a scheme-less host and prepends `https://`).
5. **Step 5 — Create the solution (also created for you, not hand-built).** The wizard's **Solution & Publisher** step detects/creates it bound to the publisher and writes `SOLUTION_NAME` + prefix into `.env` / `power.config.json`; or use the **dv-solution** skill. The Code App is added to the solution on the first `pac code push` (`-s`) — no manual add.
6. **Step 6 — Create connections** in each environment for every connector. Create them **before** importing the solution or references go unmapped. You can paste the full Maker Portal connection URL into the wizard (it extracts the apiId + connection ID).
7. **Step 7 — Register the App Registration as an Application User** in each environment and assign a security role.
8. **Step 8 — Verify** with `pac auth select`, `pac org who`, `pac solution list`.

The **Project Values** table's publisher/solution values (`PUBLISHER_*`, `CHOICE_VALUE_PREFIX`, `SOLUTION_*`) are produced by the wizard or the `dv-solution` skill (Steps 3 & 5) — record them once they exist; you supply the prefix decision, environment URLs, and connection IDs as you go.

See the canonical file at `.github/instructions/00-before-you-start.instructions.md` for the full checklist and Project Values table.
