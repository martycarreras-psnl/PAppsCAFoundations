---
"@pacaf/wizard": minor
"@pacaf/wizard-ux": minor
"@pacaf/agent-instructions": patch
---

Own the starter payload: stop fetching from `microsoft/PowerAppsCodeApps/templates/starter` via `degit`. Both the CLI wizard (`@pacaf/wizard`) and the browser wizard (`@pacaf/wizard-ux`) now write the entire starter project locally via `createMinimalProject` + `writeConfig` + `writeStarterFiles`.

Why: the upstream template was reshaped from a minimal scaffold into a full setup-wizard app of its own (xterm, an embedded terminal, a question runner, `src/router.tsx` using `createBrowserRouter`, `verbatimModuleSyntax` strict imports, dependencies we never merged). Every reshape leaked surplus files into fresh scaffolds and broke the build (`@fluentui/react-icons` not found, `@xterm/xterm` not found, etc.). Issues #47 and #63 patched the two most visible symptoms; this change removes the entire class of bug by no longer being downstream of a moving target. The `templates/starter/` directory in PAppsCAFoundations stays as documentation only — the wizard does not fetch it.

Also removes the now-unreachable `src/router.tsx` scrub from `writeStarterFiles`, and updates `01-scaffold.instructions.md` to recommend the wizard instead of `npx degit microsoft/...`.
