---
paths:
  - "src/**"
---
<!-- Generated from .github/instructions/09-form-field-pattern.instructions.md — do not edit directly -->
# Form Field Pattern — Metadata-Backed Required Indicators

**Non-negotiable.** Every editable field bound to a Dataverse column must use `<DataverseFieldLabel>`.

Key rules:
1. Never render a plain `<Label>`, raw `<label>`, or hardcoded `*` for a Dataverse-bound field
2. Use `<DataverseFieldLabel tableLogicalName="..." fieldLogicalName="..." fallback="..." />`
3. Map domain keys to Dataverse logical names via `toDataverseFieldName(key)` in `src/lib/dataverse-field-name.ts`
4. Set `aria-required={required || undefined}` using `useDataverseFieldRequired(table, field)`
5. Guard submit: `disabled={(required && !(value ?? '').trim()) || mutation.isPending}`
6. Guard mutations for `ApplicationRequired` columns — the Web API does NOT enforce it
7. Register each new table's `getMetadata` call in `fieldMetadataServiceRegistry`
8. `RequiredLevel.Value` is a **string** (`"None" | "SystemRequired" | "ApplicationRequired" | "Recommended"`), not numeric

Scaffold all three building blocks at once: `FieldMetadataRepository`, `DataverseFieldLabel`, `toDataverseFieldName`.

Full details: `.github/instructions/09-form-field-pattern.instructions.md`
