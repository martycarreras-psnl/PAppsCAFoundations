<!-- Generated from .github/instructions/ — do not edit directly. See docs/agent-support.md -->
# Components — Codex Scoped Guidance

- Use Fluent UI v9 exclusively — no Tailwind, Material UI, Chakra, Bootstrap, Ant Design
- Functional components with TypeScript interfaces for props
- `makeStyles()` for co-located styles
- Keep components under ~200 lines; extract subcomponents when larger
- Every interactive element must be keyboard-accessible with proper ARIA
- Use `<FluentProvider>` at the app root for theming
- For Dataverse-bound fields: use `<DataverseFieldLabel>`, never plain `<Label>` or hardcoded `*`

Full details: `.github/instructions/03-components.instructions.md`
