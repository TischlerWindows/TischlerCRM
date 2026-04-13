# Enhanced Page Builder Rules: Lifecycle Visibility, Tab Rules, and Create Form Widgets

**Date:** 2026-04-13
**Status:** Draft

## Context

The page builder's rules system currently targets fields, panels, and regions with condition-based effects (hidden, readOnly, badge, highlight). However, there are three gaps:

1. **No lifecycle awareness** — Fields cannot be configured to appear only during record creation or only on existing records. Admins must show everything on both screens.
2. **Tabs have no rule support** — Formatting rules cannot target tabs. There's no way to conditionally hide an entire tab.
3. **No widgets on create forms** — Widgets (Team Members, Related Lists, etc.) only render on detail pages. The create dialog renders a flat field-only form.

This design addresses all three with a unified approach: a single layout with lifecycle visibility flags and extended formatting rules.

## Design

### 1. Data Model Changes

Add two boolean flags to every layout element type. Default is `false` (visible everywhere).

**PanelField** (`apps/web/lib/schema.ts`):
```typescript
interface PanelField {
  // ... existing fields
  hideOnNew?: boolean;       // Hide on New Record form (default: false)
  hideOnExisting?: boolean;  // Hide on Existing Record (default: false)
}
```

**LayoutPanel** (`apps/web/lib/schema.ts`):
```typescript
interface LayoutPanel {
  // ... existing fields
  hideOnNew?: boolean;
  hideOnExisting?: boolean;
}
```

**LayoutSection** (`apps/web/lib/schema.ts`):
```typescript
interface LayoutSection {
  // ... existing fields
  hideOnNew?: boolean;
  hideOnExisting?: boolean;
}
```

**LayoutTab** (`apps/web/lib/schema.ts`):
```typescript
interface LayoutTab {
  // ... existing fields
  hideOnNew?: boolean;
  hideOnExisting?: boolean;
}
```

**FormattingRuleTarget** (`apps/web/lib/schema.ts`):
```typescript
type FormattingRuleTarget =
  | { kind: 'field'; fieldApiName: string; panelId: string }
  | { kind: 'panel'; panelId: string }
  | { kind: 'region'; regionId: string }
  | { kind: 'tab'; tabId: string }  // NEW
```

**LayoutWidget** (`apps/web/lib/schema.ts`):
```typescript
interface LayoutWidget {
  // ... existing fields
  hideOnNew?: boolean;
  hideOnExisting?: boolean;
}
```

Widgets get the same flags so admins can control which widgets appear on New Record vs Existing Record independently of their parent region.

### 2. Page Editor UI Changes

**2a. Visibility checkboxes on property panels**

Every element's property panel (field, panel, region, tab) gets a "Visibility" section with two checkboxes:

- [ ] Hide on New Record
- [ ] Hide on Existing Record

Below the checkboxes, auto-updating helper text:
- Neither checked: *(no helper text — default state)*
- Hide on New Record checked: *"This [field/panel/region/tab] will only appear after the record is saved."*
- Hide on Existing Record checked: *"This [field/panel/region/tab] will only appear on the New Record form."*
- Both checked: *"This [field/panel/region/tab] is hidden everywhere. Consider using formatting rules instead."*

**Files affected:**
- `apps/web/app/object-manager/[objectApi]/page-editor/properties/` — field, panel, region, tab property panels
- `apps/web/app/object-manager/[objectApi]/page-editor/store/layout-slice.ts` — update operations for new flags

**2b. Editor toolbar preview toggle**

A segmented control in the editor toolbar: **Existing Record** | **New Record**

When toggled:
- Elements with the corresponding `hideOn*` flag are visually dimmed/grayed out (not removed — admin needs to see them to configure them)
- A status bar below shows: "Viewing as **[mode]**. X fields and Y tabs hidden."

**Files affected:**
- `apps/web/app/object-manager/[objectApi]/page-editor/editor-store.ts` — add `previewMode: 'new' | 'existing'` state
- Editor toolbar component — add segmented control
- Editor canvas component — apply dimming based on preview mode

**2c. Formatting rules: tab target**

The rules builder's target type dropdown adds "Tab" alongside Field/Panel/Region.

When "Tab" is selected:
- Show a tab picker (populated from current layout's tabs)
- Effects panel only shows "Hidden" toggle (no readOnly/badge/highlight for tabs)

**Files affected:**
- `apps/web/app/object-manager/[objectApi]/page-editor/formatting/` — target selector, effects panel

### 3. Create Form Changes

**3a. Lifecycle filtering in DynamicForm**

`DynamicForm` (`apps/web/components/form/dynamic-form.tsx`) already receives `layoutType: 'create' | 'edit'`. During layout resolution:

- When `layoutType === 'create'`: filter out elements where `hideOnNew === true`
- When `layoutType === 'edit'`: filter out elements where `hideOnExisting === true`

Filtering cascades: if a tab is hidden, all its regions/panels/fields are hidden regardless of their own flags. If a region is hidden, all its panels/widgets are hidden.

**3b. Widget rendering on create form**

`DynamicForm` currently renders only panels/fields from the layout's regions. It will now also process `region.widgets` and render them using the existing `LayoutWidgetsInline` component (from `apps/web/components/layout-widgets-inline.tsx`).

Widgets with `hideOnNew === true` are filtered out. Any widget the admin places in the layout can appear on the create form — no whitelist.

**Note:** Widgets that depend on a saved record (e.g., RelatedList needs a record ID for the relationship query) should gracefully handle the case where `recordId` is undefined. They can show an empty state or a "Save to see [widget name]" message. This is a widget-level concern, not a layout concern.

**Files affected:**
- `apps/web/components/form/dynamic-form.tsx` — add widget rendering, lifecycle filtering
- `apps/web/components/layout-widgets-inline.tsx` — handle undefined `recordId` gracefully
- Individual widget components — add empty/pending state for missing record context

### 4. Runtime Formatting Rules for Tabs

**4a. New evaluation function**

Add `getFormattingEffectsForTab(tabId, rules, recordData)` to `apps/web/lib/layout-formatting.ts`. It follows the same pattern as the existing field/panel/region functions: sort rules by order, evaluate conditions, return effects from first matching active rule.

**4b. Tab effects**

Only `hidden` is supported for tab targets. Read-only doesn't make sense at the tab level — set it on individual fields/panels instead.

**4c. Runtime rendering**

In `RecordTabRenderer` (`apps/web/components/record-detail/record-tab-renderer.tsx`), before rendering each tab:

1. Check static flags: if `hideOnExisting === true`, skip the tab
2. Check formatting rules: if `getFormattingEffectsForTab()` returns `hidden: true`, skip the tab
3. Tab bar only shows tabs that pass both checks

**Files affected:**
- `apps/web/lib/layout-formatting.ts` — new `getFormattingEffectsForTab()` function
- `apps/web/components/record-detail/record-tab-renderer.tsx` — integrate tab formatting evaluation

### 5. Backwards Compatibility

All new flags (`hideOnNew`, `hideOnExisting`) default to `false`/`undefined`. Existing layouts with no flags behave exactly as today — everything visible on all screens. No migration required.

The new `tab` target kind in formatting rules is additive — existing rules with `field`/`panel`/`region` targets are unaffected.

### 6. Verification Plan

1. **Data persistence** — Set `hideOnNew`/`hideOnExisting` flags on fields/panels/regions/tabs in a test layout, save, reload, confirm they persist correctly
2. **Page editor UI** — Verify checkboxes appear on all element property panels with correct helper text. Test toolbar preview toggle dims appropriate elements and shows correct counts.
3. **Create form filtering** — Open a New Record form. Confirm elements with `hideOnNew: true` don't render. Confirm widgets render alongside fields in their region positions.
4. **Edit/detail filtering** — Open an existing record. Confirm elements with `hideOnExisting: true` don't render on both the detail view and edit dialog.
5. **Tab formatting rules** — Create a formatting rule targeting a tab with a field-value condition. Verify the tab hides/shows based on record data changes.
6. **Widget graceful degradation** — Place a RelatedList widget on a layout. Open New Record form. Confirm it shows an appropriate empty/pending state rather than erroring.
7. **Backwards compatibility** — Load existing layouts with no new flags. Confirm all elements render as before on both create and edit screens.
