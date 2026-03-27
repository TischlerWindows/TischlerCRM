# Page Editor Phase 2 — Design Spec
**Date:** 2026-03-27
**Status:** Approved
**Scope:** Nine improvements to the page editor and record renderer, sequenced renderer-first.

---

## 1. Overview

This spec extends the page editor (rebuilt in the 2026-03-25 redesign) with:
- A full migration of the record detail renderer from the old `sections` model to the new `Region → Panel → Field` model
- UX improvements to the editor palette, drop zones, and properties panel
- Per-element visibility rules and conditional formatting
- Header Highlights searchable picklist
- Preview dialog fix
- Formatting Rules count badge

**Sequencing principle:** Record renderer migration ships first. Every subsequent editor improvement is immediately visible on real record pages once the renderer works.

---

## 2. Affected Files

| Feature | Files |
|---|---|
| Record renderer migration | `apps/web/components/record-detail-page.tsx`, `apps/web/lib/layout-formatting.ts` |
| Field Sections in palette + flat fields list | `apps/web/app/object-manager/[objectApi]/page-editor/palette-fields.tsx`, `apps/web/app/object-manager/[objectApi]/page-editor/dnd-context-wrapper.tsx` |
| Drop zone text + button rename | `apps/web/app/object-manager/[objectApi]/page-editor/canvas-region.tsx` |
| Properties panel tabs + visibility + rules summary | `apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx`, `apps/web/app/object-manager/[objectApi]/page-editor/types.ts` |
| Formatting Rules scoped filtering | `apps/web/app/object-manager/[objectApi]/page-editor/formatting-rules-dialog.tsx` |
| Header Highlights picklist | `apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx` |
| Preview fix | `apps/web/app/object-manager/[objectApi]/page-editor/layout-preview-dialog.tsx` |
| Formatting Rules count badge | `apps/web/app/object-manager/[objectApi]/page-editor/editor-toolbar.tsx` |

---

## 3. Feature Designs

### 3.1 Record Renderer Migration (Foundation)

**Problem:** `record-detail-page.tsx` reads `tab.sections` (old model). The page editor now saves `tab.regions → panels → fields` (new model). Layout changes made in the editor are invisible on record pages.

**Fix:** Replace the rendering loop in `record-detail-page.tsx`:

- Iterate `tab.regions` instead of `tab.sections`
- Each region renders as a 12-column CSS grid row. `region.gridColumn` / `region.gridColumnSpan` control width.
- Each region contains panels stacked vertically. Panel renders as a labeled card with `panel.style` applied (header background, text color, bold/italic/uppercase; body background tint).
- Panel body renders fields in a CSS grid at `panel.columns` columns. Each field respects `colSpan`, `labelStyle`, `valueStyle`, and `behavior`:
  - `behavior: 'hidden'` → field is skipped entirely
  - `behavior: 'readOnly'` → value displayed, no edit affordance
  - `labelStyle` / `valueStyle` → applied as inline styles on label and value elements
- Widgets (`region.widgets`) render below panels within their region, same as before.
- **Header Highlights:** Moved from `pageLayout.highlightFields: string[]` to reading the `HeaderHighlights` widget in the layout. The renderer scans all regions for a widget with `widgetType: 'HeaderHighlights'` and renders `config.fieldApiNames: string[]` as the highlight strip. The old `pageLayout.highlightFields` path remains as a fallback for legacy layouts.
- **Visibility and formatting effects:** `evaluateVisibility` and `getFormattingEffectsForField` calls remain, adapted to use `panelId`/`regionId` targets instead of `sectionId`.
- **Legacy fallback:** If `tab.regions` is absent but `tab.sections` exists, the old rendering path remains active. This prevents breakage on any layouts saved before the redesign. Because `LayoutTab` in `types.ts` only defines `regions`, the fallback must use a runtime existence check — `('sections' in tab && Array.isArray((tab as any).sections))` — to avoid TypeScript errors. Do not add `sections` back to the `LayoutTab` type.

**`layout-formatting.ts` changes:**
- Rename `getFormattingEffectsForSection(layout, sectionId, data)` → `getFormattingEffectsForPanel(layout, panelId, data)` and add `getFormattingEffectsForRegion(layout, regionId, data)`, both filtering on `target.kind === 'panel'` and `target.kind === 'region'` respectively.
- Keep backward-compatible handling: if a rule target still has `kind === 'section'` (old format), treat it as a no-match rather than a runtime error.
- The existing call to `getFormattingEffectsForSection` inside `layout-preview-dialog.tsx` (line 13 import) must be replaced as part of Section 3.8 when the preview is rebuilt.
- Update all other call sites of `getFormattingEffectsForSection` in `record-detail-page.tsx` to use the new function names.

---

### 3.2 Field Sections in the Fields Palette

**Location:** Top of the **Fields** tab in the left palette, above the fields list, separated by a divider.

**Group label:** "Field Sections"

**Items (4 draggable tiles):**

| Label | Column count | Visual indicator |
|---|---|---|
| 1-Column Section | 1 | one block icon |
| 2-Column Section | 2 | two block icons |
| 3-Column Section | 3 | three block icons |
| 4-Column Section | 4 | four block icons |

Each tile is styled with a dashed border (distinguishing it from field chips) and a `⠿` drag handle.

**Drag type:** `palette-panel` — distinct from `palette-field` and `palette-component`.

**Drop behavior:** Dropping a `palette-panel` tile onto a **region body** calls `addPanel()` with:
- `columns`: the tile's column count
- `label`: `"New Section"`
- default empty `fields: []` and default `style: {}`

The `dnd-context-wrapper.tsx` `onDragEnd` handler gains a new branch for `palette-panel` drops into region drop zones.

**Search box:** Filters only the fields list below — Field Section tiles are always shown regardless of search query.

---

### 3.3 Flat Fields List (No Grouping)

Remove the "Standard Fields" / "Custom Fields" group headers and the two-tone chip coloring (blue for standard, green for custom). All fields render as a single flat list with one neutral chip style. Search behavior unchanged.

---

### 3.4 Drop Zone Text & Button Rename

- **Region empty state** (no panels, no widgets): `"Drop a field section or widget here"` (was `"Drop widgets here"`)
- **`+ Panel` button** in region header → `"+ Field Section"`
- **`+ Panel` button** inside region body (at bottom of panels list) → `"+ Field Section"`

---

### 3.5 Properties Panel — Underline Tabs

Add a three-tab bar using underline-style tabs (active tab: bold text + 2px bottom border in `brand-navy`; inactive: muted gray text, no border) directly below the element type header in `floating-properties.tsx`.

**Tabs:** Style | Visibility | Rules

**Style tab:** All existing content moved here unchanged (label input, behavior picker, color pickers, Bold/Italic/Uppercase toggles, delete/duplicate actions).

**Visibility tab:**
- **Visibility toggle**: "Always show" / "Always hide" segmented control.
  - For `PanelField`: maps to `field.behavior = 'hidden'` (hide) or clears it (show).
  - For `LayoutPanel` and `LayoutRegion`: a new optional `hidden?: boolean` flag added to both types in `types.ts`. When `true`, the panel/region is excluded from the record renderer at runtime. **In the editor canvas**, hidden panels/regions are NOT removed from the DOM — they render with a dimmed overlay (50% opacity + a "Hidden" badge) so the user can still select and un-hide them. A fully hidden element in the canvas would be impossible to interact with.
- **"+ Add condition rule" button**: opens `FormattingRulesDialog` with a `targetFilter` prop set to the current element's id/type, and pre-populates a new rule with the target already set.

**Rules tab:**
- Header: `Rules (N)` where N = count of rules targeting this element. Tab label also shows the count badge when N > 0.
- Body: a compact list of all `FormattingRule` entries whose target matches this element. Each row shows: rule name, condition summary (e.g. "Status = Active"), effect badges (Hidden, Read Only, Badge, Highlight).
- Each row has an **Edit** link that opens `FormattingRulesDialog` scoped to that rule.
- Empty state: "No rules for this element. Add one from the Visibility tab."

---

### 3.6 Formatting Rules — Scoped Filtering

`FormattingRulesDialog` gains an optional `targetFilter?: { type: 'field' | 'panel' | 'region'; id: string }` prop. Also remove the stale `sections: { id: string; label: string }[]` prop from the dialog's interface — it was part of the old model and is no longer used. Update all call sites that pass `sections` to omit it.

When provided:
- The slide-over header reads "Rules for [element name]" instead of "Formatting Rules"
- Only rules targeting the specified element are shown in the list
- "Add Rule" pre-fills the target picker to the filtered element

When absent (called from toolbar button): existing behavior — all rules shown, no pre-fill.

---

### 3.7 Header Highlights — Searchable Picklist

Replace the manual API name input in the `HeaderHighlights` widget config section of `floating-properties.tsx` with:

- **Selected field chips** (up to 6): each chip shows the field label, has an ✕ to remove, and is drag-reorderable within the row using `@dnd-kit/sortable`.
- **"+ Add field" button**: opens an inline dropdown (positioned below the button) showing a searchable list of all `availableFields` for the object. Each item shows the field label. Already-selected fields appear disabled with a checkmark. Clicking an unselected field adds it to the chips. The dropdown closes after each selection or on click-outside.
- **Storage**: `config.fieldApiNames: string[]` stores API names (this is the existing field name in the codebase — do not rename). The picklist resolves field labels from the `availableFields` prop already passed to the floating panel.

---

### 3.8 Preview Dialog Fix

`layout-preview-dialog.tsx` currently uses `resolveTabCanvasItems`, `buildSampleRecordFromFields`, and the old `sections` rendering path.

**Fix:** Replace the rendering loop to use `tab.regions → panels → fields`, mirroring the updated `record-detail-page.tsx`. Differences from the record renderer:
- Uses generated sample values (field label as placeholder, e.g. "Acme Corp" for a Text field) instead of real record data.
- Applies `panel.style` and field `labelStyle`/`valueStyle` visually so the preview reflects the layout's design.
- Remove imports of `layout-sample-data`, `tab-canvas-grid`, `resolveTabCanvasItems`. Remove dependency on `buildSampleRecordFromFields`. **Delete `layout-sample-data.ts`** — it exists in the repo (`apps/web/app/object-manager/[objectApi]/page-editor/layout-sample-data.ts`) and was marked for deletion in the prior spec but never removed. After removing the import in `layout-preview-dialog.tsx`, delete the file.
- Replace the `getFormattingEffectsForSection` import with the new `getFormattingEffectsForPanel` / `getFormattingEffectsForRegion` functions from Section 3.1.
- Legacy fallback: if `tab.regions` absent, fall back to old sections path using the same runtime check as Section 3.1.

---

### 3.9 Formatting Rules Count Badge

In `editor-toolbar.tsx`, add a count badge to the "Formatting Rules" button:

- Count = total `layout.formattingRules.filter(r => r.active).length`
- Badge renders as a small red pill (e.g. `bg-red-500 text-white rounded-full px-1.5 text-xs`) appended inside the button.
- Badge is hidden (not rendered) when count is 0 — button reads just "Formatting Rules" with no badge.

---

## 4. Data Model Changes

Only two additions to `types.ts`:

```typescript
interface LayoutPanel {
  // ... existing fields
  hidden?: boolean   // NEW: true = excluded from canvas + record renderer
}

interface LayoutRegion {
  // ... existing fields
  hidden?: boolean   // NEW: true = excluded from canvas + record renderer
}
```

`PanelField.behavior: 'hidden'` already exists — no change needed for fields.

---

## 5. Out of Scope

- Mobile/responsive preview
- Real-time collaborative editing
- Visibility rules on the record detail page at runtime based on `LayoutPanel.hidden` / `LayoutRegion.hidden` (runtime evaluation of formatting rules already covers dynamic hiding — static `hidden` flag is editor-only for now)
- Reordering highlight chips persistence (order stored in `config.fieldApiNames` array order)
