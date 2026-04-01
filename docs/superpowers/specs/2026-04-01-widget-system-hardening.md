# Widget System Hardening — Design Spec

**Date:** 2026-04-01
**Status:** Approved for implementation
**Scope:** Fix four confirmed bugs in the widget runtime, make component registration registry-driven (both internal and external), establish a shared package for widget IDs, and update developer documentation to reflect the corrected workflow.

---

## Background

A code review of the widget framework identified four issues:

1. External widgets on record pages always receive an empty stub record, an empty object definition, and an empty `orgId` — not the live record being viewed.
2. `merge-text` config tokens (`{record.fieldApiName}`) are never resolved at runtime — `resolveConfig` is never called.
3. External widgets always receive `integration={null}`, so they can never check connection status.
4. Adding a new widget silently requires updating hardcoded component maps in `layout-widgets-inline.tsx` and `floating-properties.tsx` that are not mentioned in the developer guide or spec, causing "widget unavailable" errors if missed.

Additionally, the backend `externalWidgetIds` array in `apps/api` is fully decoupled from the frontend registry — a second silent footgun as widget count grows.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Integration context | Connection status only (Level A) | Token loading requires server-side infrastructure; deferred to follow-on work |
| Component registration | Registry-driven (Option A) | Single file to edit when adding a widget; removes hidden maps |
| Backend/frontend ID sync | Shared `@crm/widgets` package (Option A) | Only valid solution given the monorepo boundary (`apps/api` must not import `apps/web`) |
| Internal widget config transformation | `transformConfig` field on registration | Handles Spacer's stored shape without breaking other widgets |

---

## Part 1 — Bug Fixes in `layout-widgets-inline.tsx`

### 1a. Pass real props to external widgets

**Current state:** External widgets receive `STUB_RECORD` (`{}`), `STUB_OBJECT` (empty), and `orgId=""`.

**Fix:** Pass `liveRecord`, `liveObject`, and `orgId` to external widgets — the same values already passed to internal widgets.

`orgId` is not currently in `LayoutWidgetsInlineProps`. It must be added as an optional prop (some callers, such as the page editor canvas, have no record context). During implementation, the right source for record-page callers should be confirmed from the parent component — typically from auth context, a session hook, or the record's own `orgId` field.

```tsx
// Before
<WidgetComponent
  config={widgetConfig}
  record={STUB_RECORD}
  object={STUB_OBJECT}
  integration={null}
  displayMode={displayMode}
  orgId=""
/>

// After
<WidgetComponent
  config={resolvedConfig}
  record={liveRecord}
  object={liveObject}
  integration={integrationContext}
  displayMode={displayMode}
  orgId={orgId}
/>
```

### 1b. Resolve merge-text tokens

**Current state:** `resolveConfig` is never called. Raw stored config (with unresolved `{record.fieldApiName}` tokens) is passed directly to widgets.

**Fix:** Import `resolveConfig` from `@/lib/widgets/merge-resolver` and call it on the widget config before rendering, using `liveRecord` as the record context. This applies to both external and internal widgets.

```tsx
import { resolveConfig } from '@/lib/widgets/merge-resolver'

// In the render path:
const resolvedConfig = resolveConfig(widgetConfig, liveRecord)
```

For internal widgets using typed configs (ActivityFeed, FileFolder etc.), `resolveConfig` should also be applied — it is a no-op for configs with no string values containing tokens.

### 1c. Pass integration connection status (Level A)

**Current state:** `integration={null}` always for external widgets.

**Fix:** Add an optional `integrations` prop to `LayoutWidgetsInlineProps`:

```tsx
interface LayoutWidgetsInlineProps {
  widgets?: PageWidget[]
  enabledIds?: string[]
  record?: Record<string, unknown>
  objectDef?: { apiName: string; label: string; fields: Array<{ apiName: string; label: string; type: string }> }
  orgId?: string
  /** Integration connection state keyed by provider ID */
  integrations?: Record<string, { isConnected: boolean }>
}
```

When rendering an external widget whose manifest has `integration !== null`, look up the provider in the `integrations` map and pass `{ provider, isConnected }`. If not found, pass `{ provider, isConnected: false }`. Widgets with `integration: null` still receive `integration={null}`.

> **What is NOT included (Level B / follow-on):** OAuth `accessToken` injection. Tokens require server-side decryption and a separate infrastructure change. Widgets should check `integration?.isConnected` before attempting API calls that would need a token.

---

## Part 2 — Registry-Driven Component Loading

### New `WidgetRegistration` type

Add to `apps/web/lib/widgets/types.ts`:

```ts
export interface WidgetRegistration {
  manifest: WidgetManifest
  Component: React.ComponentType<WidgetProps>
  ConfigPanel?: React.ComponentType<ConfigPanelProps>
  /**
   * Internal widgets only. The PascalCase discriminant stored in
   * WidgetConfig.type (e.g. 'Spacer', 'ActivityFeed'). Used by
   * getInternalRegistrationByType to dispatch the correct component.
   * Not needed for external widgets (looked up by manifest.id).
   */
  widgetConfigType?: string
  /**
   * Internal widgets only. Maps the stored WidgetConfig shape to
   * Record<string, unknown> before passing as the `config` prop.
   * If omitted, the stored config is passed through as-is (cast).
   */
  transformConfig?: (stored: Record<string, unknown>) => Record<string, unknown>
}
```

### External registry (`apps/web/widgets/external/registry.ts`)

Export `externalWidgetRegistrations: WidgetRegistration[]` alongside the existing `externalWidgets: WidgetManifest[]` (derived from registrations to maintain backwards compatibility with palette code).

```ts
import { config as demoWidgetManifest } from './demo-widget/widget.config'
import DemoConfigPanel from './demo-widget/ConfigPanel'

export const externalWidgetRegistrations: WidgetRegistration[] = [
  {
    manifest: demoWidgetManifest,
    Component: dynamic(() => import('./demo-widget/index')),
    ConfigPanel: DemoConfigPanel,
  },
]

// Backwards-compatible derived export
export const externalWidgets: WidgetManifest[] = externalWidgetRegistrations.map(r => r.manifest)
```

### Internal registry (`apps/web/widgets/internal/registry.ts`)

Same pattern. `transformConfig` is included where the stored config shape differs from `Record<string, unknown>`:

```ts
export const internalWidgetRegistrations: WidgetRegistration[] = [
  {
    manifest: spacerManifest,
    widgetConfigType: 'Spacer',
    Component: dynamic(() => import('./spacer/index')),
    transformConfig: (stored) => ({ height: (stored as any).minHeightPx ?? 32 }),
  },
  {
    manifest: activityFeedManifest,
    widgetConfigType: 'ActivityFeed',
    Component: dynamic(() => import('./activity-feed/index')),
    // no transformConfig needed — cast is sufficient
  },
  // ... other internal widgets follow the same pattern
]

export const internalWidgets: WidgetManifest[] = internalWidgetRegistrations.map(r => r.manifest)
```

### `registry-loader.ts` updates

Add lookup helpers for registrations:

```ts
export function getExternalRegistration(id: string): WidgetRegistration | undefined
// type = the PascalCase WidgetConfig.type discriminant, e.g. 'Spacer', 'RelatedList'
export function getInternalRegistrationByType(type: string): WidgetRegistration | undefined
```

`getInternalRegistrationByType` matches against each registration's `widgetConfigType` field. This replaces the existing `MANIFEST_ID_TO_WIDGET_TYPE` reverse-mapping pattern in `palette-components.tsx`, which can be retained separately since it serves a different purpose (DnD drag data).

### `layout-widgets-inline.tsx` — registry-driven rendering

Remove:
- `EXTERNAL_WIDGET_COMPONENTS` record
- All hardcoded `dynamic(() => import(...))` calls for individual widgets
- The if/else chain for internal widget types

Replace with a unified loop that:
1. For `ExternalWidget` config type: looks up registration via `getExternalRegistration(externalWidgetId)`
2. For all other types: looks up internal registration via `getInternalRegistrationByType(config.type)`
3. Calls `transformConfig` if present, otherwise casts config
4. Calls `resolveConfig` on the result
5. Renders the component with full props

### `floating-properties.tsx` — registry-driven config panels

Remove:
- `EXTERNAL_CONFIG_PANELS` record
- `INTERNAL_CONFIG_PANELS` record
- The static imports for individual ConfigPanel components

Replace with lookups from the registrations via `getExternalRegistration` / `getInternalRegistrationByType`. If a registration has a `ConfigPanel`, render it. Otherwise render `SchemaRenderer`.

---

## Part 3 — Shared `@crm/widgets` Package

### Package structure

```
packages/widgets/
  package.json        ← name: "@crm/widgets"
  src/
    index.ts          ← exports EXTERNAL_WIDGET_IDS constant + type
```

```ts
// packages/widgets/src/index.ts
export const EXTERNAL_WIDGET_IDS = ['demo-widget'] as const
export type ExternalWidgetId = (typeof EXTERNAL_WIDGET_IDS)[number]
```

### API consumer

`apps/api/src/widgets/external/registry.ts` replaces its hardcoded array:

```ts
// Before
export const externalWidgetIds: string[] = ['demo-widget']

// After
export { EXTERNAL_WIDGET_IDS as externalWidgetIds } from '@crm/widgets'
```

### Updated workflow for adding a new external widget

1. Add the ID string to `packages/widgets/src/index.ts`
2. Create the widget folder in `apps/web/widgets/external/<widget-name>/`
3. Add a `WidgetRegistration` entry to `apps/web/widgets/external/registry.ts`
4. Optionally add a `widget.routes.ts` under `apps/api/src/widgets/external/<widget-name>/` and register in the API registry

That is the complete list. No other files need editing.

---

## Part 4 — Documentation Update (`docs/widget-developer-guide.md`)

The developer guide must be updated to reflect the corrected workflow. Sections to rewrite:

**"Adding a new external widget" steps** — replace current steps with the four-step workflow from Part 3 above.

**"Adding a new internal widget" steps** — update to: create folder, add `WidgetRegistration` to `internal/registry.ts` (with `transformConfig` if the stored config shape needs mapping). No other files needed.

**Props reference** — add a note to the `integration` prop:
> `accessToken` is not currently populated (Level B — follow-on work). Widgets should check `isConnected` before attempting integration API calls. Do not assume a token is present.

**New section: "What's wired vs deferred"**
- Wired: merge-text resolution, record/object/orgId context, integration connection status
- Deferred: OAuth access token injection (requires server-side infrastructure work)

**"Shipping checklist"** — update to reflect the new single-file registration pattern.

---

## File Change Summary

| File | Change |
|---|---|
| `packages/widgets/src/index.ts` | New — `EXTERNAL_WIDGET_IDS` constant |
| `packages/widgets/package.json` | New — `@crm/widgets` package |
| `apps/web/lib/widgets/types.ts` | Add `WidgetRegistration` interface |
| `apps/web/lib/widgets/registry-loader.ts` | Add `getExternalRegistration`, `getInternalRegistrationByType` helpers |
| `apps/web/widgets/external/registry.ts` | Export `externalWidgetRegistrations`; derive `externalWidgets` from it |
| `apps/web/widgets/internal/registry.ts` | Export `internalWidgetRegistrations`; derive `internalWidgets` from it |
| `apps/web/components/layout-widgets-inline.tsx` | Fix props bug, add `resolveConfig`, add `orgId`/`integrations` props, registry-driven rendering |
| `apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx` | Registry-driven config panel lookup |
| `apps/api/src/widgets/external/registry.ts` | Import `EXTERNAL_WIDGET_IDS` from `@crm/widgets` |
| `docs/widget-developer-guide.md` | Update steps, props reference, add wired-vs-deferred section |

---

## Out of Scope

- OAuth `accessToken` injection (Level B integration context)
- Migrating existing internal widget stored config shapes to the new `configSchema` format
- Widget versioning
- Per-user widget enable/disable
- The `merge-text` field token picker UI (the `{}` button TODO in `schema-renderer.tsx`)
