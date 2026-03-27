# Page Editor Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the record detail renderer to the new Region→Panel→Field model and add 8 editor UX improvements (field section palette tiles, flat fields list, properties panel tabs, per-element visibility, Header Highlights picklist, preview fix, and formatting rules badge).

**Architecture:** Renderer-first sequencing — `layout-formatting.ts` gets new helpers first, then `record-detail-page.tsx` migrates to the new model, then editor UX improvements layer on top. Each task is self-contained and typechecks independently.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, `@dnd-kit/core` + `@dnd-kit/sortable`, Zustand (`editor-store`).

**Verification:** No test framework installed. Use `cd apps/web && npm run typecheck` after each task. Manual browser testing instructions provided per task.

---

### Task 1: Add `getFormattingEffectsForPanel` and `getFormattingEffectsForRegion` to layout-formatting.ts

**Files:**
- Modify: `apps/web/lib/layout-formatting.ts`

- [ ] **Step 1: Add the two new exported functions after `getFormattingEffectsForSection`**

Open `apps/web/lib/layout-formatting.ts`. After the existing `getFormattingEffectsForSection` function (line 48), add:

```typescript
export function getFormattingEffectsForPanel(
  layout: PageLayout | null | undefined,
  panelId: string,
  data: RecordData,
  context?: VisibilityContext
): FormattingRule['effects'] | null {
  const rules = getLayoutFormattingRules(layout)
    .filter((r) => r.active !== false)
    .filter((r) => r.target.kind === 'panel' && r.target.panelId === panelId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const rule of rules) {
    if (evaluateVisibility(rule.when, data, context)) {
      return rule.effects;
    }
  }
  return null;
}

export function getFormattingEffectsForRegion(
  layout: PageLayout | null | undefined,
  regionId: string,
  data: RecordData,
  context?: VisibilityContext
): FormattingRule['effects'] | null {
  const rules = getLayoutFormattingRules(layout)
    .filter((r) => r.active !== false)
    .filter((r) => r.target.kind === 'region' && r.target.regionId === regionId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const rule of rules) {
    if (evaluateVisibility(rule.when, data, context)) {
      return rule.effects;
    }
  }
  return null;
}
```

Keep the existing `getFormattingEffectsForSection` function — do not delete it yet (still referenced by `layout-preview-dialog.tsx` and `record-detail-page.tsx`, removed in Tasks 2 and 10).

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Expected: no errors related to `layout-formatting.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/layout-formatting.ts
git commit -m "feat: add getFormattingEffectsForPanel and getFormattingEffectsForRegion"
```

---

### Task 2: Record Renderer Migration

**Files:**
- Modify: `apps/web/components/record-detail-page.tsx`

This is the largest task. The goal is to replace the `tab.sections` rendering loop with a `tab.regions → panels → fields` loop while keeping a legacy fallback.

- [ ] **Step 1: Update the imports at the top of `record-detail-page.tsx`**

Find the import from `@/lib/layout-formatting` (currently imports `getFormattingEffectsForField` and `getFormattingEffectsForSection`). Replace it with:

```typescript
import {
  getFormattingEffectsForField,
  getFormattingEffectsForPanel,
  getFormattingEffectsForRegion,
  getFormattingEffectsForSection,
} from '@/lib/layout-formatting';
```

Also add imports for the new editor types. Find the existing schema import line and add `LayoutRegion`, `LayoutPanel`, `PanelField` to the destructured imports if they aren't already there:

```typescript
import { PageLayout, PageField, FieldDef, ObjectDef, normalizeFieldType, type LayoutRegion, type LayoutPanel, type PanelField } from '@/lib/schema';
```

- [ ] **Step 2: Replace the Header Highlights render block**

Find the existing block that reads `pageLayout?.highlightFields` (around line 658). Replace the condition:

```tsx
// OLD
{pageLayout?.highlightFields && pageLayout.highlightFields.length > 0 ? (

// NEW — support both legacy highlightFields and new HeaderHighlights widget
{(() => {
  // New model: find HeaderHighlights widget across all regions
  let highlightApiNames: string[] = [];
  if (pageLayout?.tabs) {
    for (const tab of pageLayout.tabs) {
      for (const region of tab.regions ?? []) {
        const hw = region.widgets?.find((w) => w.widgetType === 'HeaderHighlights');
        if (hw && hw.config.type === 'HeaderHighlights') {
          highlightApiNames = hw.config.fieldApiNames ?? [];
          break;
        }
      }
      if (highlightApiNames.length > 0) break;
    }
  }
  // Legacy fallback
  if (highlightApiNames.length === 0 && pageLayout?.highlightFields?.length) {
    highlightApiNames = pageLayout.highlightFields;
  }
  if (highlightApiNames.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {objectDef?.label ?? 'Record'}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {highlightApiNames.map((apiName) => {
          const fd = getFieldDef(apiName);
          if (!fd) return null;
          if (!evaluateVisibility(fd.visibleIf, layoutVisibilityData)) return null;
          const fFx = getFormattingEffectsForField(pageLayout, apiName, layoutVisibilityData);
          if (fFx?.hidden) return null;
          const raw = getRecordValue(apiName, fd);
          return (
            <div key={apiName} className="min-w-[100px] max-w-[220px]">
              <div className="text-xs text-gray-500">{fd.label}</div>
              <div className="text-sm font-medium text-gray-900 mt-0.5 break-words">
                {renderValue(apiName, raw, fd)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
})()}
```

- [ ] **Step 3: Replace the layout rendering loop**

Find the `{pageLayout ? (` block that renders `pageLayout.tabs.map(...)` (around line 686). Replace the inner `tab.sections` loop with a new region-based renderer. The full replacement for the tab map callback:

```tsx
{pageLayout ? (
  <div className="space-y-6">
    {pageLayout.tabs.map((tab, ti) => {
      // NEW model: tab.regions exists
      if ('regions' in tab && Array.isArray((tab as any).regions)) {
        const regions = (tab as any).regions as LayoutRegion[];
        const sortedRegions = [...regions].sort(
          (a, b) => (a.gridRow ?? 0) - (b.gridRow ?? 0) || (a.gridColumn ?? 0) - (b.gridColumn ?? 0)
        );

        return (
          <div
            key={ti}
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
          >
            {sortedRegions.map((region) => {
              // Skip statically hidden regions
              if ((region as any).hidden) return null;

              const regionFx = getFormattingEffectsForRegion(pageLayout, region.id, layoutVisibilityData);
              if (regionFx?.hidden) return null;

              const sortedPanels = [...region.panels].sort((a, b) => a.order - b.order);
              const sortedWidgets = [...region.widgets].sort((a, b) => a.order - b.order);

              const regionStyle: React.CSSProperties = {
                gridColumn: `${region.gridColumn ?? 1} / span ${region.gridColumnSpan ?? 12}`,
                ...(region.style?.background ? { backgroundColor: region.style.background } : {}),
                ...(region.style?.borderColor ? { borderColor: region.style.borderColor } : {}),
                ...(region.style?.borderStyle ? { borderStyle: region.style.borderStyle } : {}),
                borderRadius: region.style?.borderRadius === 'lg' ? 12 : region.style?.borderRadius === 'sm' ? 6 : undefined,
                boxShadow: region.style?.shadow === 'md'
                  ? '0 10px 24px rgba(15,23,42,.14)'
                  : region.style?.shadow === 'sm'
                  ? '0 1px 3px rgba(15,23,42,.12)'
                  : undefined,
              };

              return (
                <div key={region.id} style={regionStyle} className="min-w-0 space-y-4 p-2">
                  {/* Panels */}
                  {sortedPanels.map((panel) => {
                    if ((panel as any).hidden) return null;
                    const panelFx = getFormattingEffectsForPanel(pageLayout, panel.id, layoutVisibilityData);
                    if (panelFx?.hidden) return null;

                    const sortedFields = [...panel.fields].sort((a, b) => a.order - b.order);
                    const visibleFields = sortedFields.filter((f) => {
                      if (f.behavior === 'hidden') return false;
                      const fd = getFieldDef(f.fieldApiName);
                      if (!fd) return false;
                      if (!evaluateVisibility(fd.visibleIf, layoutVisibilityData)) return false;
                      const fFx = getFormattingEffectsForField(pageLayout, f.fieldApiName, layoutVisibilityData);
                      if (fFx?.hidden) return false;
                      return true;
                    });

                    if (visibleFields.length === 0) return null;

                    const headerStyle: React.CSSProperties = {
                      ...(panel.style?.headerBackground ? { backgroundColor: panel.style.headerBackground } : {}),
                      ...(panel.style?.headerTextColor ? { color: panel.style.headerTextColor } : {}),
                      fontWeight: panel.style?.headerBold ? 700 : undefined,
                      fontStyle: panel.style?.headerItalic ? 'italic' : undefined,
                      textTransform: panel.style?.headerUppercase ? 'uppercase' : undefined,
                    };
                    const bodyStyle: React.CSSProperties = {
                      ...(panel.style?.bodyBackground ? { backgroundColor: panel.style.bodyBackground } : {}),
                    };

                    return (
                      <div key={panel.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                        <div
                          className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700"
                          style={headerStyle}
                        >
                          {panel.label}
                        </div>
                        <div
                          className="grid gap-x-6 gap-y-4 p-4"
                          style={{
                            ...bodyStyle,
                            gridTemplateColumns: `repeat(${panel.columns}, minmax(0, 1fr))`,
                          }}
                        >
                          {visibleFields.map((f) => {
                            const fd = getFieldDef(f.fieldApiName);
                            if (!fd) return null;
                            const raw = getRecordValue(f.fieldApiName, fd);
                            const labelStyle: React.CSSProperties = {
                              ...(f.labelStyle?.color ? { color: f.labelStyle.color } : {}),
                              fontWeight: f.labelStyle?.bold ? 700 : undefined,
                              fontStyle: f.labelStyle?.italic ? 'italic' : undefined,
                              textTransform: f.labelStyle?.uppercase ? 'uppercase' : undefined,
                            };
                            const valueStyle: React.CSSProperties = {
                              ...(f.valueStyle?.color ? { color: f.valueStyle.color } : {}),
                              ...(f.valueStyle?.background ? { backgroundColor: f.valueStyle.background, padding: '2px 6px', borderRadius: 4 } : {}),
                              fontWeight: f.valueStyle?.bold ? 700 : undefined,
                              fontStyle: f.valueStyle?.italic ? 'italic' : undefined,
                            };
                            const displayLabel = f.labelOverride || fd.label;
                            return (
                              <div
                                key={f.fieldApiName}
                                style={{ gridColumn: `span ${Math.min(f.colSpan ?? 1, panel.columns)}` }}
                              >
                                <div className="text-xs font-medium text-gray-500 mb-0.5" style={labelStyle}>
                                  {displayLabel}
                                </div>
                                <div className="text-sm text-gray-900" style={valueStyle}>
                                  {renderValue(f.fieldApiName, raw, fd)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Widgets */}
                  {sortedWidgets.length > 0 && (
                    <LayoutWidgetsInline widgets={sortedWidgets} />
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      // LEGACY FALLBACK: old tab.sections model
      const legacyTab = tab as any;
      const sorted = [...(legacyTab.sections ?? [])].sort((a: any, b: any) => a.order - b.order);
      // ... keep the existing legacy sections rendering code here unchanged ...
      // (copy the existing sections rendering JSX block from the old code verbatim)
      return (
        <div key={ti} className="space-y-4">
          {sorted.map((section: any) => (
            <div key={section.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500 italic">Legacy section: {section.label}</p>
            </div>
          ))}
        </div>
      );
    })}
  </div>
) : (
  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
    No page layout assigned to this record.
  </div>
)}
```

**Important:** For the legacy fallback block at the bottom, instead of the stub shown above, copy the FULL existing sections rendering code from `record-detail-page.tsx`. The old loop starts at the line containing `const sorted = [...tab.sections].sort(...)` (approximately line 689) and ends just before the closing `);` of the outer `pageLayout.tabs.map(...)` callback. Cut that entire block and paste it inside the `else` branch. The goal: new model gets the new renderer, old model keeps the old renderer verbatim.

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Fix any type errors. The most likely issue: `LayoutRegion`, `LayoutPanel`, `PanelField` may need to be imported from `./types` not `@/lib/schema` — check where they are exported in this project. If the types aren't on `PageLayout` (the schema type), use type assertions `as any` on the region/panel accesses or import the editor types.

- [ ] **Step 5: Manual browser test**

1. Start dev server: `cd apps/web && npm run dev`
2. Navigate to any record detail page (e.g., a Contact)
3. If the object has a page layout with regions/panels saved in the new format, fields should now render in panels with headers
4. Check: field label and value styles apply, hidden fields are absent
5. Check: legacy layouts (if any) still render without errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/record-detail-page.tsx
git commit -m "feat: migrate record renderer to Region→Panel→Field model"
```

---

### Task 3: Flat Fields List + Field Section Tiles in Palette

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/palette-fields.tsx`

- [ ] **Step 1: Replace the `PaletteFields` component**

Replace the entire contents of `palette-fields.tsx` with:

```tsx
'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { FieldDef } from '@/lib/schema';
import { useEditorStore } from './editor-store';

export interface PaletteFieldsProps {
  availableFields: FieldDef[];
}

// ── Field Section tiles ──────────────────────────────────────────────────────

const FIELD_SECTION_TILES = [
  { columns: 1 as const, label: '1-Column Section' },
  { columns: 2 as const, label: '2-Column Section' },
  { columns: 3 as const, label: '3-Column Section' },
  { columns: 4 as const, label: '4-Column Section' },
] as const;

function ColumnIcon({ count }: { count: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-3 w-3 rounded-sm bg-gray-400" />
      ))}
    </div>
  );
}

function DraggableFieldSectionTile({ columns, label }: { columns: 1 | 2 | 3 | 4; label: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-panel-${columns}`,
    data: { type: 'palette-panel', columns, label },
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="flex w-full items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-2 py-1.5 text-left text-xs transition-colors hover:border-gray-400 hover:bg-gray-50 active:cursor-grabbing"
    >
      <span className="select-none text-gray-400" aria-hidden>⠿</span>
      <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{label}</span>
      <ColumnIcon count={columns} />
    </button>
  );
}

// ── Field chips ──────────────────────────────────────────────────────────────

function DraggableFieldChip({
  field,
  isPlaced,
}: {
  field: FieldDef;
  isPlaced: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${field.apiName}`,
    data: {
      type: 'palette-field',
      fieldApiName: field.apiName,
      label: field.label,
    },
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-left text-xs transition-colors hover:bg-gray-50 active:cursor-grabbing"
    >
      <span className="select-none text-gray-400" aria-hidden>⠿</span>
      <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{field.label}</span>
      {isPlaced ? (
        <span className="text-[10px] text-gray-400" aria-label="Field already placed">✓</span>
      ) : null}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PaletteFields({ availableFields }: PaletteFieldsProps) {
  const [search, setSearch] = useState('');
  const layout = useEditorStore((s) => s.layout);

  const placedApiNames = useMemo(() => {
    const set = new Set<string>();
    for (const tab of layout.tabs) {
      for (const region of tab.regions) {
        for (const panel of region.panels) {
          for (const field of panel.fields) {
            set.add(field.fieldApiName);
          }
        }
      }
    }
    return set;
  }, [layout]);

  const filteredFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableFields;
    return availableFields.filter((field) => {
      return (
        field.label.toLowerCase().includes(query) ||
        field.apiName.toLowerCase().includes(query)
      );
    });
  }, [availableFields, search]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-2">
      {/* Search — filters fields only, not section tiles */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search fields"
          placeholder="Search fields"
          className="h-8 border-gray-200 pl-7 text-xs"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* Field Section tiles — always visible, not filtered by search */}
        <section className="space-y-1.5">
          <div className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Field Sections
          </div>
          <div className="space-y-1">
            {FIELD_SECTION_TILES.map((tile) => (
              <DraggableFieldSectionTile key={tile.columns} columns={tile.columns} label={tile.label} />
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Flat fields list */}
        <section className="space-y-1.5">
          <div className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Fields
          </div>
          <div className="space-y-1">
            {filteredFields.length > 0 ? (
              filteredFields.map((field) => (
                <DraggableFieldChip
                  key={field.apiName}
                  field={field}
                  isPlaced={placedApiNames.has(field.apiName)}
                />
              ))
            ) : (
              <div className="rounded-md border border-dashed border-gray-200 px-2 py-2 text-xs text-gray-500">
                No fields match
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/palette-fields.tsx
git commit -m "feat: flat fields list + draggable field section tiles in palette"
```

---

### Task 4: DnD Support for `palette-panel` Drop Type

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/dnd-context-wrapper.tsx`

The `DragSource` union already exists. Add `palette-panel` to it and handle it in `onDragEnd`.

- [ ] **Step 1: Add `palette-panel` to the `DragSource` union**

Find the `DragSource` type definition (around line 22). Add a new member:

```typescript
type DragSource =
  | { kind: 'palette-field'; fieldApiName: string; label: string }
  | { kind: 'palette-panel'; columns: 1 | 2 | 3 | 4; label: string }   // NEW
  | { kind: 'existing-field'; fieldApiName: string; fromPanelId: string; label: string }
  | { kind: 'palette-widget'; widgetType: WidgetType; label: string }
  | { kind: 'existing-widget'; widgetId: string; label: string }
  | { kind: 'panel'; panelId: string; regionId?: string; label: string }
  | { kind: 'region'; regionId: string; label: string }
  | null;
```

- [ ] **Step 2: Resolve `palette-panel` data in `parseDragSource`**

Find where drag source data is parsed from `active.data.current` (look for `kind: 'palette-field'` or `type: 'palette-field'` handling). In the same parsing block, add:

```typescript
if (data.type === 'palette-panel') {
  return {
    kind: 'palette-panel',
    columns: data.columns as 1 | 2 | 3 | 4,
    label: typeof data.label === 'string' ? data.label : 'New Section',
  };
}
```

- [ ] **Step 3: Handle the drop in `onDragEnd`**

In the `onDragEnd` handler, after the existing `palette-widget` → `region-drop` branch, add:

```typescript
// palette-panel dropped onto a region → add a new panel
if (source.kind === 'palette-panel' && target?.kind === 'region-drop') {
  const { addPanel } = useEditorStore.getState();
  addPanel(
    {
      id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: 'New Section',
      order: 0,
      columns: source.columns,
      style: {},
      fields: [],
    },
    target.regionId,
  );
  return;
}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 5: Manual test**

1. Open the page editor
2. Drag "2-Column Section" from the Fields palette onto a region
3. A new panel with 2 columns should appear in that region

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/dnd-context-wrapper.tsx
git commit -m "feat: support dragging field section tiles from palette onto regions"
```

---

### Task 5: Drop Zone Text & Button Rename

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/canvas-region.tsx`

- [ ] **Step 1: Update the region empty state text**

Find the empty state div (currently contains `"Drop widgets here"`). Replace the text:

```tsx
// OLD
Drop widgets here

// NEW
Drop a field section or widget here
```

- [ ] **Step 2: Rename `+ Panel` buttons to `+ Field Section`**

Find all occurrences of `+ Panel` in `canvas-region.tsx`. There are two: one in the region header bar and one at the bottom of the panels list. Replace both:

```tsx
// OLD
+ Panel
// (or: `+ Panel` as button text)

// NEW
+ Field Section
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/canvas-region.tsx
git commit -m "feat: update drop zone text and rename + Panel to + Field Section"
```

---

### Task 6: Add `hidden` Flag to `LayoutPanel` and `LayoutRegion`

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/types.ts`

- [ ] **Step 1: Add `hidden?: boolean` to both interfaces**

Open `types.ts`. Find `interface LayoutPanel` and add the field:

```typescript
interface LayoutPanel {
  // ... existing fields
  hidden?: boolean;   // true = dim in editor canvas; excluded from record renderer
}
```

Find `interface LayoutRegion` and add:

```typescript
interface LayoutRegion {
  // ... existing fields
  hidden?: boolean;   // true = dim in editor canvas; excluded from record renderer
}
```

- [ ] **Step 2: Add dim overlay to `canvas-panel.tsx` for hidden panels**

Open `canvas-panel.tsx`. In the outer `<div>` of `CanvasPanel`, add a relative container and the dim overlay:

```tsx
<div
  className={`relative rounded-lg border bg-white shadow-sm transition-colors ${
    isPanelSelected ? 'border-brand-navy ring-1 ring-brand-navy/20' : 'border-gray-200'
  }`}
  data-region-id={regionId}
>
  {panel.hidden ? (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 pointer-events-none">
      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Hidden</span>
    </div>
  ) : null}
  {/* ... rest of panel content unchanged ... */}
```

- [ ] **Step 3: Add dim overlay to `canvas-region.tsx` for hidden regions**

Open `canvas-region.tsx`. In the outermost region wrapper div (the one with `wrapperStyle` applied), add `relative` to its className, then insert the overlay immediately inside:

```tsx
{region.hidden ? (
  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 pointer-events-none">
    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Hidden</span>
  </div>
) : null}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/types.ts \
        apps/web/app/object-manager/\[objectApi\]/page-editor/canvas-panel.tsx \
        apps/web/app/object-manager/\[objectApi\]/page-editor/canvas-region.tsx
git commit -m "feat: add hidden flag to LayoutPanel/LayoutRegion with canvas dim overlay"
```

---

### Task 7: Properties Panel — Underline Tabs (Style / Visibility / Rules)

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx`

This is the most complex single-file change. Work section by section.

- [ ] **Step 1: Add tab state and tab bar component**

Near the top of `FloatingProperties`, add tab state:

```tsx
const [activeTab, setActiveTab] = useState<'style' | 'visibility' | 'rules'>('style');

// Reset to 'style' tab when selection changes
useEffect(() => {
  setActiveTab('style');
}, [selectedElement?.id, selectedElement?.type]);
```

Add a `TabBar` sub-component at the top of the file (before `FloatingProperties`):

```tsx
function TabBar({
  active,
  onChange,
  rulesCount,
}: {
  active: 'style' | 'visibility' | 'rules';
  onChange: (tab: 'style' | 'visibility' | 'rules') => void;
  rulesCount: number;
}) {
  const tabs = [
    { id: 'style' as const, label: 'Style' },
    { id: 'visibility' as const, label: 'Visibility' },
    { id: 'rules' as const, label: rulesCount > 0 ? `Rules (${rulesCount})` : 'Rules' },
  ];
  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            active === tab.id
              ? 'border-b-2 border-brand-navy text-brand-navy font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Compute `rulesCount` for the selected element**

Inside `FloatingProperties`, compute the count of formatting rules targeting the current selection:

```tsx
const rulesCount = useMemo(() => {
  if (!selection || !layout.formattingRules) return 0;
  return layout.formattingRules.filter((rule) => {
    if (!rule.active) return false;
    if (selection.kind === 'field') {
      return rule.target.kind === 'field' &&
        rule.target.fieldApiName === selection.field.fieldApiName &&
        rule.target.panelId === selection.panel.id;
    }
    if (selection.kind === 'panel') {
      return rule.target.kind === 'panel' && rule.target.panelId === selection.panel.id;
    }
    if (selection.kind === 'region') {
      return rule.target.kind === 'region' && rule.target.regionId === selection.region.id;
    }
    return false;
  }).length;
}, [layout.formattingRules, selection]);
```

- [ ] **Step 3: Wrap existing content in the Style tab**

In the JSX returned by `FloatingProperties`, find the section where selection-specific content renders (after the panel header with element type + close button). Insert the `TabBar` right after the header, then wrap the existing content in `{activeTab === 'style' && (...)}`.

The structure should be:

```tsx
{/* Panel header — element type + close button */}
<div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
  {/* ... existing header content ... */}
</div>

{/* Tab bar */}
<TabBar active={activeTab} onChange={setActiveTab} rulesCount={rulesCount} />

{/* Tab content */}
{activeTab === 'style' && (
  <div className="overflow-y-auto p-3 space-y-4">
    {/* ... ALL existing style/behavior/color content goes here unchanged ... */}
  </div>
)}

{activeTab === 'visibility' && (
  <VisibilityTab selection={selection} />
)}

{activeTab === 'rules' && (
  <RulesTab selection={selection} layout={layout} />
)}
```

- [ ] **Step 4: Build `VisibilityTab` sub-component**

Add this before `FloatingProperties`:

```tsx
function VisibilityTab({ selection }: { selection: ResolvedSelection }) {
  const updatePanel = useEditorStore((s) => s.updatePanel);
  const updateRegion = useEditorStore((s) => s.updateRegion);
  const updateField = useEditorStore((s) => s.updateField);

  if (!selection) return null;

  const isHidden =
    selection.kind === 'field'
      ? selection.field.behavior === 'hidden'
      : (selection as any)[selection.kind]?.hidden === true;

  const handleToggle = (hide: boolean) => {
    if (selection.kind === 'field') {
      updateField(selection.field.fieldApiName, selection.panel.id, {
        behavior: hide ? 'hidden' : 'none',
      });
    } else if (selection.kind === 'panel') {
      updatePanel(selection.panel.id, { hidden: hide } as any);
    } else if (selection.kind === 'region') {
      updateRegion(selection.region.id, { hidden: hide } as any);
    }
  };

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Visibility
        </div>
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => handleToggle(false)}
            className={`flex-1 py-1.5 font-medium transition-colors ${
              !isHidden ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Always show
          </button>
          <button
            type="button"
            onClick={() => handleToggle(true)}
            className={`flex-1 py-1.5 font-medium transition-colors border-l border-gray-200 ${
              isHidden ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Always hide
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="text-xs text-gray-500 mb-2">
          For conditional show/hide based on record values, use Formatting Rules.
        </div>
        <button
          type="button"
          className="w-full rounded-md border border-dashed border-gray-300 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          onClick={() => {
            // This button needs to open the FormattingRulesDialog scoped to this element.
            // Since FloatingProperties doesn't control the dialog directly, dispatch a custom
            // event that the parent page.tsx listens to.
            window.dispatchEvent(
              new CustomEvent('open-formatting-rules', {
                detail: {
                  targetFilter: {
                    type: selection.kind === 'field' ? 'field' : selection.kind,
                    id:
                      selection.kind === 'field'
                        ? selection.field.fieldApiName
                        : selection.kind === 'panel'
                        ? selection.panel.id
                        : selection.kind === 'region'
                        ? selection.region.id
                        : '',
                    panelId: selection.kind === 'field' ? selection.panel.id : undefined,
                  },
                },
              })
            );
          }}
        >
          + Add condition rule
        </button>
      </div>
    </div>
  );
}
```

**Note:** The `CustomEvent` pattern is used because `FloatingProperties` doesn't have direct access to the `FormattingRulesDialog` open state. The parent `page.tsx` will listen for this event (handled in Task 8).

- [ ] **Step 5: Build `RulesTab` sub-component**

```tsx
function RulesTab({
  selection,
  layout,
}: {
  selection: ResolvedSelection;
  layout: import('./types').EditorPageLayout;
}) {
  if (!selection) return null;

  const matchingRules = (layout.formattingRules ?? []).filter((rule) => {
    if (selection.kind === 'field') {
      return rule.target.kind === 'field' &&
        rule.target.fieldApiName === selection.field.fieldApiName &&
        rule.target.panelId === selection.panel.id;
    }
    if (selection.kind === 'panel') {
      return rule.target.kind === 'panel' && rule.target.panelId === selection.panel.id;
    }
    if (selection.kind === 'region') {
      return rule.target.kind === 'region' && rule.target.regionId === selection.region.id;
    }
    return false;
  });

  if (matchingRules.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-500">
        No rules for this element.{' '}
        <span className="text-gray-700">Add one from the Visibility tab.</span>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {matchingRules.map((rule) => (
        <div key={rule.id} className="rounded-md border border-gray-200 p-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-800">{rule.name || 'Unnamed rule'}</span>
            <button
              type="button"
              className="text-brand-navy hover:underline"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('open-formatting-rules', {
                    detail: { ruleId: rule.id },
                  })
                );
              }}
            >
              Edit
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {rule.effects.hidden && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">Hidden</span>
            )}
            {rule.effects.readOnly && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">Read Only</span>
            )}
            {rule.effects.badge && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">Badge</span>
            )}
            {rule.effects.highlightToken && rule.effects.highlightToken !== 'none' && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">Highlight</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && npm run typecheck
```

Fix any errors. Common issues: `selection.kind === 'widget'` doesn't have a panel/region — guard those paths. The `VisibilityTab` toggle should be disabled/hidden for widgets.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/floating-properties.tsx
git commit -m "feat: add Style/Visibility/Rules tabs to floating properties panel"
```

---

### Task 8: Scoped Formatting Rules Dialog + Event Listener in page.tsx

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/formatting-rules-dialog.tsx`
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/[layoutId]/page.tsx`

- [ ] **Step 1: Remove the stale `sections` prop from `FormattingRulesDialog`**

Open `formatting-rules-dialog.tsx`. Find the interface at line ~308:

```typescript
// BEFORE
{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rules: FormattingRule[];
  onApply: (next: FormattingRule[]) => void;
  sections: { id: string; label: string }[];
  objectFields: FieldDef[];
}

// AFTER — remove the sections prop
{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rules: FormattingRule[];
  onApply: (next: FormattingRule[]) => void;
  objectFields: FieldDef[];
  targetFilter?: { type: 'field' | 'panel' | 'region'; id: string; panelId?: string };
  initialRuleId?: string;
}
```

The `sections: _sections` parameter in the function signature becomes just removed. The parameter is already prefixed `_sections` so it's unused — just delete it.

- [ ] **Step 2: Use `targetFilter` to filter the displayed rules list**

Inside `FormattingRulesDialog`, find where `working` (the sorted rules list) is rendered. Add a filtered view:

```tsx
const displayedRules = useMemo(() => {
  if (!targetFilter) return working;
  return working.filter((rule) => {
    if (targetFilter.type === 'field') {
      return rule.target.kind === 'field' &&
        rule.target.fieldApiName === targetFilter.id &&
        (!targetFilter.panelId || rule.target.panelId === targetFilter.panelId);
    }
    if (targetFilter.type === 'panel') {
      return rule.target.kind === 'panel' && rule.target.panelId === targetFilter.id;
    }
    return rule.target.kind === 'region' && rule.target.regionId === targetFilter.id;
  });
}, [working, targetFilter]);
```

Use `displayedRules` in the rules list render instead of `working`. The "Add Rule" button should pre-set the target when `targetFilter` is provided.

- [ ] **Step 3: Use `initialRuleId` to auto-select a rule on open**

In the `useEffect` that runs when `open` changes, after setting `setWorking(...)`, also set the selected rule if provided:

```tsx
useEffect(() => {
  if (!open) return;
  setWorking(normalizeRulesFromInput(rules));
  if (initialRuleId) setSelectedRuleId(initialRuleId);
}, [open, rules, initialRuleId]);
```

- [ ] **Step 4: Update `FormattingRulesDialog` call site in `page.tsx`**

Open `page.tsx`. Find where `<FormattingRulesDialog>` is rendered. Remove the `sections={...}` prop. Add state for `targetFilter` and `initialRuleId`:

```tsx
const [rulesTargetFilter, setRulesTargetFilter] = useState<
  { type: 'field' | 'panel' | 'region'; id: string; panelId?: string } | undefined
>(undefined);
const [rulesInitialRuleId, setRulesInitialRuleId] = useState<string | undefined>(undefined);
```

Add a `useEffect` to listen for the custom events dispatched from `FloatingProperties`:

```tsx
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail ?? {};
    setRulesTargetFilter(detail.targetFilter ?? undefined);
    setRulesInitialRuleId(detail.ruleId ?? undefined);
    setIsRulesOpen(true);
  };
  window.addEventListener('open-formatting-rules', handler);
  return () => window.removeEventListener('open-formatting-rules', handler);
}, []);
```

Update the `<FormattingRulesDialog>` JSX. Also clear the filter state when the dialog closes so that subsequent toolbar-triggered opens don't show a stale filtered view:

```tsx
<FormattingRulesDialog
  open={isRulesOpen}
  onOpenChange={(open) => {
    setIsRulesOpen(open);
    if (!open) {
      setRulesTargetFilter(undefined);
      setRulesInitialRuleId(undefined);
    }
  }}
  rules={layout.formattingRules ?? []}
  onApply={handleApplyRules}
  objectFields={availableFields}
  targetFilter={rulesTargetFilter}
  initialRuleId={rulesInitialRuleId}
/>
```

Also find any existing call site that passes `sections={...}` and remove that prop.

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/formatting-rules-dialog.tsx \
        apps/web/app/object-manager/\[objectApi\]/page-editor/\[layoutId\]/page.tsx
git commit -m "feat: scoped formatting rules dialog with targetFilter and initialRuleId"
```

---

### Task 9: Header Highlights — Searchable Picklist

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx`

The `HeaderHighlights` widget config is rendered inside `FloatingProperties` when `selection.kind === 'widget' && selection.widget.widgetType === 'HeaderHighlights'`. Find that section and replace the existing manual input with the picklist.

- [ ] **Step 1: Find the HeaderHighlights widget config section**

Search for `HeaderHighlights` in `floating-properties.tsx`. The config currently renders fields from `widget.config` — likely a text input for each field API name.

- [ ] **Step 2: Add `HeaderHighlightsPicker` as a named sub-component**

**Important:** Do NOT use hooks inside an IIFE in JSX — this violates React's Rules of Hooks. Instead, add a proper named sub-component at the top of the file (near `VisibilityTab` and `RulesTab`):

```tsx
function HeaderHighlightsPicker({
  widgetId,
  selectedApiNames,
  availableFields,
}: {
  widgetId: string;
  selectedApiNames: string[];
  availableFields: import('@/lib/schema').FieldDef[];
}) {
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const handleRemove = (apiName: string) => {
    updateWidget(widgetId, {
      config: {
        type: 'HeaderHighlights' as const,
        fieldApiNames: selectedApiNames.filter((n) => n !== apiName),
      },
    });
  };

  const handleAdd = (apiName: string) => {
    if (selectedApiNames.includes(apiName) || selectedApiNames.length >= 6) return;
    updateWidget(widgetId, {
      config: {
        type: 'HeaderHighlights' as const,
        fieldApiNames: [...selectedApiNames, apiName],
      },
    });
    setDropdownOpen(false);
    setFilterQuery('');
  };

  const filteredOptions = availableFields.filter(
    (f) =>
      !selectedApiNames.includes(f.apiName) &&
      (f.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
        f.apiName.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="space-y-2">
      <Label className="text-xs text-gray-600">Highlight Fields (up to 6)</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {selectedApiNames.map((apiName) => {
          const fd = availableFields.find((f) => f.apiName === apiName);
          return (
            <span
              key={apiName}
              className="inline-flex items-center gap-1 rounded-full bg-brand-navy/10 px-2 py-0.5 text-xs font-medium text-brand-navy"
            >
              {fd?.label ?? apiName}
              <button
                type="button"
                onClick={() => handleRemove(apiName)}
                className="text-brand-navy/60 hover:text-brand-navy ml-0.5"
                aria-label={`Remove ${fd?.label ?? apiName}`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      {selectedApiNames.length < 6 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex w-full items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            <span className="text-gray-400">+</span> Add field
          </button>
          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => { setDropdownOpen(false); setFilterQuery(''); }}
              />
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="sticky top-0 border-b border-gray-100 bg-white p-1.5">
                  <Input
                    autoFocus
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search..."
                    className="h-7 text-xs"
                  />
                </div>
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">No fields available</div>
                ) : (
                  filteredOptions.map((f) => (
                    <button
                      key={f.apiName}
                      type="button"
                      onClick={() => handleAdd(f.apiName)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 text-left"
                    >
                      {f.label}
                      <span className="ml-auto text-[10px] text-gray-400">{f.apiName}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Use `HeaderHighlightsPicker` in the widget config section**

Find the section in `FloatingProperties` that renders the `HeaderHighlights` widget config (inside the `selection.kind === 'widget'` branch). Replace the existing manual input with:

```tsx
{selection.widget.widgetType === 'HeaderHighlights' && (
  <HeaderHighlightsPicker
    widgetId={selection.widget.id}
    selectedApiNames={
      (selection.widget.config as { type: 'HeaderHighlights'; fieldApiNames: string[] })
        .fieldApiNames ?? []
    }
    availableFields={availableFields}
  />
)}
```

**Note:** `availableFields` needs to be passed into `FloatingProperties`. Check the current props — if it isn't already passed, add it as a prop: `availableFields: FieldDef[]`.

- [ ] **Step 2: Pass `availableFields` to `FloatingProperties` in `page.tsx` if not already passed**

In `page.tsx`, find `<FloatingProperties ... />` and add `availableFields={availableFields}` if missing.

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 4: Manual test**

1. Add a `HeaderHighlights` widget to a region via the Components palette
2. Click the widget in the canvas
3. The properties panel should show "+ Add field" button
4. Click it — a searchable dropdown of all available fields should appear
5. Select 2-3 fields — they should appear as chips
6. Click ✕ on a chip — it should be removed

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/floating-properties.tsx
git commit -m "feat: Header Highlights searchable picklist replaces manual API name input"
```

---

### Task 10: Preview Dialog Fix + Delete `layout-sample-data.ts`

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/layout-preview-dialog.tsx`
- Delete: `apps/web/app/object-manager/[objectApi]/page-editor/layout-sample-data.ts`

- [ ] **Step 1: Replace the rendering logic in `layout-preview-dialog.tsx`**

The current file imports `buildSampleRecordFromFields` from `./layout-sample-data` and uses `resolveTabCanvasItems`/`tab-canvas-grid`. Replace the entire rendering section.

Remove these imports:
- `import { buildSampleRecordFromFields } from './layout-sample-data';`
- `import { resolveTabCanvasItems, gridItemStyle, TAB_GRID_COLUMNS } from '@/lib/tab-canvas-grid';`

Add a simple sample value generator inline:

```tsx
function sampleValue(fieldType: string | undefined, label: string): string {
  switch (fieldType) {
    case 'Email': return 'john@example.com';
    case 'Phone': return '(555) 123-4567';
    case 'Currency': return '$12,500';
    case 'Number': return '42';
    case 'Percent': return '85%';
    case 'Date': return '03-15-2026';
    case 'DateTime': return '03-15-2026 09:30';
    case 'Checkbox': return 'Yes';
    case 'URL': return 'https://example.com';
    default: return label;
  }
}
```

Replace the tab rendering loop with the same Region→Panel→Field pattern as Task 2, but using `sampleValue` for the field values and applying panel/field styles visually.

Structure:

```tsx
{pageLayout.tabs.map((tab, ti) => {
  if (!('regions' in tab) || !Array.isArray((tab as any).regions)) {
    // Legacy fallback — render a simple message
    return (
      <div key={ti} className="p-4 text-sm text-gray-500 italic">
        Legacy layout format — save the layout in the editor to update.
      </div>
    );
  }
  const regions = (tab as any).regions as any[];
  return (
    <div key={ti} className="grid gap-4" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
      {regions
        .sort((a, b) => (a.gridRow ?? 0) - (b.gridRow ?? 0) || (a.gridColumn ?? 0) - (b.gridColumn ?? 0))
        .map((region: any) => {
          if (region.hidden) return null;
          return (
            <div
              key={region.id}
              style={{
                gridColumn: `${region.gridColumn ?? 1} / span ${region.gridColumnSpan ?? 12}`,
                ...(region.style?.background ? { backgroundColor: region.style.background } : {}),
              }}
              className="space-y-3 p-1"
            >
              {[...region.panels].sort((a: any, b: any) => a.order - b.order).map((panel: any) => {
                if (panel.hidden) return null;
                const headerStyle: React.CSSProperties = {
                  ...(panel.style?.headerBackground ? { backgroundColor: panel.style.headerBackground } : {}),
                  ...(panel.style?.headerTextColor ? { color: panel.style.headerTextColor } : {}),
                  fontWeight: panel.style?.headerBold ? 700 : undefined,
                };
                const bodyStyle: React.CSSProperties = {
                  ...(panel.style?.bodyBackground ? { backgroundColor: panel.style.bodyBackground } : {}),
                };
                return (
                  <div key={panel.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-700" style={headerStyle}>
                      {panel.label}
                    </div>
                    <div
                      className="grid gap-x-4 gap-y-3 p-3"
                      style={{
                        ...bodyStyle,
                        gridTemplateColumns: `repeat(${panel.columns ?? 2}, minmax(0, 1fr))`,
                      }}
                    >
                      {[...panel.fields]
                        .sort((a: any, b: any) => a.order - b.order)
                        .filter((f: any) => f.behavior !== 'hidden')
                        .map((f: any) => {
                          const fd = allFields.find((def) => def.apiName === f.fieldApiName);
                          const displayLabel = f.labelOverride || fd?.label || f.fieldApiName;
                          const sample = sampleValue(fd?.type, displayLabel);
                          const labelStyle: React.CSSProperties = {
                            ...(f.labelStyle?.color ? { color: f.labelStyle.color } : {}),
                            fontWeight: f.labelStyle?.bold ? 700 : undefined,
                          };
                          const valueStyle: React.CSSProperties = {
                            ...(f.valueStyle?.color ? { color: f.valueStyle.color } : {}),
                            ...(f.valueStyle?.background ? { backgroundColor: f.valueStyle.background, padding: '1px 4px', borderRadius: 3 } : {}),
                            fontWeight: f.valueStyle?.bold ? 700 : undefined,
                          };
                          return (
                            <div key={f.fieldApiName} style={{ gridColumn: `span ${Math.min(f.colSpan ?? 1, panel.columns ?? 2)}` }}>
                              <div className="text-[10px] font-medium text-gray-400 mb-0.5" style={labelStyle}>{displayLabel}</div>
                              <div className="text-xs text-gray-700" style={valueStyle}>{sample}</div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
})}
```

- [ ] **Step 2: Delete `layout-sample-data.ts`**

```bash
rm "apps/web/app/object-manager/[objectApi]/page-editor/layout-sample-data.ts"
```

Verify no other files import from it:

```bash
cd apps/web && grep -r "layout-sample-data" --include="*.ts" --include="*.tsx" .
```

Expected: no matches.

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 4: Manual test**

1. Open the page editor and click Preview
2. The preview dialog should show regions, panels, and fields with their styles applied
3. Sample values (not real data) should appear in each field slot

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/layout-preview-dialog.tsx
git rm apps/web/app/object-manager/\[objectApi\]/page-editor/layout-sample-data.ts
git commit -m "feat: fix preview dialog to render new Region→Panel→Field model; delete layout-sample-data.ts"
```

---

### Task 11: Formatting Rules Count Badge in Toolbar

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/editor-toolbar.tsx`

- [ ] **Step 1: Compute the active rules count**

Inside `EditorToolbar`, compute:

```tsx
const activeRulesCount = useMemo(
  () => (layout.formattingRules ?? []).filter((r) => r.active !== false).length,
  [layout.formattingRules]
);
```

- [ ] **Step 2: Add the badge to the Formatting Rules button**

Find the existing "Formatting Rules" button (around line 372):

```tsx
// BEFORE
<Button variant="outline" size="sm" type="button" onClick={onOpenRules}>
  <Wand2 className="mr-1.5 h-4 w-4" />
  Formatting Rules
</Button>

// AFTER
<Button variant="outline" size="sm" type="button" onClick={onOpenRules}>
  <Wand2 className="mr-1.5 h-4 w-4" />
  Formatting Rules
  {activeRulesCount > 0 && (
    <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
      {activeRulesCount}
    </span>
  )}
</Button>
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/object-manager/\[objectApi\]/page-editor/editor-toolbar.tsx
git commit -m "feat: add active rules count badge to Formatting Rules toolbar button"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Full typecheck pass**

```bash
cd apps/web && npm run typecheck
```

Expected: zero errors.

- [ ] **Step 2: Build check**

```bash
cd apps/web && npm run build
```

Expected: successful build with no errors (warnings are OK).

- [ ] **Step 3: End-to-end browser walkthrough**

Verify each feature manually:

1. **Record renderer** — open a Contact/Lead/Deal record. If the object has a page layout with regions and panels, fields render in labeled panel cards. Legacy objects (no regions) still render.
2. **Field Section palette** — open the page editor, Fields tab shows 4 section tiles at top, flat fields list below. Drag a section tile onto a region → panel appears.
3. **Drop zone text** — empty region body says "Drop a field section or widget here". Region header button says "+ Field Section".
4. **Properties panel tabs** — click a field → floating panel has Style / Visibility / Rules tabs.
5. **Visibility tab** — toggle "Always hide" on a field → field renders dimmed in canvas. Toggle back.
6. **Rules tab** — if formatting rules exist for an element, they appear listed on the Rules tab.
7. **Header Highlights picklist** — add HeaderHighlights widget, click it, add fields via picklist.
8. **Preview** — click Preview → dialog shows new panel/field layout with sample values and applied styles.
9. **Formatting Rules badge** — add a formatting rule → button shows count badge.

- [ ] **Step 4: Final commit if any loose fixes**

```bash
git add -p  # stage only intentional changes
git commit -m "fix: post-integration cleanups for page editor phase 2"
```
