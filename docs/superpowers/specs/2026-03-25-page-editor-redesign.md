# Page Editor Redesign — Design Spec
**Date:** 2026-03-25
**Status:** Approved
**Scope:** Full rebuild of the page layout editor (existing layouts can be deleted — not tied to any)

---

## 1. Overview

A full rebuild of the page editor to create a dynamic, colorful, Salesforce-inspired page layout builder. The new editor replaces the current flat section model with a Region → Panel → Field hierarchy, introduces a visual template gallery, full color/styling per element, role-based layout assignment, and a floating properties panel on a fixed-palette + wide-canvas shell.

---

## 2. Core Architecture Decision

**Full Rebuild (not a refactor).** The current data model, canvas, and DnD system are replaced entirely. Existing page layouts in the database may be deleted — the team is not tied to them. This gives a clean, correct data model with no legacy debt.

**Tech stack retained:** Next.js 14, React 18, TypeScript, Tailwind CSS, `@dnd-kit`, Zustand.

---

## 3. Data Model

### 3.1 Full TypeScript Interfaces

The `LayoutRegion`, `LayoutPanel`, and `PanelField` types are the **canonical in-editor AND persisted types** — there is no separate canvas/runtime type. The Zustand store holds a `PageLayout` directly; `buildPageLayout` is only needed for minor serialization cleanup before saving (e.g. stripping transient UI state). `initEditorFromLayout` populates the store from a loaded `PageLayout`.

```typescript
// Top-level layout — stored in OrgSchema.objects[n].pageLayouts
interface PageLayout {
  id: string
  name: string                          // editable inline in editor toolbar
  objectApi: string
  active: boolean                       // one active layout per role at a time
  isDefault: boolean                    // true = fallback for users whose role has no active layout
  roles: string[]                       // role ids from the org's role list
  tabs: LayoutTab[]
  formattingRules: FormattingRule[]
}

interface LayoutTab {
  id: string
  label: string
  order: number
  regions: LayoutRegion[]
}

interface LayoutRegion {
  id: string
  label: string
  gridColumn: number                    // 1-based, 12-col grid
  gridColumnSpan: number                // 1–12
  gridRow: number
  gridRowSpan: number
  style: RegionStyle
  panels: LayoutPanel[]                 // stacked vertically inside region
  widgets: LayoutWidget[]               // rendered below panels
}

interface LayoutPanel {
  id: string
  label: string
  order: number
  columns: 1 | 2 | 3 | 4
  style: PanelStyle
  fields: PanelField[]
}

interface PanelField {
  fieldApiName: string
  colSpan: number                       // 1 to panel.columns
  order: number
  labelStyle: LabelStyle
  valueStyle: ValueStyle
  behavior: 'none' | 'required' | 'readOnly' | 'hidden'
}

interface LayoutWidget {
  id: string
  // HeaderHighlights renders a horizontal strip of key field values in a header region
  widgetType: 'RelatedList' | 'ActivityFeed' | 'FileFolder' | 'CustomComponent' | 'Spacer' | 'HeaderHighlights'
  order: number
  // widgets render full-width within their region; colSpan reserved for future use
  config: WidgetConfig
}
```

### 3.2 Style Objects

All color values are **free hex strings** (e.g. `#3b82f6`). The existing `LabelColorToken` type and `PageFieldPresentation` type are **removed** — they are replaced by `LabelStyle` and `ValueStyle`.

```typescript
interface RegionStyle {
  background?: string                   // hex or 'transparent'
  borderColor?: string
  borderStyle?: 'solid' | 'dashed' | 'none'
  shadow?: 'sm' | 'md' | 'none'
  borderRadius?: 'none' | 'sm' | 'lg'
}

interface PanelStyle {
  headerBackground?: string             // hex — header bar background
  headerTextColor?: string              // hex — header bar text
  headerBold?: boolean
  headerItalic?: boolean
  headerUppercase?: boolean
  bodyBackground?: string              // hex — panel body tint
}

interface LabelStyle {
  color?: string                        // hex
  bold?: boolean
  italic?: boolean
  uppercase?: boolean
}

interface ValueStyle {
  color?: string                        // hex
  background?: string                  // hex
  bold?: boolean
  italic?: boolean
}
```

### 3.3 FormattingRule Target Update

The existing `FormattingRuleTarget` uses `sectionId`. That concept is replaced. The new target discriminated union is:

```typescript
type FormattingRuleTarget =
  | { kind: 'field';   fieldApiName: string; panelId: string }
  | { kind: 'panel';   panelId: string }
  | { kind: 'region';  regionId: string }
```

`sectionId` is removed. The rest of `FormattingRule` (id, name, active, order, `when: ConditionExpr[]`, effects) is unchanged.

### 3.4 RecordType Relationship

The existing `RecordType.pageLayoutId` field is **deprecated and removed**. Layout assignment is now fully governed by `PageLayout.roles`. A user sees the layout whose `active: true` and whose `roles` contains the user's role. If no active layout covers the user's role, the layout with `isDefault: true` is shown.

### 3.5 Custom Layout Templates

Saved custom templates are stored in `OrgSchema` at the top level:

```typescript
interface OrgSchema {
  // ... existing fields
  customLayoutTemplates?: CustomLayoutTemplate[]
}

// TemplatePanelDef: panel structure without field data (type-level enforcement)
type TemplatePanelDef = Omit<LayoutPanel, 'fields'>
type TemplateRegionDef = Omit<LayoutRegion, 'panels' | 'widgets'> & {
  panels: TemplatePanelDef[]
  // widgets excluded from templates
}
type TemplateTabDef = Omit<LayoutTab, 'regions'> & { regions: TemplateRegionDef[] }

interface CustomLayoutTemplate {
  id: string
  name: string
  objectApi: string                     // the object this template was saved from
  tabs: TemplateTabDef[]               // structural skeleton only — no PanelField data
  createdAt: string                     // ISO date
}
```

When saving as a template the "Save As Template" action produces a `TemplateTabDef[]` by stripping `fields` from every panel. The type system enforces this — `CustomLayoutTemplate.tabs` cannot hold `PanelField[]`.

---

## 4. Editor Shell

### 4.1 Layout

Three zones:
- **Left palette** (fixed, ~200px wide): Fields and Components tabs
- **Center canvas** (fills remaining width): the 12-column layout grid
- **Floating properties panel**: appears near the selected element on click; dismissed by clicking away or the ✕ button. When **nothing is selected**, no floating panel renders.

Top toolbar spans full width.

### 4.2 Top Toolbar

Left to right:
- **Back link**: `← Layouts` (navigates to the layout list for this object)
- **Layout name**: editable inline `<input>` — click to edit, blur to confirm. Updates `layout.name` in the store.
- **Tab bar**: tab pills for each `LayoutTab`, `+ Tab` button to add
- **Right side**: Assigned roles display (chips, click opens role picker), Active toggle (green = live), Preview button, Save button, "Formatting Rules" button

### 4.3 Left Palette

Two tabs: **Fields** and **Components**.

**Fields tab:**
- Search input
- Fields grouped: "Standard Fields" (blue chips) and "Custom Fields" (green chips)
- Each field is a draggable chip with a `⠿` drag handle
- Fields already placed on the layout show a faint checkmark indicator but remain draggable (same field can appear in multiple panels)

**Components tab:**
- Draggable cards for: Header Highlights, Related List, Activity Feed, Files & Folders, Custom Component, Spacer
- Each shows an icon and label
- **Header Highlights** (`widgetType: 'HeaderHighlights'`): renders a horizontal strip of key field values; intended to be dropped in a header region. Config: up to 6 field API names to display as highlight badges.

---

## 5. Canvas

### 5.1 Grid System

- Canvas uses CSS Grid with 12 columns
- Regions placed via `gridColumn` / `gridColumnSpan` / `gridRow`
- Multiple rows supported; rows auto-size to content
- Faint dotted 12-column overlay on the canvas background

### 5.2 Regions

Each region renders as a card on the grid:
- **Region header bar**: shows drag handle, region label, `+ Panel` button, `⚙` icon. Click `⚙` or click the region header → opens floating properties.
- **Region body**: panels stacked vertically, widgets below
- **Resize divider**: visible on the right border between horizontally adjacent regions. Drag to redistribute `gridColumnSpan` between the two regions. Snaps to 12-col increments. Minimum span: 2 cols per region.

`+ Add Region` button at the bottom of the canvas adds a new full-width region.

### 5.3 Panels

Inside a region, panels stack vertically:
- **Panel header bar**: shows drag handle, label, column count badge, `⚙` icon. Click to open floating properties.
- **Panel body**: CSS grid at `panel.columns` columns. Fields are draggable chips.
- **Field resize handle**: thin strip on right edge of each field. Drag right/left to change `colSpan`. Snaps to whole columns. Min span: 1. Max span: `panel.columns`.
- `+ Panel` button at the bottom of each region body

### 5.4 Drag and Drop Interactions

All DnD via `@dnd-kit/core` + `@dnd-kit/sortable`:

| Drag Source | Drop Target | Result |
|---|---|---|
| Field chip (palette) | Panel body | Adds field at drop position; if dropped on an existing field, inserts above it |
| Field chip (panel) | Same panel | Reorders field; insertion above/below closest field |
| Field chip (panel) | Different panel | Moves field to new panel at drop position |
| Component card (palette) | Region body | Adds widget at drop position; if dropped on existing widget, inserts above it |
| Widget (region body) | Different region body | Moves widget to new region |
| Panel header (drag handle) | Same region | Reorders panel within region |
| Region header (drag handle) | Canvas grid | Repositions region; snaps to grid column |

### 5.5 Floating Properties Panel

Appears near the clicked element, repositioned to stay within viewport. Dismissed by clicking anywhere outside it or pressing Escape, or clicking ✕.

**Nothing selected:** Panel does not render.

**Region selected:**
- Label (text input)
- Width: col span button picker (3, 4, 6, 8, 9, 12) — updates `gridColumnSpan`; adjacent region's span adjusts automatically to fill 12 cols
- Region Style: background color, border color + style picker (solid/dashed/none), shadow (none/sm/md), corner radius (none/sm/lg)
- Delete / Duplicate actions

**Panel selected:**
- Label (text input)
- Columns (1 / 2 / 3 / 4 picker)
- Header Bar Style: background color, text color, Bold / Italic / Uppercase toggles
- Panel Body Style: background tint color
- Delete / Duplicate actions

**Field selected:**
- Label Override (text input — overrides the default field label; leave blank to use field default)
- Behavior: None / Required / Read Only / Hidden
- Label Style: color picker, Bold / Italic / Uppercase toggles
- Value Style: text color picker, background color picker, Bold / Italic toggles
- Remove from Layout

**Widget selected:**
- Widget-specific config (e.g. Related List: related object selector, display columns count)
- Delete action

**Color pickers:** A row of quick-access swatches + checkerboard that opens full picker (hue wheel + hex input).

Quick-access swatch palette (consistent across all pickers):
`#ffffff`, `#f1f5f9`, `#e0f2fe`, `#dcfce7`, `#fef3c7`, `#fce7f3`, `#ede9fe`,
`#0ea5e9`, `#10b981`, `#f59e0b`, `#ef4444`, `#8b5cf6`, `#ec4899`, `#1e293b`

---

## 6. Template Gallery

Shown as a full-screen modal when clicking "New Layout".

### 6.1 Structure

- **Left sidebar**: category filter (All Templates, Single Region, Two Regions, Three Regions, With Header, Complex, Saved Custom)
- **Main grid**: 3-column card grid. Each card: SVG block preview (proportional), name (bold), description (col counts), selected state (purple border + tint)
- **Footer**: selected template name + "Use Template →" + Cancel

### 6.2 Built-in Templates

| Name | Structure |
|---|---|
| Blank Canvas | Empty — no regions |
| Full Width | 1 region, 12 cols |
| Header + Main | 12-col header row, 12-col main row |
| Header + Left Sidebar | 12-col header row, 4+8 cols below |
| Header + Right Sidebar | 12-col header row, 8+4 cols below |
| Header + 3 Equal | 12-col header row, 4+4+4 cols below |
| Two Equal | 6+6 cols |
| Two Unequal | 8+4 cols |
| Three Equal | 4+4+4 cols |
| Header + 2 Below | 12-col header, then 6+6 below |
| Complex (5 regions) | 12 header, 8+4 middle, 12 footer |

### 6.3 Saved Custom Templates

"Save As Template" button in the editor toolbar. Saves structural skeleton (regions, panels, column counts, styles — no field data) as a `CustomLayoutTemplate` in `OrgSchema.customLayoutTemplates`. Appears in the "Saved Custom" gallery category.

---

## 7. Layout List Page

Route: `/object-manager/[objectApi]/page-editor` (existing route, repurposed as the list view).
Editor route: `/object-manager/[objectApi]/page-editor/[layoutId]` (existing nested route, unchanged).

Columns: Layout Name, Assigned Roles, Status (Active / Default / Draft badge), Last Modified, Actions (Edit, Duplicate, Delete).

- **Active toggle**: inline per row. Activating a layout that conflicts with another active layout for the same role shows a confirmation dialog: _"[Other Layout] is already active for [Role]. Replace it?"_ Confirmation calls `updateObject()` to deactivate the old and activate the new in a single write.
- **New Layout** button → template gallery modal
- **Role assignment**: role chips on each row; click chips to open role picker multi-select modal

---

## 8. Role-Based Assignment & Active Toggle

- `PageLayout.roles: string[]` — roles come from the org's existing role system
- `PageLayout.active: boolean` — at most one `active: true` layout per role, enforced client-side in the store before calling `updateObject()`
- `PageLayout.isDefault: boolean` — at most one default per object; designating a new default clears the previous one
- **Enforcement location**: `setLayoutActive(layoutId, active)` lives in **`schemaStore`** (not `editor-store`), because it must load and modify all layouts for the object — a schema-level concern. Algorithm:
  1. Load all `PageLayout[]` for the object from `schemaStore`
  2. Find any currently `active: true` layouts that share a role with the target layout
  3. If conflicts exist, return conflict list — the UI (layout list row or editor toolbar) shows the confirmation dialog
  4. On user confirmation: set conflicting layouts `active: false`, set target layout `active: true`
  5. Call `updateObject()` once with the full updated layouts array
- The editor toolbar calls `schemaStore.setLayoutActive` when the Active toggle is clicked
- The editor toolbar always shows current roles and active state

---

## 9. Conditional Formatting Rules

The `FormattingRule` data structure is updated as described in Section 3.3 (target uses `panelId`/`regionId` instead of `sectionId`). The effects (`hidden`, `readOnly`, `badge`, `highlightToken`) are unchanged.

UI: "Formatting Rules" button in toolbar opens a slide-over panel (not a blocking modal). Shows rules in priority order with drag-to-reorder, active/inactive toggle per rule, and an "Add Rule" button. Each rule opens an inline editor with: Name, When conditions (AND/OR), Target picker (field / panel / region from a dropdown of current layout elements), Effects checkboxes.

---

## 10. State Management

Zustand store (`editor-store.ts`) — rebuilt clean. The store holds a `PageLayout` directly (no separate canvas type):

```typescript
interface EditorState {
  layout: PageLayout
  selectedElement: { type: 'region' | 'panel' | 'field' | 'widget'; id: string } | null
  isDirty: boolean
  undoStack: PageLayout[]              // max 30 snapshots
  redoStack: PageLayout[]              // cleared on any mutating action

  // Actions
  setSelectedElement: (el: EditorState['selectedElement']) => void
  updateRegion: (regionId: string, patch: Partial<LayoutRegion>) => void
  updatePanel: (panelId: string, patch: Partial<LayoutPanel>) => void
  updateField: (fieldApiName: string, panelId: string, patch: Partial<PanelField>) => void
  updateWidget: (widgetId: string, patch: Partial<LayoutWidget>) => void
  addRegion: (region: LayoutRegion, tabId: string) => void
  addPanel: (panel: LayoutPanel, regionId: string) => void
  addField: (field: PanelField, panelId: string, atIndex?: number) => void
  addWidget: (widget: LayoutWidget, regionId: string, atIndex?: number) => void
  removeRegion: (regionId: string) => void
  removePanel: (panelId: string) => void
  removeField: (fieldApiName: string, panelId: string) => void
  removeWidget: (widgetId: string) => void
  moveField: (fieldApiName: string, fromPanelId: string, toPanelId: string, atIndex: number) => void
  movePanel: (panelId: string, toIndex: number) => void
  resizeRegion: (regionId: string, newColSpan: number) => void
  resizeField: (fieldApiName: string, panelId: string, newColSpan: number) => void
  pushUndo: () => void
  undo: () => void
  redo: () => void
}

// Key undo/redo rule:
// pushUndo(snapshot): push to undoStack, CLEAR redoStack, mark isDirty = true
// undo(): pop from undoStack, push current to redoStack, restore snapshot
// redo(): pop from redoStack, push current to undoStack, restore snapshot
// Any other mutating action (add/update/remove/move/resize): calls pushUndo first
```

`isDirty` gates the Save button and triggers the unsaved-changes guard on navigation.

---

## 11. Serialization & Persistence

`buildPageLayout(layout: PageLayout): PageLayout` — minimal cleanup before save (strips any undefined/null style fields). Persisted via existing `updateObject()` in schema store.

`initEditorFromLayout(layout: PageLayout): Pick<EditorState, 'layout' | 'isDirty' | 'selectedElement' | 'undoStack' | 'redoStack'>` — returns `{ layout, isDirty: false, selectedElement: null, undoStack: [], redoStack: [] }`. The `layout` field is required in the return type (not `Partial`) so callers cannot accidentally pass `undefined`.

---

## 12. Routing

No routing changes. Existing routes are reused:
- `/object-manager/[objectApi]/page-editor` → layout list page (file: `layout-list-view.tsx`)
- `/object-manager/[objectApi]/page-editor/[layoutId]` → editor (file: `[layoutId]/page.tsx`)

The "Back link" in the toolbar navigates to the list: `router.push(`/object-manager/${objectApi}/page-editor`)`.

---

## 13. Files Changed

**Deleted / fully replaced:**

| Old File | Replacement |
|---|---|
| `editor-store.ts` | rebuilt (same name) |
| `dnd-context-wrapper.tsx` | rebuilt (same name) |
| `canvas-section.tsx` | `canvas-region.tsx` + `canvas-panel.tsx` |
| `canvas-field.tsx` | rebuilt (same name) |
| `canvas-widget.tsx` | rebuilt (same name) |
| `tab-canvas-grid-editor.tsx` | absorbed into new canvas |
| `properties-panel.tsx` | `floating-properties.tsx` |
| `layout-presets.ts` | `templates.ts` (built-in templates data) |
| `new-layout-template-modal.tsx` | `template-gallery.tsx` |
| `build-page-layout.ts` | rebuilt (same name) |
| `types.ts` | rebuilt (same name) |
| `editor-drag-ui-context.tsx` | deleted — drag state folded into store |
| `layout-sample-data.ts` | deleted — replaced by templates.ts stubs |
| `record-header-chrome.tsx` | deleted — highlights moved to panel widget type |

**Retained / lightly updated:**

| File | Change |
|---|---|
| `formatting-rules-dialog.tsx` | UI rebuilt as slide-over; target type updated (panelId/regionId) |
| `unsaved-changes-dialog.tsx` | keep as-is |
| `layout-list-view.tsx` | extended: role chips, active toggle, default star |
| `editor-toolbar.tsx` | rebuilt for new toolbar design (inline name input, roles, active toggle) |
| `field-palette.tsx` → `palette-fields.tsx` | rebuilt |
| `widget-palette.tsx` → `palette-components.tsx` | rebuilt |
| `layout-preview-dialog.tsx` | keep; update to render new region/panel structure |

**Schema (`/lib/schema.ts`) changes:**
- Add `PageLayout.active`, `PageLayout.isDefault`, `PageLayout.roles`
- Add `LayoutRegion`, `LayoutPanel`, `PanelField`, `RegionStyle`, `PanelStyle`, `LabelStyle`, `ValueStyle`, `CustomLayoutTemplate`
- Add `OrgSchema.customLayoutTemplates`
- Remove `LabelColorToken`, `PageFieldPresentation`
- Remove `PageLayout.highlightFields` — replaced by `HeaderHighlights` widget type
- Update `FormattingRuleTarget` (remove `sectionId`, add `panelId`, `regionId`)
- Add `TemplatePanelDef`, `TemplateRegionDef`, `TemplateTabDef` utility types
- Deprecate `RecordType.pageLayoutId`

---

## 14. Out of Scope (this version)

- Mobile/responsive preview mode (future)
- Real-time collaborative editing (future)
- Version history / rollback (future)
- Per-field visibility based on record type (use formatting rules instead)
- "Save As Template" scoped to other users / org sharing (templates are org-wide only)
