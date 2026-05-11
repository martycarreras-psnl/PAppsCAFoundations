---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "src/App.tsx"
---
<!-- Generated from .github/instructions/03-components.instructions.md — do not edit directly -->
# Component Architecture & UI Patterns

Key rules:
- Use Fluent UI v9 exclusively — no Tailwind, Material UI, Chakra, Bootstrap, Ant Design
- Functional components only, with TypeScript interfaces for props
- Co-locate styles using `makeStyles()` from `@fluentui/react-components`
- Use TanStack Query for server state, React context for UI state
- Keep components under ~200 lines; extract subcomponents when larger
- Use React Router for navigation; route-level code splitting with `React.lazy`
- Every interactive element must be keyboard-accessible and have proper ARIA attributes
- Use `<FluentProvider>` at the app root for theming

Full details: `.github/instructions/03-components.instructions.md`
