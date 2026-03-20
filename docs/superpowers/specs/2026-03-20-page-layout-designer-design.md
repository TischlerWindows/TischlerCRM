# Page layout designer — design specification

**Date:** 2026-03-20  
**Status:** Implemented (designer-first phase — 2026-03-20)  
**Related plan:** Page layout designer overhaul (designer-first)

**Implementation notes:** Hybrid persistence landed in Prisma (`PageLayout.extensions`, `LayoutSection` flags / `visibleIf` / `description`, `LayoutField.presentation`) with Zod validation in `apps/api/src/routes/layouts.ts`. Shared evaluators live in `apps/web/lib/layout-formatting.ts` and `field-visibility.ts`. Page Editor modules: `page-editor/types.ts`, `build-page-layout.ts`, `layout-list-view.tsx`, `layout-preview-dialog.tsx`, `formatting-rules-dialog.tsx`. Runtime parity: `dynamic-form.tsx`, `record-detail-page.tsx`. SQL migration: `packages/db/prisma/migrations/page_layout_extensions/migration.sql`.

## 1. Goals

- Deliver a **Lightning / Zoho–class** page builder UX: clear palette, canvas, and properties inspector, with room to grow (related lists, custom components later).
- Keep **dynamic resizing** (column/row span) as today.
- Support **vertical sections** (stacked within tabs) with improved section chrome (label, optional description, collapse in editor).
- Add **layout-scoped field presentation**: label bold, label color via **tokens** only (no user-supplied CSS/class names).
- Introduce **layout-level conditional formatting** (visibility/read-only/badge/highlight) using the same **condition DSL** as field visibility (`ConditionExpr[]`).
- **Phase 1:** designer + persisted model + **in-editor preview** using the same evaluators as runtime will use.  
- **Phase 2:** wire **DynamicForm** and **record detail** for full parity (see §8).

## 2. Information architecture (builder)

| Region | Responsibility |
|--------|----------------|
| **Toolbar** | Layout name, back to list, save, open preview |
| **Palette** | Searchable field list; drag sources |
| **Canvas** | Tabs, sections, columns, placed fields, resize handles, drop targets |
| **Inspector** | Contextual props for selected tab / section / field |
| **Preview (modal)** | Read-only layout render with sample data + optional overrides |

**Selection model:** single selection (`tab` | `section` | `field`). Layout-wide actions (e.g. formatting rules) live in inspector when no element is selected or via a dedicated control in the toolbar (implementation: toolbar “Preview” + layout rules access from inspector empty state).

## 3. Data model (TypeScript)

### 3.1 `PageField.presentation` (layout-scoped)

```ts
// Token keys — mapped to Tailwind classes in code (allowlist)
labelColorToken?: 'default' | 'brand' | 'muted' | 'danger' | 'success'
labelBold?: boolean
```

Embedded on each `PageField` alongside `column`, `order`, `colSpan`, `rowSpan`. Enrichment (`enrichLayoutFieldDefs`) must **preserve** `presentation` when merging field defs.

### 3.2 `PageSection`

Existing: `visibleIf`, `showInRecord`, `showInTemplate`.  
**New:** optional `description?: string` (short helper text under section title in preview/runtime).

### 3.3 `FormattingRule` (layout-level)

Replaces ambiguous string `when` with explicit conditions:

- `when: ConditionExpr[]` — AND semantics, same as `visibleIf`.
- `target`: `{ kind: 'field', fieldApiName: string }` | `{ kind: 'section', sectionId: string }`.
- `order: number` — lower runs first.
- `active: boolean`
- `effects`: `{ hidden?, readOnly?, badge?, highlightToken? }`  
  - **No** user-controlled `className` in v1. Legacy `className` on old types is **ignored** at runtime until migrated.

**Semantics:** Evaluate rules in **ascending `order`**. The **first** active rule whose `when` is true and whose `target` matches the current field/section **wins** (Salesforce-simple, easy to explain). Phase 2 may introduce merging for non-conflicting effects if product requires it.

### 3.4 Field visibility: object vs layout (deprecation path)

**Today:** Page Editor saves field visibility onto **`FieldDef.visibleIf`** (object-wide).  
**Target:** Support **layout-only** visibility overrides (same field, different layouts) without mutating `FieldDef`.

**Backward compatibility (phase 2):**

- Effective visibility = `evaluateVisibility(layoutOverride ?? fieldDef.visibleIf)` once layout overrides exist.
- Phase 1: continue writing field rules to `FieldDef` from the existing modal; document that layout overrides are future work. Preview may combine both when introduced.

## 4. Persistence strategy (locked: **Hybrid C**)

| Concern | Storage |
|---------|---------|
| Section flags + conditional visibility + description | **`LayoutSection`** columns: `showInRecord`, `showInTemplate`, `visibleIf` (JSON), `description` (text) |
| Layout-level formatting rules + future extras | **`PageLayout.extensions`** JSON: `{ formattingRules?: FormattingRule[], version?: number }` |
| Per-field presentation | **`LayoutField.presentation`** JSON |

**Rationale:** Section metadata is relational and small; rules + presentation fit JSON without exploding table count. Strict **Zod** validation on API write; treat parse errors as 400.

### 4.1 Sync with org schema (`saveSchema`)

Object Manager persists full `PageLayout` objects inside the org schema document (local / settings API). **Relational** layouts API must accept the same shape so a future sync job or dual-write can reconcile.

**Rule:** Any new field on `PageLayout` / sections / layout fields in TypeScript must be **represented** in either Prisma columns or `extensions` / `presentation` JSON and validated on `POST/PUT /layouts`.

## 5. Shared evaluation (preview + runtime)

- **Visibility:** existing [`apps/web/lib/field-visibility.ts`](apps/web/lib/field-visibility.ts) — `evaluateVisibility(conditions, data, context)`.
- **Formatting:** new [`apps/web/lib/layout-formatting.ts`](apps/web/lib/layout-formatting.ts) — `getFormattingEffectsForTarget(rules, target, data, context)` implementing first-match semantics.

Preview and (phase 2) `DynamicForm` / record detail **must import the same modules** — no duplicated condition logic.

## 6. Preview semantics (phase 1)

- Build a **synthetic record**: default values by field type (empty string, 0, false, etc.).
- Optional **“Edit sample values”** JSON or simple key/value UI later; v1 uses deterministic defaults + optional toggles for picklists where useful.
- Respect: section `visibleIf`, `showInTemplate` (preview simulates form), field `visibleIf`, `formattingRules` for field targets, `presentation` for labels.
- Section-target formatting: `hidden` hides the whole section in preview.

## 7. API / Prisma (summary)

- Migration adds: `PageLayout.extensions`, `LayoutSection.showInRecord`, `showInTemplate`, `visibleIf`, `description`, `LayoutField.presentation`.
- Zod schemas in [`apps/api/src/routes/layouts.ts`](apps/api/src/routes/layouts.ts) extended; create/update map new fields; **GET** responses include them for clients that hydrate from API.

## 8. Phase 2 — runtime parity (planned)

1. **`record-detail-page.tsx`:** Evaluate `section.visibleIf` and `fieldDef.visibleIf` using `evaluateVisibility`; apply `formattingRules` and `presentation` for labels/values.
2. **`dynamic-form.tsx`:** Merge layout-level visibility override when added; apply formatting effects (read-only, badge, highlight).
3. **Tests:** Rule ordering, interaction between visibility and `effects.hidden`, token class allowlist.

## 9. Security

- Conditions are **structured** (`ConditionExpr`); no `eval()` of user strings.
- No arbitrary CSS from stored layout data; only token → class map maintained in code.

## 10. Module split (Page Editor)

| Module | Path |
|--------|------|
| Canvas types | `page-editor/types.ts` |
| Layout list view | `page-editor/layout-list-view.tsx` |
| Preview dialog | `page-editor/layout-preview-dialog.tsx` |

Main [`page-editor.tsx`](apps/web/app/object-manager/[objectApi]/page-editor.tsx) remains orchestration, DnD context, and state.

## 11. Accessibility

- Preview uses semantic headings for sections; inspector controls labeled; preview dialog traps focus (Radix/shadcn `Dialog`).

---

*End of spec.*
