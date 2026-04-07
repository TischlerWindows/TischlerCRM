# Widget Developer Guide

**Framework version:** 1.0  
**Last updated:** 2026-04-01  
**Spec:** `docs/superpowers/specs/2026-03-30-external-widget-framework-design.md`

---

## Contents

1. [Quickstart — External widget](#1-quickstart--external-widget)
2. [Quickstart — Internal widget](#2-quickstart--internal-widget)
3. [`widget.config.ts` reference](#3-widgetconfigts-reference)
4. [Component props reference (`WidgetProps`)](#4-component-props-reference-widgetprops)
5. [What's wired vs deferred](#whats-wired-vs-deferred)
6. [Schema field type catalogue](#5-schema-field-type-catalogue)
7. [`ConfigPanel.tsx` guide](#6-configpaneltsx-guide)
8. [`widget.routes.ts` guide](#7-widgetroutests-guide)
9. [Merge-text resolution](#8-merge-text-resolution)
10. [Integration gating](#9-integration-gating)
11. [Demo widget walkthrough](#10-demo-widget-walkthrough)
12. [RelatedList walkthrough](#11-relatedlist-walkthrough)
13. [Shipping checklist](#12-shipping-checklist)

---

## 1. Quickstart — External widget

An **external widget** is backed by a third-party integration (e.g. Dropbox, Slack). It requires the admin to connect the integration in **Settings → Connected Apps** and enable the widget in **Settings → Widgets** before it appears in the page editor palette.

### Steps

**1. Add the widget ID to the shared package**

Add the widget's ID string to the `EXTERNAL_WIDGET_IDS` array in `packages/widgets/src/index.ts`.

**2. Create the widget folder**

Create `apps/web/widgets/external/<widget-name>/` with:

- `widget.config.ts` — the `WidgetManifest`
- `index.tsx` — the widget component (receives `WidgetProps`)
- `ConfigPanel.tsx` (optional) — override config panel

**3. Add a `WidgetRegistration` entry to the frontend registry**

Add an entry to `apps/web/widgets/external/registry.ts`:

```ts
{
  manifest: yourWidgetManifest,
  Component: dynamic(() => import('./<widget-name>/index')),
  ConfigPanel: YourConfigPanel, // optional
}
```

**4. Optionally add a backend route module**

Add `apps/api/src/widgets/external/<widget-name>/widget.routes.ts` and register it in `apps/api/src/widgets/external/registry.ts`.

That is the complete list. No other files need editing.

> If `integration` is set to a provider ID (e.g. `'dropbox'`), the palette toggle will be locked until that integration is connected in **Settings → Connected Apps**.

---

## 2. Quickstart — Internal widget

An **internal widget** is powered by CRM data. It always appears in the palette — no admin toggle, no integration dependency.

### Steps

**1. Create the widget folder**

Create `apps/web/widgets/internal/<widget-name>/` with:

- `widget.config.ts` — the `WidgetManifest`
- `index.tsx` — the widget component (receives `WidgetProps`)
- `ConfigPanel.tsx` (optional) — override config panel

**2. Add a `WidgetRegistration` entry to the internal registry**

Add an entry to `apps/web/widgets/internal/registry.ts`:

```ts
{
  manifest: yourWidgetManifest,
  widgetConfigType: 'YourType', // must match WidgetConfig.type discriminant in schema
  Component: dynamic(() => import('./<widget-name>/index')),
  ConfigPanel: YourConfigPanel, // optional
  transformConfig: (stored) => ({ ... }), // optional: map stored keys to component prop keys
}
```

No other files need editing.

Internal widgets call existing CRM API routes directly from `index.tsx` (there is no `widget.routes.ts` for internal widgets). Use the `record`, `object`, and `orgId` props to build your API calls. The widget appears immediately in the **Components** section of the palette.

---

## 3. `widget.config.ts` reference

Every widget (internal and external) exports a typed `config` object conforming to `WidgetManifest`. Import the type from the shared library:

```ts
import { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = { ... }
```

### `WidgetManifest` fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique kebab-case identifier. **Immutable after deploy** — changing it orphans all existing placements. |
| `name` | `string` | Yes | Display name shown in the palette and properties panel. |
| `description` | `string` | Yes | One-sentence description shown on the widget card in palette and Settings. |
| `icon` | `string` | Yes | Lucide icon name (e.g. `'FolderOpen'`, `'Activity'`). Browse icons at [lucide.dev](https://lucide.dev). |
| `category` | `'external' \| 'internal'` | Yes | Must match the folder the widget lives in. |
| `integration` | `string \| null` | Yes | Provider ID (e.g. `'dropbox'`) to gate on a connected integration, or `null` for no dependency. |
| `defaultDisplayMode` | `'full' \| 'column'` | Yes | Initial placement mode when dragged onto the canvas. The designer can change it afterwards. |
| `configSchema` | `SchemaField[]` | Yes | Ordered list of fields for the auto-rendered properties panel. May be empty if `ConfigPanel.tsx` handles everything. |

### Full example (external, with integration)

```ts
import { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'dropbox-folder',
  name: 'Dropbox Folder',
  description: 'Browse and upload files from a linked Dropbox folder',
  icon: 'FolderOpen',
  category: 'external',
  integration: 'dropbox',
  defaultDisplayMode: 'full',
  configSchema: [
    {
      key: 'folderPath',
      type: 'merge-text',
      label: 'Folder Path',
      placeholder: '/clients/{record.name}',
      required: true,
      helpText: 'Use {record.fieldApiName} to insert the current record value',
    },
    { type: 'divider' },
    { type: 'heading', label: 'Display options' },
    {
      key: 'showUpload',
      type: 'boolean',
      label: 'Show Upload Button',
      default: true,
    },
    {
      key: 'viewMode',
      type: 'button-group',
      label: 'View Mode',
      options: [
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid' },
      ],
      default: 'list',
    },
  ],
}
```

---

## 4. Component props reference (`WidgetProps`)

Every widget's `index.tsx` default export receives `WidgetProps`. The type is defined in `apps/web/lib/widgets/types.ts`.

```ts
interface WidgetProps {
  config: Record<string, unknown>
  record: Record<string, unknown>
  object: ObjectDefinition
  integration: IntegrationContext | null
  displayMode: 'full' | 'column'
  orgId: string
}
```

### Field reference

| Prop | Type | Description |
|---|---|---|
| `config` | `Record<string, unknown>` | Config values from the properties panel. `merge-text` tokens have already been resolved — `{record.name}` becomes the actual record name. Access fields by the `key` you defined in `configSchema`. |
| `record` | `Record<string, unknown>` | The CRM record currently being viewed. Contains all field values keyed by their API name (`record.name`, `record.accountId`, etc.). |
| `object` | `ObjectDefinition` | The object definition: `{ apiName, label, fields: [{ apiName, label, type }] }`. Use to read the full field schema, build column lists, etc. |
| `integration` | `IntegrationContext \| null` | `null` for internal widgets or `integration: null` external widgets. For connected external widgets: `{ provider, accessToken?, isConnected }`. Do not use `accessToken` directly in client code — prefer calling your `widget.routes.ts` backend handler instead. **Note:** `accessToken` is not currently populated (deferred to follow-on work). Widgets should check `integration?.isConnected` before attempting integration API calls. Do not assume a token is present. |
| `displayMode` | `'full' \| 'column'` | Current placement mode. Use to adapt the component layout — e.g. hide secondary columns in `'column'` mode. |
| `orgId` | `string` | The current organisation ID. Pass to API calls that require multi-tenant isolation. |

### Usage example

```tsx
import { WidgetProps } from '@/lib/widgets/types'

export default function DropboxFolderWidget({ config, record, integration, orgId }: WidgetProps) {
  const folderPath = config.folderPath as string   // already resolved, e.g. '/clients/Acme Corp'
  const showUpload = config.showUpload as boolean

  if (!integration?.isConnected) {
    return <div>Dropbox is not connected. Set it up in Settings → Connected Apps.</div>
  }

  return (
    <div>
      <h3>Files in {folderPath}</h3>
      {/* fetch from /api/widgets/dropbox-folder/files?path=... */}
    </div>
  )
}
```

---

## What's wired vs deferred

**Currently wired:**
- Merge-text token resolution (`{record.fieldApiName}` substitution in config values)
- Live record and object definition passed to all widgets
- `orgId` passed to all widgets
- Integration connection status (`integration.isConnected`)

**Deferred (follow-on work):**
- OAuth `accessToken` injection — requires server-side decryption infrastructure. Widgets should check `isConnected` before making integration API calls.

---

## 5. Schema field type catalogue

The `configSchema` array in `widget.config.ts` drives the auto-rendered properties panel. Each entry is a `SchemaField` object.

### Common optional properties (all types except `divider` / `heading`)

| Property | Type | Description |
|---|---|---|
| `key` | `string` | Config key. Corresponds to the key in the `config` prop received by the widget. |
| `label` | `string` | Display label in the panel. |
| `required` | `boolean` | Shows a red asterisk; blocks save if empty. |
| `default` | `unknown` | Value used when the widget is first placed on a layout. |
| `placeholder` | `string` | Input placeholder text. |
| `helpText` | `string` | Small hint rendered below the field. |

### Type catalogue

| Type | Renders as | Extra properties | Example config value | Notes |
|---|---|---|---|---|
| `text` | Single-line text input | — | `"Acme Corp"` | General-purpose short text. |
| `textarea` | Multi-line text input | — | `"Line 1\nLine 2"` | Use for notes, descriptions, or multi-line templates. |
| `url` | Text input | — | `"https://example.com"` | Applies URL format validation. |
| `merge-text` | Text input with `{}` token picker | — | `"/clients/{record.name}"` | Tokens are resolved at render time on the record page. See [§8](#8-merge-text-resolution). |
| `select` | Dropdown | `options: [{ value, label }]` | `"medium"` | Requires `options` array. |
| `button-group` | Segmented button picker | `options: [{ value, label }]` | `"grid"` | Best for small sets of mutually exclusive choices (S/M/L, Left/Center/Right). |
| `boolean` | Toggle switch | — | `true` | |
| `number` | Number input | `min?: number`, `max?: number` | `10` | |
| `color` | Color swatch picker | — | `"#3b82f6"` | Returns a hex string. |
| `object-select` | Dropdown of CRM object types | — | `"contact"` | Options are sourced from the Object Manager. Respects per-object read permissions. |
| `divider` | Visual separator | — | — | No `key` needed. Use between sections. |
| `heading` | Section label | — | — | No `key` needed. Requires `label`. |
| `json` | JSON textarea | — | `{ "key": "value" }` | Escape hatch for complex, unstructured payloads. Validates JSON syntax. |

### Example: all types together

```ts
configSchema: [
  { type: 'heading', label: 'Content' },
  { key: 'title',       type: 'text',         label: 'Title',        default: 'My Widget' },
  { key: 'description', type: 'textarea',      label: 'Description',  placeholder: 'Enter a description...' },
  { key: 'link',        type: 'url',           label: 'Link URL' },
  { key: 'folderPath',  type: 'merge-text',    label: 'Folder Path',  placeholder: '/clients/{record.name}' },

  { type: 'divider' },
  { type: 'heading', label: 'Display' },

  {
    key: 'size',
    type: 'button-group',
    label: 'Size',
    options: [
      { value: 'sm', label: 'S' },
      { value: 'md', label: 'M' },
      { value: 'lg', label: 'L' },
    ],
    default: 'md',
  },
  {
    key: 'theme',
    type: 'select',
    label: 'Theme',
    options: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
    default: 'light',
  },
  { key: 'accentColor', type: 'color',   label: 'Accent Color', default: '#3b82f6' },
  { key: 'showBorder',  type: 'boolean', label: 'Show Border',  default: true },
  { key: 'maxItems',    type: 'number',  label: 'Max Items',    default: 10, min: 1, max: 50 },

  { type: 'divider' },
  { type: 'heading', label: 'Advanced' },

  { key: 'relatedObject', type: 'object-select', label: 'Related Object' },
  { key: 'rawPayload',    type: 'json',          label: 'Raw Payload',   helpText: 'Advanced: override request body' },
]
```

---

## 6. `ConfigPanel.tsx` guide

### When to use it

The auto-rendered schema panel covers 90 % of use cases. Use `ConfigPanel.tsx` only when:

- Field **options depend on another field's current value** (dynamic options), or
- You need **multi-select**, multi-step wizards, live previews, or other UI that cannot be expressed in `configSchema`.

If your widget just needs static fields, do not create `ConfigPanel.tsx`. The schema renderer is simpler and requires no custom code.

### The `onChange` contract

`ConfigPanel.tsx` receives `ConfigPanelProps`:

```ts
interface ConfigPanelProps {
  config: Record<string, unknown>     // current config values
  onChange: (config: Record<string, unknown>) => void  // replace entire config
  record: Record<string, unknown>     // current record (read-only)
  integration: WidgetProps['integration']
  object: WidgetProps['object']
}
```

Call `onChange` with the **full config object** every time any field changes. The properties panel persists the value you pass — it does not merge partial updates.

```tsx
// Correct: spread existing config, override changed key
onChange({ ...config, myField: newValue })

// Wrong: omits other fields
onChange({ myField: newValue })
```

### RelatedList as a worked example

RelatedList uses `ConfigPanel.tsx` because the column list, link field, and sort field options are derived from whichever object the designer selects. These options are not known until the widget is configured, so they cannot be declared in a static `configSchema`.

```tsx
// apps/web/widgets/internal/related-list/ConfigPanel.tsx
import { useState, useEffect } from 'react'
import { ConfigPanelProps } from '@/lib/widgets/types'

export default function RelatedListConfigPanel({ config, onChange, object }: ConfigPanelProps) {
  const [fields, setFields] = useState<Array<{ apiName: string; label: string }>>([])

  // Step 1: Render the object selector (static — no dependency on other fields)
  // Step 2: When the selected object changes, fetch its field list
  useEffect(() => {
    if (!config.objectApiName) return
    fetch(`/api/objects/${config.objectApiName}/fields`)
      .then(r => r.json())
      .then(data => setFields(data.fields))
  }, [config.objectApiName])

  return (
    <div className="space-y-4">
      {/* Related Object */}
      <ObjectSelect
        label="Related Object"
        value={config.objectApiName as string}
        onChange={val => onChange({ ...config, objectApiName: val, columns: [], linkField: '', sortField: '' })}
      />

      {/* Columns (dynamic — only rendered once an object is chosen) */}
      {fields.length > 0 && (
        <MultiSelect
          label="Columns"
          options={fields.map(f => ({ value: f.apiName, label: f.label }))}
          value={config.columns as string[]}
          onChange={val => onChange({ ...config, columns: val })}
        />
      )}

      {/* Link Field */}
      {fields.length > 0 && (
        <Select
          label="Link Field"
          options={fields.map(f => ({ value: f.apiName, label: f.label }))}
          value={config.linkField as string}
          onChange={val => onChange({ ...config, linkField: val })}
        />
      )}

      {/* Row Limit */}
      <NumberInput
        label="Row Limit"
        value={config.rowLimit as number ?? 10}
        min={1}
        max={50}
        onChange={val => onChange({ ...config, rowLimit: val })}
      />
    </div>
  )
}
```

Key points from this example:

1. **Object selector resets downstream fields** — when `objectApiName` changes, `columns`, `linkField`, and `sortField` are cleared because they are no longer valid for the new object.
2. **Always spread the full config** — `{ ...config, linkField: val }` preserves all other settings.
3. **Conditional rendering** — `columns` and `linkField` are hidden until an object is selected and its field list is loaded.

---

## 7. `widget.routes.ts` guide

External widgets can ship a `widget.routes.ts` file in their API folder:

```
apps/api/src/widgets/external/my-widget/
  widget.routes.ts
```

This file is optional. Use it when your widget needs server-side logic — proxying third-party API calls, accessing OAuth tokens, transforming data, or handling file uploads. Integration tokens never leave the server, so keep any credential usage here.

### Fastify pattern

Widget routes follow the same Fastify plugin pattern used in `apps/api/src/routes/`. Export an `async function registerRoutes(app: FastifyInstance)`:

```ts
// apps/api/src/widgets/external/dropbox-folder/widget.routes.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export async function registerRoutes(app: FastifyInstance) {
  app.get('/files', async (request: FastifyRequest, reply: FastifyReply) => {
    const { path } = request.query as { path: string }
    const { integrationToken, orgId } = (request as any).widgetContext

    const response = await fetch(`https://api.dropboxapi.com/2/files/list_folder`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integrationToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    })

    const data = await response.json()
    return data.entries
  })

  app.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const { integrationToken, orgId, userId } = (request as any).widgetContext
    // ... handle upload
    return { success: true }
  })
}
```

The framework registers this under `/api/widgets/dropbox-folder/*` at startup. Your widget component calls:

```ts
const files = await fetch(`/api/widgets/dropbox-folder/files?path=${encodeURIComponent(folderPath)}`)
```

### `widgetContext` object

The framework injects `request.widgetContext` via Fastify `decorateRequest`. Available fields:

| Field | Type | Description |
|---|---|---|
| `integrationToken` | `string \| undefined` | Decrypted OAuth access token for the current user's connection to the widget's integration. |
| `orgId` | `string` | Current organisation ID. Use for all DB queries to ensure multi-tenant isolation. |
| `userId` | `string` | Current authenticated user ID. |
| `record` | `Record<string, unknown> \| undefined` | The CRM record, if a `recordId` query param was passed to the request. |

### Registration

Add one import to `apps/api/src/widgets/external/registry.ts`:

```ts
export { registerRoutes as myWidgetRoutes } from './my-widget/widget.routes'
```

The API registry iterates all exported `registerRoutes` functions at startup and mounts them under their respective widget namespaces.

### Reference

For the full Fastify route module pattern, see `apps/api/src/routes/integrations.ts` as a reference.

---

## 8. Merge-text resolution

`merge-text` config fields allow designers to embed dynamic record values into string config values. This is the mechanism for folder paths, URL patterns, subject lines, and similar values that should include data from the current record.

### Token syntax

```
{record.fieldApiName}
```

Where `fieldApiName` is the API name of a field on the current record.

**Examples:**

| Token | Resolves to (example) |
|---|---|
| `{record.name}` | `Acme Corp` |
| `{record.accountId}` | `acc_01HABCDEF` |
| `{record.status}` | `Active` |

Tokens are embedded directly in the config string:

```
/clients/{record.name}/documents
→ /clients/Acme Corp/documents
```

### When resolution happens

- **Editor canvas:** Tokens are shown as-is (unresolved). The designer sees `{record.name}` literally. No substitution occurs during layout design.
- **Record page:** Tokens are resolved at render time by `apps/web/lib/widgets/merge-resolver.ts` before the `config` prop is passed to the widget component. By the time your `index.tsx` receives `config.folderPath`, it is already the fully resolved string.

You do not need to handle resolution in your widget component.

### v1 limitations

| Limitation | Behaviour |
|---|---|
| **Nested paths not supported** | `{record.account.name}` is treated as a literal string and is not resolved. |
| **Missing field** | If `fieldApiName` does not exist on the record, the token is replaced with an empty string (`""`). No error is thrown. |
| **Partial resolution** | A string can contain multiple tokens. Each is resolved independently. A string like `{record.firstName} {record.lastName}` resolves correctly even if the first token is present and the second is missing. |

### Fallback behaviour

```
{record.nonExistentField}  →  ""   (empty string, not an error)
/files/{record.name}       →  /files/Acme Corp
/files/{record.missing}    →  /files/
```

Design your widget to gracefully handle empty strings in `merge-text` fields — e.g. show an empty state or prompt the designer to configure the field.

---

## 9. Integration gating

Whether a widget appears in the palette depends on its `integration` property and its enabled state.

### `integration: null`

The widget has no third-party integration dependency.

- **External widget with `integration: null`:** Appears in the palette as soon as an admin enables it in **Settings → Widgets**. The toggle is always actionable — no connection check required.
- **Internal widget with `integration: null`:** All internal widgets use `null`. They always appear in the palette with no admin action required.

### `integration: 'providerID'`

The widget is linked to a specific provider (e.g. `'dropbox'`, `'slack'`).

- The palette tile is visible only when **both** conditions are true:
  1. The widget is enabled in **Settings → Widgets**, AND
  2. The linked integration is connected in **Settings → Connected Apps**
- In Settings → Widgets, the enable toggle shows a locked state with the tooltip "Connect [Provider] first" if the integration is not yet connected.
- If a widget is placed on a layout and the integration is later disconnected, the widget renders a graceful error state — check `integration.isConnected` in your component.

### Disabled state behaviour

| State | Palette | Record page |
|---|---|---|
| Widget enabled, integration connected | Draggable tile | Renders normally |
| Widget enabled, integration not connected | Greyed-out tile with tooltip | Renders integration error state |
| Widget disabled by admin | Hidden from palette | Renders "Widget disabled" placeholder |
| Widget removed from codebase entirely | Not in palette | Renders "Widget unavailable" placeholder |

These last two states are **distinct** — "disabled" means the admin turned off the toggle; "unavailable" means the code no longer exists. They have different copy and different user actions on the record page.

---

## 10. Demo widget walkthrough

The demo widget lives at `apps/web/widgets/external/demo-widget/`. Its purpose is two-fold:

1. **Validation** — proves every schema field type and framework feature works end-to-end.
2. **Template** — copy-paste starting point for new external widgets.

The widget uses `integration: null`, so it does not require a connected integration and is always available once enabled.

### `widget.config.ts`

```
apps/web/widgets/external/demo-widget/widget.config.ts
```

Declares `configSchema` entries for every supported field type in order: `text`, `textarea`, `url`, `merge-text`, `select`, `button-group`, `boolean`, `number`, `color`, `object-select`, `divider`, `heading`, `json`. This makes it immediately obvious when a field type regresses.

Key things to note:
- `integration: null` — no integration required; always actionable in Settings.
- `category: 'external'` — appears under the "External" palette section (not "Components").
- Every field has a `default` so the widget renders without any configuration.

### `index.tsx`

```
apps/web/widgets/external/demo-widget/index.tsx
```

The component is a styled card that **displays its own config values** as labelled rows. When you drag the widget onto a record page, you see every configured value rendered back to you — `merge-text` tokens fully resolved, colors shown as swatches, booleans shown as Yes/No. This makes it trivially easy to confirm that field types are working correctly.

The component also branches on `displayMode`:
- `'full'` — renders all fields in a two-column grid
- `'column'` — renders a compact single-column list

### `ConfigPanel.tsx`

```
apps/web/widgets/external/demo-widget/ConfigPanel.tsx
```

The demo widget ships `ConfigPanel.tsx` as a demonstration of the escape hatch. It adds a **live preview pane** alongside the standard fields — the preview panel re-renders in real time as config values change in the properties panel.

This file is not the default pattern. It exists to show how `ConfigPanel.tsx` works. For most widgets, the auto-rendered schema panel is sufficient.

### How to use it as a template

1. Copy the entire `demo-widget/` folder.
2. Change `id` in `widget.config.ts` — this is the only change that is **required** before the widget works.
3. Trim `configSchema` to only the fields your widget needs.
4. Replace the `index.tsx` display logic with your actual UI.
5. Delete `ConfigPanel.tsx` unless you need dynamic field behaviour.
6. Register the new folder in `apps/web/widgets/external/registry.ts`.

---

## 11. RelatedList walkthrough

The RelatedList widget is the fully built internal widget and the reference implementation for the `ConfigPanel.tsx` escape hatch.

**Location:** `apps/web/widgets/internal/related-list/`

### Why it needs `ConfigPanel.tsx`

RelatedList lets the designer choose a related object, then pick columns, a link field, and a sort field from that object's field list. The field list is not known at widget declaration time — it depends on which object the designer selects. A static `configSchema` cannot express this dependency, so RelatedList uses the escape hatch.

As a result, `configSchema` in `widget.config.ts` is empty — all config is handled by `ConfigPanel.tsx`.

### `widget.config.ts`

Sets `category: 'internal'`, `integration: null`, and an empty `configSchema: []`. The presence of `ConfigPanel.tsx` in the folder signals to the properties panel renderer to use it instead of the schema renderer.

### `ConfigPanel.tsx` — the dynamic pattern

The panel has three phases:

1. **Object selection** — an `object-select` dropdown. Always rendered. On change, it resets downstream fields (columns, link field, sort field) and fetches the new object's field list.
2. **Field list loading** — calls `GET /api/objects/:objectApiName/fields`. Shows a loading state while fetching.
3. **Field selectors** — multi-select for columns, single-select for link field and sort field, driven by the fetched field list. Rendered only after the field list loads.

The `onChange` contract is followed strictly: every change calls `onChange({ ...config, changedKey: newValue })` to replace the full config object.

### `index.tsx` — runtime rendering

At runtime on a record page, the component:

1. Reads `config.objectApiName`, `config.linkField`, `config.columns`, `config.sortField`, `config.sortDirection`, `config.rowLimit`, `config.showSearch` from the resolved `config` prop.
2. Fetches related records from `GET /api/objects/:objectApiName/records` with query params:
   - `filter[linkField]=currentRecordId` — filters to records linked to the current record
   - `orderBy=sortField:direction` — applies the configured sort
   - `limit=rowLimit` — caps the result set
3. Renders a table with the configured columns.
4. Shows a loading skeleton while fetching.
5. Shows an empty state ("No related records") if the fetch returns zero rows.
6. Shows an optional search input if `config.showSearch` is true.

### Config shape

```ts
{
  objectApiName: string    // e.g. 'contact'
  columns: string[]        // field API names to show as columns
  linkField: string        // field on the related object that references the current record
  sortField: string        // field API name to sort by
  sortDirection: 'asc' | 'desc'
  rowLimit: number         // 1–50, default 10
  showSearch: boolean      // default false
}
```

### Extending the pattern

When you need dynamic config for your own widget, follow the same three-phase pattern:

1. Render a "root" selector that controls what downstream options are available.
2. On root change, reset downstream fields and fetch new options.
3. Render downstream selectors only after options load.

Always spread `config` in `onChange` calls to preserve fields not being changed.

---

## 12. Shipping checklist

Use this checklist before considering a widget done.

### All widgets

- [ ] `id` is unique, kebab-case, and will not change after deploy
- [ ] `category` matches the folder (`'external'` or `'internal'`)
- [ ] `icon` is a valid Lucide icon name (verify at [lucide.dev](https://lucide.dev))
- [ ] All `configSchema` fields have a `default` so the widget renders without manual configuration
- [ ] A `WidgetRegistration` entry has been added to the appropriate registry file (`apps/web/widgets/external/registry.ts` or `apps/web/widgets/internal/registry.ts`) — this is the only registration step required; do not edit `layout-widgets-inline.tsx` or `floating-properties.tsx`
- [ ] Dragging the widget onto a layout in the page editor works without errors
- [ ] All `configSchema` fields render correctly in the properties panel
- [ ] The component renders correctly on a record page with default config
- [ ] The component handles loading and empty states gracefully
- [ ] `displayMode: 'column'` is handled (compact layout or graceful fallback)

### External widgets only

- [ ] Widget is enabled in **Settings → Widgets**
- [ ] If `integration` is set to a provider ID: integration is connected in **Settings → Connected Apps**
- [ ] Widget appears in the **External** section of the page editor palette
- [ ] `integration.isConnected === false` is handled gracefully in `index.tsx` (do not assume the token is always present)
- [ ] If using `widget.routes.ts`: routes are registered in `apps/api/src/widgets/external/registry.ts`
- [ ] If using `widget.routes.ts`: no credentials or tokens are returned to the client; all credential usage stays on the server

### Widgets with `ConfigPanel.tsx`

- [ ] Every `onChange` call spreads the full existing `config` object
- [ ] Resetting a root field (e.g. object selection) clears dependent downstream fields
- [ ] Loading states are shown while async options are fetched
- [ ] The panel handles the case where no root selection has been made yet (empty/unconfigured state)

### `merge-text` fields

- [ ] Widget handles empty string gracefully when a token resolves to `""` (missing field)
- [ ] Placeholder text uses `{record.fieldApiName}` format to guide the designer
- [ ] `helpText` explains the token syntax to designers who may be unfamiliar with it

### Merge-text in `widget.config.ts` best practice

```ts
{
  key: 'folderPath',
  type: 'merge-text',
  label: 'Folder Path',
  placeholder: '/clients/{record.name}',
  helpText: 'Use {record.fieldApiName} to insert field values from the current record',
  required: true,
}
```
