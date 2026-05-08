# Solution Streamliner

A Power Apps Code App built with React, Fluent UI v9, TanStack Query, and TypeScript.

## Development

```bash
npm install
npm run dev:local
npm run prototype:seed
npm run dev
```

## Build and Deploy

```bash
npm run build
pac code push
```

## Power Platform

| Property | Value |
|----------|-------|
| Solution | Solution Streamliner |
| Publisher Prefix | `yourprefix` |

| Environment | URL |
|-------------|-----|
| Dev | https://carremacodeapps.crm.dynamics.com |

Connector binding is intentionally deferred until the prototype is stable. Use WizardUX step 8 or `pac code add-data-source` when you are ready for real data.
