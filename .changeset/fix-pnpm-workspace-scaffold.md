---
"@pacaf/wizard": patch
"@pacaf/wizard-ux": patch
---

Fix Step 7 scaffold failing when the target directory is a pnpm workspace root. Three fixes for issue #76:

- **Detect pnpm workspace roots.** When `pnpm-workspace.yaml` is present at (or above) the project directory, `pnpm add` aborts with `ERR_PNPM_ADDING_TO_ROOT`, silently skipping the runtime `[2/3]` and dev `[3/3]` installs. The wizard now passes `-w` / `--workspace-root` to the `pnpm add` commands in that case (both the CLI wizard and the browser wizard-ux) and warns the user.
- **Add `@fluentui/react-icons` to the runtime dependency list.** The generated `src/App.tsx` imports icons from it, but it was never installed — the smoke test failed with `Failed to resolve import "@fluentui/react-icons"` even in non-workspace directories.
- **Pre-approve pnpm-blocked build scripts.** The generated `package.json` now declares `pnpm.onlyBuiltDependencies` (`esbuild`, `keytar`, `node-pty`, `@azure/msal-node-*`) so installs no longer require the interactive `pnpm approve-builds` step for Vite's bundler and PAC auth credential storage.
