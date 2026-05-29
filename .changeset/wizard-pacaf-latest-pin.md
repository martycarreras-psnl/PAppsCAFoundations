---
"@pacaf/wizard": patch
---

Scaffold the first-party `@pacaf/scripts` and `@pacaf/agent-instructions` dev
dependencies from the `latest` dist-tag instead of a `^3.0.0` caret. With a warm
pnpm store the caret range could resolve to a previously-cached 3.x release, so
fresh scaffolds occasionally landed on a stale `@pacaf/*` version while a newer
one was already published. Pinning to `latest` forces the package manager to
re-query the registry on every scaffold; it still writes back the resolved caret
range into the generated project's package.json.
