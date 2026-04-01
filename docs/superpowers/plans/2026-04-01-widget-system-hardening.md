# Widget System Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four confirmed runtime bugs in the widget system, make component registration fully registry-driven (eliminating hidden manual maps), and add a shared `@crm/widgets` package so the API and frontend share a single source of truth for external widget IDs.

**Architecture:** A new `packages/widgets` package exports `EXTERNAL_WIDGET_IDS`. Both `apps/web` registries are extended to export `WidgetRegistration[]` (manifest + lazy component + optional ConfigPanel), and all hardcoded dispatch maps (`EXTERNAL_WIDGET_COMPONENTS`, `EXTERNAL_CONFIG_PANELS`, `INTERNAL_CONFIG_PANELS`, the if/else chain in `layout-widgets-inline`) are replaced with registry lookups. Bug fixes (stub props, missing `resolveConfig`, null integration) are applied in `layout-widgets-inline.tsx` in the same pass.

**Tech Stack:** Next.js 14, React, TypeScript, Fastify, pnpm workspaces (`packages: ['apps/*', 'packages/*']`). Test framework: Jest (see existing tests at `apps/web/lib/widgets/__tests__/merge-resolver.test.ts` for patterns).

---

## File Map

| File | Action | Reason |
|---|---|---|
| `packages/widgets/package.json` | Create | `@crm/widgets` package manifest |
| `packages/widgets/tsconfig.json` | Create | TypeScript config for the package |
| `packages/widgets/src/index.ts` | Create | `EXTERNAL_WIDGET_IDS` constant |
| `apps/web/lib/widgets/types.ts` | Modify | Add `WidgetRegistration`; add `objectOptions?` to `ConfigPanelProps` |
| `apps/web/lib/widgets/registry-loader.ts` | Modify | Add `getExternalRegistration`, `getInternalRegistrationByType` |
| `apps/web/lib/widgets/__tests__/registry-loader.test.ts` | Create | Tests for new lookup helpers and `transformConfig` |
| `apps/web/widgets/external/registry.ts` | Modify | Export `externalWidgetRegistrations`; derive `externalWidgets` from it |
| `apps/web/widgets/internal/registry.ts` | Modify | Export `internalWidgetRegistrations` with all 5 widgets; derive `internalWidgets` from it |
| `apps/web/components/layout-widgets-inline.tsx` | Modify | Fix stub props / orgId / integration; add `resolveConfig`; registry-driven rendering |
| `apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx` | Modify | Replace hardcoded panels and maps with registry-driven lookup |
| `apps/api/src/widgets/external/registry.ts` | Modify | Import `EXTERNAL_WIDGET_IDS` from `@crm/widgets` |
| `apps/api/package.json` | Modify | Add `@crm/widgets: "workspace:*"` dependency |
| `docs/widget-developer-guide.md` | Modify | Update quickstart steps, props reference, shipping checklist |

---

## Task 1: Create `@crm/widgets` shared package

**Files:**
- Create: `packages/widgets/package.json`
- Create: `packages/widgets/tsconfig.json`
- Create: `packages/widgets/src/index.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/widgets/external/registry.ts`

- [ ] **Step 1: Create the package files**

Create `packages/widgets/package.json`:
```json
{
  "name": "@crm/widgets",
  "version": "0.0.1",
  "private": true,
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "5.4.5"
  }
}
```

Create `packages/widgets/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `packages/widgets/src/index.ts`:
```ts
export const EXTERNAL_WIDGET_IDS = ['demo-widget'] as const
export type ExternalWidgetId = (typeof EXTERNAL_WIDGET_IDS)[number]
```

- [ ] **Step 2: Add `@crm/widgets` to the API app's dependencies**

In `apps/api/package.json`, add to the `"dependencies"` object (after `"@crm/types": "workspace:*"`):
```json
"@crm/widgets": "workspace:*",
```

- [ ] **Step 3: Update the API registry to import from the shared package**

Replace the entire contents of `apps/api/src/widgets/external/registry.ts`:
```ts
import type { FastifyInstance } from 'fastify'
export { EXTERNAL_WIDGET_IDS as externalWidgetIds } from '@crm/widgets'

export const externalWidgetRouteModules: Array<{
  widgetId: string
  registerRoutes: (app: FastifyInstance) => Promise<void>
}> = []
```

- [ ] **Step 4: Install and verify**

```bash
cd c:/Users/jjjip/Documents/GitHub/TischlerCRM-New-Test-Branch/TischlerCRM-New-Test-Branch
pnpm install
```

Expected: no errors. The `@crm/widgets` package resolves from the workspace.

- [ ] **Step 5: Commit**

```bash
git add packages/widgets/ apps/api/package.json apps/api/src/widgets/external/registry.ts
git commit -m "feat: add @crm/widgets shared package for external widget IDs"
```

---

## Task 2: Extend `types.ts` with `WidgetRegistration`

**Files:**
- Modify: `apps/web/lib/widgets/types.ts`

- [ ] **Step 1: Add `objectOptions` to `ConfigPanelProps` and add `WidgetRegistration`**

`apps/web/lib/widgets/types.ts` currently ends at line 77. Append after line 76 (before the final blank line):

Replace the existing `ConfigPanelProps` interface and add `WidgetRegistration` below it. The full updated bottom of the file should be:

```ts
// Props for optional ConfigPanel.tsx escape hatch
export interface ConfigPanelProps {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  record: Record<string, unknown>
  integration: WidgetProps['integration']
  object: WidgetProps['object']
  /** Populated when an object-select field is present in the schema */
  objectOptions?: Array<{ value: string; label: string }>
}

// Full registration entry — one per widget, in the registry files
export interface WidgetRegistration {
  manifest: WidgetManifest
  /** Lazy-loaded React component (use next/dynamic at the call site) */
  Component: React.ComponentType<WidgetProps>
  /** Optional custom properties panel. If absent, SchemaRenderer is used. */
  ConfigPanel?: React.ComponentType<ConfigPanelProps>
  /**
   * Internal widgets only. The PascalCase discriminant stored in
   * WidgetConfig.type (e.g. 'Spacer', 'ActivityFeed'). Used by
   * getInternalRegistrationByType to dispatch the correct component.
   */
  widgetConfigType?: string
  /**
   * Internal widgets only. Normalises the stored WidgetConfig shape to
   * Record<string, unknown> before passing as the config prop.
   * Handles legacy stored keys (e.g. minHeightPx → height for Spacer).
   * If omitted, the stored config is cast and passed through unchanged.
   */
  transformConfig?: (stored: Record<string, unknown>) => Record<string, unknown>
}
```

You will need to add `import React from 'react'` or use `import type React` at the top. Check the existing imports in the file — if there is no React import, add:
```ts
import type React from 'react'
```
at line 1.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/widgets/types.ts
git commit -m "feat: add WidgetRegistration type and objectOptions to ConfigPanelProps"
```

---

## Task 3: Update external registry to export `WidgetRegistration[]`

**Files:**
- Modify: `apps/web/widgets/external/registry.ts`

- [ ] **Step 1: Rewrite the external registry**

Replace the entire contents of `apps/web/widgets/external/registry.ts`:

```ts
import dynamic from 'next/dynamic'
import type { WidgetManifest, WidgetRegistration } from '@/lib/widgets/types'
import { config as demoWidgetManifest } from './demo-widget/widget.config'
import DemoConfigPanel from './demo-widget/ConfigPanel'

export const externalWidgetRegistrations: WidgetRegistration[] = [
  {
    manifest: demoWidgetManifest,
    Component: dynamic(() => import('./demo-widget/index')),
    ConfigPanel: DemoConfigPanel,
  },
]

// Backwards-compatible derived export used by palette and other consumers
export const externalWidgets: WidgetManifest[] = externalWidgetRegistrations.map((r) => r.manifest)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/jjjip/Documents/GitHub/TischlerCRM-New-Test-Branch/TischlerCRM-New-Test-Branch/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors in `apps/web/widgets/external/registry.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/external/registry.ts
git commit -m "feat: external registry exports WidgetRegistration with component and ConfigPanel"
```

---

## Task 4: Update internal registry to export `WidgetRegistration[]`

**Files:**
- Modify: `apps/web/widgets/internal/registry.ts`

- [ ] **Step 1: Rewrite the internal registry**

Replace the entire contents of `apps/web/widgets/internal/registry.ts`:

```ts
import dynamic from 'next/dynamic'
import type { WidgetManifest, WidgetRegistration } from '@/lib/widgets/types'
import { config as activityFeedManifest } from './activity-feed/widget.config'
import { config as headerHighlightsManifest } from './header-highlights/widget.config'
import { config as fileFolderManifest } from './file-folder/widget.config'
import { config as spacerManifest } from './spacer/widget.config'
import { config as relatedListManifest } from './related-list/widget.config'
import HeaderHighlightsConfigPanel from './header-highlights/ConfigPanel'
import RelatedListConfigPanel from './related-list/ConfigPanel'

export const internalWidgetRegistrations: WidgetRegistration[] = [
  {
    manifest: activityFeedManifest,
    widgetConfigType: 'ActivityFeed',
    Component: dynamic(() => import('./activity-feed/index')),
    // configSchema keys (maxItems, showAvatars) match stored keys — no transform needed
  },
  {
    manifest: headerHighlightsManifest,
    widgetConfigType: 'HeaderHighlights',
    Component: dynamic(() => import('./header-highlights/index')),
    ConfigPanel: HeaderHighlightsConfigPanel,
  },
  {
    manifest: fileFolderManifest,
    widgetConfigType: 'FileFolder',
    Component: dynamic(() => import('./file-folder/index')),
    // Legacy stored key is 'folderId'; schema key is 'path'. Handles both.
    transformConfig: (stored) => ({
      provider: (stored.provider ?? '') as string,
      path: (stored.path ?? stored.folderId ?? '') as string,
    }),
  },
  {
    manifest: spacerManifest,
    widgetConfigType: 'Spacer',
    Component: dynamic(() => import('./spacer/index')),
    // Legacy stored key is 'minHeightPx'; schema key is 'height'. Handles both.
    transformConfig: (stored) => ({
      height: (stored.height ?? stored.minHeightPx ?? 32) as number,
    }),
  },
  {
    manifest: relatedListManifest,
    widgetConfigType: 'RelatedList',
    Component: dynamic(() => import('./related-list/index')),
    ConfigPanel: RelatedListConfigPanel,
  },
]

// Backwards-compatible derived export used by palette and other consumers
export const internalWidgets: WidgetManifest[] = internalWidgetRegistrations.map((r) => r.manifest)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/jjjip/Documents/GitHub/TischlerCRM-New-Test-Branch/TischlerCRM-New-Test-Branch/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors in `apps/web/widgets/internal/registry.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/internal/registry.ts
git commit -m "feat: internal registry exports WidgetRegistration for all 5 widgets with transformConfig"
```

---

## Task 5: Add registry-loader lookup helpers and tests

**Files:**
- Modify: `apps/web/lib/widgets/registry-loader.ts`
- Create: `apps/web/lib/widgets/__tests__/registry-loader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/widgets/__tests__/registry-loader.test.ts`:

```ts
import {
  getExternalRegistration,
  getInternalRegistrationByType,
} from '../registry-loader'

describe('getExternalRegistration', () => {
  it('returns the registration for a known widget ID', () => {
    const reg = getExternalRegistration('demo-widget')
    expect(reg).toBeDefined()
    expect(reg?.manifest.id).toBe('demo-widget')
  })

  it('returns undefined for an unknown ID', () => {
    expect(getExternalRegistration('nonexistent-widget')).toBeUndefined()
  })
})

describe('getInternalRegistrationByType', () => {
  it('returns the Spacer registration by PascalCase type', () => {
    const reg = getInternalRegistrationByType('Spacer')
    expect(reg).toBeDefined()
    expect(reg?.widgetConfigType).toBe('Spacer')
  })

  it('returns the RelatedList registration', () => {
    const reg = getInternalRegistrationByType('RelatedList')
    expect(reg).toBeDefined()
    expect(reg?.widgetConfigType).toBe('RelatedList')
  })

  it('returns undefined for an unknown type', () => {
    expect(getInternalRegistrationByType('UnknownWidget')).toBeUndefined()
  })

  it('Spacer transformConfig maps legacy minHeightPx to height', () => {
    const reg = getInternalRegistrationByType('Spacer')
    expect(reg?.transformConfig).toBeDefined()
    expect(reg!.transformConfig!({ minHeightPx: 64 })).toEqual({ height: 64 })
  })

  it('Spacer transformConfig prefers the new height key over minHeightPx', () => {
    const reg = getInternalRegistrationByType('Spacer')
    expect(reg!.transformConfig!({ height: 48, minHeightPx: 32 })).toEqual({ height: 48 })
  })

  it('Spacer transformConfig falls back to 32 when both keys are absent', () => {
    const reg = getInternalRegistrationByType('Spacer')
    expect(reg!.transformConfig!({})).toEqual({ height: 32 })
  })

  it('FileFolder transformConfig maps legacy folderId to path', () => {
    const reg = getInternalRegistrationByType('FileFolder')
    expect(reg?.transformConfig).toBeDefined()
    const result = reg!.transformConfig!({ provider: 'dropbox', folderId: '/files' })
    expect(result).toEqual({ provider: 'dropbox', path: '/files' })
  })

  it('FileFolder transformConfig prefers the new path key over folderId', () => {
    const reg = getInternalRegistrationByType('FileFolder')
    const result = reg!.transformConfig!({ provider: 'dropbox', path: '/new', folderId: '/old' })
    expect(result).toEqual({ provider: 'dropbox', path: '/new' })
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd c:/Users/jjjip/Documents/GitHub/TischlerCRM-New-Test-Branch/TischlerCRM-New-Test-Branch/apps/web
npx jest lib/widgets/__tests__/registry-loader.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `getExternalRegistration is not a function` or similar.

- [ ] **Step 3: Add the lookup functions to `registry-loader.ts`**

Replace the entire contents of `apps/web/lib/widgets/registry-loader.ts`:

```ts
import type { WidgetManifest, WidgetRegistration } from './types'
import { externalWidgets, externalWidgetRegistrations } from '@/widgets/external/registry'
import { internalWidgets, internalWidgetRegistrations } from '@/widgets/internal/registry'

export function getAllWidgets(): WidgetManifest[] {
  return [...internalWidgets, ...externalWidgets]
}

export function getExternalWidgets(): WidgetManifest[] {
  return externalWidgets
}

export function getInternalWidgets(): WidgetManifest[] {
  return internalWidgets
}

export function getWidgetById(id: string): WidgetManifest | undefined {
  return getAllWidgets().find((w) => w.id === id)
}

export function getExternalRegistration(id: string): WidgetRegistration | undefined {
  return externalWidgetRegistrations.find((r) => r.manifest.id === id)
}

export function getInternalRegistrationByType(type: string): WidgetRegistration | undefined {
  return internalWidgetRegistrations.find((r) => r.widgetConfigType === type)
}

// On the client, pass in the list of enabled widgetIds from the API.
// Returns only widgets that should appear in the palette.
export function getEnabledExternalWidgets(
  enabledIds: string[],
  connectedProviders: string[]
): WidgetManifest[] {
  return externalWidgets.filter((w) => {
    if (!enabledIds.includes(w.id)) return false
    if (w.integration === null) return true
    return connectedProviders.includes(w.integration)
  })
}
```

- [ ] **Step 4: Run the tests again — confirm they pass**

```bash
cd c:/Users/jjjip/Documents/GitHub/TischlerCRM-New-Test-Branch/TischlerCRM-New-Test-Branch/apps/web
npx jest lib/widgets/__tests__/registry-loader.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: Run the existing merge-resolver tests to confirm no regressions**

```bash
npx jest lib/widgets/__tests__/ --no-coverage 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/widgets/registry-loader.ts apps/web/lib/widgets/__tests__/registry-loader.test.ts
git commit -m "feat: add getExternalRegistration and getInternalRegistrationByType lookup helpers"
```

---

## Task 6: Fix `layout-widgets-inline.tsx`

Fixes four bugs in one pass: stub props, empty `orgId`, null integration context, missing `resolveConfig`. Also makes rendering registry-driven.

**Files:**
- Modify: `apps/web/components/layout-widgets-inline.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `apps/web/components/layout-widgets-inline.tsx`:

```tsx
'use client';

import React from 'react';
import type { PageWidget } from '@/lib/schema';
import type { WidgetProps } from '@/lib/widgets/types';
import { getExternalRegistration, getInternalRegistrationByType } from '@/lib/widgets/registry-loader';
import { resolveConfig } from '@/lib/widgets/merge-resolver';
import { externalWidgets } from '@/widgets/external/registry';

function WidgetDisabledPlaceholder({ widgetId }: { widgetId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
      Widget &ldquo;{widgetId}&rdquo; is not enabled for this organization.
    </div>
  );
}

function WidgetUnavailablePlaceholder({ widgetId }: { widgetId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-red-100 bg-red-50/50 px-3 py-4 text-center text-xs text-red-400">
      Widget &ldquo;{widgetId}&rdquo; is unavailable.
    </div>
  );
}

function WidgetLoadingPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400 animate-pulse">
      Loading widget…
    </div>
  );
}

const STUB_OBJECT = { apiName: '', label: '', fields: [] as Array<{ apiName: string; label: string; type: string }> };

interface LayoutWidgetsInlineProps {
  widgets?: PageWidget[];
  enabledIds?: string[];
  /** The live CRM record being rendered */
  record?: Record<string, unknown>;
  /** The object definition for the current record */
  objectDef?: { apiName: string; label: string; fields: Array<{ apiName: string; label: string; type: string }> };
  /** Organisation ID for multi-tenant API calls */
  orgId?: string;
  /** Integration connection state keyed by provider ID (Level A — no accessToken yet) */
  integrations?: Record<string, { isConnected: boolean }>;
}

function getIntegrationContext(
  provider: string | null,
  integrations: Record<string, { isConnected: boolean }> | undefined
): WidgetProps['integration'] {
  if (!provider) return null;
  const state = integrations?.[provider];
  return { provider, isConnected: state?.isConnected ?? false };
}

/**
 * Renders tab-level or section-level layout widgets on record detail and forms.
 */
export function LayoutWidgetsInline({
  widgets,
  enabledIds,
  record,
  objectDef,
  orgId,
  integrations,
}: LayoutWidgetsInlineProps) {
  if (!widgets?.length) return null;

  const effectiveEnabledIds = enabledIds ?? externalWidgets.map((w) => w.id);
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const liveRecord = record ?? {};
  const liveObject = objectDef ?? STUB_OBJECT;
  const effectiveOrgId = orgId ?? '';

  return (
    <div className="mb-4 flex flex-col gap-3">
      {sorted.map((w) => {
        const config = w.config;

        // ── External widgets ──────────────────────────────────────────────
        if (config.type === 'ExternalWidget') {
          const { externalWidgetId, displayMode, config: widgetConfig } = config;
          const registration = getExternalRegistration(externalWidgetId);

          if (!registration) {
            return <WidgetUnavailablePlaceholder key={w.id} widgetId={externalWidgetId} />;
          }
          if (!effectiveEnabledIds.includes(externalWidgetId)) {
            return <WidgetDisabledPlaceholder key={w.id} widgetId={externalWidgetId} />;
          }

          const { Component } = registration;
          const resolvedConfig = resolveConfig(widgetConfig, liveRecord);
          const integrationContext = getIntegrationContext(
            registration.manifest.integration,
            integrations
          );

          return (
            <React.Suspense key={w.id} fallback={<WidgetLoadingPlaceholder />}>
              <Component
                config={resolvedConfig}
                record={liveRecord}
                object={liveObject}
                integration={integrationContext}
                displayMode={displayMode}
                orgId={effectiveOrgId}
              />
            </React.Suspense>
          );
        }

        // ── Internal widgets (registry-driven) ────────────────────────────
        const registration = getInternalRegistrationByType(config.type);
        if (registration) {
          const { Component, transformConfig } = registration;
          const storedConfig = config as unknown as Record<string, unknown>;
          const normalizedConfig = transformConfig ? transformConfig(storedConfig) : storedConfig;
          const resolvedConfig = resolveConfig(normalizedConfig, liveRecord);

          return (
            <React.Suspense key={w.id} fallback={<WidgetLoadingPlaceholder />}>
              <Component
                config={resolvedConfig}
                record={liveRecord}
                object={liveObject}
                integration={null}
                displayMode="full"
                orgId={effectiveOrgId}
              />
            </React.Suspense>
          );
        }

        // ── Fallback for unregistered widget types ────────────────────────
        return (
          <div
            key={w.id}
            className="p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-sm text-blue-900"
          >
            <span className="font-medium">Widget:</span> {w.widgetType}
            {config && 'label' in config && (config as { label?: string }).label
              ? ` — ${(config as { label?: string }).label}`
              : null}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/jjjip/Documents/GitHub/TischlerCRM-New-Test-Branch/TischlerCRM-New-Test-Branch/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `layout-widgets-inline.tsx`. If callers are passing the old `record` prop name incorrectly, fix the callers to pass `record` and `objectDef`.

- [ ] **Step 3: Smoke-test manually in the dev server**

Start the dev server and open a record page that has at least one internal widget (e.g., a layout with a Spacer or Activity Feed). Confirm the widget renders and no console errors appear.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout-widgets-inline.tsx
git commit -m "fix: layout-widgets-inline — real props for external widgets, resolveConfig, registry-driven rendering"
```

---

## Task 7: Fix `floating-properties.tsx` — registry-driven config panel lookup

Removes `EXTERNAL_CONFIG_PANELS`, `INTERNAL_CONFIG_PANELS`, the three hardcoded inline panels (ActivityFeed, FileFolder, Spacer), and the static ConfigPanel imports. Replaces them with registration lookups.

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx`

- [ ] **Step 1: Update imports at the top of the file (lines 1–28)**

Replace lines 9–28 (the widget-related imports and the two panel maps):

```tsx
import { SchemaRenderer } from '@/lib/widgets/schema-renderer';
import { getExternalRegistration, getInternalRegistrationByType } from '@/lib/widgets/registry-loader';
import type { ConfigPanelProps } from '@/lib/widgets/types';
import { useEditorStore } from './editor-store';
import type { EditorPageLayout, LayoutPanel, LayoutSection, LayoutTab, LayoutWidget, PanelField } from './types';
```

Remove:
- `import { getWidgetById } from '@/lib/widgets/registry-loader'` (replaced by `getExternalRegistration`)
- `import DemoConfigPanel from '@/widgets/external/demo-widget/ConfigPanel'`
- `import HeaderHighlightsConfigPanel from '@/widgets/internal/header-highlights/ConfigPanel'`
- `import RelatedListConfigPanel from '@/widgets/internal/related-list/ConfigPanel'`
- The `type ConfigPanelComponent = ...` local alias
- The `const EXTERNAL_CONFIG_PANELS` block
- The `const INTERNAL_CONFIG_PANELS` block

- [ ] **Step 2: Replace the entire widget panel section (lines 960–1156)**

Find the block starting at line 960 (`{selection.kind === 'widget' && (`). Replace lines 960–1156 with:

```tsx
        {selection.kind === 'widget' && (
          <>
            <div className="rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
              Type: <span className="font-medium">{selection.widget.widgetType}</span>
            </div>

            {/* Internal widgets — registry-driven */}
            {selection.widget.config.type !== 'ExternalWidget' &&
              selection.widget.config.type !== 'CustomComponent' &&
              (() => {
                const registration = getInternalRegistrationByType(selection.widget.config.type);
                if (!registration) return null;

                const storedConfig = selection.widget.config as unknown as Record<string, unknown>;
                const readConfig = registration.transformConfig
                  ? registration.transformConfig(storedConfig)
                  : storedConfig;
                const objectFields = (availableFields ?? []).map((f) => ({
                  apiName: f.apiName,
                  label: f.label,
                  type: String(f.type),
                }));

                if (registration.ConfigPanel) {
                  const Panel = registration.ConfigPanel;
                  return (
                    <Panel
                      config={readConfig}
                      onChange={(newCfg) =>
                        updateWidget(selection.widget.id, {
                          config: newCfg as unknown as WidgetConfig,
                        })
                      }
                      record={{}}
                      integration={null}
                      object={{ apiName: '', label: '', fields: objectFields }}
                    />
                  );
                }

                if (registration.manifest.configSchema.length > 0) {
                  return (
                    <SchemaRenderer
                      schema={registration.manifest.configSchema}
                      config={readConfig}
                      onChange={(key, value) =>
                        updateWidget(selection.widget.id, {
                          config: {
                            ...selection.widget.config,
                            [key]: value,
                          } as WidgetConfig,
                        })
                      }
                    />
                  );
                }

                return null;
              })()}

            {/* CustomComponent — legacy, not in the widget registry */}
            {selection.widget.config.type === 'CustomComponent' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">componentId</Label>
                <Input
                  value={selection.widget.config.componentId}
                  aria-label="Custom component ID"
                  onChange={(e) =>
                    updateWidget(selection.widget.id, {
                      config: {
                        ...selection.widget.config,
                        componentId: e.target.value,
                      } as WidgetConfig,
                    })
                  }
                />
              </div>
            )}

            {/* External widgets — registry-driven */}
            {selection.widget.config.type === 'ExternalWidget' &&
              (() => {
                const externalConfig = selection.widget.config;
                const registration = getExternalRegistration(externalConfig.externalWidgetId);
                const manifest = registration?.manifest;
                const ExternalConfigPanel = registration?.ConfigPanel;

                return (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-600">Display Mode</Label>
                      <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
                        {(['full', 'column'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              updateWidget(selection.widget.id, {
                                config: { ...externalConfig, displayMode: mode },
                              })
                            }
                            className={`flex-1 py-1.5 font-medium capitalize transition-colors ${
                              externalConfig.displayMode === mode
                                ? 'bg-brand-navy text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            } ${mode === 'column' ? 'border-l border-gray-200' : ''}`}
                          >
                            {mode === 'full' ? 'Full Width' : 'Column'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {ExternalConfigPanel ? (
                      <ExternalConfigPanel
                        config={externalConfig.config}
                        onChange={(newCfg) =>
                          updateWidget(selection.widget.id, {
                            config: { ...externalConfig, config: newCfg },
                          })
                        }
                        record={{}}
                        integration={null}
                        object={{ apiName: '', label: '', fields: [] }}
                        objectOptions={[]}
                      />
                    ) : manifest ? (
                      <SchemaRenderer
                        schema={manifest.configSchema}
                        config={externalConfig.config}
                        onChange={(key, value) =>
                          updateWidget(selection.widget.id, {
                            config: {
                              ...externalConfig,
                              config: { ...externalConfig.config, [key]: value },
                            },
                          })
                        }
                      />
                    ) : (
                      <div className="text-xs text-gray-400">
                        Widget &quot;{externalConfig.externalWidgetId}&quot; not found in registry.
                      </div>
                    )}

                    {manifest?.integration && (
                      <div className="rounded-md bg-blue-50 px-2.5 py-2 text-xs text-blue-700 border border-blue-100">
                        Powered by {manifest.integration}
                      </div>
                    )}
                  </div>
                );
              })()}
```

Note: line 1157 onwards (the Delete button `<div className="border-t border-gray-200 pt-3">`) stays unchanged — only close the `<>` and `{selection.kind === 'widget' && (` properly.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd c:/Users/jjjip/Documents/GitHub/TischlerCRM-New-Test-Branch/TischlerCRM-New-Test-Branch/apps/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `floating-properties.tsx`. If you see `WidgetConfig` type errors on the `[key]: value` spread lines, cast with `as WidgetConfig` as done in the existing code for adjacent sections.

- [ ] **Step 4: Smoke-test in the page editor**

Start the dev server, open the page editor for any object, drag a Spacer widget onto the canvas, and select it. Confirm the properties panel shows a "Height (px)" number input (from SchemaRenderer, reading the `height` schema field). Change the value. Confirm the canvas updates.

Repeat for an Activity Feed widget — confirm "Max Items" and "Show Avatars" appear in the properties panel.

Click the demo-widget in External (if enabled). Confirm the ConfigPanel renders.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/object-manager/[objectApi]/page-editor/floating-properties.tsx"
git commit -m "feat: floating-properties — registry-driven config panel lookup, remove hardcoded maps"
```

---

## Task 8: Update developer guide

**Files:**
- Modify: `docs/widget-developer-guide.md`

- [ ] **Step 1: Update the external widget quickstart (Section 1)**

Replace the "Steps" section under `## 1. Quickstart — External widget` with:

```markdown
### Steps

**1. Add the widget ID to the shared package**

Open `packages/widgets/src/index.ts` and add your ID to the array:

```ts
export const EXTERNAL_WIDGET_IDS = ['demo-widget', 'my-widget'] as const
```

The ID must be kebab-case and **never change after deploy** — changing it orphans all existing placements.

**2. Create the widget folder**

```
cp -r apps/web/widgets/external/demo-widget apps/web/widgets/external/my-widget
```

**3. Edit `widget.config.ts`**

Open `apps/web/widgets/external/my-widget/widget.config.ts` and set the `id` to match the ID you added in step 1:

```ts
export const config: WidgetManifest = {
  id: 'my-widget',          // ← must match packages/widgets/src/index.ts
  name: 'My Widget',
  description: 'What this widget does',
  icon: 'Star',
  category: 'external',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [
    // ... your fields
  ],
}
```

**4. Register the widget in the frontend registry**

Add one entry to `apps/web/widgets/external/registry.ts`:

```ts
import { config as myWidgetManifest } from './my-widget/widget.config'

export const externalWidgetRegistrations: WidgetRegistration[] = [
  // ... existing entries
  {
    manifest: myWidgetManifest,
    Component: dynamic(() => import('./my-widget/index')),
    // ConfigPanel: MyWidgetConfigPanel,   // only if you need a custom panel
  },
]
```

**5. Implement the component**

Edit `apps/web/widgets/external/my-widget/index.tsx`. The component receives a `WidgetProps` object (see [§4](#4-component-props-reference-widgetprops)).

**6. Enable in Settings**

Start the dev server, go to **Settings → Widgets**, and toggle the widget on. It will now appear in the page editor palette under the **External** section.

> If `integration` is set to a provider ID (e.g. `'dropbox'`), the toggle will be locked until that integration is connected in **Settings → Connected Apps**.
```

- [ ] **Step 2: Update the internal widget quickstart (Section 2)**

Replace the "Steps" section under `## 2. Quickstart — Internal widget` with:

```markdown
### Steps

**1. Create the widget folder**

```
cp -r apps/web/widgets/internal/activity-feed apps/web/widgets/internal/my-internal-widget
```

**2. Edit `widget.config.ts`**

```ts
export const config: WidgetManifest = {
  id: 'my-internal-widget',
  name: 'My Internal Widget',
  description: 'Displays CRM data in a useful way',
  icon: 'LayoutList',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [
    { key: 'maxItems', type: 'number', label: 'Max Items', default: 20 },
  ],
}
```

**3. Register the widget in the internal registry**

Add one entry to `apps/web/widgets/internal/registry.ts`:

```ts
import { config as myInternalWidgetManifest } from './my-internal-widget/widget.config'

export const internalWidgetRegistrations: WidgetRegistration[] = [
  // ... existing entries
  {
    manifest: myInternalWidgetManifest,
    widgetConfigType: 'MyInternalWidget',   // must match WidgetConfig.type in schema.ts
    Component: dynamic(() => import('./my-internal-widget/index')),
    // ConfigPanel: MyConfigPanel,           // only if you need a custom panel
    // transformConfig: (stored) => ({ ... }) // only if stored keys differ from schema keys
  },
]
```

You will also need to add `'MyInternalWidget'` to the `WidgetType` union and `WidgetConfig` union in `apps/web/lib/schema.ts` so the page editor can store and render the new widget type.

**4. Implement the component**

Edit `index.tsx`. Internal widgets call existing CRM API routes directly. Use the `record`, `object`, and `orgId` props to build your API calls.

**5. Test in the editor**

The widget appears immediately in the **Components** section of the palette. Drag it onto a layout and check that the properties panel renders your `configSchema` fields correctly.
```

- [ ] **Step 3: Update the `integration` prop reference in Section 4**

In `## 4. Component props reference (WidgetProps)`, find the `integration` row in the Field reference table and update it:

```markdown
| `integration` | `IntegrationContext \| null` | `null` for internal widgets or `integration: null` external widgets. For connected external widgets: `{ provider, isConnected }`. **Note:** `accessToken` is not currently populated — this is Level B follow-on work. Check `isConnected` before making integration API calls; do not assume a token is present. |
```

- [ ] **Step 4: Add a "What's wired vs deferred" section**

Add a new section between `## 9. Integration gating` and `## 10. Demo widget walkthrough`:

```markdown
## 9a. What's wired vs deferred

As of the widget system hardening (2026-04-01), the following is in place:

| Feature | Status |
|---|---|
| `record` prop — live CRM record on record pages | **Wired** |
| `object` prop — live object definition on record pages | **Wired** |
| `orgId` prop — organisation ID from the record page | **Wired** |
| `merge-text` token resolution at render time | **Wired** |
| `integration.isConnected` — connection status for the widget's provider | **Wired** (Level A) |
| `integration.accessToken` — OAuth token for making integration API calls | **Deferred** (Level B — requires server-side token injection infrastructure) |

**For external widget authors:** always guard integration API calls with `if (!integration?.isConnected) return <ErrorState />`. Do not assume `accessToken` is present. When Level B ships, `accessToken` will be populated automatically with no widget code changes required.
```

- [ ] **Step 5: Update the shipping checklist (Section 12)**

In `## 12. Shipping checklist`, replace the "All widgets" checklist item:
```
- [ ] Widget is registered in the appropriate `registry.ts`
```
with:
```
- [ ] Widget is registered in `apps/web/widgets/external/registry.ts` OR `apps/web/widgets/internal/registry.ts` (one entry with `manifest`, `Component`, and optional `ConfigPanel` / `transformConfig` / `widgetConfigType`)
- [ ] For **external** widgets only: widget ID is also added to `packages/widgets/src/index.ts`
```

- [ ] **Step 6: Commit**

```bash
git add docs/widget-developer-guide.md
git commit -m "docs: update widget developer guide for registry-driven registration workflow"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All four bugs fixed (props, resolveConfig, integration, hidden maps). Shared package created. Documentation updated.
- [x] **Placeholder scan:** No TBD/TODO items. All code blocks are complete.
- [x] **Type consistency:** `WidgetRegistration` defined in Task 2, used in Tasks 3, 4, 5, 6, 7. `getExternalRegistration` / `getInternalRegistrationByType` defined in Task 5, used in Tasks 6 and 7. `EXTERNAL_WIDGET_IDS` defined in Task 1, imported by API in Task 1. `transformConfig` defined in Task 2, set in Task 4, applied in Tasks 6 and 7.
- [x] **Scope:** Eight focused tasks, each producing a working commit. No task is a prerequisite for more than one subsequent task (except Task 2 which unblocks 3, 4, and 5).
