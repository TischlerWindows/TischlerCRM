# Path Feature Design Spec

## Context

TischlerCRM needs a Salesforce Path-like feature that lets admins define visual stage progressions for any object and lets users see and advance a record's current stage. Objects like Opportunity, Lead, Project, and WorkOrder already have stage/status concepts, but there is no visual path representation or guided stage progression. This feature adds that capability through two parts: a configuration system in the Object Manager and a dynamic widget for record detail pages.

## Architecture Decision

**Schema-Embedded** — Path definitions live on `ObjectDef` in the existing `OrgSchema`, following the same pattern as `workflowRules`, `validationRules`, and `formattingRules`. This keeps path config loaded with the schema (no extra API calls), versioned with schema saves, and consistent with existing CRUD helpers in the Zustand schema store.

---

## 1. Data Model

### Types (added to `apps/web/lib/schema.ts`)

```typescript
interface PathDef {
  id: string;                              // uuid
  name: string;                            // e.g., "Sales Process"
  description?: string;
  active: boolean;
  trackingFieldApiName: string;            // system-created hidden field
  stages: PathStage[];
  createdAt: string;
  updatedAt: string;
}

interface PathStage {
  id: string;                              // uuid
  name: string;                            // e.g., "Prospecting"
  order: number;                           // position in the path (0-based)
  category: 'active' | 'closed-won' | 'closed-lost';
  guidance?: string;                       // guidance for success text
  keyFields?: string[];                    // field apiNames to show in popover
}
```

### ObjectDef Extension

```typescript
interface ObjectDef {
  // ... existing: fields, layouts, workflowRules, validationRules ...
  paths?: PathDef[];
}
```

### Tracking Field

- When a path is created, the system auto-creates a hidden field on the object: `__path_{pathId}_stage`
- The field stores the current stage `id` (UUID string) in the record's JSON `data` column
- The field is prefixed with `__` to indicate system-managed — hidden from normal field lists, the field picker, and form layouts
- When a path is deleted, its tracking field is also removed

### Multiple Paths

- An object can have multiple paths (e.g., "Sales Process" and "Renewal Pipeline" on Opportunity)
- Each path has its own independent tracking field
- Path widgets on a page layout specify which path to display

---

## 2. Settings UI — Object Manager

### Location

New **"Paths"** tab in the Object Manager, alongside Fields, Layouts, Validation Rules, and Workflow Triggers.

**Route:** `/object-manager/[objectApi]/paths`

### Path List View

- Header with object name context + "+ New Path" button
- List of existing paths, each showing:
  - Active/inactive indicator (green/gray dot)
  - Path name
  - Stage count + status text (e.g., "6 stages · Active")
  - Mini stage preview (compact colored chips showing stage names)
  - Edit button + overflow menu (duplicate, delete)

### Path Editor

Full-page editor within the Object Manager (same pattern as workflow trigger editing).

**Top section:**
- Path name (text input)
- Description (text input)
- Active toggle (switch)

**Stages section:**
- "+ Add Stage" button
- Draggable list of stages (reorderable via drag handle)
- Each stage row shows: drag handle, order number, stage name, category badge
- Click/expand a stage to edit:
  - **Stage Name** — text input
  - **Category** — button group: Active | Closed Won | Closed Lost
  - **Key Fields** — tag-style field picker from the object's fields (click "+ Add field" to select)
  - **Guidance for Success** — textarea for guidance text

**Bottom action bar:**
- Cancel button
- Save Path button

### Schema Store Integration

New helpers added to the Zustand schema store (`apps/web/lib/schema-store.ts`):

- `addPath(objectApi, path)` — creates a new path + auto-creates the tracking field
- `updatePath(objectApi, pathId, updates)` — updates path definition
- `deletePath(objectApi, pathId)` — removes path + its tracking field
- `reorderPathStages(objectApi, pathId, stageIds)` — reorder stages

---

## 3. Path Widget (Record Detail)

### Visual Design

**Chevron bar** — horizontal bar of connected chevron-shaped stage segments spanning full widget width.

**Stage visual states:**
| State | Background | Text | Icon |
|-------|-----------|------|------|
| Completed | Dark navy (#1e3a5f) | White | Checkmark |
| Current | Bright blue (#3b82f6) | White, bold | None |
| Future | Light gray (#e2e8f0) | Gray (#64748b) | None |
| Closed Won (terminal) | Green (#22c55e) | White, bold | Star |
| Closed Lost (terminal) | Red (#ef4444) | White, bold | X |

**Closed state coloring:**
- **Closed Won:** All completed stages turn dark green (#166534), won stage is bright green, lost stage is dimmed
- **Closed Lost:** All completed stages turn dark red (#991b1b), lost stage is bright red, won stage is dimmed, skipped future stages stay gray

**Path name label** — small uppercase label above the chevron bar (e.g., "SALES PROCESS"). When closed, appends status: "SALES PROCESS — Closed Won"

### Popover Interaction

Clicking any stage opens a popover below the clicked chevron segment:

1. **Stage name** as heading
2. **Key Fields** section — 2-column grid showing field labels and their live values from the record. Empty/null values shown with a red dash to highlight missing data.
3. **Guidance for Success** section — the guidance text configured for this stage
4. **"Mark as Current Stage" button** — advances (or reverts) the record to this stage

**Going backward:** If the user clicks a stage before the current one, a confirmation dialog appears: "Are you sure you want to move back to [stage name]?" with Cancel/Confirm buttons.

### Stage Transition Data Flow

1. User clicks a stage → popover opens
2. User clicks "Mark as Current Stage"
3. If backward → confirmation dialog, on confirm proceed
4. Widget calls `PUT /objects/:apiName/records/:recordId` updating `data.__path_{pathId}_stage` to the new stage ID
5. Widget re-reads record data and re-renders the chevron bar
6. Initial state: when tracking field has no value, the first "active" category stage is shown as current

---

## 4. Page Builder Integration

### Widget Registration

Registered as an internal widget following existing patterns:

**Files to modify/create:**

| File | Change |
|------|--------|
| `apps/web/widgets/internal/path/widget.config.ts` | Widget manifest |
| `apps/web/widgets/internal/path/index.tsx` | Widget component |
| `apps/web/widgets/internal/path/ConfigPanel.tsx` | Custom config panel |
| `apps/web/widgets/internal/registry.ts` | Register Path widget |
| `apps/web/lib/schema.ts` | Add `PathConfig` to `WidgetConfig` union, add `PathDef`/`PathStage` types, add `paths` to `ObjectDef` |
| `apps/web/lib/schema-store.ts` | Add path CRUD helpers |
| `apps/web/app/object-manager/[objectApi]/page-editor/dnd/drag-parser.ts` | Add 'Path' to `WIDGET_TYPES` |
| `apps/web/app/object-manager/[objectApi]/page-editor/canvas-widget.tsx` | Add label + summary |
| `apps/web/app/object-manager/[objectApi]/page-editor/properties/widget-config-panel.tsx` | Add config panel section |
| `apps/web/components/layout-widgets-inline.tsx` | Handle Path widget rendering |

### Widget Config (stored in page layout)

```typescript
interface PathConfig {
  type: 'Path';
  pathId: string;            // which path to display
  showLabel: boolean;        // show path name above bar (default: true)
  showGuidance: boolean;     // show guidance in popover (default: true)
  showKeyFields: boolean;    // show key fields in popover (default: true)
  compact: boolean;          // compact mode — shorter bar, click-to-advance (default: false)
}
```

### Config Panel (in Page Editor)

When a Path widget is selected in the page editor:

1. **Path Selector** — dropdown of active paths for this object. Auto-selects if only one exists.
2. **Display Options:**
   - Show label (toggle, default on)
   - Show guidance (toggle, default on)
   - Show key fields (toggle, default on)
   - Compact mode (toggle, default off)

---

## 5. Files to Create

| File | Purpose |
|------|---------|
| `apps/web/app/object-manager/[objectApi]/paths.tsx` | Path list + editor UI (settings) |
| `apps/web/widgets/internal/path/widget.config.ts` | Widget manifest |
| `apps/web/widgets/internal/path/index.tsx` | Path widget component |
| `apps/web/widgets/internal/path/ConfigPanel.tsx` | Page builder config panel |

## 6. Files to Modify

| File | Change |
|------|--------|
| `apps/web/lib/schema.ts` | Add `PathDef`, `PathStage`, `PathConfig` types; extend `ObjectDef` with `paths`; add `'Path'` to `WidgetType` |
| `apps/web/lib/schema-store.ts` | Add `addPath`, `updatePath`, `deletePath`, `reorderPathStages` helpers |
| `apps/web/widgets/internal/registry.ts` | Register Path widget |
| `apps/web/app/object-manager/[objectApi]/page-editor/dnd/drag-parser.ts` | Add `'Path'` to `WIDGET_TYPES` set |
| `apps/web/app/object-manager/[objectApi]/page-editor/canvas-widget.tsx` | Add Path label + summary |
| `apps/web/app/object-manager/[objectApi]/page-editor/properties/widget-config-panel.tsx` | Add Path config section |
| `apps/web/components/layout-widgets-inline.tsx` | Handle Path widget type in render pipeline |
| `apps/web/app/object-manager/[objectApi]/*.tsx` | Add "Paths" tab to Object Manager navigation |

---

## 7. Verification

### Settings UI
1. Navigate to Object Manager → select any object → "Paths" tab appears
2. Create a new path with 4+ stages, including at least one closed-won and one closed-lost stage
3. Add key fields and guidance text to at least two stages
4. Verify stage reordering via drag-and-drop
5. Save, then edit — verify all data persists correctly
6. Verify active/inactive toggle works
7. Verify duplicate and delete from the list view

### Widget
1. Open the Page Editor for the object, drag a Path widget into a region
2. In the config panel, select the path created above
3. Toggle display options and verify they save
4. Navigate to a record detail page — path widget renders with chevron bar
5. Click a future stage — popover shows key fields (with record values) + guidance + "Mark as Current Stage"
6. Click "Mark as Current Stage" — chevron bar updates, record's tracking field is written
7. Click a previous stage — confirmation dialog appears, confirm — stage reverts
8. Set stage to a closed-won stage — entire bar turns green
9. Set stage to a closed-lost stage — completed stages turn red, future stages gray
10. Test compact mode — shorter bar, clicking a stage directly advances/reverts (no popover), backward click still shows confirmation dialog
