# Page Layout System Hardening — Comprehensive Refactor

## Context

The page layout system (builder, data model, and live page rendering) has accumulated technical debt through feature growth. The system has a dual data model (`EditorPageLayout` vs `PageLayout`) requiring bidirectional conversion, 6 files over 500 lines with tangled responsibilities, CSS chaos (`!important` overrides, hardcoded z-indexes, mixed styling approaches), missing validation and error handling, and accessibility gaps. This refactor unifies the architecture, decomposes large files into testable modules, fixes rendering issues on both the builder and live page, and polishes performance and responsive behavior — making the system robust under the hood while keeping the user experience simple and clean.

## Decisions

- **Migrate all layouts to the new Region → Panel → Field model.** Remove the legacy `PageTab/PageSection/PageField` rendering path entirely. Auto-migrate on load.
- **Full decomposition of all files over 500 lines** into focused, single-responsibility modules (~200 lines each).
- **Tailwind-first with design tokens.** Remove `!important` overrides, establish z-index scale and spacing tokens in `tailwind.config.ts`.
- **Add tests as we go.** Each new module gets unit/component tests.
- **Layered approach in 4 phases:** Foundation → Decomposition → Rendering → Polish.

---

## Phase 1: Foundation

Unified data model, design tokens, and validation layer.

### 1a. Unified Layout Model

**Goal:** Single `PageLayout` type used by both builder and renderer.

**Current state:**
- `EditorPageLayout` (editor) uses `LayoutTab → LayoutSection (regions) → LayoutPanel → PanelField`
- `PageLayout` (persistence/rendering) uses `PageTab → PageSection → PageField`
- ~100+ lines of bidirectional conversion in `[layoutId]/page.tsx` (`toPersistedLayout`, `toEditorLayout`, `normalizeTab`)

**Target:**
- Single `PageLayout` with hierarchy: `Tab[] → Region[] → Panel[] → Field[]`
- One-way `migrateLegacyLayout(old: LegacyPageLayout): PageLayout` for backward compat
- Migration runs automatically on layout load (in schema-store or a dedicated hook)
- Remove `EditorPageLayout`, `toPersistedLayout()`, `toEditorLayout()` entirely

**Files to modify:**
- `apps/web/lib/schema.ts` — redefine `PageLayout` with new hierarchy
- `apps/web/app/object-manager/[objectApi]/page-editor/types.ts` — remove `EditorPageLayout`, keep shared sub-types
- `apps/web/lib/schema-store.ts` — add migration on load
- `apps/web/app/object-manager/[objectApi]/page-editor/[layoutId]/page.tsx` — remove conversion logic

**New files:**
- `apps/web/lib/layout-migration.ts` — `migrateLegacyLayout()` function

### 1b. Design Tokens

**Goal:** Consistent, maintainable styling via Tailwind config.

**Changes:**
- `tailwind.config.ts` — add z-index scale:
  - `dropdown: 10`, `sticky: 20`, `overlay: 30`, `modal: 40`, `toast: 50`
- `apps/web/app/globals.css` — remove all `!important` overrides (`.bg-gray-50`, `.border-gray-200`)
- Replace hijacked Tailwind color classes with semantic colors in `tailwind.config.ts` `extend.colors` (e.g., `primary`, `surface`, `border-default`) so they work with standard Tailwind classes
- Document the z-index scale as a comment in `tailwind.config.ts`

**Files to modify:**
- `apps/web/tailwind.config.ts`
- `apps/web/app/globals.css`

### 1c. Validation Schemas

**Goal:** Runtime validation at mutation points (editor save, API route).

**New file:** `apps/web/lib/layout-validation.ts`

**Schemas to create (Zod):**
- `PageLayoutSchema` — validates full layout structure
- `RegionSchema` — grid position bounds (1-12 columns), non-overlapping check
- `PanelSchema` — columns (1-4), field ordering
- `FieldSchema` — valid `fieldApiName`, `colSpan` within panel columns
- `WidgetConfigSchema` — validates against widget registration's `configSchema`
- `FormattingRuleSchema` — conditions, targets, effects

**Grid collision detection:** Check that no two regions in the same tab overlap in the 12-column grid. Report which regions conflict.

**Integration points:**
- Editor save path (in `use-editor-lifecycle.ts` after decomposition)
- API route `PUT /layouts/:layoutId` (in `apps/api/src/routes/layouts.ts`)

---

## Phase 2: Decomposition

Break all files over 500 lines into focused modules with tests.

### 2a. floating-properties.tsx (1,162 lines) → `properties/`

| New file | Responsibility | ~Lines |
|----------|---------------|--------|
| `properties/field-properties.tsx` | Field label/value styling, behavior (required/readOnly/hidden) | ~200 |
| `properties/panel-properties.tsx` | Panel header styling, column count, collapse | ~200 |
| `properties/region-properties.tsx` | Region grid position, background, border, shadow | ~200 |
| `properties/widget-config-panel.tsx` | Delegates to registry `ConfigPanel` per widget type | ~150 |
| `properties/properties-sidebar.tsx` | Orchestrator — renders correct panel based on `selectedElement` | ~100 |

### 2b. [layoutId]/page.tsx (904 lines) → `editor/`

| New file | Responsibility | ~Lines |
|----------|---------------|--------|
| `editor/editor-page.tsx` | Shell component (layout, routing, toolbar) | ~150 |
| `editor/use-editor-lifecycle.ts` | Hook: load, save, normalization, dirty tracking | ~250 |
| `editor/editor-canvas.tsx` | Canvas area (tabs + regions rendering) | ~200 |

### 2c. dnd-context-wrapper.tsx (574 lines) → `dnd/`

| New file | Responsibility | ~Lines |
|----------|---------------|--------|
| `dnd/dnd-provider.tsx` | DndContext setup, sensors, collision strategy | ~100 |
| `dnd/drag-parser.ts` | Type-safe `parseActiveDrag()` with discriminated unions | ~100 |
| `dnd/drop-handler.ts` | `parseDropTarget()` + store dispatch | ~150 |
| `dnd/types.ts` | `DragPayload` discriminated union type | ~30 |

**Type-safe drag payload:**
```typescript
type DragPayload =
  | { kind: 'field'; fieldApiName: string; sourcePanelId?: string }
  | { kind: 'widget'; widgetType: string; sourceRegionId?: string }
  | { kind: 'panel'; panelId: string; sourceRegionId?: string }
  | { kind: 'region'; regionId: string };
```

### 2d. formatting-rules-dialog.tsx (884 lines) → `formatting/`

| New file | Responsibility | ~Lines |
|----------|---------------|--------|
| `formatting/rules-dialog.tsx` | Dialog shell, rule list CRUD | ~200 |
| `formatting/condition-builder.tsx` | Condition expression editor (left/op/right) | ~250 |
| `formatting/effect-picker.tsx` | hidden/readOnly/badge/highlight selectors | ~150 |
| `formatting/rule-preview.tsx` | Live preview of formatting effect | ~100 |

### 2e. editor-store.ts (734 lines) → `store/`

| New file | Responsibility | ~Lines |
|----------|---------------|--------|
| `store/layout-slice.ts` | Layout mutations (regions, panels, fields, widgets) | ~300 |
| `store/selection-slice.ts` | Selected element tracking | ~80 |
| `store/history-slice.ts` | Undo/redo stack (30 snapshots) | ~100 |
| `store/editor-store.ts` | Composition of slices into single Zustand store | ~80 |

### 2f. record-detail-page.tsx (~1,200 lines) → `record-detail/`

| New file | Responsibility | ~Lines |
|----------|---------------|--------|
| `record-detail/record-detail-page.tsx` | Shell: layout resolution, tab routing, action bar | ~200 |
| `record-detail/record-tab-renderer.tsx` | Renders a single tab (regions → panels → fields) | ~250 |
| `record-detail/field-value-renderer.tsx` | `renderValue()` for 25+ field types | ~300 |
| `record-detail/record-actions.tsx` | Edit/delete/clone/admin menu actions | ~200 |

### 2g. dynamic-form.tsx (~1,600 lines) → `form/`

| New file | Responsibility | ~Lines |
|----------|---------------|--------|
| `form/dynamic-form.tsx` | Shell: form layout, section rendering, submit | ~200 |
| `form/field-input.tsx` | Renders input for each field type (25+ types) | ~400 |
| `form/form-validation.ts` | `validateFields()` shared utility (extracted from duplicate logic) | ~150 |
| `form/lookup-search.tsx` | Lookup autocomplete with paginated search | ~200 |
| `form/address-field.tsx` | Address input with Google Places autocomplete | ~200 |
| `form/picklist-fields.tsx` | Picklist, MultiPicklist, PicklistText, PicklistLookup | ~200 |

**Note:** `layout-list-view.tsx` (493 lines) is under the 500-line threshold and excluded from decomposition.

### 2h. Tests

**Unit tests:**
- `layout-migration.test.ts` — legacy layout conversion (all edge cases)
- `layout-validation.test.ts` — schema validation, grid collision detection
- `drag-parser.test.ts` — all drag payload types, malformed input handling
- `drop-handler.test.ts` — drop target resolution, store dispatch correctness

**Component tests:**
- `field-properties.test.tsx` — renders correctly for each behavior mode
- `properties-sidebar.test.tsx` — switches panel based on selected element
- `condition-builder.test.tsx` — condition expression editing

---

## Phase 3: Rendering Fixes

Fix the live page and builder rendering using the unified model.

### 3a. Live Page (record-detail-page.tsx)

- Remove legacy `PageTab/PageSection` rendering path (dead after Phase 1 migration)
- Simplify `renderTab()` to only handle `Region → Panel → Field`
- Replace inline `style={{ gridTemplateColumns: ... }}` with Tailwind grid classes
- Replace hardcoded z-indexes (`z-20`, `z-30`, `z-40`, `z-50`) with token classes
- Add `React.memo` on field rendering components
- Fix scroll lock on admin menu overlay (`overflow: hidden` on body when open)
- Key file: `apps/web/components/record-detail-page.tsx`

### 3b. Builder Canvas

- Wrap `CanvasSection`, `CanvasPanel`, `CanvasField`, `CanvasWidget` in `ErrorBoundary`
- Error boundary UI: "Something went wrong — click to retry" with reset
- Use type-safe drag payloads from `dnd/drag-parser.ts`
- Add visual grid collision warnings (red highlight on overlapping regions)

### 3c. Widget Rendering

- Validate widget configs against registration `configSchema` before render
- Fallback UI: "Widget misconfigured — edit in layout builder"
- Ensure `resolveConfig()` called for all widget types (internal + external)
- Key file: `apps/web/components/layout-widgets-inline.tsx`

### 3d. Accessibility

- Add `aria-label` to icon-only buttons (collapse/expand chevrons, drag handles, delete)
- Text alternatives for color-only status indicators
- Fix Enter key form behavior — use proper `onSubmit`, not field-level Enter override
- Add `role="alert"` on validation error messages
- Keyboard navigation audit for builder canvas

### 3e. Field Rendering

- Remove hardcoded `autoGeneratedFieldNames` array — detect from `FieldDef.type` (`AutoNumber`, `Formula`, `RollupSummary`, `AutoUser`)
- Fix MultiPicklist delimiter validation (handle missing/corrupted `;` separator)
- Replace `lookupTick` counter hack with proper loading state for lookup label resolution
- Duplicate validation logic (`validateForm`/`validateSection`) → extract to shared `validateFields()` utility

---

## Phase 4: Polish

Performance, responsive behavior, edge cases, and final QA.

### 4a. Performance

- Replace "preload ALL lookup records" with paginated search-on-type (debounced, 300ms)
- Memoize expensive `renderValue()` calls with `React.useMemo`
- `React.lazy` + code splitting for formatting rules dialog
- Skeleton loading states for widget components during async loads

### 4b. Responsive Refinement

- 12-column grid regions stack to full-width below `md:` breakpoint
- Address field grid: `grid-cols-1` on mobile, `grid-cols-2` on tablet+
- Builder canvas: mobile-friendly read-only preview mode (no drag-drop on mobile)

### 4c. Edge Cases & Robustness

- Optimistic save with rollback on failure (show error toast, restore previous state)
- Concurrent edit detection: if `updatedAt` changed since load, warn before save
- Consolidate formatting rules to top-level `formattingRules` only (remove `extensions.formattingRules` fallback)
- Show undo/redo limit indicator when history stack is full (30 snapshots)

### 4d. API Improvements

- Replace destructive PUT (delete-all-recreate) with Prisma nested `upsert`
- Add partial layout update endpoint for single-field/panel changes
- Improve error responses with field-level detail

### 4e. QA Checklist

- [ ] All layout templates render correctly after migration
- [ ] Drag-drop works for all payload types (field, widget, panel)
- [ ] Formatting rules work across all target types (field, panel, region)
- [ ] Responsive at 320px, 768px, 1024px, 1440px
- [ ] Screen reader audit (VoiceOver/NVDA) on builder and live page
- [ ] No console errors or warnings in production build

---

## Key Files Reference

| File | Current Lines | Phase | Action |
|------|:---:|:---:|--------|
| `apps/web/lib/schema.ts` | 854 | 1 | Redefine PageLayout types |
| `apps/web/lib/schema-store.ts` | 1,139 | 1 | Add migration on load |
| `apps/web/tailwind.config.ts` | — | 1 | Add z-index/token scale |
| `apps/web/app/globals.css` | — | 1 | Remove !important overrides |
| `apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx` | 1,162 | 2 | Split → `properties/` |
| `apps/web/app/object-manager/[objectApi]/page-editor/[layoutId]/page.tsx` | 904 | 1+2 | Remove conversion, split → `editor/` |
| `apps/web/app/object-manager/[objectApi]/page-editor/formatting-rules-dialog.tsx` | 884 | 2 | Split → `formatting/` |
| `apps/web/app/object-manager/[objectApi]/page-editor/editor-store.ts` | 734 | 2 | Split → `store/` |
| `apps/web/app/object-manager/[objectApi]/page-editor/dnd-context-wrapper.tsx` | 574 | 2 | Split → `dnd/` |
| `apps/web/components/record-detail-page.tsx` | ~1,200 | 2+3 | Split → `record-detail/`, remove legacy path |
| `apps/web/components/dynamic-form.tsx` | ~1,600 | 2+3 | Split → `form/`, fix validation |
| `apps/web/components/layout-widgets-inline.tsx` | — | 3 | Add config validation |
| `apps/api/src/routes/layouts.ts` | — | 1+4 | Add validation, improve PUT |

## New Files

| File | Phase | Purpose |
|------|:---:|--------|
| `apps/web/lib/layout-migration.ts` | 1 | Legacy → new model migration |
| `apps/web/lib/layout-validation.ts` | 1 | Zod schemas, grid collision detection |
| `apps/web/app/object-manager/[objectApi]/page-editor/properties/*.tsx` | 2 | Property panel components |
| `apps/web/app/object-manager/[objectApi]/page-editor/editor/*.tsx` | 2 | Editor page components |
| `apps/web/app/object-manager/[objectApi]/page-editor/dnd/*.ts(x)` | 2 | Drag-drop modules |
| `apps/web/app/object-manager/[objectApi]/page-editor/formatting/*.tsx` | 2 | Formatting rules components |
| `apps/web/app/object-manager/[objectApi]/page-editor/store/*.ts` | 2 | Store slices |
| `apps/web/components/record-detail/*.tsx` | 2 | Record detail page components |
| `apps/web/components/form/*.tsx` | 2 | Dynamic form components |
| `apps/web/lib/__tests__/layout-migration.test.ts` | 2 | Migration tests |
| `apps/web/lib/__tests__/layout-validation.test.ts` | 2 | Validation tests |

## Verification

After each phase:
1. Run `pnpm build` — no TypeScript errors
2. Run `pnpm test` — all tests pass
3. Manual verification:
   - Open the page editor, create a layout with regions/panels/fields/widgets
   - Save, reload, verify persistence
   - Open a record detail page, verify layout renders correctly
   - Test drag-drop for all payload types
   - Test formatting rules
   - Check responsive behavior at mobile/tablet/desktop
4. After Phase 1 specifically: verify that an old-format layout auto-migrates on load and renders correctly in both builder and live page
