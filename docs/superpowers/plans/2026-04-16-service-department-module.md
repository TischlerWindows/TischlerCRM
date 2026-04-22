# Service Department Module Implementation Plan

> **⚠️ SUPERSEDED 2026-04-20** — Do NOT implement from this v1 plan. It was written against the v1 spec which has since been replaced by [v2 spec (2026-04-20)](../specs/2026-04-20-service-department-module-design-v2.md). A fresh implementation plan aligned with v2 will be generated at `docs/superpowers/plans/2026-04-20-service-department-module-v2.md` via `superpowers:writing-plans`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Service Department module — data model (7 objects/enhancements), 3 triggers, path-guided lifecycle, 4 custom pages (Tech Dashboard, Schedule Calendar, Assignment Board, Cost Dashboard), punch list PDF, and role profiles — on top of the existing metadata-driven CRM architecture.

**Architecture:** Metadata-driven CRM where objects are defined in `ensure-core-objects.ts` and records stored as JSON in a single `Record` table. New objects use the same `CustomObject → CustomField → Record` pattern as all other CRM objects. Triggers use the existing registry pattern. Custom UIs are Next.js 14 App Router pages. Child records (assignments, punch list items, time entries, expenses) are accessed via Related Lists on WorkOrder detail, not dedicated list pages.

**Tech Stack:** TypeScript, Next.js 14, Fastify 5, Prisma 5 (PostgreSQL), jsPDF, pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-04-16-service-department-module-design.md`

**Skills & Tools:**
- Use **Context7** (`resolve-library-id` → `get-library-docs`) before implementing with any library. Fetch current docs for: **jsPDF** (PDF generation in Tasks 6, 11), **@dnd-kit** (drag-and-drop in Task 10), **Next.js App Router** (all page tasks), **Prisma** (trigger data queries), **Tailwind CSS** (all UI tasks). Do NOT rely on training data — always check Context7 first.
- Use **superpowers:test-driven-development** for trigger logic (Tasks 3, 4, 7)
- Use **superpowers:verification-before-completion** after each task before committing
- Use **superpowers:subagent-driven-development** (recommended) or **superpowers:executing-plans** to work through tasks

---

## Prefix Map

| Object | Prefix | Status |
|--------|--------|--------|
| Technician | `035` | New (currently unregistered) |
| WorkOrderAssignment | `036` | New |
| PunchListItem | `037` | New |
| TimeEntry | `038` | New |
| WorkOrderExpense | `039` | New |
| TechnicianRateHistory | `040` | New |

---

### Task 1: Enhance Technician object + register prefix

**Files:**
- Modify: `apps/api/src/ensure-core-objects.ts` (Technician entry, ~line 226)
- Modify: `packages/db/src/record-id.ts` (add Technician prefix)

- [ ] **Step 1: Add new fields to existing Technician object**

In `apps/api/src/ensure-core-objects.ts`, find the Technician object definition and replace it with enhanced version:

```typescript
  {
    apiName: 'Technician',
    label: 'Technician',
    pluralLabel: 'Technicians',
    description: 'Service and installation technicians',
    fields: [
      { apiName: 'technicianName', label: 'Technician Name', type: 'Text', required: true },
      { apiName: 'techCode', label: 'Tech Code', type: 'Text', unique: true },
      { apiName: 'departmentTags', label: 'Department Tags', type: 'MultiPicklist', picklistValues: ['Install', 'Service'] },
      { apiName: 'hourlyRate', label: 'Hourly Rate', type: 'Currency', required: true },
      { apiName: 'overtimeRate', label: 'Overtime Rate', type: 'Currency' },
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'skills', label: 'Skills', type: 'MultiPicklist', picklistValues: ['Glazing', 'Framing', 'Electrical', 'Plumbing', 'General'] },
      { apiName: 'user', label: 'User', type: 'Lookup' },
      { apiName: 'active', label: 'Active', type: 'Checkbox', defaultValue: 'true' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Active', 'Inactive'], defaultValue: 'Active' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
    ],
  },
```

Note: The `ensureFields()` function is additive — it only creates fields that don't exist yet, so existing Technician records are not affected.

- [ ] **Step 2: Register Technician prefix in record-id.ts**

In `packages/db/src/record-id.ts`, add Technician to the static prefix map (after `Task: '034'`):

```typescript
  Technician: '035',
```

- [ ] **Step 3: Verify — restart API and check Technician fields**

```bash
cd apps/api && pnpm dev
```

Expected: Console shows `[ensure-core-objects] Done — 0 created, N already existed` (Technician already exists, but new fields should be added by `ensureFields`). Verify in the CRM Object Manager that Technician now shows the new fields (techCode, departmentTags, overtimeRate, skills, user, active, notes).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ensure-core-objects.ts packages/db/src/record-id.ts
git commit -m "feat(service): enhance Technician with department tags, tech code, skills, and user link"
```

---

### Task 2: Enhance WorkOrder + add 5 new child objects + all prefixes

**Files:**
- Modify: `apps/api/src/ensure-core-objects.ts` (WorkOrder fields + 5 new objects)
- Modify: `packages/db/src/record-id.ts` (5 new prefixes)

- [ ] **Step 1: Add new fields to WorkOrder object**

In `apps/api/src/ensure-core-objects.ts`, find the WorkOrder object definition and replace it:

```typescript
  {
    apiName: 'WorkOrder',
    label: 'Work Order',
    pluralLabel: 'Work Orders',
    description: 'Scheduled work orders for service and maintenance',
    fields: [
      // Existing fields (ensureFields will skip these)
      { apiName: 'workOrderNumber', label: 'Work Order Number', type: 'Text', unique: true },
      { apiName: 'name', label: 'Work Order', type: 'Text' },
      { apiName: 'title', label: 'Title', type: 'TextArea' },
      { apiName: 'workOrderType', label: 'Work Order Type', type: 'Picklist', picklistValues: ['Installation', 'Repair', 'Maintenance', 'Inspection', 'Warranty', 'Punch List', 'Other'], defaultValue: 'Repair' },
      { apiName: 'scheduledStartDate', label: 'Scheduled Start Date', type: 'Date' },
      { apiName: 'scheduledEndDate', label: 'Scheduled End Date', type: 'Date' },
      { apiName: 'estimateCost', label: 'Estimate Cost', type: 'Currency' },
      { apiName: 'property', label: 'Property', type: 'Lookup' },
      // New fields
      { apiName: 'workOrderCategory', label: 'Category', type: 'Picklist', picklistValues: ['Client Service', 'Internal'], defaultValue: 'Client Service' },
      { apiName: 'workOrderStatus', label: 'Work Order Status', type: 'Picklist', picklistValues: ['Scheduled', 'In Progress', 'Completed', 'Closed'], defaultValue: 'Scheduled' },
      { apiName: 'project', label: 'Project', type: 'Lookup' },
      { apiName: 'leadTech', label: 'Lead Tech', type: 'Lookup' },
      { apiName: 'workDescription', label: 'Work Description', type: 'LongTextArea' },
      { apiName: 'toolsNeeded', label: 'Tools Needed', type: 'LongTextArea' },
      { apiName: 'outsideContractors', label: 'Outside Contractors', type: 'LongTextArea' },
      { apiName: 'completedDate', label: 'Completed Date', type: 'DateTime' },
      { apiName: 'completedBy', label: 'Completed By', type: 'Lookup' },
      { apiName: 'closedDate', label: 'Closed Date', type: 'DateTime' },
      { apiName: 'closedBy', label: 'Closed By', type: 'Lookup' },
      { apiName: 'customerSignature', label: 'Customer Signature', type: 'Text' },
      { apiName: 'signatureDate', label: 'Signature Date', type: 'Date' },
      { apiName: 'invoiceNumber', label: 'Invoice Number', type: 'Text' },
      { apiName: 'totalEstimatedHours', label: 'Total Estimated Hours', type: 'Number' },
      { apiName: 'totalActualHours', label: 'Total Actual Hours', type: 'Number' },
      { apiName: 'totalLaborCost', label: 'Total Labor Cost', type: 'Currency' },
      { apiName: 'totalExpenses', label: 'Total Expenses', type: 'Currency' },
      { apiName: 'totalJobCost', label: 'Total Job Cost', type: 'Currency' },
    ],
  },
```

Note: The old `workStatus` field remains (additive system). The new `workOrderStatus` is the path-driven field. `toolsNeeded` uses `LongTextArea` to store JSON-stringified checklist data — the custom checklist UI component (Task 5) will parse and render it.

- [ ] **Step 2: Add WorkOrderAssignment object**

Add after the Task object in CORE_OBJECTS array:

```typescript
  {
    apiName: 'WorkOrderAssignment',
    label: 'Work Order Assignment',
    pluralLabel: 'Work Order Assignments',
    description: 'Junction linking technicians to work orders',
    fields: [
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup', required: true },
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'isLead', label: 'Lead Tech', type: 'Checkbox' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
      { apiName: 'notified', label: 'Notified', type: 'Checkbox' },
      { apiName: 'notifiedDate', label: 'Notified Date', type: 'DateTime' },
    ],
  },
```

- [ ] **Step 3: Add PunchListItem object**

```typescript
  {
    apiName: 'PunchListItem',
    label: 'Punch List Item',
    pluralLabel: 'Punch List Items',
    description: 'Work items within a work order',
    fields: [
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup', required: true },
      { apiName: 'itemNumber', label: 'Item Number', type: 'Number' },
      { apiName: 'location', label: 'Location', type: 'Text' },
      { apiName: 'description', label: 'Description', type: 'LongTextArea' },
      { apiName: 'assignedTech', label: 'Assigned Tech', type: 'Lookup' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Open', 'In Progress', 'Completed', 'N/A'], defaultValue: 'Open' },
      { apiName: 'estimatedHours', label: 'Estimated Hours', type: 'Number' },
      { apiName: 'estimatedMen', label: 'Estimated Men', type: 'Number' },
      { apiName: 'materialsInWarehouse', label: 'Materials in Warehouse', type: 'LongTextArea' },
      { apiName: 'materialsToOrder', label: 'Materials to Order', type: 'LongTextArea' },
      { apiName: 'specialEquipment', label: 'Special Equipment', type: 'LongTextArea' },
      { apiName: 'elevationPage', label: 'Elevation Page', type: 'Text' },
      { apiName: 'serviceDate', label: 'Service Date', type: 'Date' },
    ],
  },
```

- [ ] **Step 4: Add TimeEntry object**

```typescript
  {
    apiName: 'TimeEntry',
    label: 'Time Entry',
    pluralLabel: 'Time Entries',
    description: 'Hours tracking per technician per work order',
    fields: [
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup', required: true },
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'date', label: 'Date', type: 'Date', required: true },
      { apiName: 'workHours', label: 'Work Hours', type: 'Number' },
      { apiName: 'travelHours', label: 'Travel Hours', type: 'Number' },
      { apiName: 'prepHours', label: 'Prep Hours', type: 'Number' },
      { apiName: 'miscHours', label: 'Misc Hours', type: 'Number' },
      { apiName: 'totalHours', label: 'Total Hours', type: 'Number' },
      { apiName: 'rateAtEntry', label: 'Rate at Entry', type: 'Currency' },
      { apiName: 'totalCost', label: 'Total Cost', type: 'Currency' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
    ],
  },
```

Note: `totalHours` and `totalCost` are stored as concrete Number/Currency fields. The `snapshot-rate-on-time-entry` trigger (Task 3) will compute and store these values on create/update rather than using formula fields. This avoids formula-engine complexity and keeps historical values stable.

- [ ] **Step 5: Add WorkOrderExpense object**

```typescript
  {
    apiName: 'WorkOrderExpense',
    label: 'Work Order Expense',
    pluralLabel: 'Work Order Expenses',
    description: 'Per diem, mileage, materials, and other job expenses',
    fields: [
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup', required: true },
      { apiName: 'technician', label: 'Technician', type: 'Lookup' },
      { apiName: 'expenseType', label: 'Expense Type', type: 'Picklist', picklistValues: ['Per Diem', 'Mileage', 'Materials', 'Equipment', 'Other'], required: true },
      { apiName: 'amount', label: 'Amount', type: 'Currency', required: true },
      { apiName: 'quantity', label: 'Quantity', type: 'Number' },
      { apiName: 'rate', label: 'Rate', type: 'Currency' },
      { apiName: 'date', label: 'Date', type: 'Date', required: true },
      { apiName: 'description', label: 'Description', type: 'Text' },
    ],
  },
```

- [ ] **Step 6: Add TechnicianRateHistory object**

```typescript
  {
    apiName: 'TechnicianRateHistory',
    label: 'Technician Rate History',
    pluralLabel: 'Technician Rate History',
    description: 'Audit trail for technician rate changes',
    fields: [
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'effectiveDate', label: 'Effective Date', type: 'Date', required: true },
      { apiName: 'previousRate', label: 'Previous Rate', type: 'Currency', required: true },
      { apiName: 'newRate', label: 'New Rate', type: 'Currency', required: true },
      { apiName: 'rateType', label: 'Rate Type', type: 'Picklist', picklistValues: ['Hourly', 'Overtime'], required: true },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
    ],
  },
```

- [ ] **Step 7: Register all new prefixes in record-id.ts**

In `packages/db/src/record-id.ts`, add to the prefix map after `Technician: '035'`:

```typescript
  WorkOrderAssignment: '036',
  PunchListItem: '037',
  TimeEntry: '038',
  WorkOrderExpense: '039',
  TechnicianRateHistory: '040',
```

- [ ] **Step 8: Verify — restart API and confirm all objects exist**

```bash
cd apps/api && pnpm dev
```

Expected: Console shows new objects created with their field counts. Open the CRM and navigate to Object Manager — all 6 new/enhanced objects should appear with their fields. Verify WorkOrder shows all new fields.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/ensure-core-objects.ts packages/db/src/record-id.ts
git commit -m "feat(service): add WorkOrder enhancements + 5 new service child objects"
```

---

### Task 3: Rate-change-history + rate-snapshot triggers

**Files:**
- Create: `apps/api/src/triggers/rate-change-history/trigger.config.ts`
- Create: `apps/api/src/triggers/rate-change-history/index.ts`
- Create: `apps/api/src/triggers/snapshot-rate-on-time-entry/trigger.config.ts`
- Create: `apps/api/src/triggers/snapshot-rate-on-time-entry/index.ts`
- Modify: `apps/api/src/triggers/registry.ts`
- Modify: `packages/triggers/src/index.ts`

- [ ] **Step 1: Create rate-change-history trigger config**

Create `apps/api/src/triggers/rate-change-history/trigger.config.ts`:

```typescript
import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'rate-change-history',
  name: 'Record Technician Rate Changes',
  description: 'Auto-creates a TechnicianRateHistory record when hourlyRate or overtimeRate changes',
  icon: 'History',
  objectApiName: 'Technician',
  events: ['afterUpdate'],
}
```

- [ ] **Step 2: Create rate-change-history handler**

Create `apps/api/src/triggers/rate-change-history/index.ts`:

```typescript
import { prisma } from '@crm/db/client'
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordId, recordData, beforeData, userId } = ctx
    if (!beforeData) return null

    const rateHistoryObjectId = await getObjectId('TechnicianRateHistory')
    if (!rateHistoryObjectId) {
      console.error('[rate-change-history] TechnicianRateHistory object not found')
      return null
    }

    registerRecordIdPrefix('TechnicianRateHistory')
    const today = new Date().toISOString().split('T')[0]
    const recordsToCreate: any[] = []

    // Check hourly rate change
    const oldHourly = Number(beforeData.hourlyRate) || 0
    const newHourly = Number(recordData.hourlyRate) || 0
    if (oldHourly !== newHourly && newHourly > 0) {
      recordsToCreate.push({
        id: generateRecordId('TechnicianRateHistory'),
        objectId: rateHistoryObjectId,
        data: {
          technician: recordId,
          effectiveDate: today,
          previousRate: oldHourly,
          newRate: newHourly,
          rateType: 'Hourly',
        },
        createdById: userId,
        modifiedById: userId,
      })
    }

    // Check overtime rate change
    const oldOvertime = Number(beforeData.overtimeRate) || 0
    const newOvertime = Number(recordData.overtimeRate) || 0
    if (oldOvertime !== newOvertime && newOvertime > 0) {
      recordsToCreate.push({
        id: generateRecordId('TechnicianRateHistory'),
        objectId: rateHistoryObjectId,
        data: {
          technician: recordId,
          effectiveDate: today,
          previousRate: oldOvertime,
          newRate: newOvertime,
          rateType: 'Overtime',
        },
        createdById: userId,
        modifiedById: userId,
      })
    }

    if (recordsToCreate.length > 0) {
      await prisma.record.createMany({ data: recordsToCreate })
      console.log(`[rate-change-history] Created ${recordsToCreate.length} rate history record(s) for tech ${recordId}`)
    }

    return null
  } catch (err) {
    console.error('[rate-change-history] Trigger failed:', err)
    return null
  }
}

async function getObjectId(apiName: string): Promise<string | null> {
  const obj = await prisma.customObject.findFirst({
    where: { apiName: { equals: apiName, mode: 'insensitive' } },
  })
  return obj?.id ?? null
}
```

- [ ] **Step 3: Create snapshot-rate-on-time-entry trigger config**

Create `apps/api/src/triggers/snapshot-rate-on-time-entry/trigger.config.ts`:

```typescript
import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'snapshot-rate-on-time-entry',
  name: 'Snapshot Rate on Time Entry',
  description: 'Captures the technician hourly rate at time of entry creation and computes totals',
  icon: 'Clock',
  objectApiName: 'TimeEntry',
  events: ['beforeCreate', 'beforeUpdate'],
}
```

- [ ] **Step 4: Create snapshot-rate-on-time-entry handler**

Create `apps/api/src/triggers/snapshot-rate-on-time-entry/index.ts`:

```typescript
import { prisma } from '@crm/db/client'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { event, recordData } = ctx

    const techId = recordData.technician
    if (!techId) return null

    // Look up the technician's current hourly rate
    const techRecord = await prisma.record.findUnique({ where: { id: techId } })
    if (!techRecord) return null

    const techData = techRecord.data as Record<string, any>
    const currentRate = Number(techData.hourlyRate) || 0

    // Compute totals
    const workHours = Number(recordData.workHours) || 0
    const travelHours = Number(recordData.travelHours) || 0
    const prepHours = Number(recordData.prepHours) || 0
    const miscHours = Number(recordData.miscHours) || 0
    const totalHours = workHours + travelHours + prepHours + miscHours

    // On create: always snapshot the rate
    // On update: only re-snapshot if rateAtEntry is not yet set (preserve original snapshot)
    const rateAtEntry = event === 'beforeCreate'
      ? currentRate
      : (Number(recordData.rateAtEntry) || currentRate)

    const totalCost = totalHours * rateAtEntry

    // Return field updates (beforeCreate/beforeUpdate triggers can mutate the record)
    return {
      rateAtEntry,
      totalHours,
      totalCost,
    }
  } catch (err) {
    console.error('[snapshot-rate-on-time-entry] Trigger failed:', err)
    return null
  }
}
```

- [ ] **Step 5: Register both triggers**

In `apps/api/src/triggers/registry.ts`, add the imports and registrations:

```typescript
import { config as rateChangeHistoryConfig } from './rate-change-history/trigger.config.js'
import { handler as rateChangeHistoryHandler } from './rate-change-history/index.js'
import { config as snapshotRateConfig } from './snapshot-rate-on-time-entry/trigger.config.js'
import { handler as snapshotRateHandler } from './snapshot-rate-on-time-entry/index.js'

// Add to triggerRegistrations array:
  { manifest: rateChangeHistoryConfig, handler: rateChangeHistoryHandler },
  { manifest: snapshotRateConfig, handler: snapshotRateHandler },
```

In `packages/triggers/src/index.ts`, add the IDs:

```typescript
export const TRIGGER_IDS = [
  'create-installation-costs',
  'rate-change-history',
  'snapshot-rate-on-time-entry',
] as const
```

- [ ] **Step 6: Verify triggers**

1. Start the API: `cd apps/api && pnpm dev`
2. Create a Technician record with hourlyRate = 35
3. Create a TimeEntry record linked to that technician → verify `rateAtEntry` is auto-set to 35, `totalHours` and `totalCost` are computed
4. Update the Technician's hourlyRate to 40 → verify a TechnicianRateHistory record is created with previousRate=35, newRate=40, rateType=Hourly
5. Create another TimeEntry → verify `rateAtEntry` is now 40

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/triggers/rate-change-history/ apps/api/src/triggers/snapshot-rate-on-time-entry/ apps/api/src/triggers/registry.ts packages/triggers/src/index.ts
git commit -m "feat(service): add rate-change-history and rate-snapshot triggers"
```

---

### Task 4: Work Order lifecycle path + auto-stamp trigger

**Files:**
- Create: `apps/api/src/triggers/work-order-lifecycle/trigger.config.ts`
- Create: `apps/api/src/triggers/work-order-lifecycle/index.ts`
- Modify: `apps/api/src/triggers/registry.ts`
- Modify: `packages/triggers/src/index.ts`

- [ ] **Step 1: Create work-order-lifecycle trigger config**

Create `apps/api/src/triggers/work-order-lifecycle/trigger.config.ts`:

```typescript
import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'work-order-lifecycle',
  name: 'Work Order Lifecycle',
  description: 'Auto-stamps date/user fields on status transitions and enforces lifecycle rules',
  icon: 'GitBranch',
  objectApiName: 'WorkOrder',
  events: ['beforeUpdate'],
}
```

- [ ] **Step 2: Create work-order-lifecycle handler**

Create `apps/api/src/triggers/work-order-lifecycle/index.ts`:

```typescript
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Scheduled': ['In Progress'],
  'In Progress': ['Completed', 'Scheduled'],
  'Completed': ['Closed', 'In Progress'],
  'Closed': [],
}

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordData, beforeData, userId } = ctx
    if (!beforeData) return null

    const oldStatus = beforeData.workOrderStatus as string | undefined
    const newStatus = recordData.workOrderStatus as string | undefined

    // No status change — nothing to do
    if (!newStatus || newStatus === oldStatus) return null

    // Validate transition
    const allowed = VALID_TRANSITIONS[oldStatus || 'Scheduled'] || []
    if (!allowed.includes(newStatus)) {
      // Invalid transition — revert to old status
      console.warn(`[work-order-lifecycle] Invalid transition: ${oldStatus} → ${newStatus}`)
      return { workOrderStatus: oldStatus }
    }

    const now = new Date().toISOString()
    const updates: Record<string, any> = {}

    if (newStatus === 'Completed') {
      updates.completedDate = now
      updates.completedBy = userId
    }

    if (newStatus === 'Closed') {
      updates.closedDate = now
      updates.closedBy = userId
    }

    // If moving back from Completed to In Progress, clear completion fields
    if (oldStatus === 'Completed' && newStatus === 'In Progress') {
      updates.completedDate = null
      updates.completedBy = null
    }

    return Object.keys(updates).length > 0 ? updates : null
  } catch (err) {
    console.error('[work-order-lifecycle] Trigger failed:', err)
    return null
  }
}
```

- [ ] **Step 3: Register trigger**

Add to `apps/api/src/triggers/registry.ts`:

```typescript
import { config as woLifecycleConfig } from './work-order-lifecycle/trigger.config.js'
import { handler as woLifecycleHandler } from './work-order-lifecycle/index.js'

// Add to array:
  { manifest: woLifecycleConfig, handler: woLifecycleHandler },
```

Add `'work-order-lifecycle'` to the `TRIGGER_IDS` array in `packages/triggers/src/index.ts`.

- [ ] **Step 4: Verify lifecycle**

1. Create a WorkOrder with `workOrderStatus: 'Scheduled'`
2. Update to `'In Progress'` → should succeed, no date stamps
3. Update to `'Completed'` → `completedDate` and `completedBy` should auto-populate
4. Update to `'Closed'` → `closedDate` and `closedBy` should auto-populate
5. Try invalid transition (Scheduled → Closed) → should be reverted

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/triggers/work-order-lifecycle/ apps/api/src/triggers/registry.ts packages/triggers/src/index.ts
git commit -m "feat(service): add work-order-lifecycle trigger with auto-stamp and transition validation"
```

---

### Task 5: WorkOrder assignment management widget

**Files:**
- Create: `apps/web/widgets/internal/work-order-assignments/index.tsx`
- Create: `apps/web/widgets/internal/work-order-assignments/registry-entry.ts`
- Modify: `apps/web/widgets/internal/registry.ts` (register new widget)

This widget displays assigned technicians for a WorkOrder, allows adding/removing techs, and toggles lead tech. It renders as a tab on the WorkOrder detail page.

- [ ] **Step 1: Study existing widget pattern**

Read `apps/web/widgets/internal/registry.ts` and one existing internal widget (e.g., `installation-cost-grid`) to understand the registration pattern, props interface, and how widgets access the parent record context.

- [ ] **Step 2: Create the WorkOrderAssignment widget**

Create `apps/web/widgets/internal/work-order-assignments/index.tsx`:

The widget should:
1. Query WorkOrderAssignment records where `workOrder` = current record ID
2. Resolve each assignment's technician name by looking up the Technician record
3. Display a table: Tech Name | Tech Code | Lead? | Notified? | Notes | Actions
4. "Add Technician" button opens a lookup search for Technician records (filtered by `departmentTags` containing 'Service')
5. Lead toggle: clicking sets `isLead=true` on the selected assignment and `isLead=false` on all others, also updates `WorkOrder.leadTech`
6. Remove button: deletes the WorkOrderAssignment record
7. Uses `recordsService.getRecords('WorkOrderAssignment')` with filtering, `recordsService.createRecord()`, `recordsService.updateRecord()`, `recordsService.deleteRecord()`

- [ ] **Step 3: Register the widget**

Add to `apps/web/widgets/internal/registry.ts`:

```typescript
import WorkOrderAssignments from './work-order-assignments/index.js'

// Add to registry:
{
  id: 'work-order-assignments',
  name: 'Work Order Assignments',
  component: WorkOrderAssignments,
  objectApiNames: ['WorkOrder'],
  placement: 'tab',
}
```

- [ ] **Step 4: Verify**

Open a WorkOrder detail page → the Assignments widget should appear as a tab. Add a technician, mark as lead, remove — all operations should persist correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/web/widgets/internal/work-order-assignments/ apps/web/widgets/internal/registry.ts
git commit -m "feat(service): add WorkOrder assignment management widget"
```

---

### Task 6: Punch List related list + print PDF

**Files:**
- Create: `apps/web/widgets/internal/punch-list/index.tsx`
- Create: `apps/web/widgets/internal/punch-list/punch-list-pdf.ts`
- Modify: `apps/web/widgets/internal/registry.ts`

- [ ] **Step 1: Create the Punch List widget**

Create `apps/web/widgets/internal/punch-list/index.tsx`:

The widget should:
1. Query PunchListItem records where `workOrder` = current record ID
2. Display a table: # | Location | Description | Tech | Status | Est Hours | Est Men | Service Date
3. Inline status toggle (Open → In Progress → Completed)
4. "Add Item" button opens a form to create a new PunchListItem (auto-assigns next `itemNumber`)
5. "Print PDF" button generates a combined punch list PDF

- [ ] **Step 2: Create punch-list-pdf.ts** (use Context7: `resolve-library-id` for "jsPDF" → `get-library-docs` for PDF generation API)

Create `apps/web/widgets/internal/punch-list/punch-list-pdf.ts`:

```typescript
export async function generatePunchListPdf(
  workOrderName: string,
  propertyAddress: string,
  items: Array<{
    itemNumber: number
    location: string
    description: string
    techName: string
    status: string
    estimatedHours: number
    estimatedMen: number
    materialsInWarehouse: string
    materialsToOrder: string
    specialEquipment: string
    elevationPage: string
    serviceDate: string
  }>
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  let y = 20

  // Header
  doc.setFontSize(16)
  doc.setTextColor(39, 61, 92) // brand-navy
  doc.text('TISCHLER UND SOHN', w / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(12)
  doc.text('Punch List', w / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Work Order: ${workOrderName}`, 15, y)
  y += 5
  doc.text(`Property: ${propertyAddress}`, 15, y)
  y += 5
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, y)
  y += 10

  // Table header
  doc.setFillColor(39, 61, 92)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.rect(10, y, w - 20, 7, 'F')
  const cols = [10, 20, 50, 100, 135, 158]
  doc.text('#', cols[0]! + 2, y + 5)
  doc.text('Location', cols[1]! + 2, y + 5)
  doc.text('Description', cols[2]! + 2, y + 5)
  doc.text('Tech', cols[3]! + 2, y + 5)
  doc.text('Status', cols[4]! + 2, y + 5)
  doc.text('Est Hrs', cols[5]! + 2, y + 5)
  y += 9

  // Table rows
  doc.setTextColor(40, 40, 40)
  for (const item of items) {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.text(String(item.itemNumber), cols[0]! + 2, y)
    doc.text(item.location || '', cols[1]! + 2, y)
    doc.text((item.description || '').substring(0, 40), cols[2]! + 2, y)
    doc.text(item.techName || '', cols[3]! + 2, y)
    doc.text(item.status || '', cols[4]! + 2, y)
    doc.text(String(item.estimatedHours || ''), cols[5]! + 2, y)
    y += 6
  }

  doc.save(`PunchList_${workOrderName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
}
```

- [ ] **Step 3: Register widget and verify**

Register in `apps/web/widgets/internal/registry.ts`, verify on a WorkOrder detail page: add punch list items, toggle statuses, print PDF.

- [ ] **Step 4: Commit**

```bash
git add apps/web/widgets/internal/punch-list/ apps/web/widgets/internal/registry.ts
git commit -m "feat(service): add Punch List widget with inline editing and PDF print"
```

---

### Task 7: TimeEntry + WorkOrderExpense widgets + roll-up trigger

**Files:**
- Create: `apps/web/widgets/internal/time-entries/index.tsx`
- Create: `apps/web/widgets/internal/work-order-expenses/index.tsx`
- Create: `apps/api/src/triggers/work-order-rollup/trigger.config.ts`
- Create: `apps/api/src/triggers/work-order-rollup/index.ts`
- Modify: `apps/web/widgets/internal/registry.ts`
- Modify: `apps/api/src/triggers/registry.ts`
- Modify: `packages/triggers/src/index.ts`

- [ ] **Step 1: Create time-entries widget**

`apps/web/widgets/internal/time-entries/index.tsx`: Displays time entries for the work order. Table: Date | Tech | Work Hrs | Travel Hrs | Prep Hrs | Misc Hrs | Total Hrs | Rate | Cost. "Log Hours" button opens create form (date defaults to today, rate auto-populated by trigger). Renders in a tab on WorkOrder detail.

- [ ] **Step 2: Create work-order-expenses widget**

`apps/web/widgets/internal/work-order-expenses/index.tsx`: Displays expenses for the work order. Table: Date | Tech | Type | Amount | Qty | Rate | Description. "Add Expense" button opens create form.

- [ ] **Step 3: Create work-order-rollup trigger**

This trigger fires `afterCreate`, `afterUpdate`, `afterDelete` on TimeEntry and WorkOrderExpense. It recalculates and writes the roll-up fields on the parent WorkOrder:

```typescript
// trigger.config.ts
export const config: TriggerManifest = {
  id: 'work-order-rollup',
  name: 'Work Order Cost Roll-ups',
  description: 'Recalculates totalActualHours, totalLaborCost, totalExpenses, totalJobCost on the parent WorkOrder',
  icon: 'Calculator',
  objectApiName: 'TimeEntry', // Note: need to also handle WorkOrderExpense — see handler
  events: ['afterCreate', 'afterUpdate', 'afterDelete'],
}
```

The handler:
1. Gets the `workOrder` ID from the record
2. Queries all TimeEntry records for that WO → sums `totalHours` and `totalCost`
3. Queries all WorkOrderExpense records for that WO → sums `amount`
4. Updates the WorkOrder record with the computed totals

- [ ] **Step 4: Register widgets and trigger, verify**

Test: Add time entries and expenses to a WO, verify the roll-up fields update on the WO record, verify the widgets display correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/web/widgets/internal/time-entries/ apps/web/widgets/internal/work-order-expenses/ apps/api/src/triggers/work-order-rollup/ apps/web/widgets/internal/registry.ts apps/api/src/triggers/registry.ts packages/triggers/src/index.ts
git commit -m "feat(service): add TimeEntry + Expense widgets with roll-up trigger"
```

---

### Task 8: Tech Dashboard page

**Files:**
- Create: `apps/web/app/tech-dashboard/page.tsx`
- Modify: `apps/web/app/app-wrapper.tsx` (add nav entry)

- [ ] **Step 1: Create Tech Dashboard page** (use Context7: `resolve-library-id` for "Next.js" → `get-library-docs` for App Router client components, data fetching patterns)

`apps/web/app/tech-dashboard/page.tsx`:

The page should:
1. Get the current user from `useAuth()`
2. Query Technician records where `user` = current user ID to get the tech's record
3. Query WorkOrderAssignment records where `technician` = tech's record ID
4. For each assignment, look up the WorkOrder details
5. Separate into sections:
   - **Today** — WOs with scheduledStartDate = today
   - **Upcoming** — WOs with scheduledStartDate in next 14 days
   - **Pending Review** — WOs in Completed status where completedDate is within 24 hours (still editable)
   - **Missing Hours** — Completed WOs with no TimeEntry records for this tech
6. Each WO card shows: WO name, property address, status badge, scheduled dates, team members, action buttons (Log Hours, View Details)

- [ ] **Step 2: Add to navigation**

In `apps/web/app/app-wrapper.tsx`, add to `hrefToObjectMap`:

```typescript
'/tech-dashboard': 'WorkOrder', // Uses WorkOrder permissions for visibility
```

- [ ] **Step 3: Verify**

Log in as a user linked to a Technician record. Navigate to Tech Dashboard. Verify sections show correct filtered data. Click action buttons.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/tech-dashboard/ apps/web/app/app-wrapper.tsx
git commit -m "feat(service): add Tech Dashboard page with today/upcoming/pending sections"
```

---

### Task 9: Schedule Calendar page

**Files:**
- Create: `apps/web/app/schedule/page.tsx`
- Create: `apps/web/app/schedule/calendar-grid.tsx`
- Modify: `apps/web/app/app-wrapper.tsx`

- [ ] **Step 1: Create calendar grid component** (use Context7: `resolve-library-id` for "Next.js" → `get-library-docs` for client-side interactivity and state management in App Router)

`apps/web/app/schedule/calendar-grid.tsx`:

A week/month view component:
- Y-axis: technician names (rows)
- X-axis: days (columns)
- Cells: WorkOrder blocks colored by status, spanning their date range
- Click a block → navigate to `/workorders/[id]`
- View toggle: week / month
- Navigation: prev/next week/month

Data fetching:
1. Query all Technician records with `departmentTags` containing 'Service' and `active = true`
2. Query all WorkOrderAssignment records for visible date range
3. For each assignment, look up the WorkOrder to get dates and status
4. Render as a grid

- [ ] **Step 2: Create schedule page**

`apps/web/app/schedule/page.tsx`:

Wraps the calendar grid with:
- Header with title and controls
- Filter bar: by category (Client/Internal/All), by status
- The CalendarGrid component

- [ ] **Step 3: Add to navigation**

Add to `hrefToObjectMap` in `app-wrapper.tsx`:

```typescript
'/schedule': 'WorkOrder',
```

- [ ] **Step 4: Verify**

Create several WorkOrders with different date ranges and assigned techs. Navigate to Schedule page. Verify techs appear as rows, WOs appear as colored blocks in the correct date columns.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/schedule/ apps/web/app/app-wrapper.tsx
git commit -m "feat(service): add Schedule Calendar page with tech rows and WO blocks"
```

---

### Task 10: Assignment Board page

**Files:**
- Create: `apps/web/app/assignment-board/page.tsx`
- Modify: `apps/web/app/app-wrapper.tsx`

- [ ] **Step 1: Create Assignment Board page**

`apps/web/app/assignment-board/page.tsx`:

Layout:
- Left panel: "Unassigned" — WorkOrders with no WorkOrderAssignment records, filtered to status=Scheduled
- Right panel: Tech cards — one card per active Service technician showing:
  - Tech name and code
  - Number of assigned WOs for the current week
  - Total scheduled hours
  - List of assigned WO names

Interaction:
- Drag a WO from unassigned pool onto a tech card → creates WorkOrderAssignment record
- Uses `@dnd-kit/core` and `@dnd-kit/sortable` (check if already in project dependencies, otherwise use HTML5 drag-and-drop). **Use Context7:** `resolve-library-id` for "@dnd-kit" → `get-library-docs` for drag-and-drop API, sortable containers, and drop handlers.

Data fetching:
1. All WorkOrders in Scheduled status
2. All WorkOrderAssignment records
3. All active Service technicians
4. Compute which WOs are unassigned (no assignment records)

- [ ] **Step 2: Add to navigation**

```typescript
'/assignment-board': 'WorkOrder',
```

- [ ] **Step 3: Verify**

Create unassigned WorkOrders. Open Assignment Board. Drag a WO onto a tech card. Verify the assignment record is created and the WO moves from the unassigned pool to the tech card.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/assignment-board/ apps/web/app/app-wrapper.tsx
git commit -m "feat(service): add Assignment Board page with drag-and-drop tech assignment"
```

---

### Task 11: Cost Dashboard page

**Files:**
- Create: `apps/web/app/cost-dashboard/page.tsx`
- Modify: `apps/web/app/app-wrapper.tsx`

- [ ] **Step 1: Create Cost Dashboard page**

`apps/web/app/cost-dashboard/page.tsx`:

Sections:
1. **Summary cards** — total labor cost, total expenses, total job cost for selected period
2. **Per-Technician table** — Tech | Total Hours | Avg Rate | Labor Cost | Expenses | Total Cost
3. **Per-WorkOrder table** — WO | Property | Status | Labor Cost | Expenses | Total Cost
4. **Hours breakdown** — bar chart or table: Work Hours | Travel | Prep | Misc by tech or by WO

Controls:
- Date range picker (defaults to current month)
- Filter by tech, by category
- Export to CSV button (converts table data to CSV and triggers download)

Data fetching:
1. Query TimeEntry records for date range
2. Query WorkOrderExpense records for date range
3. Aggregate by tech and by WO
4. Resolve tech names and WO names

- [ ] **Step 2: Add CSV export utility**

```typescript
function exportToCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 3: Add to navigation and verify**

Add to `hrefToObjectMap`. Verify with sample data: date range filtering works, per-tech and per-WO breakdowns are accurate, CSV export downloads correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/cost-dashboard/ apps/web/app/app-wrapper.tsx
git commit -m "feat(service): add Cost Dashboard page with per-tech/per-WO reporting and CSV export"
```

---

### Task 12: Service Manager + Service Technician profiles + Service department

**Files:**
- Modify: `apps/api/src/ensure-core-objects.ts` (add department + profile seeding)

- [ ] **Step 1: Add Service department and profiles to ensure-core-objects**

At the end of `ensureCoreObjects()`, after the object creation loop, add department and profile seeding:

```typescript
  // Ensure Service department exists
  const existingDept = await prisma.department.findFirst({
    where: { name: { equals: 'Service', mode: 'insensitive' } },
  })
  if (!existingDept) {
    await prisma.department.create({
      data: {
        id: generateId('Department'),
        name: 'Service',
        description: 'Service Department — technicians and managers',
        createdById: systemUser.id,
        modifiedById: systemUser.id,
      },
    })
    console.log('[ensure-core-objects] Created Service department')
  }

  // Ensure Service Manager profile exists
  const existingMgrProfile = await prisma.profile.findFirst({
    where: { name: { equals: 'Service Manager', mode: 'insensitive' } },
  })
  if (!existingMgrProfile) {
    await prisma.profile.create({
      data: {
        id: generateId('Profile'),
        name: 'Service Manager',
        description: 'Full access to service module objects and features',
        permissions: JSON.stringify({
          objectPermissions: {},
          appPermissions: {},
        }),
        createdById: systemUser.id,
        modifiedById: systemUser.id,
      },
    })
    console.log('[ensure-core-objects] Created Service Manager profile')
  }

  // Ensure Service Technician profile exists
  const existingTechProfile = await prisma.profile.findFirst({
    where: { name: { equals: 'Service Technician', mode: 'insensitive' } },
  })
  if (!existingTechProfile) {
    await prisma.profile.create({
      data: {
        id: generateId('Profile'),
        name: 'Service Technician',
        description: 'Graduated access for service technicians — starts restricted',
        permissions: JSON.stringify({
          objectPermissions: {},
          appPermissions: {},
        }),
        createdById: systemUser.id,
        modifiedById: systemUser.id,
      },
    })
    console.log('[ensure-core-objects] Created Service Technician profile')
  }
```

Note: The `permissions` JSON is initially empty — the admin configures specific object/field permissions through the Settings > Profiles UI as per the spec (admin decides what each role can see/edit).

- [ ] **Step 2: Verify**

Restart API. Check Settings > Departments — "Service" should appear. Check Settings > Profiles — "Service Manager" and "Service Technician" should appear. Assign a user to Service Technician profile, verify they can see WorkOrders (once permissions are configured).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ensure-core-objects.ts
git commit -m "feat(service): seed Service department + Service Manager/Technician profiles"
```

---

## Dependency Graph

```
Task 1 (Enhance Technician + prefix)
  │
  v
Task 2 (Enhance WorkOrder + 5 new objects + prefixes)
  │
  ├──> Task 3 (Rate triggers)
  │
  ├──> Task 4 (WO lifecycle trigger)
  │      │
  │      v
  ├──> Task 5 (Assignment widget)
  │      │
  │      ├──> Task 8 (Tech Dashboard)
  │      ├──> Task 9 (Schedule Calendar)
  │      └──> Task 10 (Assignment Board)
  │
  ├──> Task 6 (Punch List + PDF)
  │
  ├──> Task 7 (TimeEntry + Expense + rollups)
  │      │
  │      └──> Task 11 (Cost Dashboard)
  │
  └──> Task 12 (Roles/Profiles — last)
```

Tasks 3, 4, 5, 6, 7 can run in parallel after Task 2.
Tasks 8-11 can run in parallel after their upstream dependencies.
Task 12 runs last (needs all objects to exist for permission configuration).

---

## Deferred: Notification Triggers

The spec defines 4 notification automations (Tech Assigned email, Schedule Reminder, WO→Completed manager alert, Hours Missing reminder). These depend on the CRM's email sending infrastructure and are best implemented after the core data model and UIs are working. They follow the same trigger pattern as Tasks 3-4 and can be added as a follow-up plan once the email system is confirmed.
