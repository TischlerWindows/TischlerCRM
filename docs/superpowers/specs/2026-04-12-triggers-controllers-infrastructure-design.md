# Triggers & Controllers Infrastructure Design

## Context

The CRM currently has two systems for backend extensibility:

1. **Workflow Engine** (`apps/api/src/workflow-engine.ts`) — UI-based rule automation for simple conditions + actions (field updates, email alerts, task creation). Configured through the Object Manager.
2. **Widget System** (`apps/web/widgets/`, `apps/api/src/widgets/`) — manifest-based, registry-driven architecture for frontend components with settings UI for enable/disable management.

We need to import and rework a complex Salesforce Installation object that requires **code-based** backend logic — triggers that auto-create child records based on date ranges and technician assignments, controllers that serve calculated data to UI components. The existing workflow engine can't express this complexity.

**This spec covers:** Creating a standardized infrastructure for code-based Triggers and Controllers, mirroring the Widget pattern. This is the foundation that the Installation object (and future objects) will build on.

**This spec does NOT cover:** The Installation object itself, its UI components, or its specific business logic. Those will be a separate spec.

---

## Architecture Overview

Mirror the Widget pattern exactly:
- Per-module folders with manifest files
- Manual registration arrays
- Registry loader functions
- Database tables for enable/disable state
- API routes for admin management
- Settings UI page with card grid and toggles

### Definitions

- **Trigger**: Code that fires automatically on record lifecycle events (create, update, delete). Runs server-side in the Fastify API. Returns field updates or performs side effects (creating child records, sending notifications). Analogous to Salesforce Apex triggers.
- **Controller**: Server-side class that registers Fastify API routes to serve data to UI components. Handles complex queries, aggregations, and business logic that generic CRUD routes can't. Analogous to Salesforce Apex controllers backing LWC components.

Both coexist alongside the existing workflow engine — triggers and workflows are complementary, not competing.

---

## 1. Folder Structure

```
apps/api/src/
├── triggers/
│   ├── <trigger-name>/
│   │   ├── index.ts              # TriggerHandler function
│   │   └── trigger.config.ts     # TriggerManifest export
│   └── registry.ts               # TriggerRegistration[] array
│
├── controllers/
│   ├── <controller-name>/
│   │   ├── index.ts              # registerRoutes function
│   │   └── controller.config.ts  # ControllerManifest export
│   └── registry.ts               # ControllerRegistration[] array
│
├── lib/
│   ├── triggers/
│   │   ├── types.ts              # TriggerManifest, TriggerRegistration, TriggerHandler, TriggerContext
│   │   ├── registry-loader.ts    # Discovery/lookup functions
│   │   └── trigger-engine.ts     # runTriggers() execution engine
│   └── controllers/
│       ├── types.ts              # ControllerManifest, ControllerRegistration
│       └── registry-loader.ts    # Discovery/lookup functions

packages/
├── triggers/
│   ├── src/index.ts              # TRIGGER_IDS single source of truth
│   ├── package.json              # @crm/triggers
│   └── tsconfig.json
└── controllers/
    ├── src/index.ts              # CONTROLLER_IDS single source of truth
    ├── package.json              # @crm/controllers
    └── tsconfig.json

apps/web/
├── app/settings/automations/
│   └── page.tsx                  # Combined settings page with tabs
└── lib/automations/
    └── types.ts                  # Shared manifest types for frontend consumption
```

### Conventions
- Module folders: **kebab-case** matching the manifest `id`
- Each module: `index.ts` (logic) + `*.config.ts` (manifest)
- Registries: manually maintained arrays (explicit registration, no magic auto-discovery)
- Config files export a `config` constant of the manifest type

---

## 2. Type Definitions

### Trigger Types (`apps/api/src/lib/triggers/types.ts`)

```typescript
import type { FastifyInstance } from 'fastify'

export type TriggerEvent =
  | 'beforeCreate' | 'afterCreate'
  | 'beforeUpdate' | 'afterUpdate'
  | 'beforeDelete' | 'afterDelete'

export interface TriggerManifest {
  id: string                    // kebab-case, unique, immutable
  name: string                  // Human-readable display name
  description: string           // What it does
  icon: string                  // Lucide icon name
  objectApiName: string         // Which CRM object it fires on
  events: TriggerEvent[]        // Which lifecycle events it handles
}

export interface TriggerContext {
  event: TriggerEvent
  objectApi: string
  recordId: string
  recordData: Record<string, any>
  beforeData?: Record<string, any>  // previous values (on update)
  userId: string
  orgId: string
}

// Handler returns field updates to apply, or null for no updates
export type TriggerHandler = (ctx: TriggerContext) => Promise<Record<string, any> | null>

export interface TriggerRegistration {
  manifest: TriggerManifest
  handler: TriggerHandler
}
```

### Controller Types (`apps/api/src/lib/controllers/types.ts`)

```typescript
import type { FastifyInstance } from 'fastify'

export interface ControllerManifest {
  id: string                    // kebab-case, unique, immutable
  name: string                  // Human-readable display name
  description: string           // What it provides
  icon: string                  // Lucide icon name
  objectApiName: string         // Which CRM object it serves
  routePrefix: string           // API route prefix (e.g., '/controllers/installation-grid')
}

export interface ControllerRegistration {
  manifest: ControllerManifest
  registerRoutes: (app: FastifyInstance) => Promise<void>
}
```

### Frontend Types (`apps/web/lib/automations/types.ts`)

Subset of the API types needed for the settings UI:

```typescript
export interface TriggerManifestDTO {
  id: string
  name: string
  description: string
  icon: string
  objectApiName: string
  events: string[]
}

export interface ControllerManifestDTO {
  id: string
  name: string
  description: string
  icon: string
  objectApiName: string
  routePrefix: string
}
```

---

## 3. Registry & Registry Loader

### Trigger Registry (`apps/api/src/triggers/registry.ts`)

```typescript
import type { TriggerRegistration } from '../lib/triggers/types'
// Import each trigger's config + handler
import { config as createInstCostsConfig } from './create-installation-costs/trigger.config'
import { handler as createInstCostsHandler } from './create-installation-costs/index'

export const triggerRegistrations: TriggerRegistration[] = [
  { manifest: createInstCostsConfig, handler: createInstCostsHandler },
]

export const triggers = triggerRegistrations.map(r => r.manifest)
```

### Trigger Registry Loader (`apps/api/src/lib/triggers/registry-loader.ts`)

```typescript
getAllTriggers(): TriggerManifest[]
getTriggerById(id: string): TriggerManifest | undefined
getTriggersByObject(objectApiName: string): TriggerManifest[]
getActiveTriggers(objectApiName: string, enabledIds: string[]): TriggerRegistration[]
getTriggerRegistration(id: string): TriggerRegistration | undefined
```

### Controller Registry & Loader

Exact same pattern. Controller registry exports `controllerRegistrations` and `controllers`. Loader provides `getAllControllers()`, `getControllerById()`, `getControllersByObject()`, `getActiveControllers()`, `getControllerRegistration()`.

---

## 4. Trigger Engine

### `apps/api/src/lib/triggers/trigger-engine.ts`

```typescript
export async function runTriggers(input: {
  event: 'create' | 'update' | 'delete'
  phase: 'before' | 'after'
  objectApi: string
  recordId: string
  recordData: Record<string, any>
  beforeData?: Record<string, any>
  userId: string
  orgId: string
}): Promise<Record<string, any> | null>
```

**Execution flow:**
1. Load enabled trigger IDs from `TriggerSetting` table for the org
2. Get active trigger registrations for `input.objectApi`
3. Map to the specific `TriggerEvent` (e.g., `'after'` + `'create'` → `'afterCreate'`)
4. Filter to triggers that listen for that event
5. Execute each handler sequentially (order = registry order)
6. Merge all returned field updates (later triggers overwrite earlier ones for the same field — last wins)
7. Return merged updates or `null`

**Error handling:** If a trigger handler throws, log the error and continue to the next trigger. One failing trigger should not block others.

**Note:** Triggers can also perform side effects beyond field updates (e.g., creating child records via Prisma). The return value is only for field updates on the triggering record itself.

### Integration Point (`apps/api/src/routes/records.ts`)

Called alongside `runWorkflows()`:

```typescript
// After record create:
runWorkflows({ event: 'create', ... });
const triggerUpdates = await runTriggers({
  event: 'create', phase: 'after', objectApi: apiName,
  recordId: record.id, recordData: normalizedData, userId, orgId,
});
if (triggerUpdates) {
  // Apply field updates to the record
}

// After record update:
runWorkflows({ event: 'update', ... });
const triggerUpdates = await runTriggers({
  event: 'update', phase: 'after', objectApi: apiName,
  recordId: existingRecord.id, recordData: mergedData,
  beforeData, userId, orgId,
});
```

### Controller Route Registration (`apps/api/src/app.ts`)

During Fastify startup, register **all** controller routes (regardless of enabled state):

```typescript
import { controllerRegistrations } from './controllers/registry.js'
// For each controller, call registerRoutes(app)
// Each route handler checks ControllerSetting.enabled at request time
```

**Runtime enable/disable:** Controller routes are always registered at startup to avoid requiring app restarts. Each controller's route handlers check the `ControllerSetting.enabled` flag at request time and return `403 { error: 'Controller disabled' }` if not enabled. This mirrors how trigger enabled checks happen at execution time.

---

## 5. Database

### New Prisma Models (`packages/db/prisma/schema.prisma`)

```prisma
model TriggerSetting {
  id        String   @id @default(cuid())
  orgId     String
  triggerId String
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orgId, triggerId])
}

model ControllerSetting {
  id           String   @id @default(cuid())
  orgId        String
  controllerId String
  enabled      Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([orgId, controllerId])
}
```

### Migration

Single migration: `add_trigger_controller_settings`

---

## 6. API Routes

### `apps/api/src/routes/automations.ts`

All routes are admin-only (same pattern as `routes/widgets.ts`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/automations/triggers` | List all triggers with enabled state for org |
| `PUT` | `/automations/triggers/:triggerId` | Toggle trigger enabled/disabled |
| `GET` | `/automations/controllers` | List all controllers with enabled state for org |
| `PUT` | `/automations/controllers/:controllerId` | Toggle controller enabled/disabled |

Response shape mirrors widgets:
```json
[
  { "triggerId": "create-installation-costs", "enabled": true,
    "name": "Create Installation Cost Records", "description": "...",
    "icon": "Calculator", "objectApiName": "installations",
    "events": ["afterCreate", "afterUpdate"] }
]
```

The GET endpoints return manifest data + enabled state so the frontend doesn't need its own registry.

---

## 7. Packages (ID Source of Truth)

### `packages/triggers/src/index.ts`

```typescript
export const TRIGGER_IDS = ['create-installation-costs'] as const
export type TriggerId = (typeof TRIGGER_IDS)[number]
```

### `packages/controllers/src/index.ts`

```typescript
export const CONTROLLER_IDS = ['installation-grid'] as const
export type ControllerId = (typeof CONTROLLER_IDS)[number]
```

These are validated by the API routes when toggling enabled state.

---

## 8. Settings UI

### `apps/web/app/settings/automations/page.tsx`

**Layout:**
- Header card: Zap icon, "Automations" title, subtitle "Manage code-based triggers and controllers"
- Tab bar: **Triggers** (count) | **Controllers** (count)
- Card grid under active tab (same visual design as widgets page)

**Trigger card contents:**
- Icon + Name
- "Trigger" type badge
- Object badge (e.g., "installations")
- Event badges (e.g., "afterCreate", "afterUpdate")
- Description
- Active/Inactive status badge
- Enable/disable toggle

**Controller card contents:**
- Icon + Name
- "Controller" type badge
- Object badge
- Route prefix display
- Description
- Active/Inactive status badge
- Enable/disable toggle

**Data flow:**
- Fetches from `GET /automations/triggers` and `GET /automations/controllers`
- Toggles via `PUT /automations/triggers/:id` and `PUT /automations/controllers/:id`
- No separate frontend registry needed — API returns manifest data

### Settings Overview Card (`apps/web/app/settings/page.tsx`)

Add to the cards array:
```typescript
{ title: 'Automations', icon: Zap, href: '/settings/automations',
  count: triggerCount + controllerCount,
  description: 'Manage code-based triggers and controllers',
  color: '#f59e0b' }
```

Requires a new API call to get the combined count.

---

## 9. API Client Updates

### `apps/web/lib/api-client.ts`

New methods:
```typescript
getTriggerSettings(): Promise<TriggerSettingDTO[]>
updateTriggerSetting(triggerId: string, enabled: boolean): Promise<void>
getControllerSettings(): Promise<ControllerSettingDTO[]>
updateControllerSetting(controllerId: string, enabled: boolean): Promise<void>
```

---

## Verification Plan

1. **Infrastructure builds:** `pnpm build` succeeds across all packages and apps
2. **Database migration:** `pnpm prisma migrate dev` creates both tables without errors
3. **API routes work:**
   - `GET /automations/triggers` returns empty array (no triggers registered yet)
   - `GET /automations/controllers` returns empty array
4. **Settings UI renders:**
   - Navigate to `/settings/automations` — page loads with tabs
   - Both tabs show empty states
   - Settings overview page shows Automations card with count 0
5. **Trigger engine integration:**
   - `runTriggers()` is called from `records.ts` on create/update
   - With no active triggers, returns `null` without errors
6. **End-to-end with a test trigger:**
   - Create a simple test trigger (e.g., `test-trigger` that sets a field to "triggered")
   - Enable it via the settings UI
   - Create/update a record on the target object
   - Verify the field update was applied

---

## Files to Modify (Existing)

| File | Change |
|------|--------|
| `packages/db/prisma/schema.prisma` | Add TriggerSetting + ControllerSetting models |
| `apps/api/src/app.ts` | Register automations routes + controller routes at startup |
| `apps/api/src/routes/records.ts` | Call `runTriggers()` alongside `runWorkflows()` |
| `apps/web/app/settings/page.tsx` | Add Automations card to overview grid |
| `apps/web/lib/api-client.ts` | Add trigger/controller settings API methods |

## Files to Create (New)

| File | Purpose |
|------|---------|
| `packages/triggers/src/index.ts` | TRIGGER_IDS source of truth |
| `packages/triggers/package.json` | Package config |
| `packages/controllers/src/index.ts` | CONTROLLER_IDS source of truth |
| `packages/controllers/package.json` | Package config |
| `apps/api/src/lib/triggers/types.ts` | Trigger type definitions |
| `apps/api/src/lib/triggers/registry-loader.ts` | Trigger discovery/lookup |
| `apps/api/src/lib/triggers/trigger-engine.ts` | runTriggers() execution |
| `apps/api/src/lib/controllers/types.ts` | Controller type definitions |
| `apps/api/src/lib/controllers/registry-loader.ts` | Controller discovery/lookup |
| `apps/api/src/triggers/registry.ts` | Trigger registration array |
| `apps/api/src/controllers/registry.ts` | Controller registration array |
| `apps/api/src/routes/automations.ts` | API routes for settings |
| `apps/web/app/settings/automations/page.tsx` | Settings UI page |
| `apps/web/lib/automations/types.ts` | Frontend DTO types |
| Prisma migration | add_trigger_controller_settings |
