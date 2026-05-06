<!-- Generated from .github/instructions/00-before-you-start.instructions.md — do not edit directly -->
# Before You Start

Complete these manual steps in the Power Platform Admin Center and Maker Portal before any code:

1. **Publisher prefix** — 2–8 lowercase letters, no numbers/hyphens. Record as `PP_PUBLISHER_PREFIX`.
2. **Create the publisher** in Maker Portal → Solutions → Publishers → New Publisher.
3. **Create environments** — Dev (required), Test, Prod. Each must have Dataverse enabled.
4. **Create the solution** in the dev environment linked to your publisher.
5. **Create connections** in each environment for every connector the app uses. Record Connection IDs.
6. **Register the App Registration** as an Application User in each environment.
7. **Verify** with `pac auth select`, `pac org who`, `pac solution list`.
8. **Install the Dataverse-skills plugin** — `/plugin install dataverse@claude-plugins-official`. Requires Python 3 + `pip install PowerPlatform-Dataverse-Client pandas`. Verify with "Connect to Dataverse".

See the canonical file at `.github/instructions/00-before-you-start.instructions.md` for the full checklist and Project Values table.
