# WizardUX — Browser-Based Setup

A browser-based UX for the PAppsCAFoundations setup wizard. Runs alongside the CLI wizard, sharing the same `.wizard-state.json` so you can switch between them at any time.

> Both the CLI wizard at [`../wizard/`](../wizard) and this browser wizard are fully supported entry points. WizardUX now keeps the full nine-step setup flow in the browser, using server-side runners and live logs for long-running commands.

## Quick start

From the repo root:

```bash
npm run wizard:ux
```

This installs `wizard-ux` dependencies on first run, starts the Fastify server on `http://127.0.0.1:5174`, and opens your browser. Press `Ctrl+C` to stop.

## What it does

- Beautiful Fluent UI v9 interface — same stack you'll use to build your Code Apps.
- Step navigator with progress, jump-to-step, resume detection.
- Live log panel with SSE streaming for steps that run server-side.
- Summary page that surfaces every value collected so far.
- Diagnostics view of system tooling and raw state.

## v0 scope

| Step | Browser support |
|---|---|
| 1. Prerequisites | Read-only check screen |
| 2. Project & environment | Full form |
| 3. App Registration | Full form with optional 1Password read/save |
| 4. Auth Setup | Full form + live PAC auth output |
| 5. Publisher | Full form (auto or create new) |
| 6. Solution | Full form (auto or create new) |
| 7. Scaffold | Full form + live scaffold output |
| 8. Connectors | Native defer/notes step |
| 9. Verify & deploy | Full form + live build/deploy output |

All nine steps now stay inside WizardUX. App registration values are collected in browser forms, credentials can be read from or synced to 1Password, PAC auth output streams through the live log, scaffolding runs server-side, and verify/deploy can build and push without opening the old CLI wizard.

## Architecture

```
wizard-ux/
├── server/        Fastify API on :5174
│   ├── routes/    /api/state, /api/system, /api/steps, /api/steps/:n/stream
│   └── steps/     Per-step questions() + apply() modules (mirror wizard/steps/*)
└── src/           React 19 + Fluent UI v9 + TanStack Query
    ├── pages/     Welcome, StepRunner, Summary, Diagnostics
    ├── components/ AppHeader, StepNav, QuestionCard, LiveLog, EmbeddedTerminal, HeroBackground
    └── theme/     Custom Power Platform brand ramp + light/dark/system mode
```

## Security

- Server binds to `127.0.0.1` only.
- CSRF token issued on `/api/handshake`, required on every mutating call.
- Same-origin enforced via CORS.
- Client secrets are held in memory on the server only — never sent back to the browser, never written to logs.
- Auto-shutdown after 10 minutes of API inactivity.

## How it differs from the CLI

The CLI ([`../wizard/`](../wizard)) is the authoritative pipeline. It calls the same `wizard/lib/*` helpers WizardUX does. You can:
1. Start in WizardUX, finish in the CLI.
2. Start in the CLI, finish in WizardUX.
3. Use WizardUX as a state inspector while the CLI runs in another terminal.

`.wizard-state.json` is the single source of truth for both.

## Build for production

```bash
npm run wizard:ux:build           # emits wizard-ux/dist/
NODE_ENV=production npm run wizard:ux  # serves the built app
```

In production mode, Vite is not loaded — Fastify serves the prebuilt SPA from `dist/`.

## Roadmap

- v1: Connector picker UI for step 8 with connection discovery and data-source registration.
- v1: One-click open `make.powerapps.com` to the right environment.
- v2: Replace `react-resizable-panels` with a Fluent-native splitter when one ships.
