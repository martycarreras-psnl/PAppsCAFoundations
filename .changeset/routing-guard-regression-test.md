---
"@pacaf/scripts": patch
---

Add regression tests for the routing guard (issue #74) covering:

- `BrowserRouter` mentioned only inside a `//` line comment in `src/main.tsx` must not trip the guard.
- `BrowserRouter` / `createBrowserRouter` mentioned only inside a `/* … */` block comment must not trip the guard.
- A real `BrowserRouter` named import is still auto-rewritten to `HashRouter`.
- A `src/router.tsx` that calls `createBrowserRouter` is still auto-removed.

These lock in the comment-stripping + precise-regex behavior shipped in 3.0.3 so the 3.0.1-era false-positive cannot regress.
