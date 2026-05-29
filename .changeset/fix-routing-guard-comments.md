---
"@pacaf/scripts": patch
---

Fix routing guard false-positive on `BrowserRouter` mentions inside comments.

The prebuild routing guard used a plain word-boundary regex (`\bBrowserRouter\b`) that matched the word `BrowserRouter` anywhere in `src/main.tsx` — including inside the explanatory comment our own scaffold writes (`// HashRouter (NOT BrowserRouter) is required…`). On `@pacaf/scripts@3.0.1` this failed the build outright; on 3.0.2's self-heal it silently rewrote the comment.

The guard now strips comments first, then matches only on real named imports from `react-router-dom` or actual JSX/call usage (`<BrowserRouter>`, `createBrowserRouter(`). Documentation comments are safe.
