# Foundations helper scripts

All published CLI entry points support inert `--help`: no credentials, cloud
requests, sign-in, package downloads, or project changes are needed.

`pacaf-pac`, `pacaf-pac-safe`, and `pacaf-setup-auth` remain PAC-specific helpers
for solution ALM/admin. Their shared state, credential encryption, shell, and
target-verification helpers ship inside this package. They do not depend on a
sibling wizard installation. Wizard state is resolved in the consumer's working
directory (`pacaf-pac-safe --cwd DIR` uses that project).

## Updating safely

`pacaf-update` updates installed helper/instruction packages using the project's
lockfile-selected package manager, then runs the **locally installed**
`pacaf-instructions sync`. It does not use `npx` to download another copy.
Existing dependency ranges and registry configuration remain authoritative.
A failed package update skips sync; failed sync returns nonzero and never prints
“Done.” Older instruction releases without local-edit protection are refused:
review and update their dependency range first.

`pacaf-update --check` checks guidance content and compares both installed package
versions with the configured npm registry. Exit codes: 0 current, 2 drift, 1
failure (including missing local dependencies or an unavailable registry).

Intentional project policy belongs in `.pacaf/policy/` and is explicitly mapped
to shipped guidance destinations in `.pacaf/policy-overlays.json`. These are
whole-file replacements. See the `@pacaf/agent-instructions` package README for
the manifest format, local-edit refusal, backups, and partial-sync recovery.
The updater reapplies registered policy after the sync subprocess, even if that
subprocess fails partway through.

Sync also gates the PAC-to-Power-Apps-CLI policy switch: an existing Code App
needs the exact `@microsoft/power-apps-cli` devDependency `1.0.2` and no legacy
PAC Code App lifecycle scripts. Run the explicit `pacaf-migrate-pa` review/apply
workflow first; updating packages alone does not migrate the app. A deliberately
reviewed whole-policy overlay exception is documented in the instructions
package. `--check` never installs packages.

Consumer tarball smoke: `node --test packages/scripts/tests/package-tarball.test.mjs`
from the monorepo root. It packs and offline-installs local tarballs into an
isolated project, exercises every declared CLI with `--help`, and cleans up.
