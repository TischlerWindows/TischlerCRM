# Service Department Module — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Service Department module per the v2 spec — enhanced Technician + 6 new/changed objects, 4 triggers, 7-state lifecycle with reason modals, walled-garden tech permissions, 4 widgets on WorkOrder detail, 3 new pages (Tech Dashboard, merged Schedule, Cost Dashboard), punch list PDF, and seeded profiles + department.

**Architecture:** Metadata-driven CRM. Objects defined in `ensure-core-objects.ts`; records stored as JSON in a single `Record` table. New objects use the standard `CustomObject → CustomField → Record` pattern. Triggers follow the existing registry pattern. Custom UIs are Next.js 14 App Router pages. Child records (assignments, punch list items, time entries, expenses) appear as widgets on WorkOrder detail — no dedicated list pages. The existing `path` widget is reused for the 7-state status bar. The existing `file-folder` widget is the Dropbox integration.

**Tech Stack:** TypeScript, Next.js 14 App Router, Fastify 5, Prisma 5 (PostgreSQL), `@dnd-kit` (drag-drop), jsPDF (PDF generation), pnpm monorepo.

**Spec:** `docs/superpowers/specs/2026-04-20-service-department-module-design-v2.md`

**Skills & Tools:**
- Use **Context7** (`resolve-library-id` → `get-library-docs`) before implementing with any library: **jsPDF** (Task 7), **@dnd-kit** (Task 11), **Next.js App Router** (all page tasks), **Prisma** (trigger data queries), **Tailwind CSS** (all UI tasks). Do NOT rely on training data.
- Use **superpowers:test-driven-development** for trigger logic (Tasks 3, 4, 8)
- Use **superpowers:verification-before-completion** after each task before committing
- Use **superpowers:subagent-driven-development** (recommended) or **superpowers:executing-plans** to work through tasks

---

## Prefix Map (v2)

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
- Modify: `apps/api/src/ensure-core-objects.ts` (Technician entry)
- Modify: `packages/db/src/record-id.ts` (add Technician prefix)

- [ ] **Step 1: Replace Technician object definition (no overtime)**

In `apps/api/src/ensure-core-objects.ts`, find the existing `Technician` entry and replace it with:

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
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'skills', label: 'Skills', type: 'MultiPicklist', picklistValues: ['Glazing', 'Framing', 'Electrical', 'Plumbing', 'General'] },
      { apiName: 'user', label: 'User', type: 'Lookup' },
      { apiName: 'active', label: 'Active', type: 'Checkbox', defaultValue: 'true' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
    ],
  },
```

Note: `overtimeRate` is intentionally omitted (v2 drops overtime logic). `ensureFields()` is additive — existing Technician records are unaffected.

- [ ] **Step 2: Register Technician prefix in record-id.ts**

In `packages/db/src/record-id.ts`, add after the existing prefix map (place alphabetically or after the last entry):

```typescript
  Technician: '035',
```

- [ ] **Step 3: Verify — restart API**

Run: `cd apps/api && pnpm dev`

Expected: Console shows `[ensure-core-objects] Done` with Technician present. Open Object Manager → Technician now shows `techCode`, `departmentTags`, `skills`, `user`, `active`, `notes` fields. No `overtimeRate`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ensure-core-objects.ts packages/db/src/record-id.ts
git commit -m "feat(service): enhance Technician with tech code, skills, user link (no overtime)"
```

---

### Task 2: Enhance WorkOrder + 5 new child objects + Tischler property seeds + prefixes

**Files:**
- Modify: `apps/api/src/ensure-core-objects.ts` (WorkOrder fields + 5 new objects + Tischler property seeds)
- Modify: `packages/db/src/record-id.ts` (5 new prefixes)

- [ ] **Step 1: Replace WorkOrder object definition**

In `apps/api/src/ensure-core-objects.ts`, find the existing `WorkOrder` entry and replace:

```typescript
  {
    apiName: 'WorkOrder',
    label: 'Work Order',
    pluralLabel: 'Work Orders',
    description: 'Scheduled work orders for service and maintenance',
    fields: [
      { apiName: 'workOrderNumber', label: 'Work Order Number', type: 'Text', unique: true },
      { apiName: 'name', label: 'Work Order', type: 'Text' },
      { apiName: 'title', label: 'Title', type: 'TextArea' },
      { apiName: 'property', label: 'Property', type: 'Lookup', required: true },
      { apiName: 'workOrderCategory', label: 'Category', type: 'Picklist', picklistValues: ['Client Service', 'Internal'], defaultValue: 'Client Service' },
      { apiName: 'workOrderSource', label: 'Source', type: 'Picklist', picklistValues: ['Customer Call', 'Warranty Claim', 'Maintenance Contract', 'Internal Request', 'Referred from Project', 'Other'] },
      { apiName: 'workOrderStatus', label: 'Status', type: 'Picklist', picklistValues: ['Open', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Closed', 'Cancelled'], defaultValue: 'Open' },
      { apiName: 'holdReason', label: 'Hold Reason', type: 'Picklist', picklistValues: ['Waiting on Parts', 'Waiting on Materials', 'Weather Delay', 'Customer Delay', 'Warranty Decision Pending', 'Subcontractor Delay', 'Tech Unavailable', 'Other'] },
      { apiName: 'holdNotes', label: 'Hold Notes', type: 'LongTextArea' },
      { apiName: 'cancelReason', label: 'Cancel Reason', type: 'Picklist', picklistValues: ['Customer Cancelled', 'Duplicate Work Order', 'Issue Resolved', 'Covered Under Different WO', 'Warranty Denied', 'Not Reproducible', 'Other'] },
      { apiName: 'cancelNotes', label: 'Cancel Notes', type: 'LongTextArea' },
      { apiName: 'project', label: 'Project', type: 'Lookup' },
      { apiName: 'leadTech', label: 'Lead Tech', type: 'Lookup' },
      { apiName: 'scheduledStartDate', label: 'Scheduled Start', type: 'DateTime' },
      { apiName: 'scheduledEndDate', label: 'Scheduled End', type: 'DateTime' },
      { apiName: 'completedDate', label: 'Completed Date', type: 'DateTime' },
      { apiName: 'completedBy', label: 'Completed By', type: 'Lookup' },
      { apiName: 'closedDate', label: 'Closed Date', type: 'DateTime' },
      { apiName: 'closedBy', label: 'Closed By', type: 'Lookup' },
      { apiName: 'workDescription', label: 'Work Description', type: 'LongTextArea' },
      { apiName: 'toolsNeeded', label: 'Tools Needed', type: 'LongTextArea' },
      { apiName: 'outsideContractors', label: 'Outside Contractors', type: 'LongTextArea' },
      { apiName: 'invoiceNumber', label: 'Invoice Number', type: 'Text' },
      { apiName: 'totalEstimatedHours', label: 'Total Estimated Hours', type: 'Number' },
      { apiName: 'totalActualHours', label: 'Total Actual Hours', type: 'Number' },
      { apiName: 'totalLaborCost', label: 'Total Labor Cost', type: 'Currency' },
      { apiName: 'totalExpenses', label: 'Total Expenses', type: 'Currency' },
      { apiName: 'totalJobCost', label: 'Total Job Cost', type: 'Currency' },
    ],
  },
```

- [ ] **Step 2: Add WorkOrderAssignment object**

Add after the Task object in the `CORE_OBJECTS` array:

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

Note: `totalHours` / `totalCost` / `rateAtEntry` are computed and stored by the `snapshot-rate-on-time-entry` trigger (Task 3) — not formula fields.

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

- [ ] **Step 6: Add TechnicianRateHistory object (hourly only — no rateType)**

```typescript
  {
    apiName: 'TechnicianRateHistory',
    label: 'Technician Rate History',
    pluralLabel: 'Technician Rate History',
    description: 'Audit trail for technician hourly rate changes',
    fields: [
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'effectiveDate', label: 'Effective Date', type: 'Date', required: true },
      { apiName: 'previousRate', label: 'Previous Rate', type: 'Currency', required: true },
      { apiName: 'newRate', label: 'New Rate', type: 'Currency', required: true },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
    ],
  },
```

- [ ] **Step 7: Register all new prefixes in record-id.ts**

Add after `Technician: '035'`:

```typescript
  WorkOrderAssignment: '036',
  PunchListItem: '037',
  TimeEntry: '038',
  WorkOrderExpense: '039',
  TechnicianRateHistory: '040',
```

- [ ] **Step 8: Seed Tischler-owned Property records**

At the end of `ensureCoreObjects()`, after the object-creation loop, add seeding for the three internal property records. First, locate the Property object:

```typescript
  // Seed Tischler-owned Property records used as anchors for Internal WOs
  const propertyObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Property', mode: 'insensitive' } },
  })
  if (propertyObj) {
    const internalProps = [
      { name: 'Tischler HQ — Office', category: 'Internal' },
      { name: 'Tischler HQ — Warehouse', category: 'Internal' },
      { name: 'Tischler Fleet — Service Trucks', category: 'Internal' },
    ]
    for (const p of internalProps) {
      const exists = await prisma.record.findFirst({
        where: {
          objectId: propertyObj.id,
          data: { path: ['name'], equals: p.name },
        },
      })
      if (!exists) {
        await prisma.record.create({
          data: {
            id: generateRecordId('Property'),
            objectId: propertyObj.id,
            data: { name: p.name, propertyCategory: p.category },
            createdById: systemUser.id,
            modifiedById: systemUser.id,
          },
        })
        console.log(`[ensure-core-objects] Seeded internal property: ${p.name}`)
      }
    }
  }
```

Note: `propertyCategory` is a hypothetical field on Property — adjust to match the actual field name for property-type classification. If no such field exists, just persist `name` and the category is implicit from the name.

- [ ] **Step 9: Verify — restart API**

Run: `cd apps/api && pnpm dev`

Expected: All 6 new/enhanced objects visible in Object Manager. WorkOrder has 7 status values + both reason picklists. Three internal Property records appear in the Property list.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/ensure-core-objects.ts packages/db/src/record-id.ts
git commit -m "feat(service): WorkOrder v2 fields + 5 child objects + Tischler property seeds"
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
  description: 'Auto-creates a TechnicianRateHistory record when hourlyRate changes',
  icon: 'History',
  objectApiName: 'Technician',
  events: ['afterUpdate'],
}
```

- [ ] **Step 2: Create rate-change-history handler (hourly only)**

Create `apps/api/src/triggers/rate-change-history/index.ts`:

```typescript
import { prisma } from '@crm/db/client'
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordId, recordData, beforeData, userId } = ctx
    if (!beforeData) return null

    const oldHourly = Number(beforeData.hourlyRate) || 0
    const newHourly = Number(recordData.hourlyRate) || 0
    if (oldHourly === newHourly || newHourly <= 0) return null

    const rateHistoryObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'TechnicianRateHistory', mode: 'insensitive' } },
    })
    if (!rateHistoryObj) {
      console.error('[rate-change-history] TechnicianRateHistory object not found')
      return null
    }

    registerRecordIdPrefix('TechnicianRateHistory')
    const today = new Date().toISOString().split('T')[0]

    await prisma.record.create({
      data: {
        id: generateRecordId('TechnicianRateHistory'),
        objectId: rateHistoryObj.id,
        data: {
          technician: recordId,
          effectiveDate: today,
          previousRate: oldHourly,
          newRate: newHourly,
        },
        createdById: userId,
        modifiedById: userId,
      },
    })
    console.log(`[rate-change-history] Logged rate change for tech ${recordId}: $${oldHourly} → $${newHourly}`)

    return null
  } catch (err) {
    console.error('[rate-change-history] Trigger failed:', err)
    return null
  }
}
```

- [ ] **Step 3: Create snapshot-rate-on-time-entry trigger config**

Create `apps/api/src/triggers/snapshot-rate-on-time-entry/trigger.config.ts`:

```typescript
import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'snapshot-rate-on-time-entry',
  name: 'Snapshot Rate on Time Entry',
  description: 'Captures the technician hourly rate at entry creation and computes totals',
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

    const techRecord = await prisma.record.findUnique({ where: { id: techId } })
    if (!techRecord) return null

    const techData = techRecord.data as Record<string, any>
    const currentRate = Number(techData.hourlyRate) || 0

    const workHours = Number(recordData.workHours) || 0
    const travelHours = Number(recordData.travelHours) || 0
    const prepHours = Number(recordData.prepHours) || 0
    const miscHours = Number(recordData.miscHours) || 0
    const totalHours = workHours + travelHours + prepHours + miscHours

    // On create: snapshot current rate. On update: preserve existing rateAtEntry (immutable after save).
    const rateAtEntry = event === 'beforeCreate'
      ? currentRate
      : (Number(recordData.rateAtEntry) || currentRate)

    const totalCost = totalHours * rateAtEntry

    return { rateAtEntry, totalHours, totalCost }
  } catch (err) {
    console.error('[snapshot-rate-on-time-entry] Trigger failed:', err)
    return null
  }
}
```

- [ ] **Step 5: Register both triggers in registry**

In `apps/api/src/triggers/registry.ts`, add imports at the top:

```typescript
import { config as rateChangeHistoryConfig } from './rate-change-history/trigger.config.js'
import { handler as rateChangeHistoryHandler } from './rate-change-history/index.js'
import { config as snapshotRateConfig } from './snapshot-rate-on-time-entry/trigger.config.js'
import { handler as snapshotRateHandler } from './snapshot-rate-on-time-entry/index.js'
```

Add to the `triggerRegistrations` array:

```typescript
  { manifest: rateChangeHistoryConfig, handler: rateChangeHistoryHandler },
  { manifest: snapshotRateConfig, handler: snapshotRateHandler },
```

In `packages/triggers/src/index.ts`, add the IDs to `TRIGGER_IDS`:

```typescript
  'rate-change-history',
  'snapshot-rate-on-time-entry',
```

- [ ] **Step 6: Verify triggers**

Run: `cd apps/api && pnpm dev`

Test:
1. Create Technician record with `hourlyRate = 35`
2. Create a TimeEntry linked to that technician with `workHours=4, travelHours=1` → verify `rateAtEntry=35`, `totalHours=5`, `totalCost=175`
3. Update Technician `hourlyRate` to 40 → verify new TechnicianRateHistory record with `previousRate=35, newRate=40`
4. Create another TimeEntry → `rateAtEntry=40`, old entry unchanged

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/triggers/rate-change-history/ apps/api/src/triggers/snapshot-rate-on-time-entry/ apps/api/src/triggers/registry.ts packages/triggers/src/index.ts
git commit -m "feat(service): add rate-change-history and rate-snapshot triggers"
```

---

### Task 4: Work Order lifecycle trigger (7-state with auto-stamps)

**Files:**
- Create: `apps/api/src/triggers/work-order-lifecycle/trigger.config.ts`
- Create: `apps/api/src/triggers/work-order-lifecycle/index.ts`
- Modify: `apps/api/src/triggers/registry.ts`
- Modify: `packages/triggers/src/index.ts`

- [ ] **Step 1: Create trigger config**

Create `apps/api/src/triggers/work-order-lifecycle/trigger.config.ts`:

```typescript
import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'work-order-lifecycle',
  name: 'Work Order Lifecycle',
  description: 'Validates status transitions and auto-stamps completedDate/closedDate + user fields',
  icon: 'GitBranch',
  objectApiName: 'WorkOrder',
  events: ['beforeUpdate'],
}
```

- [ ] **Step 2: Create handler with 7-state transition table**

Create `apps/api/src/triggers/work-order-lifecycle/index.ts`:

```typescript
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Open':        ['Scheduled', 'Cancelled'],
  'Scheduled':   ['Open', 'In Progress', 'On Hold', 'Cancelled'],
  'In Progress': ['Completed', 'On Hold', 'Cancelled'],
  'On Hold':     ['Scheduled', 'In Progress', 'Cancelled'],
  'Completed':   ['Closed', 'In Progress'],
  'Closed':      [],
  'Cancelled':   ['Open'],
}

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordData, beforeData, userId } = ctx
    if (!beforeData) return null

    const oldStatus = (beforeData.workOrderStatus as string) || 'Open'
    const newStatus = recordData.workOrderStatus as string | undefined

    if (!newStatus || newStatus === oldStatus) return null

    const allowed = VALID_TRANSITIONS[oldStatus] || []
    if (!allowed.includes(newStatus)) {
      console.warn(`[work-order-lifecycle] Invalid transition: ${oldStatus} → ${newStatus} — reverting`)
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

    // Re-open: clear completion stamps so the 24-hr window resets on re-completion
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

Note: the modal UX (Task 5) enforces that `holdReason` / `cancelReason` are populated client-side before submitting the transition — this trigger does not reject missing reasons. Reason fields are part of the same update payload and persist naturally.

- [ ] **Step 3: Register trigger**

In `apps/api/src/triggers/registry.ts`:

```typescript
import { config as woLifecycleConfig } from './work-order-lifecycle/trigger.config.js'
import { handler as woLifecycleHandler } from './work-order-lifecycle/index.js'

// Add to array:
  { manifest: woLifecycleConfig, handler: woLifecycleHandler },
```

In `packages/triggers/src/index.ts`, add `'work-order-lifecycle'` to `TRIGGER_IDS`.

- [ ] **Step 4: Verify lifecycle transitions**

Start the API. Test each transition via API or Object Manager:

| From | To | Expected |
|---|---|---|
| Open | Scheduled | allowed, no stamps |
| Scheduled | In Progress | allowed |
| In Progress | Completed | `completedDate` + `completedBy` stamped |
| Completed | Closed | `closedDate` + `closedBy` stamped |
| Completed | In Progress | allowed, `completedDate`/`completedBy` cleared |
| Scheduled | Closed | **rejected, reverts to Scheduled** (invalid jump) |
| Cancelled | Open | allowed (recover) |
| Closed | * | rejected (terminal) |

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/triggers/work-order-lifecycle/ apps/api/src/triggers/registry.ts packages/triggers/src/index.ts
git commit -m "feat(service): add 7-state work-order-lifecycle trigger with auto-stamping"
```

---

### Task 5: Reason modal component (shared for On Hold + Cancelled)

**Files:**
- Create: `apps/web/components/work-order-reason-modal.tsx`

- [ ] **Step 1: Study an existing dialog pattern**

Before writing, read `apps/web/components/new-opportunity-dialog.tsx` (or any existing dialog in `apps/web/components/`) to match the project's dialog primitives (shadcn/ui Dialog or similar). Note the import paths for `Dialog`, `DialogContent`, `Button`, `Select`, `Textarea`, and how the project wires `onOpenChange`.

- [ ] **Step 2: Create the shared reason modal component**

Create `apps/web/components/work-order-reason-modal.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export type ReasonModalMode = 'hold' | 'cancel'

const HOLD_REASONS = [
  'Waiting on Parts',
  'Waiting on Materials',
  'Weather Delay',
  'Customer Delay',
  'Warranty Decision Pending',
  'Subcontractor Delay',
  'Tech Unavailable',
  'Other',
]

const CANCEL_REASONS = [
  'Customer Cancelled',
  'Duplicate Work Order',
  'Issue Resolved',
  'Covered Under Different WO',
  'Warranty Denied',
  'Not Reproducible',
  'Other',
]

interface Props {
  open: boolean
  mode: ReasonModalMode
  onConfirm: (reason: string, notes: string) => void
  onCancel: () => void
}

export function WorkOrderReasonModal({ open, mode, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const title = mode === 'hold' ? 'Put Work Order On Hold' : 'Cancel Work Order'
  const reasons = mode === 'hold' ? HOLD_REASONS : CANCEL_REASONS
  const confirmLabel = mode === 'hold' ? 'Put On Hold' : 'Cancel WO'
  const confirmVariant: 'default' | 'destructive' = mode === 'hold' ? 'default' : 'destructive'

  const handleConfirm = () => {
    if (!reason) return
    onConfirm(reason, notes)
    setReason('')
    setNotes('')
  }

  const handleCancel = () => {
    setReason('')
    setNotes('')
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason"><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={!reason}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

If the project does not use shadcn/ui components exactly as imported above, adapt the import paths to the project's actual UI primitives (check `apps/web/components/ui/` for available components).

- [ ] **Step 3: Verify — render a standalone test page**

Temporary test: in a scratch page (or any existing dev-only page), render:

```tsx
import { useState } from 'react'
import { WorkOrderReasonModal } from '@/components/work-order-reason-modal'

export default function TestPage() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open Hold Modal</button>
      <WorkOrderReasonModal
        open={open}
        mode="hold"
        onConfirm={(r, n) => { console.log('hold', r, n); setOpen(false) }}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
```

Verify: modal opens, dropdown lists 8 hold reasons, notes field is optional, Cancel closes without confirm, Save fires `onConfirm` with `{ reason, notes }`.

Remove the test page before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/work-order-reason-modal.tsx
git commit -m "feat(service): add shared reason modal for On Hold and Cancelled transitions"
```

---

### Task 6: WorkOrder assignment management widget

**Files:**
- Create: `apps/web/widgets/internal/work-order-assignments/widget.config.ts`
- Create: `apps/web/widgets/internal/work-order-assignments/index.tsx`
- Modify: `apps/web/widgets/internal/registry.ts`

- [ ] **Step 1: Study an existing widget for shape**

Read `apps/web/widgets/internal/related-list/index.tsx` and `apps/web/widgets/internal/installation-cost-grid/index.tsx` to understand how widgets receive the parent record (usually via a prop like `recordId` or `record`) and how `recordsService` is called inside them.

- [ ] **Step 2: Create widget config**

Create `apps/web/widgets/internal/work-order-assignments/widget.config.ts`:

```typescript
import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'work-order-assignments',
  name: 'Work Order Assignments',
  description: 'Technicians assigned to this work order',
  icon: 'Users',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
```

- [ ] **Step 3: Create the widget component**

Create `apps/web/widgets/internal/work-order-assignments/index.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { recordsService } from '@/lib/records-service'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface Assignment {
  id: string
  data: {
    workOrder: string
    technician: string
    isLead?: boolean
    notes?: string
    notified?: boolean
  }
}

interface Tech {
  id: string
  data: { technicianName?: string; techCode?: string; departmentTags?: string[]; active?: boolean }
}

interface Props {
  recordId: string // the parent WorkOrder ID
}

export default function WorkOrderAssignmentsWidget({ recordId }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [techs, setTechs] = useState<Record<string, Tech>>({})
  const [showPicker, setShowPicker] = useState(false)
  const [allServiceTechs, setAllServiceTechs] = useState<Tech[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    const all = await recordsService.getRecords('WorkOrderAssignment') as Assignment[]
    const filtered = all.filter(a => a.data.workOrder === recordId)
    setAssignments(filtered)

    const techMap: Record<string, Tech> = {}
    for (const a of filtered) {
      if (a.data.technician && !techMap[a.data.technician]) {
        const t = await recordsService.getRecord('Technician', a.data.technician) as Tech
        if (t) techMap[a.data.technician] = t
      }
    }
    setTechs(techMap)
    setLoading(false)
  }

  async function openPicker() {
    const all = await recordsService.getRecords('Technician') as Tech[]
    setAllServiceTechs(all.filter(t => t.data.active !== false && (t.data.departmentTags || []).includes('Service')))
    setShowPicker(true)
  }

  async function addTech(techId: string) {
    await recordsService.createRecord('WorkOrderAssignment', {
      workOrder: recordId,
      technician: techId,
      isLead: assignments.length === 0, // first tech added becomes lead
    })
    if (assignments.length === 0) {
      await recordsService.updateRecord('WorkOrder', recordId, { leadTech: techId })
    }
    setShowPicker(false)
    reload()
  }

  async function toggleLead(assignment: Assignment) {
    for (const a of assignments) {
      await recordsService.updateRecord('WorkOrderAssignment', a.id, { isLead: a.id === assignment.id })
    }
    await recordsService.updateRecord('WorkOrder', recordId, { leadTech: assignment.data.technician })
    reload()
  }

  async function removeAssignment(id: string) {
    await recordsService.deleteRecord('WorkOrderAssignment', id)
    reload()
  }

  useEffect(() => { reload() }, [recordId])

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading…</div>

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Assigned Technicians</h3>
        <Button size="sm" onClick={openPicker}>+ Add Technician</Button>
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500">No technicians assigned yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b">
            <th className="py-2">Tech</th><th>Code</th><th>Lead</th><th>Notified</th><th></th>
          </tr></thead>
          <tbody>
            {assignments.map(a => {
              const t = techs[a.data.technician]
              return (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{t?.data.technicianName || '—'}</td>
                  <td>{t?.data.techCode || '—'}</td>
                  <td><Checkbox checked={!!a.data.isLead} onCheckedChange={() => toggleLead(a)} /></td>
                  <td>{a.data.notified ? 'Yes' : 'No'}</td>
                  <td><Button variant="ghost" size="sm" onClick={() => removeAssignment(a.id)}>Remove</Button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {showPicker && (
        <div className="mt-4 p-3 border rounded">
          <h4 className="font-medium mb-2">Pick a Service Technician</h4>
          <ul className="space-y-1 max-h-64 overflow-auto">
            {allServiceTechs
              .filter(t => !assignments.some(a => a.data.technician === t.id))
              .map(t => (
                <li key={t.id}>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addTech(t.id)}>
                    {t.data.technicianName} ({t.data.techCode})
                  </Button>
                </li>
              ))}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowPicker(false)}>Close</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Register widget**

In `apps/web/widgets/internal/registry.ts`, add:

```typescript
import { config as workOrderAssignmentsConfig } from './work-order-assignments/widget.config'
import WorkOrderAssignmentsWidget from './work-order-assignments'

// Add to registrations:
  { manifest: workOrderAssignmentsConfig, Component: WorkOrderAssignmentsWidget },
```

Adapt the registration shape to match the existing pattern in `registry.ts` exactly.

- [ ] **Step 5: Verify**

Open a WorkOrder detail page, place the widget on its layout via Object Manager / page builder. Add a technician, toggle lead, remove — all operations persist. Verify `WorkOrder.leadTech` updates when lead changes.

- [ ] **Step 6: Commit**

```bash
git add apps/web/widgets/internal/work-order-assignments/ apps/web/widgets/internal/registry.ts
git commit -m "feat(service): add WorkOrder assignment management widget"
```

---

### Task 7: Punch List widget + PDF

**Files:**
- Create: `apps/web/widgets/internal/punch-list/widget.config.ts`
- Create: `apps/web/widgets/internal/punch-list/index.tsx`
- Create: `apps/web/widgets/internal/punch-list/punch-list-pdf.ts`
- Modify: `apps/web/widgets/internal/registry.ts`

- [ ] **Step 1: Fetch jsPDF docs via Context7**

Use Context7: `resolve-library-id` for "jsPDF", then `get-library-docs` focused on text/layout APIs and auto-paging. Reference these patterns for the PDF helper.

- [ ] **Step 2: Create widget config**

Create `apps/web/widgets/internal/punch-list/widget.config.ts`:

```typescript
import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'punch-list',
  name: 'Punch List',
  description: 'Work items for this work order with inline status + PDF print',
  icon: 'ListChecks',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
```

- [ ] **Step 3: Create PDF helper**

Create `apps/web/widgets/internal/punch-list/punch-list-pdf.ts`:

```typescript
export interface PunchItemForPdf {
  itemNumber: number
  location: string
  description: string
  techName: string
  status: string
  estimatedHours: number
  estimatedMen: number
  serviceDate: string
}

export async function generatePunchListPdf(
  workOrderName: string,
  propertyAddress: string,
  items: PunchItemForPdf[],
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  let y = 20

  doc.setFontSize(16)
  doc.setTextColor(39, 61, 92)
  doc.text('TISCHLER UND SOHN', w / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(12)
  doc.text('Punch List', w / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Work Order: ${workOrderName}`, 15, y); y += 5
  doc.text(`Property: ${propertyAddress}`, 15, y); y += 5
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, y); y += 10

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

  doc.setTextColor(40, 40, 40)
  for (const item of items) {
    if (y > 270) { doc.addPage(); y = 20 }
    doc.text(String(item.itemNumber), cols[0]! + 2, y)
    doc.text((item.location || '').substring(0, 18), cols[1]! + 2, y)
    doc.text((item.description || '').substring(0, 40), cols[2]! + 2, y)
    doc.text((item.techName || '').substring(0, 18), cols[3]! + 2, y)
    doc.text(item.status || '', cols[4]! + 2, y)
    doc.text(String(item.estimatedHours || ''), cols[5]! + 2, y)
    y += 6
  }

  doc.save(`PunchList_${workOrderName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
}
```

- [ ] **Step 4: Create widget component (team-editable)**

Create `apps/web/widgets/internal/punch-list/index.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { recordsService } from '@/lib/records-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generatePunchListPdf, type PunchItemForPdf } from './punch-list-pdf'

const STATUSES = ['Open', 'In Progress', 'Completed', 'N/A']

interface PunchItem {
  id: string
  data: {
    workOrder: string
    itemNumber?: number
    location?: string
    description?: string
    assignedTech?: string
    status?: string
    estimatedHours?: number
    estimatedMen?: number
    serviceDate?: string
  }
}

interface Props { recordId: string }

export default function PunchListWidget({ recordId }: Props) {
  const [items, setItems] = useState<PunchItem[]>([])
  const [techNames, setTechNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newLoc, setNewLoc] = useState('')

  async function reload() {
    setLoading(true)
    const all = await recordsService.getRecords('PunchListItem') as PunchItem[]
    const mine = all.filter(i => i.data.workOrder === recordId)
      .sort((a, b) => (a.data.itemNumber || 0) - (b.data.itemNumber || 0))
    setItems(mine)

    const map: Record<string, string> = {}
    for (const i of mine) {
      const id = i.data.assignedTech
      if (id && !map[id]) {
        const t = await recordsService.getRecord('Technician', id) as any
        if (t) map[id] = t.data?.technicianName || ''
      }
    }
    setTechNames(map)
    setLoading(false)
  }

  async function addItem() {
    const nextNumber = (items[items.length - 1]?.data.itemNumber || 0) + 1
    await recordsService.createRecord('PunchListItem', {
      workOrder: recordId,
      itemNumber: nextNumber,
      description: newDesc,
      location: newLoc,
      status: 'Open',
    })
    setNewDesc(''); setNewLoc(''); setAdding(false)
    reload()
  }

  async function updateStatus(item: PunchItem, status: string) {
    await recordsService.updateRecord('PunchListItem', item.id, { status })
    reload()
  }

  async function printPdf() {
    const wo = await recordsService.getRecord('WorkOrder', recordId) as any
    const property = wo?.data?.property
      ? await recordsService.getRecord('Property', wo.data.property) as any
      : null
    const propAddress = property?.data?.name || property?.data?.address || ''
    const pdfItems: PunchItemForPdf[] = items.map(i => ({
      itemNumber: i.data.itemNumber || 0,
      location: i.data.location || '',
      description: i.data.description || '',
      techName: techNames[i.data.assignedTech || ''] || '',
      status: i.data.status || '',
      estimatedHours: i.data.estimatedHours || 0,
      estimatedMen: i.data.estimatedMen || 0,
      serviceDate: i.data.serviceDate || '',
    }))
    await generatePunchListPdf(wo?.data?.name || `WO-${recordId}`, propAddress, pdfItems)
  }

  useEffect(() => { reload() }, [recordId])

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading…</div>

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Punch List</h3>
        <div className="space-x-2">
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>+ Add Item</Button>
          <Button size="sm" variant="outline" onClick={printPdf} disabled={items.length === 0}>Print PDF</Button>
        </div>
      </div>

      {adding && (
        <div className="mb-3 p-3 border rounded space-y-2">
          <Input placeholder="Location (kitchen, bath 2, etc.)" value={newLoc} onChange={e => setNewLoc(e.target.value)} />
          <Input placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <div className="space-x-2">
            <Button size="sm" onClick={addItem} disabled={!newDesc}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No items yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b">
            <th className="py-2 w-10">#</th><th>Location</th><th>Description</th><th>Tech</th><th className="w-36">Status</th>
          </tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-b">
                <td className="py-2">{i.data.itemNumber}</td>
                <td>{i.data.location || '—'}</td>
                <td>{i.data.description || '—'}</td>
                <td>{techNames[i.data.assignedTech || ''] || '—'}</td>
                <td>
                  <Select value={i.data.status || 'Open'} onValueChange={v => updateStatus(i, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Register widget**

In `apps/web/widgets/internal/registry.ts`, add at the top:

```typescript
import { config as punchListConfig } from './punch-list/widget.config'
import PunchListWidget from './punch-list'
```

Add to the registrations array:

```typescript
  { manifest: punchListConfig, Component: PunchListWidget },
```

Adapt the registration shape to match the existing pattern in `registry.ts` exactly.

- [ ] **Step 6: Verify**

Place on WO Detail layout. Add 3 items, toggle statuses, print PDF. Confirm PDF opens with correct headers, all items listed, page break if more than ~40 items.

- [ ] **Step 7: Commit**

```bash
git add apps/web/widgets/internal/punch-list/ apps/web/widgets/internal/registry.ts
git commit -m "feat(service): add team-editable punch list widget with PDF print"
```

---

### Task 8: TimeEntry + WorkOrderExpense widgets (user-scoped for techs) + roll-up trigger

**Files:**
- Create: `apps/web/widgets/internal/time-entries/widget.config.ts`
- Create: `apps/web/widgets/internal/time-entries/index.tsx`
- Create: `apps/web/widgets/internal/work-order-expenses/widget.config.ts`
- Create: `apps/web/widgets/internal/work-order-expenses/index.tsx`
- Create: `apps/api/src/triggers/work-order-rollup/trigger.config.ts`
- Create: `apps/api/src/triggers/work-order-rollup/index.ts`
- Modify: `apps/web/widgets/internal/registry.ts`
- Modify: `apps/api/src/triggers/registry.ts`
- Modify: `packages/triggers/src/index.ts`

- [ ] **Step 1: Create time-entries widget (user-scoped)**

Create `apps/web/widgets/internal/time-entries/widget.config.ts`:

```typescript
import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'time-entries',
  name: 'Time Entries',
  description: 'Hours logged against this work order (scoped per user for techs)',
  icon: 'Clock',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
```

Create `apps/web/widgets/internal/time-entries/index.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { recordsService } from '@/lib/records-service'
import { useAuth } from '@/lib/auth' // adapt to the project's actual auth hook
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TimeEntry {
  id: string
  data: {
    workOrder: string
    technician: string
    date: string
    workHours?: number
    travelHours?: number
    prepHours?: number
    miscHours?: number
    totalHours?: number
    rateAtEntry?: number
    totalCost?: number
    notes?: string
  }
}

interface Props { recordId: string }

export default function TimeEntriesWidget({ recordId }: Props) {
  const { user, isManager } = useAuth() // isManager: boolean — derive from user profile role
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [techNames, setTechNames] = useState<Record<string, string>>({})
  const [myTechId, setMyTechId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ workHours: '', travelHours: '', prepHours: '', miscHours: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [wo, setWo] = useState<any>(null)

  async function reload() {
    setLoading(true)
    const [woRec, all, allTechs] = await Promise.all([
      recordsService.getRecord('WorkOrder', recordId),
      recordsService.getRecords('TimeEntry'),
      recordsService.getRecords('Technician'),
    ])
    setWo(woRec)
    const mine = (all as TimeEntry[]).filter(e => e.data.workOrder === recordId)
    const filtered = isManager ? mine : mine.filter(e => {
      const tech = (allTechs as any[]).find(t => t.id === e.data.technician)
      return tech?.data?.user === user?.id
    })
    const myTech = (allTechs as any[]).find(t => t.data?.user === user?.id)
    setMyTechId(myTech?.id || null)
    setEntries(filtered)

    const map: Record<string, string> = {}
    for (const t of (allTechs as any[])) map[t.id] = t.data?.technicianName || ''
    setTechNames(map)
    setLoading(false)
  }

  const completedAt = wo?.data?.completedDate ? new Date(wo.data.completedDate).getTime() : null
  const within24h = completedAt ? (Date.now() - completedAt) < 24 * 60 * 60 * 1000 : true
  const canEditForTech = isManager || within24h

  async function addEntry() {
    if (!myTechId) return
    await recordsService.createRecord('TimeEntry', {
      workOrder: recordId,
      technician: myTechId,
      date: new Date().toISOString().split('T')[0],
      workHours: Number(form.workHours) || 0,
      travelHours: Number(form.travelHours) || 0,
      prepHours: Number(form.prepHours) || 0,
      miscHours: Number(form.miscHours) || 0,
      notes: form.notes,
    })
    setForm({ workHours: '', travelHours: '', prepHours: '', miscHours: '', notes: '' })
    setAdding(false)
    reload()
  }

  useEffect(() => { reload() }, [recordId])
  if (loading) return <div className="p-4 text-sm text-gray-500">Loading…</div>

  const canLog = isManager || (myTechId && canEditForTech && wo?.data?.workOrderStatus !== 'Closed')

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Time Entries</h3>
        {canLog && <Button size="sm" onClick={() => setAdding(true)}>+ Log Hours</Button>}
      </div>

      {adding && (
        <div className="mb-3 p-3 border rounded grid grid-cols-4 gap-2">
          <Input placeholder="Work" value={form.workHours} onChange={e => setForm(f => ({ ...f, workHours: e.target.value }))} />
          <Input placeholder="Travel" value={form.travelHours} onChange={e => setForm(f => ({ ...f, travelHours: e.target.value }))} />
          <Input placeholder="Prep" value={form.prepHours} onChange={e => setForm(f => ({ ...f, prepHours: e.target.value }))} />
          <Input placeholder="Misc" value={form.miscHours} onChange={e => setForm(f => ({ ...f, miscHours: e.target.value }))} />
          <Input className="col-span-3" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="space-x-2">
            <Button size="sm" onClick={addEntry}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No time entries {isManager ? '' : 'from you '}yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b">
            <th className="py-2">Date</th><th>Tech</th><th>Work</th><th>Travel</th><th>Prep</th><th>Misc</th><th>Total</th><th>Rate</th><th>Cost</th>
          </tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b">
                <td className="py-2">{e.data.date}</td>
                <td>{techNames[e.data.technician] || '—'}</td>
                <td>{e.data.workHours || 0}</td>
                <td>{e.data.travelHours || 0}</td>
                <td>{e.data.prepHours || 0}</td>
                <td>{e.data.miscHours || 0}</td>
                <td className="font-medium">{e.data.totalHours || 0}</td>
                <td>${e.data.rateAtEntry || 0}</td>
                <td className="font-medium">${e.data.totalCost || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

Adapt `useAuth` import to the project's actual auth hook. `isManager` must be a boolean derived from the user's profile.

- [ ] **Step 2: Create work-order-expenses widget (same user-scoping pattern)**

Create `apps/web/widgets/internal/work-order-expenses/widget.config.ts`:

```typescript
import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'work-order-expenses',
  name: 'Work Order Expenses',
  description: 'Expenses logged against this work order (scoped per user for techs)',
  icon: 'Receipt',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
```

Create `apps/web/widgets/internal/work-order-expenses/index.tsx`. Follow the same structure as time-entries (user-scoping for techs, manager sees all), with these differences:
- Fields: date, expenseType (picklist), amount, quantity, rate, description
- No rate snapshot trigger — user enters `amount` directly
- Expense types: Per Diem / Mileage / Materials / Equipment / Other

Use the same `useAuth` / `isManager` / `within24h` gating. Adapt the add-form for expense fields.

- [ ] **Step 3: Create work-order-rollup trigger config**

Create `apps/api/src/triggers/work-order-rollup/trigger.config.ts`:

```typescript
import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'work-order-rollup',
  name: 'Work Order Cost Roll-ups',
  description: 'Recalculates totalActualHours, totalLaborCost, totalExpenses, totalJobCost on parent WO',
  icon: 'Calculator',
  objectApiName: 'TimeEntry',
  events: ['afterCreate', 'afterUpdate', 'afterDelete'],
}
```

Note: this config targets TimeEntry. Register a **second** registration entry pointing to WorkOrderExpense using the same handler (see Step 5).

- [ ] **Step 4: Create work-order-rollup handler**

Create `apps/api/src/triggers/work-order-rollup/index.ts`:

```typescript
import { prisma } from '@crm/db/client'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordData, beforeData } = ctx
    const woId = (recordData?.workOrder || beforeData?.workOrder) as string | undefined
    if (!woId) return null

    const timeEntries = await prisma.record.findMany({
      where: { data: { path: ['workOrder'], equals: woId } },
    })
    const timeEntryObj = await prisma.customObject.findFirst({ where: { apiName: 'TimeEntry' } })
    const expenseObj = await prisma.customObject.findFirst({ where: { apiName: 'WorkOrderExpense' } })
    if (!timeEntryObj || !expenseObj) return null

    let totalHours = 0, totalLaborCost = 0
    for (const e of timeEntries.filter(r => r.objectId === timeEntryObj.id)) {
      const d = e.data as Record<string, any>
      totalHours += Number(d.totalHours) || 0
      totalLaborCost += Number(d.totalCost) || 0
    }

    let totalExpenses = 0
    for (const e of timeEntries.filter(r => r.objectId === expenseObj.id)) {
      const d = e.data as Record<string, any>
      totalExpenses += Number(d.amount) || 0
    }

    const totalJobCost = totalLaborCost + totalExpenses

    await prisma.record.update({
      where: { id: woId },
      data: {
        data: {
          ...((await prisma.record.findUnique({ where: { id: woId } }))?.data as object || {}),
          totalActualHours: totalHours,
          totalLaborCost,
          totalExpenses,
          totalJobCost,
        },
      },
    })

    return null
  } catch (err) {
    console.error('[work-order-rollup] Trigger failed:', err)
    return null
  }
}
```

- [ ] **Step 5: Register trigger for BOTH TimeEntry AND WorkOrderExpense**

In `apps/api/src/triggers/registry.ts`, register the handler against both object api names. If the manifest only supports one `objectApiName`, add a second manifest copy with `objectApiName: 'WorkOrderExpense'`:

```typescript
import { config as rollupConfig } from './work-order-rollup/trigger.config.js'
import { handler as rollupHandler } from './work-order-rollup/index.js'

const rollupConfigExpense = { ...rollupConfig, id: 'work-order-rollup-expense', objectApiName: 'WorkOrderExpense' }

// Add both registrations:
  { manifest: rollupConfig, handler: rollupHandler },
  { manifest: rollupConfigExpense, handler: rollupHandler },
```

In `packages/triggers/src/index.ts`, add both IDs to `TRIGGER_IDS`:

```typescript
  'work-order-rollup',
  'work-order-rollup-expense',
```

- [ ] **Step 6: Register both widgets**

In `apps/web/widgets/internal/registry.ts`, add at the top:

```typescript
import { config as timeEntriesConfig } from './time-entries/widget.config'
import TimeEntriesWidget from './time-entries'
import { config as expensesConfig } from './work-order-expenses/widget.config'
import WorkOrderExpensesWidget from './work-order-expenses'
```

Add to the registrations array:

```typescript
  { manifest: timeEntriesConfig, Component: TimeEntriesWidget },
  { manifest: expensesConfig, Component: WorkOrderExpensesWidget },
```

Adapt the registration shape to match the existing pattern in `registry.ts` exactly.

- [ ] **Step 7: Verify**

- Add 2 time entries to a WO → verify WO.totalActualHours and WO.totalLaborCost update
- Add an expense → verify totalExpenses + totalJobCost update
- Delete a time entry → verify rollups decrement
- Log in as a tech → verify you see only your own entries; log in as manager → see all

- [ ] **Step 8: Commit**

```bash
git add apps/web/widgets/internal/time-entries/ apps/web/widgets/internal/work-order-expenses/ apps/api/src/triggers/work-order-rollup/ apps/web/widgets/internal/registry.ts apps/api/src/triggers/registry.ts packages/triggers/src/index.ts
git commit -m "feat(service): time/expense widgets (user-scoped) + rollup trigger"
```

---

### Task 9: WorkOrder Detail integration — path bar, reason modal wiring, layout

**Files:**
- Modify: `apps/web/app/workorders/[id]/page.tsx` (or whatever the WO detail page path is — verify first)

- [ ] **Step 1: Locate the actual WO detail page file**

Run: `find apps/web/app -name 'page.tsx' | xargs grep -l -i 'workorder' | head`
Expected: one or two matches, likely `apps/web/app/workorders/[id]/page.tsx` or a generic record detail page.

If WorkOrder uses the generic `RecordDetailPage`, no dedicated file exists and the integration is done by placing widgets via the page-layout admin UI. In that case, skip directly to Step 4.

- [ ] **Step 2: Add reason-modal wiring to WO detail**

Where the WO detail page handles status changes (inside a Path widget callback or a custom status control), intercept the transition:

```typescript
'use client'
import { useState } from 'react'
import { WorkOrderReasonModal, type ReasonModalMode } from '@/components/work-order-reason-modal'
import { recordsService } from '@/lib/records-service'

// Inside the WO detail component:
const [modalMode, setModalMode] = useState<ReasonModalMode | null>(null)
const [pendingStatus, setPendingStatus] = useState<string | null>(null)

async function handleStatusChange(newStatus: string) {
  if (newStatus === 'On Hold') { setPendingStatus(newStatus); setModalMode('hold'); return }
  if (newStatus === 'Cancelled') { setPendingStatus(newStatus); setModalMode('cancel'); return }
  await recordsService.updateRecord('WorkOrder', recordId, { workOrderStatus: newStatus })
}

async function confirmWithReason(reason: string, notes: string) {
  if (!pendingStatus) return
  const payload: Record<string, any> = { workOrderStatus: pendingStatus }
  if (modalMode === 'hold') { payload.holdReason = reason; payload.holdNotes = notes }
  if (modalMode === 'cancel') { payload.cancelReason = reason; payload.cancelNotes = notes }
  await recordsService.updateRecord('WorkOrder', recordId, payload)
  setModalMode(null); setPendingStatus(null)
}

// In JSX:
<WorkOrderReasonModal
  open={modalMode !== null}
  mode={modalMode || 'hold'}
  onConfirm={confirmWithReason}
  onCancel={() => { setModalMode(null); setPendingStatus(null) }}
/>
```

Wire `handleStatusChange` into whatever status-change UI the page has. If the existing `path` widget exposes an `onAdvance` / `onChange` callback, use it. If not, modify the path widget to accept a callback prop.

- [ ] **Step 3: Add the existing `file-folder` widget + new widgets to WO page layout**

Via the CRM's Object Manager → WorkOrder → Page Layout, add to the layout:
- `path` widget (configured for `workOrderStatus` field)
- `file-folder` widget (Dropbox integration)
- `work-order-assignments` tab
- `punch-list` tab
- `time-entries` tab
- `work-order-expenses` tab
- `activity-feed` widget (existing — shows status transitions with reasons)

This is a config step, not a code change, if the layout system is admin-driven.

- [ ] **Step 4: Verify end-to-end**

Open a WO. Tap path bar → In Progress → modal does NOT appear. Tap → On Hold → modal DOES appear; pick reason + notes → save → status = On Hold, holdReason/holdNotes persisted. Tap → In Progress (resume) → no modal. Tap → Completed → no modal; completedDate stamped. Manager taps → Closed → no modal; closedDate stamped. Try invalid jump (In Progress → Closed): reverts.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/workorders/
git commit -m "feat(service): wire reason modal into WO detail status transitions"
```

---

### Task 10: Tech Dashboard page (mobile-first)

**Files:**
- Create: `apps/web/app/tech-dashboard/page.tsx`
- Modify: `apps/web/app/app-wrapper.tsx` (add nav entry)

- [ ] **Step 1: Fetch Next.js App Router docs via Context7**

Use Context7: `resolve-library-id` for "Next.js", then `get-library-docs` focused on client components, data fetching in Server Components, and `useAuth` patterns. Apply these.

- [ ] **Step 2: Create Tech Dashboard page**

Create `apps/web/app/tech-dashboard/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { recordsService } from '@/lib/records-service'
import { useAuth } from '@/lib/auth'

interface WO { id: string; data: any }
interface Tech { id: string; data: any }

export default function TechDashboardPage() {
  const { user } = useAuth()
  const [today, setToday] = useState<WO[]>([])
  const [upcoming, setUpcoming] = useState<WO[]>([])
  const [pendingReview, setPendingReview] = useState<WO[]>([])
  const [missingHours, setMissingHours] = useState<WO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      if (!user) return
      const techs = await recordsService.getRecords('Technician') as Tech[]
      const me = techs.find(t => t.data?.user === user.id)
      if (!me) { setLoading(false); return }

      const assignments = (await recordsService.getRecords('WorkOrderAssignment') as any[])
        .filter(a => a.data?.technician === me.id)

      const woIds = [...new Set(assignments.map(a => a.data.workOrder as string))]
      const wos = (await Promise.all(woIds.map(id => recordsService.getRecord('WorkOrder', id) as Promise<WO | null>)))
        .filter(Boolean) as WO[]

      const todayStr = new Date().toISOString().split('T')[0]
      const in14Days = new Date(); in14Days.setDate(in14Days.getDate() + 14)

      const todayList: WO[] = []
      const upcomingList: WO[] = []
      const pendingList: WO[] = []

      for (const w of wos) {
        const start = w.data?.scheduledStartDate
        const status = w.data?.workOrderStatus
        const startDate = start ? new Date(start) : null

        if (status === 'Completed' && w.data?.completedDate) {
          const hrsAgo = (Date.now() - new Date(w.data.completedDate).getTime()) / 3600000
          if (hrsAgo < 24) pendingList.push(w)
        }
        if (startDate && startDate.toISOString().split('T')[0] === todayStr && status !== 'Closed' && status !== 'Cancelled') {
          todayList.push(w)
        } else if (startDate && startDate > new Date() && startDate <= in14Days && status !== 'Closed' && status !== 'Cancelled') {
          upcomingList.push(w)
        }
      }

      const timeEntries = (await recordsService.getRecords('TimeEntry') as any[])
        .filter(e => e.data?.technician === me.id)
      const woIdsWithMyEntries = new Set(timeEntries.map(e => e.data.workOrder))
      const missingList = wos.filter(w =>
        w.data?.workOrderStatus === 'Completed' && !woIdsWithMyEntries.has(w.id)
      )

      setToday(todayList); setUpcoming(upcomingList); setPendingReview(pendingList); setMissingHours(missingList)
      setLoading(false)
    })()
  }, [user])

  if (loading) return <div className="p-4">Loading…</div>

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">My Work</h1>

      <Section title="Today" items={today} empty="Nothing scheduled for today." />
      <Section title="Upcoming (next 14 days)" items={upcoming} empty="No upcoming work." />
      <Section title="Pending Review (24-hr edit window)" items={pendingReview} empty="Nothing pending." />
      <Section title="⚠ Missing Hours" items={missingHours} empty="All hours logged." />
    </div>
  )
}

function Section({ title, items, empty }: { title: string; items: any[]; empty: string }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map(w => (
            <li key={w.id} className="border rounded p-3 shadow-sm">
              <div className="flex justify-between">
                <span className="font-medium">{w.data?.name || w.id}</span>
                <span className="text-xs px-2 py-1 rounded bg-gray-100">{w.data?.workOrderStatus}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">{w.data?.scheduledStartDate || '—'}</div>
              <div className="mt-2 space-x-2">
                <Link href={`/workorders/${w.id}`} className="text-sm text-blue-600">Open WO</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Add mobile-first styles**

Verify the layout responsive on a narrow viewport (375px wide). Cards stack, text wraps, tap targets are ≥44px. If any element overflows, constrain with Tailwind utilities (`max-w-full`, `truncate`, `break-words`).

- [ ] **Step 4: Add to navigation**

In `apps/web/app/app-wrapper.tsx`, add to `hrefToObjectMap`:

```typescript
'/tech-dashboard': 'WorkOrder',
```

Add a nav item linking to `/tech-dashboard` (follow the existing nav item pattern in the wrapper).

- [ ] **Step 5: Verify**

Log in as a user linked to a Technician record. Open `/tech-dashboard` on a phone (or dev tools mobile emulation at 375×812). Sections show correct counts. Tap "Open WO" → navigates.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/tech-dashboard/ apps/web/app/app-wrapper.tsx
git commit -m "feat(service): add mobile-first Tech Dashboard page"
```

---

### Task 11: Merged Schedule page — calendar + unassigned pool + drag-drop

**Files:**
- Create: `apps/web/app/schedule/page.tsx`
- Create: `apps/web/app/schedule/calendar-grid.tsx`
- Create: `apps/web/app/schedule/unassigned-pool.tsx`
- Modify: `apps/web/app/app-wrapper.tsx`

- [ ] **Step 1: Fetch @dnd-kit docs via Context7**

Use Context7: `resolve-library-id` for "@dnd-kit", then `get-library-docs` focused on `DndContext`, `useDraggable`, `useDroppable`, and drag overlays. Apply.

- [ ] **Step 2: Verify @dnd-kit is installed**

Run: `cat apps/web/package.json | grep dnd-kit`

If not present, add it: `cd apps/web && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 3: Create the unassigned pool component**

Create `apps/web/app/schedule/unassigned-pool.tsx`:

```typescript
'use client'

import { useDraggable } from '@dnd-kit/core'

export function UnassignedWoCard({ wo }: { wo: any }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: wo.id, data: { wo } })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="p-2 border rounded bg-white shadow-sm cursor-grab text-sm">
      <div className="font-medium">{wo.data?.name || wo.id}</div>
      <div className="text-xs text-gray-500">{wo.data?.workOrderStatus}</div>
    </div>
  )
}
```

- [ ] **Step 4: Create the calendar grid with droppable cells**

Create `apps/web/app/schedule/calendar-grid.tsx`:

```typescript
'use client'

import { useDroppable } from '@dnd-kit/core'

const STATUS_COLORS: Record<string, string> = {
  'Open': 'bg-gray-100 border-gray-400',
  'Scheduled': 'bg-blue-100 border-blue-400',
  'In Progress': 'bg-green-100 border-green-400',
  'On Hold': 'bg-yellow-100 border-yellow-400',
  'Completed': 'bg-purple-100 border-purple-400',
  'Closed': 'bg-gray-200 border-gray-500',
  'Cancelled': 'bg-red-100 border-red-400',
}

export function CalendarCell({ techId, date, wos }: { techId: string; date: string; wos: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${techId}__${date}`, data: { techId, date } })
  return (
    <td ref={setNodeRef} className={`p-1 border align-top min-h-16 ${isOver ? 'bg-blue-50' : ''}`}>
      {wos.map(w => (
        <div key={w.id} className={`text-xs p-1 mb-1 rounded border ${STATUS_COLORS[w.data?.workOrderStatus] || 'bg-gray-100'}`}>
          <a href={`/workorders/${w.id}`} className="hover:underline">{w.data?.name || w.id}</a>
          {w.data?.workOrderCategory === 'Internal' && <span className="ml-1 text-[10px] uppercase">INT</span>}
        </div>
      ))}
    </td>
  )
}

export function CalendarGrid({ techs, days, assignments, workOrders }: {
  techs: any[]; days: string[]; assignments: any[]; workOrders: Record<string, any>;
}) {
  return (
    <table className="w-full border-collapse">
      <thead><tr>
        <th className="p-2 border bg-gray-50 text-left">Tech</th>
        {days.map(d => <th key={d} className="p-2 border bg-gray-50 text-xs">{d}</th>)}
      </tr></thead>
      <tbody>
        {techs.map(tech => (
          <tr key={tech.id}>
            <td className="p-2 border font-medium text-sm">{tech.data?.technicianName} ({tech.data?.techCode})</td>
            {days.map(d => {
              const cellWos = assignments
                .filter(a => a.data?.technician === tech.id)
                .map(a => workOrders[a.data.workOrder])
                .filter(w => w && w.data?.scheduledStartDate?.startsWith(d))
              return <CalendarCell key={d} techId={tech.id} date={d} wos={cellWos} />
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 5: Create the merged Schedule page**

Create `apps/web/app/schedule/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { recordsService } from '@/lib/records-service'
import { CalendarGrid } from './calendar-grid'
import { UnassignedWoCard } from './unassigned-pool'
import { Button } from '@/components/ui/button'

function weekDays(start = new Date()) {
  const days: string[] = []
  const s = new Date(start); s.setDate(s.getDate() - s.getDay()) // Sunday
  for (let i = 0; i < 7; i++) { const d = new Date(s); d.setDate(s.getDate() + i); days.push(d.toISOString().split('T')[0]) }
  return days
}

export default function SchedulePage() {
  const [techs, setTechs] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<Record<string, any>>({})
  const [unassigned, setUnassigned] = useState<any[]>([])
  const [weekStart, setWeekStart] = useState(new Date())
  const days = weekDays(weekStart)

  async function reload() {
    const [allTechs, allAssignments, allWos] = await Promise.all([
      recordsService.getRecords('Technician'),
      recordsService.getRecords('WorkOrderAssignment'),
      recordsService.getRecords('WorkOrder'),
    ])
    setTechs((allTechs as any[]).filter(t => t.data?.active !== false && (t.data?.departmentTags || []).includes('Service')))
    setAssignments(allAssignments as any[])
    const woMap: Record<string, any> = {}
    for (const w of allWos as any[]) woMap[w.id] = w
    setWorkOrders(woMap)

    const assignedWoIds = new Set((allAssignments as any[]).map(a => a.data?.workOrder))
    setUnassigned((allWos as any[]).filter(w =>
      !assignedWoIds.has(w.id) && (w.data?.workOrderStatus === 'Open' || w.data?.workOrderStatus === 'Scheduled')
    ))
  }

  async function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return
    const { techId, date } = e.over.data.current as { techId: string; date: string }
    const woId = e.active.id as string
    await recordsService.createRecord('WorkOrderAssignment', {
      workOrder: woId,
      technician: techId,
      isLead: true,
    })
    await recordsService.updateRecord('WorkOrder', woId, {
      scheduledStartDate: `${date}T08:00:00`,
      workOrderStatus: 'Scheduled',
      leadTech: techId,
    })
    reload()
  }

  useEffect(() => { reload() }, [])

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-4">
        <aside className="w-64 shrink-0 border-r pr-4">
          <h2 className="font-semibold mb-2">Unassigned</h2>
          <div className="space-y-2">
            {unassigned.length === 0 ? (
              <p className="text-sm text-gray-500">All WOs are assigned.</p>
            ) : unassigned.map(w => <UnassignedWoCard key={w.id} wo={w} />)}
          </div>
        </aside>
        <main className="flex-1 overflow-x-auto">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold">Schedule</h1>
            <div className="space-x-2">
              <Button size="sm" variant="outline" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}>← Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setWeekStart(new Date())}>This week</Button>
              <Button size="sm" variant="outline" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}>Next →</Button>
            </div>
          </div>
          <CalendarGrid techs={techs} days={days} assignments={assignments} workOrders={workOrders} />
        </main>
      </div>
    </DndContext>
  )
}
```

- [ ] **Step 6: Add to navigation**

In `apps/web/app/app-wrapper.tsx`, add `'/schedule': 'WorkOrder'` to `hrefToObjectMap` and a nav item.

- [ ] **Step 7: Verify**

Create 4 unassigned WOs. Open Schedule. Verify they appear in the left pool. Drag one onto a tech's Wed cell → the WO moves into the grid at Wednesday, unassigned pool loses it, status becomes Scheduled, leadTech set.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/schedule/ apps/web/app/app-wrapper.tsx
git commit -m "feat(service): merged Schedule page with unassigned pool + drag-drop"
```

---

### Task 12: Cost Dashboard page

**Files:**
- Create: `apps/web/app/cost-dashboard/page.tsx`
- Modify: `apps/web/app/app-wrapper.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/app/cost-dashboard/page.tsx`:

```typescript
'use client'

import { useEffect, useMemo, useState } from 'react'
import { recordsService } from '@/lib/records-service'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function CostDashboardPage() {
  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date(); monthStart.setDate(1)
  const [from, setFrom] = useState(monthStart.toISOString().split('T')[0])
  const [to, setTo] = useState(today)
  const [entries, setEntries] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [techs, setTechs] = useState<Record<string, any>>({})
  const [wos, setWos] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => {
    setLoading(true)
    const [allEntries, allExpenses, allTechs, allWos] = await Promise.all([
      recordsService.getRecords('TimeEntry'),
      recordsService.getRecords('WorkOrderExpense'),
      recordsService.getRecords('Technician'),
      recordsService.getRecords('WorkOrder'),
    ])
    setEntries((allEntries as any[]).filter(e => e.data?.date >= from && e.data?.date <= to))
    setExpenses((allExpenses as any[]).filter(e => e.data?.date >= from && e.data?.date <= to))
    const tmap: Record<string, any> = {}; for (const t of allTechs as any[]) tmap[t.id] = t; setTechs(tmap)
    const wmap: Record<string, any> = {}; for (const w of allWos as any[]) wmap[w.id] = w; setWos(wmap)
    setLoading(false)
  })() }, [from, to])

  const perTech = useMemo(() => {
    const map: Record<string, { hours: number; labor: number; expenses: number }> = {}
    for (const e of entries) {
      const tid = e.data?.technician
      if (!map[tid]) map[tid] = { hours: 0, labor: 0, expenses: 0 }
      map[tid].hours += Number(e.data?.totalHours) || 0
      map[tid].labor += Number(e.data?.totalCost) || 0
    }
    for (const x of expenses) {
      const tid = x.data?.technician
      if (tid) { if (!map[tid]) map[tid] = { hours: 0, labor: 0, expenses: 0 }; map[tid].expenses += Number(x.data?.amount) || 0 }
    }
    return map
  }, [entries, expenses])

  const perWo = useMemo(() => {
    const map: Record<string, { labor: number; expenses: number }> = {}
    for (const e of entries) {
      const w = e.data?.workOrder
      if (!map[w]) map[w] = { labor: 0, expenses: 0 }
      map[w].labor += Number(e.data?.totalCost) || 0
    }
    for (const x of expenses) {
      const w = x.data?.workOrder
      if (!map[w]) map[w] = { labor: 0, expenses: 0 }
      map[w].expenses += Number(x.data?.amount) || 0
    }
    return map
  }, [entries, expenses])

  const totalLabor = Object.values(perTech).reduce((s, r) => s + r.labor, 0)
  const totalExpenses = Object.values(perTech).reduce((s, r) => s + r.expenses, 0)

  if (loading) return <div className="p-4">Loading…</div>

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Cost Dashboard</h1>
      <div className="flex gap-2 items-end">
        <div><label className="text-xs">From</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="text-xs">To</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card label="Total Labor"  value={`$${totalLabor.toFixed(2)}`} />
        <Card label="Total Expenses" value={`$${totalExpenses.toFixed(2)}`} />
        <Card label="Total Job Cost" value={`$${(totalLabor + totalExpenses).toFixed(2)}`} />
      </div>

      <section>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">By Technician</h2>
          <Button size="sm" variant="outline" onClick={() => exportCsv('by-tech.csv',
            ['Tech', 'Hours', 'Labor', 'Expenses', 'Total'],
            Object.entries(perTech).map(([tid, r]) => [
              techs[tid]?.data?.technicianName || tid,
              String(r.hours),
              String(r.labor),
              String(r.expenses),
              String(r.labor + r.expenses),
            ]),
          )}>Export CSV</Button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th>Tech</th><th>Hours</th><th>Labor</th><th>Expenses</th><th>Total</th></tr></thead>
          <tbody>
            {Object.entries(perTech).map(([tid, r]) => (
              <tr key={tid} className="border-b">
                <td>{techs[tid]?.data?.technicianName || tid}</td>
                <td>{r.hours}</td>
                <td>${r.labor.toFixed(2)}</td>
                <td>${r.expenses.toFixed(2)}</td>
                <td>${(r.labor + r.expenses).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-semibold mb-2">By Work Order</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th>WO</th><th>Status</th><th>Labor</th><th>Expenses</th><th>Total</th></tr></thead>
          <tbody>
            {Object.entries(perWo).map(([wid, r]) => {
              const w = wos[wid]
              return (
                <tr key={wid} className="border-b">
                  <td>{w?.data?.name || wid}</td>
                  <td>{w?.data?.workOrderStatus || '—'}</td>
                  <td>${r.labor.toFixed(2)}</td>
                  <td>${r.expenses.toFixed(2)}</td>
                  <td>${(r.labor + r.expenses).toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
```

- [ ] **Step 2: Add to navigation**

`'/cost-dashboard': 'WorkOrder'` in `hrefToObjectMap`, and a nav link.

- [ ] **Step 3: Verify**

With data from previous tasks, open Cost Dashboard. Verify the month-to-date totals. Change date range. Export CSV and confirm file downloads with correct contents.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/cost-dashboard/ apps/web/app/app-wrapper.tsx
git commit -m "feat(service): add Cost Dashboard with per-tech/per-WO tables + CSV export"
```

---

### Task 13: Service department + profiles with walled-garden defaults

**Files:**
- Modify: `apps/api/src/ensure-core-objects.ts` (seed department + profiles with defaults)

- [ ] **Step 1: Locate the profile permission schema**

Search for how existing profiles structure their `permissions` JSON. Grep:

```bash
grep -r 'permissions' apps/api/src --include '*.ts' | grep -i profile | head
```

Read one existing profile's permissions JSON (e.g., via Prisma Studio or a DB query) to understand the shape: `{ objectPermissions: {...}, fieldPermissions: {...}, appPermissions: {...} }` or similar.

- [ ] **Step 2: Seed Service department + both profiles at the end of ensure-core-objects**

At the end of `ensureCoreObjects()` (after the property seeds from Task 2), add:

```typescript
  // --- Service department + profile seeding ---
  const serviceDept = await prisma.department.findFirst({ where: { name: { equals: 'Service', mode: 'insensitive' } } })
    ?? await prisma.department.create({
      data: { id: generateId('Department'), name: 'Service', description: 'Service Department', createdById: systemUser.id, modifiedById: systemUser.id },
    })

  // Service Manager: full access to service objects
  const managerPermissions = {
    objectPermissions: {
      WorkOrder:            { read: true, create: true, edit: true, delete: true },
      WorkOrderAssignment:  { read: true, create: true, edit: true, delete: true },
      PunchListItem:        { read: true, create: true, edit: true, delete: true },
      TimeEntry:            { read: true, create: true, edit: true, delete: true },
      WorkOrderExpense:     { read: true, create: true, edit: true, delete: true },
      Technician:           { read: true, create: true, edit: true, delete: true },
      TechnicianRateHistory:{ read: true, create: false, edit: false, delete: false },
      Property:             { read: true, create: true, edit: true, delete: false },
    },
    appPermissions: {
      '/tech-dashboard':   false,
      '/schedule':         true,
      '/cost-dashboard':   true,
      '/workorders':       true,
    },
  }

  // Service Technician: walled garden — see only WOs assigned, own time/expenses, all punch list items
  const techPermissions = {
    objectPermissions: {
      WorkOrder:            { read: 'ownAssignments', create: false, edit: 'ownAssignments', delete: false },
      WorkOrderAssignment:  { read: 'ownTech', create: false, edit: false, delete: false },
      PunchListItem:        { read: 'viaWorkOrder', create: true, edit: true, delete: false },
      TimeEntry:            { read: 'ownTech', create: 'ownTech', edit: 'ownTechWithin24h', delete: false },
      WorkOrderExpense:     { read: 'ownTech', create: 'ownTech', edit: 'ownTechWithin24h', delete: false },
      Technician:           { read: 'sameAssignedWos', create: false, edit: false, delete: false },
      Property:             { read: 'viaWorkOrder', create: false, edit: false, delete: false },
      // Everything else: hidden by default (no entry = no access)
    },
    appPermissions: {
      '/tech-dashboard':   true,
      '/schedule':         false,
      '/cost-dashboard':   false,
      '/workorders':       true, // filtered to own assignments
    },
  }

  const managerProfile = await prisma.profile.findFirst({ where: { name: { equals: 'Service Manager', mode: 'insensitive' } } })
  if (!managerProfile) {
    await prisma.profile.create({
      data: {
        id: generateId('Profile'),
        name: 'Service Manager',
        description: 'Full access to service module objects and features',
        permissions: JSON.stringify(managerPermissions),
        createdById: systemUser.id,
        modifiedById: systemUser.id,
      },
    })
    console.log('[ensure-core-objects] Created Service Manager profile')
  }

  const techProfile = await prisma.profile.findFirst({ where: { name: { equals: 'Service Technician', mode: 'insensitive' } } })
  if (!techProfile) {
    await prisma.profile.create({
      data: {
        id: generateId('Profile'),
        name: 'Service Technician',
        description: 'Walled garden — see only your own assigned work orders',
        permissions: JSON.stringify(techPermissions),
        createdById: systemUser.id,
        modifiedById: systemUser.id,
      },
    })
    console.log('[ensure-core-objects] Created Service Technician profile')
  }
```

Note: the string values `'ownAssignments'`, `'ownTech'`, `'viaWorkOrder'`, `'ownTechWithin24h'`, `'sameAssignedWos'` are **permission tokens** that the permission layer must interpret. If the project's permission system does not support these predicates, either (a) extend the `canAccess()` helper to handle them, or (b) enforce client-side filtering in each widget (time/expense widgets already do this in Task 8) and only set basic CRUD booleans here. Pick the approach that matches the project's existing permission conventions — document your choice in the commit message.

- [ ] **Step 3: Verify**

Restart API. Settings → Departments: "Service" appears. Settings → Profiles: both profiles appear. Assign a user to Service Technician; log in; verify walled garden: cannot see WOs they're not assigned to, cannot see time entries from other techs, can see all punch list items on assigned WOs.

Assign another user to Service Manager; log in; verify full access.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ensure-core-objects.ts
git commit -m "feat(service): seed Service dept + Manager/Technician profiles with walled-garden defaults"
```

---

## Dependency Graph

```
Task 1 (Technician + prefix)
  │
  v
Task 2 (WorkOrder + 5 child objects + Tischler seeds + prefixes)
  │
  ├──> Task 3 (Rate triggers)
  ├──> Task 4 (WO lifecycle trigger)
  ├──> Task 5 (Reason modal component)
  │      │
  │      v
  │    Task 9 (WO Detail integration — requires Tasks 4, 5, 6, 7, 8)
  ├──> Task 6 (Assignment widget)
  │      │
  │      ├──> Task 10 (Tech Dashboard)
  │      ├──> Task 11 (Schedule page)
  ├──> Task 7 (Punch List widget + PDF)
  ├──> Task 8 (Time/Expense widgets + rollup trigger)
  │      │
  │      └──> Task 12 (Cost Dashboard)
  └──> Task 13 (Profiles — runs last)
```

Tasks 3–8 can run in parallel after Task 2. Task 9 is the integration point — requires Tasks 4, 5, 6, 7, 8. Tasks 10–12 can parallelize after their dependencies. Task 13 runs last so all objects exist for permission targeting.

---

## Deferred (out of scope — future plans)

1. **Notification triggers** — Tech Assigned email, Schedule Reminder (24hrs before), WO → Completed manager alert, Hours Missing reminder. Add once email infra is confirmed.
2. **Customer touchpoints** — signature capture on Surface Tablet, invoice emails, "tech on the way" notifications.
3. **Property-level maintenance / warranty tracking** + renewal reminders.
4. **Salesforce data migration** — Michael leads separately.
5. **Structured Tool object** — revisit only if the free-text `toolsNeeded` proves insufficient.
6. **Work Order Summary PDF** — only Punch List PDF in this build.
