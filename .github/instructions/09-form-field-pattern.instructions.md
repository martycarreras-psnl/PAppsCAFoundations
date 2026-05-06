---
applyTo: "src/**"
---

# Editable Field Labels — Required Pattern (Metadata-Backed)

Every editable field in a Code App that binds to a Dataverse column **must** use a shared metadata-backed label primitive. This is how the app stays consistent with each column's Dataverse `RequiredLevel` setting without hardcoding `*` asterisks per field, and without drifting when a schema owner flips a column from Optional to Business Required.

This file is non-negotiable. Follow it for every new editable field, in every form, in every dialog, from the moment the first Dataverse-bound input is introduced.

---

## The Three Building Blocks

A compliant app has exactly three pieces powering this pattern. Scaffold them the first time you introduce a Dataverse-bound editable field — then reuse them forever.

### 1. `FieldMetadataRepository` on your data provider

Add to your provider contract (`src/services/<domain>/contracts.ts` or equivalent):

```ts
export type DataverseFieldRequiredLevel = 'none' | 'recommended' | 'application' | 'system';

export interface DataverseFieldMetadata {
  tableLogicalName: string;
  fieldLogicalName: string;
  displayName?: string;
  requiredLevel: DataverseFieldRequiredLevel;
  isRequired: boolean; // true when requiredLevel is 'application' or 'system'
  maxLength?: number;   // String/Memo columns
  minValue?: number;    // Money/Decimal/Integer columns
  maxValue?: number;    // Money/Decimal/Integer columns
  precision?: number;   // Money/Decimal columns
}

export interface FieldMetadataRepository {
  getField(tableLogicalName: string, fieldLogicalName: string): Promise<DataverseFieldMetadata | null>;
}
```

Expose it on the provider:

```ts
export interface MyAppDataProvider {
  // ...existing repositories...
  fieldMetadata: FieldMetadataRepository;
}
```

The **mock provider** returns `null` from `getField` — that is fine, the label falls back to display text with no asterisk during local prototyping.

The **Dataverse provider** implements it by calling `<GeneratedService>.getMetadata({ schema: { columns: 'all' } })` for each registered table, caching per-table, and mapping attributes into `DataverseFieldMetadata`. See the canonical implementation pattern below.

### 2. `DataverseFieldLabel` shared primitive

Create `src/components/ui/dataverse-field-label.tsx`:

```tsx
import * as React from 'react'
import { useDataverseFieldMetadata } from '@/hooks/use-dataverse-field-metadata'
import { Label } from '@/components/ui/label' // Fluent UI wrapper or shadcn Label
import { cn } from '@/lib/utils'

type Props = React.ComponentProps<typeof Label> & {
  /** Dataverse table logical name (e.g. `prefix_vendors`). Omit for client-only fields. */
  tableLogicalName?: string
  /** Dataverse column logical name (e.g. `prefix_vendorname`). Omit for client-only fields. */
  fieldLogicalName?: string
  /** Display text to use when metadata is not available. */
  fallback?: string
  /** Force the required indicator for client-only fields that are not Dataverse-backed. */
  required?: boolean
}

export function DataverseFieldLabel({
  tableLogicalName, fieldLogicalName, fallback, required, className, children, ...rest
}: Props) {
  const { data } = useDataverseFieldMetadata(tableLogicalName ?? '', fieldLogicalName ?? '')
  const text = data?.displayName ?? fallback ?? children
  const isRequired = data?.isRequired ?? required ?? false
  return (
    <Label className={cn(className)} {...rest}>
      {text}
      {isRequired ? <span aria-hidden="true" className="ml-0.5 text-signal-red">*</span> : null}
    </Label>
  )
}

export function useDataverseFieldRequired(
  tableLogicalName: string | undefined,
  fieldLogicalName: string | undefined,
  fallback?: boolean,
): boolean {
  const { data } = useDataverseFieldMetadata(tableLogicalName ?? '', fieldLogicalName ?? '')
  return data?.isRequired ?? fallback ?? false
}
```

And its TanStack Query hook at `src/hooks/use-dataverse-field-metadata.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { useDataProvider } from '@/services/<domain>/provider-context'

export function useDataverseFieldMetadata(tableLogicalName: string, fieldLogicalName: string) {
  const provider = useDataProvider()
  return useQuery({
    queryKey: ['fieldMetadata', tableLogicalName, fieldLogicalName],
    enabled: !!tableLogicalName && !!fieldLogicalName,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: () => provider.fieldMetadata.getField(tableLogicalName, fieldLogicalName),
  })
}
```

### 3. `toDataverseFieldName` convention helper

Create `src/lib/dataverse-field-name.ts`:

```ts
// Every custom column uses the publisher prefix + the domain key lowercased.
// Columns that break the convention must pass an explicit `fieldLogicalName`.

export const DATAVERSE_PREFIX = '<yourprefix>_'; // e.g. 'rpvms_', 'csoeng_'

export function toDataverseFieldName(key: string | undefined | null): string | undefined {
  if (!key) return undefined;
  if (key.startsWith(DATAVERSE_PREFIX)) return key.toLowerCase();
  return `${DATAVERSE_PREFIX}${key.toLowerCase()}`;
}
```

Replace `<yourprefix>_` with the publisher prefix you recorded in [00-before-you-start.instructions.md](00-before-you-start.instructions.md).

---

## Rules (Non-Negotiable)

1. **Never** render a plain `<Label>`, raw `<label>`, or hardcoded `*` asterisk for a Dataverse-bound field. Always use `<DataverseFieldLabel>`.
2. Pass both `tableLogicalName` and `fieldLogicalName`. Prefer `toDataverseFieldName(domainKey)` so the publisher prefix is not hardcoded at call sites.
3. Set `aria-required={required || undefined}` on the input/select/textarea using `useDataverseFieldRequired`.
4. For Business-Required (`ApplicationRequired`) Dataverse fields, add a **client-side guard in the mutation** that throws a clear `"<Display Name> is required."` error when the value is empty. The Web API does **not** enforce `ApplicationRequired` — the app must.
5. Also guard the submit button: `disabled={(required && !(value ?? '').trim()) || mutation.isPending}`.
6. For client-only fields (e.g. a dialog comment that is computed into a record), use `<DataverseFieldLabel required>...</DataverseFieldLabel>` — still route through the primitive so the visual indicator stays consistent with Dataverse-bound fields.
7. When you add a new Dataverse table to the app, register it in your `fieldMetadataServiceRegistry` in the same PR. Without that entry, metadata lookups for that table return `null` and no asterisk will appear.

---

## Critical Gotcha: `RequiredLevel` Is Returned As A STRING

The Power Apps SDK `getMetadata` result returns `RequiredLevel.Value` as one of the **string** names — not a number:

- `"None"`
- `"SystemRequired"`
- `"ApplicationRequired"`
- `"Recommended"`

Older docs and generated type hints may suggest numeric values (`0..3`). Your `mapRequiredLevel` function **must** accept both string and numeric shapes, or `isRequired` will silently stay `false` for every Business-Required column:

```ts
const BY_VALUE: Record<number, DataverseFieldRequiredLevel> = {
  0: 'none', 1: 'system', 2: 'application', 3: 'recommended',
};
const BY_NAME: Record<string, DataverseFieldRequiredLevel> = {
  none: 'none', systemrequired: 'system', applicationrequired: 'application', recommended: 'recommended',
};

export function mapRequiredLevel(value: unknown): DataverseFieldRequiredLevel {
  if (typeof value === 'number' && value in BY_VALUE) return BY_VALUE[value];
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n) && n in BY_VALUE) return BY_VALUE[n];
    const k = value.trim().toLowerCase();
    if (k in BY_NAME) return BY_NAME[k];
  }
  return 'none';
}
```

---

## Canonical Form Helper Pattern

Every editable form builds a small set of helpers (`Field`, `SelectField`, `BoolField`, `ReadOnly`) that close over `tableLogicalName` and use `toDataverseFieldName`. Example shape:

```tsx
function buildHelpers(table: string) {
  function Field({ field, label, value, onChange, explicitFieldLogicalName }: {
    field: string; label: string; value: string; onChange: (v: string) => void; explicitFieldLogicalName?: string;
  }) {
    const logical = explicitFieldLogicalName ?? toDataverseFieldName(field)
    const required = useDataverseFieldRequired(table, logical)
    return (
      <div className="grid gap-1.5">
        <DataverseFieldLabel tableLogicalName={table} fieldLogicalName={logical} fallback={label} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} aria-required={required || undefined} />
      </div>
    )
  }
  // ...SelectField, BoolField, ReadOnly analogously
  return { Field }
}
```

Call sites stay tiny and never mention the prefix:

```tsx
const { Field } = buildHelpers('prefix_vendors')
<Field field="vendorName" label="Vendor Name" value={name} onChange={setName} />
```

---

## Field Constraint Enforcement

Form field helpers must apply Dataverse column constraints as HTML attributes when the metadata is available:

- **Text inputs and textareas:** set `maxLength={metadata.maxLength}` when present
- **Number inputs:** set `min={metadata.minValue}`, `max={metadata.maxValue}`, and `step` derived from `metadata.precision` (e.g. precision 2 → step `"0.01"`)

These properties are available on `AttributeMetadata` records returned by `getMetadata()` but are **not typed** in the Power Apps SDK's TypeScript declarations. Access them via untyped cast in `field-metadata-cache.ts`:

```ts
maxLength: typeof attr.MaxLength === 'number' ? attr.MaxLength : undefined,
minValue: typeof attr.MinValue === 'number' ? attr.MinValue : undefined,
maxValue: typeof attr.MaxValue === 'number' ? attr.MaxValue : undefined,
precision: typeof attr.Precision === 'number' ? attr.Precision : undefined,
```

Example form helper applying constraints:

```tsx
function Field({ field, label, value, onChange, explicitFieldLogicalName }: {
  field: string; label: string; value: string; onChange: (v: string) => void; explicitFieldLogicalName?: string;
}) {
  const logical = explicitFieldLogicalName ?? toDataverseFieldName(field)
  const { data: metadata } = useDataverseFieldMetadata(table, logical ?? '')
  const required = metadata?.isRequired ?? false
  return (
    <div className="grid gap-1.5">
      <DataverseFieldLabel tableLogicalName={table} fieldLogicalName={logical} fallback={label} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        maxLength={metadata?.maxLength}
      />
    </div>
  )
}
```

---

## What This Means For New Work

- When you add a new editable field, **default to** `DataverseFieldLabel` + `aria-required` + save-mutation guard + submit-button guard. Do not ask.
- When you build a new form helper, model it after the helpers above: take `table: string`, compute `logical` via `toDataverseFieldName(field)` (or accept an explicit override), call `useDataverseFieldRequired`, render `DataverseFieldLabel`.
- When you add a new Dataverse table, register it in `fieldMetadataServiceRegistry` in the **same PR**. Metadata silence is the #1 cause of "the asterisk isn't showing".
- When you change a column's `RequiredLevel` in Dataverse, the app picks it up on next metadata fetch (30-minute stale window) — no code change required.
