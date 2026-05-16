---
"@pacaf/wizard": patch
"@pacaf/agent-instructions": patch
---

Make the Tailwind v4 + CSS pipeline work out of the box. The wizard scaffold now (a) emits `import './index.css';` in `src/main.tsx`, (b) writes a `src/index.css` containing `@import "tailwindcss";`, (c) registers the required `@tailwindcss/vite` plugin in `vite.config.ts`, and (d) declares both `tailwindcss` and `@tailwindcss/vite` as `devDependencies`. Documents both rules in `.github/instructions/01-scaffold.instructions.md` and adds a keyed `TROUBLESHOOTING.md` entry ("My app renders but everything is unstyled"). Closes #48.
