# Installation Object Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Installation cost-tracking data model (5 objects), a trigger that auto-creates weekly cost/expense child records, and a controller with API endpoints for grid data, CRUD, calculations, and technician management.

**Architecture:** Metadata-driven CRM where objects are defined in `ensure-core-objects.ts` and records stored as JSON in a single `Record` table. The trigger and controller use the Triggers & Controllers infrastructure (registries, manifests, engine). The trigger fires on Installation create/update to spawn child records. The controller provides Fastify routes for the cost grid UI (Phase 2).

**Tech Stack:** TypeScript, Fastify 5, Prisma 5 (PostgreSQL), pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-04-12-installation-object-phase1-design.md`

---

### Task 1: Add Technician and Installation child objects to ensure-core-objects.ts

**Files:**
- Modify: `apps/api/src/ensure-core-objects.ts`

- [ ] **Step 1: Add Technician object to CORE_OBJECTS array**

In `apps/api/src/ensure-core-objects.ts`, add the Technician object definition after the TeamMember object (after line 194, before the closing `];`):

```typescript
  {
    apiName: 'Technician',
    label: 'Technician',
    pluralLabel: 'Technicians',
    description: 'Installation technicians for cost analysis',
    fields: [
      { apiName: 'technicianName', label: 'Technician Name', type: 'Text', required: true },
      { apiName: 'hourlyRate', label: 'Hourly Rate', type: 'Currency', required: true },
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Active', 'Inactive'], defaultValue: 'Active' },
    ],
  },
```

- [ ] **Step 2: Extend Installation object with new fields**

In the existing Installation object definition (line 146-157), add the new fields to the `fields` array after the existing 5 fields:

```typescript
      // Core
      { apiName: 'startDate', label: 'Start Date', type: 'Date' },
      { apiName: 'endDate', label: 'End Date', type: 'Date' },
      { apiName: 'project', label: 'Project', type: 'Lookup' },
      { apiName: 'installationBudget', label: 'Installation Budget', type: 'Currency' },
      // Calculated (set by controller)
      { apiName: 'finalCost', label: 'Final Cost', type: 'Currency' },
      { apiName: 'finalProfit', label: 'Final Profit', type: 'Currency' },
      { apiName: 'techExpenseTotal', label: 'Tech Expense Total', type: 'Currency' },
      // Estimated costs (for variance reporting)
      { apiName: 'estimatedLaborCost', label: 'Estimated Labor Cost', type: 'Currency' },
      { apiName: 'estimatedHotel', label: 'Estimated Hotel', type: 'Currency' },
      { apiName: 'estimatedTravelExp', label: 'Estimated Travel Expense', type: 'Currency' },
      { apiName: 'estimatedMileage', label: 'Estimated Mileage', type: 'Currency' },
      { apiName: 'estimatedPerDiem', label: 'Estimated Per Diem', type: 'Currency' },
      { apiName: 'estimatedFlights', label: 'Estimated Flights', type: 'Currency' },
      { apiName: 'estimatedCarRental', label: 'Estimated Car Rental', type: 'Currency' },
      { apiName: 'estimatedParking', label: 'Estimated Parking', type: 'Currency' },
      { apiName: 'estimatedEquipment', label: 'Estimated Equipment', type: 'Currency' },
      { apiName: 'estimatedMiscellaneous', label: 'Estimated Miscellaneous', type: 'Currency' },
      { apiName: 'estimatedWaterproofing', label: 'Estimated Waterproofing', type: 'Currency' },
      { apiName: 'estimatedWoodBucks', label: 'Estimated Wood Bucks', type: 'Currency' },
      { apiName: 'estimatedAirportTransportation', label: 'Estimated Airport Transportation', type: 'Currency' },
      { apiName: 'estimatedMaterials', label: 'Estimated Materials', type: 'Currency' },
      { apiName: 'estimatedContainerUnload', label: 'Estimated Container Unload', type: 'Currency' },
```

- [ ] **Step 3: Add InstallationTechnician junction object**

Add after the Technician object in the CORE_OBJECTS array:

```typescript
  {
    apiName: 'InstallationTechnician',
    label: 'Installation Technician',
    pluralLabel: 'Installation Technicians',
    description: 'Junction linking technicians to installations with frozen hourly rate',
    fields: [
      { apiName: 'installation', label: 'Installation', type: 'Lookup', required: true },
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'assignedHourlyRate', label: 'Assigned Hourly Rate', type: 'Currency', required: true },
    ],
  },
```

- [ ] **Step 4: Add InstallationCost child object**

Add after InstallationTechnician:

```typescript
  {
    apiName: 'InstallationCost',
    label: 'Installation Cost',
    pluralLabel: 'Installation Costs',
    description: 'Weekly project-level cost records for an installation',
    fields: [
      { apiName: 'installation', label: 'Installation', type: 'Lookup', required: true },
      { apiName: 'weekNumber', label: 'Week Number', type: 'Number', required: true },
      { apiName: 'weekStartDate', label: 'Week Start Date', type: 'Date', required: true },
      { apiName: 'weekEndDate', label: 'Week End Date', type: 'Date', required: true },
      { apiName: 'flightsActual', label: 'Flights', type: 'Currency' },
      { apiName: 'lodgingActual', label: 'Lodging', type: 'Currency' },
      { apiName: 'carRental', label: 'Car Rental', type: 'Currency' },
      { apiName: 'airportTransportation', label: 'Airport Transportation', type: 'Currency' },
      { apiName: 'parking', label: 'Parking', type: 'Currency' },
      { apiName: 'equipment', label: 'Equipment', type: 'Currency' },
      { apiName: 'miscellaneousExpenses', label: 'Miscellaneous', type: 'Currency' },
      { apiName: 'waterproofing', label: 'Waterproofing', type: 'Currency' },
      { apiName: 'woodBucks', label: 'Wood Bucks', type: 'Currency' },
    ],
  },
```

- [ ] **Step 5: Add InstallationTechExpense child object**

Add after InstallationCost:

```typescript
  {
    apiName: 'InstallationTechExpense',
    label: 'Installation Tech Expense',
    pluralLabel: 'Installation Tech Expenses',
    description: 'Per-technician weekly labor hours and expenses',
    fields: [
      { apiName: 'installation', label: 'Installation', type: 'Lookup', required: true },
      { apiName: 'installationTechnician', label: 'Installation Technician', type: 'Lookup', required: true },
      { apiName: 'weekNumber', label: 'Week Number', type: 'Number', required: true },
      { apiName: 'weekStartDate', label: 'Week Start Date', type: 'Date', required: true },
      { apiName: 'weekEndDate', label: 'Week End Date', type: 'Date', required: true },
      // Labor hours
      { apiName: 'containerUnload', label: 'Container Unload', type: 'Number' },
      { apiName: 'woodbucks', label: 'Woodbucks', type: 'Number' },
      { apiName: 'waterproofing', label: 'Waterproofing', type: 'Number' },
      { apiName: 'installationLabor', label: 'Installation Labor', type: 'Number' },
      { apiName: 'travel', label: 'Travel', type: 'Number' },
      { apiName: 'waterTesting', label: 'Water Testing', type: 'Number' },
      { apiName: 'sills', label: 'Sills', type: 'Number' },
      { apiName: 'finishCaulking', label: 'Finish Caulking', type: 'Number' },
      { apiName: 'screenLutronShades', label: 'Screen/Lutron/Shades', type: 'Number' },
      { apiName: 'punchListWork', label: 'Punch List Work', type: 'Number' },
      { apiName: 'finishHardware', label: 'Finish Hardware', type: 'Number' },
      { apiName: 'finalAdjustments', label: 'Final Adjustments', type: 'Number' },
      // Expenses
      { apiName: 'perDiem', label: 'Per Diem', type: 'Currency' },
      { apiName: 'mileage', label: 'Mileage', type: 'Currency' },
      { apiName: 'materials', label: 'Materials', type: 'Currency' },
    ],
  },
```

- [ ] **Step 6: Add auto-number prefixes for new objects**

In the `autoNumberFormats` object in `apps/api/src/routes/records.ts` (around line 392), add entries for the new objects. Find the object that maps field names to prefixes and add:

```typescript
  technicianName: 'TECH',          // For Technician auto-naming (if needed)
```

Note: InstallationTechnician, InstallationCost, and InstallationTechExpense don't have auto-number fields — they're created by the trigger/controller, not manually.

- [ ] **Step 7: Build and verify**

Run: `cd apps/api && pnpm build`

Expected: Build succeeds with no errors. The `ensureCoreObjects()` function will create the new objects on next API startup.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/ensure-core-objects.ts apps/api/src/routes/records.ts
git commit -m "feat(installation): add Technician, InstallationTechnician, InstallationCost, InstallationTechExpense objects and extend Installation fields"
```

---

### Task 2: Register trigger ID and create trigger manifest

**Files:**
- Modify: `packages/triggers/src/index.ts`
- Create: `apps/api/src/triggers/create-installation-costs/trigger.config.ts`

- [ ] **Step 1: Add trigger ID to packages/triggers**

In `packages/triggers/src/index.ts`, change:

```typescript
export const TRIGGER_IDS = [] as const
```

To:

```typescript
export const TRIGGER_IDS = ['create-installation-costs'] as const
```

- [ ] **Step 2: Create trigger manifest**

Create `apps/api/src/triggers/create-installation-costs/trigger.config.ts`:

```typescript
import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'create-installation-costs',
  name: 'Create Installation Cost Records',
  description: 'Auto-creates weekly cost records and tech expense records when installation dates and technicians are set',
  icon: 'Calculator',
  objectApiName: 'Installation',
  events: ['afterCreate', 'afterUpdate'],
}
```

- [ ] **Step 3: Rebuild triggers package**

Run: `pnpm --filter @crm/triggers build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/triggers/src/index.ts apps/api/src/triggers/create-installation-costs/trigger.config.ts
git commit -m "feat(installation): register create-installation-costs trigger ID and manifest"
```

---

### Task 3: Implement trigger handler

**Files:**
- Create: `apps/api/src/triggers/create-installation-costs/index.ts`
- Modify: `apps/api/src/triggers/registry.ts`

- [ ] **Step 1: Create the trigger handler**

Create `apps/api/src/triggers/create-installation-costs/index.ts`:

```typescript
import { prisma } from '@crm/db/client'
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

// Reference Sunday for week boundary calculation (March 17, 2024)
const REFERENCE_SUNDAY = new Date('2024-03-17T00:00:00Z')
const MS_PER_DAY = 86400000

/**
 * Calculate week boundaries for an installation date range.
 * Uses Sunday-based boundaries aligned to a fixed reference date.
 */
function calculateWeeks(startDate: Date, endDate: Date): Array<{ weekNumber: number; start: Date; end: Date }> {
  const weeks: Array<{ weekNumber: number; start: Date; end: Date }> = []

  // Find the first Sunday on or after startDate
  const daysSinceRef = Math.floor((startDate.getTime() - REFERENCE_SUNDAY.getTime()) / MS_PER_DAY)
  const daysUntilSunday = (7 - (daysSinceRef % 7)) % 7
  const firstSunday = new Date(startDate.getTime() + daysUntilSunday * MS_PER_DAY)

  let weekNum = 1

  if (firstSunday.getTime() > startDate.getTime() && firstSunday.getTime() <= endDate.getTime()) {
    // Partial first week: startDate → day before firstSunday
    weeks.push({
      weekNumber: weekNum++,
      start: new Date(startDate),
      end: new Date(firstSunday.getTime() - MS_PER_DAY),
    })
  }

  // Full weeks + final partial
  let current = firstSunday.getTime() <= startDate.getTime()
    ? new Date(startDate)
    : firstSunday

  while (current.getTime() <= endDate.getTime()) {
    const weekEnd = new Date(current.getTime() + 6 * MS_PER_DAY)
    weeks.push({
      weekNumber: weekNum++,
      start: new Date(current),
      end: weekEnd > endDate ? new Date(endDate) : weekEnd,
    })
    current = new Date(current.getTime() + 7 * MS_PER_DAY)
  }

  return weeks
}

/**
 * Finds the CustomObject ID for a given apiName.
 */
async function getObjectId(apiName: string): Promise<string | null> {
  const obj = await prisma.customObject.findFirst({
    where: { apiName: { equals: apiName, mode: 'insensitive' } },
    select: { id: true },
  })
  return obj?.id ?? null
}

/**
 * Finds all Record entries for a given object where a data field matches a value.
 */
async function findRecordsByObjectAndField(
  objectId: string,
  fieldName: string,
  fieldValue: string
): Promise<Array<{ id: string; data: any }>> {
  const all = await prisma.record.findMany({
    where: { objectId },
    select: { id: true, data: true },
  })
  return all.filter((r: any) => {
    const d = r.data as Record<string, any>
    return d[fieldName] === fieldValue
  })
}

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  const { recordId, recordData, userId, orgId } = ctx

  // Guard: must have valid dates
  const startDateStr = recordData.startDate
  const endDateStr = recordData.endDate
  if (!startDateStr || !endDateStr) return null

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null
  if (startDate >= endDate) return null

  // Look up object IDs
  const [costObjectId, techExpenseObjectId, junctionObjectId] = await Promise.all([
    getObjectId('InstallationCost'),
    getObjectId('InstallationTechExpense'),
    getObjectId('InstallationTechnician'),
  ])
  if (!costObjectId || !techExpenseObjectId || !junctionObjectId) {
    console.error('[create-installation-costs] Missing required objects')
    return null
  }

  // Query existing cost records for dedup
  const existingCosts = await findRecordsByObjectAndField(costObjectId, 'installation', recordId)
  const existingCostWeeks = new Set(
    existingCosts.map((r: any) => (r.data as Record<string, any>).weekNumber)
  )

  // Query existing tech expense records for dedup
  const existingExpenses = await findRecordsByObjectAndField(techExpenseObjectId, 'installation', recordId)
  const existingExpenseKeys = new Set(
    existingExpenses.map((r: any) => {
      const d = r.data as Record<string, any>
      return `${d.installationTechnician}_${d.weekNumber}`
    })
  )

  // Query assigned technicians (junction records)
  const junctionRecords = await findRecordsByObjectAndField(junctionObjectId, 'installation', recordId)

  // Calculate weeks
  const weeks = calculateWeeks(startDate, endDate)
  if (weeks.length === 0) return null

  // Create missing InstallationCost records
  const costRecordsToCreate: any[] = []
  for (const week of weeks) {
    if (existingCostWeeks.has(week.weekNumber)) continue
    costRecordsToCreate.push({
      id: generateRecordId('InstallationCost'),
      objectId: costObjectId,
      data: {
        installation: recordId,
        weekNumber: week.weekNumber,
        weekStartDate: week.start.toISOString().split('T')[0],
        weekEndDate: week.end.toISOString().split('T')[0],
        flightsActual: 0,
        lodgingActual: 0,
        carRental: 0,
        airportTransportation: 0,
        parking: 0,
        equipment: 0,
        miscellaneousExpenses: 0,
        waterproofing: 0,
        woodBucks: 0,
      },
      createdById: userId,
      modifiedById: userId,
    })
  }

  // Create missing InstallationTechExpense records
  const expenseRecordsToCreate: any[] = []
  for (const junction of junctionRecords) {
    const junctionData = junction.data as Record<string, any>
    for (const week of weeks) {
      const key = `${junction.id}_${week.weekNumber}`
      if (existingExpenseKeys.has(key)) continue
      expenseRecordsToCreate.push({
        id: generateRecordId('InstallationTechExpense'),
        objectId: techExpenseObjectId,
        data: {
          installation: recordId,
          installationTechnician: junction.id,
          weekNumber: week.weekNumber,
          weekStartDate: week.start.toISOString().split('T')[0],
          weekEndDate: week.end.toISOString().split('T')[0],
          containerUnload: 0,
          woodbucks: 0,
          waterproofing: 0,
          installationLabor: 0,
          travel: 0,
          waterTesting: 0,
          sills: 0,
          finishCaulking: 0,
          screenLutronShades: 0,
          punchListWork: 0,
          finishHardware: 0,
          finalAdjustments: 0,
          perDiem: 0,
          mileage: 0,
          materials: 0,
        },
        createdById: userId,
        modifiedById: userId,
      })
    }
  }

  // Bulk create
  if (costRecordsToCreate.length > 0) {
    await prisma.record.createMany({ data: costRecordsToCreate })
    console.log(`[create-installation-costs] Created ${costRecordsToCreate.length} cost records for installation ${recordId}`)
  }

  if (expenseRecordsToCreate.length > 0) {
    await prisma.record.createMany({ data: expenseRecordsToCreate })
    console.log(`[create-installation-costs] Created ${expenseRecordsToCreate.length} tech expense records for installation ${recordId}`)
  }

  // Return null — trigger creates side-effect records, no field updates to the Installation itself
  return null
}
```

- [ ] **Step 2: Register trigger in registry**

Replace the contents of `apps/api/src/triggers/registry.ts`:

```typescript
import type { TriggerRegistration } from '../lib/triggers/types.js'
import { config as createInstCostsConfig } from './create-installation-costs/trigger.config.js'
import { handler as createInstCostsHandler } from './create-installation-costs/index.js'

export const triggerRegistrations: TriggerRegistration[] = [
  { manifest: createInstCostsConfig, handler: createInstCostsHandler },
]

export const triggers = triggerRegistrations.map(r => r.manifest)
```

- [ ] **Step 3: Build and verify**

Run: `cd apps/api && pnpm build`

Expected: Build succeeds (267+ kb bundle).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/triggers/create-installation-costs/ apps/api/src/triggers/registry.ts
git commit -m "feat(installation): implement create-installation-costs trigger handler"
```

---

### Task 4: Register controller ID and create controller manifest

**Files:**
- Modify: `packages/controllers/src/index.ts`
- Create: `apps/api/src/controllers/installation-grid/controller.config.ts`

- [ ] **Step 1: Add controller ID**

In `packages/controllers/src/index.ts`, change:

```typescript
export const CONTROLLER_IDS = [] as const
```

To:

```typescript
export const CONTROLLER_IDS = ['installation-grid'] as const
```

- [ ] **Step 2: Create controller manifest**

Create `apps/api/src/controllers/installation-grid/controller.config.ts`:

```typescript
import type { ControllerManifest } from '../../lib/controllers/types.js'

export const config: ControllerManifest = {
  id: 'installation-grid',
  name: 'Installation Grid Controller',
  description: 'API endpoints for installation cost grid data, CRUD, calculations, and technician management',
  icon: 'Table',
  objectApiName: 'Installation',
  routePrefix: '/controllers/installation-grid',
}
```

- [ ] **Step 3: Rebuild controllers package**

Run: `pnpm --filter @crm/controllers build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/controllers/src/index.ts apps/api/src/controllers/installation-grid/controller.config.ts
git commit -m "feat(installation): register installation-grid controller ID and manifest"
```

---

### Task 5: Implement controller — data wrapper and CRUD endpoints

**Files:**
- Create: `apps/api/src/controllers/installation-grid/index.ts`
- Modify: `apps/api/src/controllers/registry.ts`

- [ ] **Step 1: Create the controller with all endpoints**

Create `apps/api/src/controllers/installation-grid/index.ts`:

```typescript
import type { FastifyInstance } from 'fastify'
import { prisma } from '@crm/db/client'
import { generateRecordId } from '@crm/db/record-id'

// ── Helpers ──────────────────────────────────────────────────────────

async function getObjectId(apiName: string): Promise<string | null> {
  const obj = await prisma.customObject.findFirst({
    where: { apiName: { equals: apiName, mode: 'insensitive' } },
    select: { id: true },
  })
  return obj?.id ?? null
}

async function findRecordsByObjectAndField(
  objectId: string, fieldName: string, fieldValue: string
): Promise<Array<{ id: string; data: any }>> {
  const all = await prisma.record.findMany({
    where: { objectId },
    select: { id: true, data: true },
  })
  return all.filter((r: any) => {
    const d = r.data as Record<string, any>
    return d[fieldName] === fieldValue
  })
}

async function checkControllerEnabled(orgId: string): Promise<boolean> {
  try {
    const setting = await prisma.controllerSetting.findUnique({
      where: { orgId_controllerId: { orgId, controllerId: 'installation-grid' } },
    })
    return setting?.enabled ?? false
  } catch {
    return true // If table doesn't exist yet, allow access
  }
}

function round2(n: any): number {
  const num = typeof n === 'number' ? n : parseFloat(n) || 0
  return Math.round(num * 100) / 100
}

// ── Cost field lists ─────────────────────────────────────────────────

const COST_FIELDS = [
  'flightsActual', 'lodgingActual', 'carRental', 'airportTransportation',
  'parking', 'equipment', 'miscellaneousExpenses', 'waterproofing', 'woodBucks',
]

const LABOR_HOUR_FIELDS = [
  'containerUnload', 'woodbucks', 'waterproofing', 'installationLabor',
  'travel', 'waterTesting', 'sills', 'finishCaulking', 'screenLutronShades',
  'punchListWork', 'finishHardware', 'finalAdjustments',
]

const EXPENSE_FIELDS = ['perDiem', 'mileage', 'materials']

const ESTIMATED_FIELDS = [
  'estimatedLaborCost', 'estimatedHotel', 'estimatedTravelExp', 'estimatedMileage',
  'estimatedPerDiem', 'estimatedFlights', 'estimatedCarRental', 'estimatedParking',
  'estimatedEquipment', 'estimatedMiscellaneous', 'estimatedWaterproofing',
  'estimatedWoodBucks', 'estimatedAirportTransportation', 'estimatedMaterials',
  'estimatedContainerUnload',
]

// ── Route registration ───────────────────────────────────────────────

export async function registerRoutes(app: FastifyInstance) {
  // Auth + enabled check middleware
  app.addHook('preHandler', async (request, reply) => {
    const user = (request as any).user
    if (!user) return reply.code(401).send({ error: 'Authentication required' })

    const enabled = await checkControllerEnabled(user.sub)
    if (!enabled) return reply.code(403).send({ error: 'Installation Grid Controller is disabled' })
  })

  // ── GET /:installationId/data ────────────────────────────────────
  app.get<{ Params: { installationId: string } }>(
    '/:installationId/data',
    async (request, reply) => {
      const { installationId } = request.params

      // Fetch installation record
      const installation = await prisma.record.findUnique({
        where: { id: installationId },
        include: {
          createdBy: { select: { id: true, name: true } },
          modifiedBy: { select: { id: true, name: true } },
        },
      })
      if (!installation) return reply.code(404).send({ error: 'Installation not found' })

      const [costObjectId, techExpenseObjectId, junctionObjectId, techObjectId] = await Promise.all([
        getObjectId('InstallationCost'),
        getObjectId('InstallationTechExpense'),
        getObjectId('InstallationTechnician'),
        getObjectId('Technician'),
      ])

      // Fetch cost records
      const costs = costObjectId
        ? (await findRecordsByObjectAndField(costObjectId, 'installation', installationId))
            .sort((a: any, b: any) => ((a.data as any).weekNumber ?? 0) - ((b.data as any).weekNumber ?? 0))
        : []

      // Fetch junction records
      const junctions = junctionObjectId
        ? await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)
        : []

      // Fetch technician names for each junction
      const techMap: Record<string, { id: string; name: string; assignedHourlyRate: number }> = {}
      for (const junc of junctions) {
        const jd = junc.data as Record<string, any>
        const techId = jd.technician
        if (techId && techObjectId) {
          const techRecord = await prisma.record.findUnique({
            where: { id: techId },
            select: { id: true, data: true },
          })
          if (techRecord) {
            const td = techRecord.data as Record<string, any>
            techMap[junc.id] = {
              id: techRecord.id,
              name: td.technicianName || 'Unknown',
              assignedHourlyRate: jd.assignedHourlyRate || 0,
            }
          }
        }
      }

      // Fetch tech expense records, grouped by junction
      const techExpenses: Record<string, { technician: any; expenses: any[] }> = {}
      if (techExpenseObjectId) {
        const allExpenses = await findRecordsByObjectAndField(techExpenseObjectId, 'installation', installationId)
        for (const exp of allExpenses) {
          const ed = exp.data as Record<string, any>
          const junctionId = ed.installationTechnician
          if (!techExpenses[junctionId]) {
            techExpenses[junctionId] = {
              technician: techMap[junctionId] || { id: '', name: 'Unknown', assignedHourlyRate: 0 },
              expenses: [],
            }
          }
          techExpenses[junctionId].expenses.push(exp)
        }
        // Sort each technician's expenses by weekNumber
        for (const key of Object.keys(techExpenses)) {
          techExpenses[key].expenses.sort(
            (a: any, b: any) => ((a.data as any).weekNumber ?? 0) - ((b.data as any).weekNumber ?? 0)
          )
        }
      }

      return {
        installation,
        costs,
        techExpenses,
        weekCount: costs.length,
      }
    }
  )

  // ── PUT /:installationId/costs ───────────────────────────────────
  app.put<{ Params: { installationId: string }; Body: { updates: Array<{ id: string; [key: string]: any }> } }>(
    '/:installationId/costs',
    async (request, reply) => {
      const { installationId } = request.params
      const { updates } = request.body as { updates: Array<{ id: string; [key: string]: any }> }
      if (!updates || !Array.isArray(updates)) return reply.code(400).send({ error: 'updates array required' })

      const user = (request as any).user
      let updated = 0

      for (const update of updates) {
        const record = await prisma.record.findUnique({ where: { id: update.id } })
        if (!record) continue
        const data = record.data as Record<string, any>
        if (data.installation !== installationId) continue

        const newData = { ...data }
        for (const [key, value] of Object.entries(update)) {
          if (key === 'id') continue
          if (COST_FIELDS.includes(key)) {
            newData[key] = round2(value)
          }
        }

        await prisma.record.update({
          where: { id: update.id },
          data: { data: newData, modifiedById: user.sub },
        })
        updated++
      }

      return { updated }
    }
  )

  // ── PUT /:installationId/tech-expenses ───────────────────────────
  app.put<{ Params: { installationId: string }; Body: { updates: Array<{ id: string; [key: string]: any }> } }>(
    '/:installationId/tech-expenses',
    async (request, reply) => {
      const { installationId } = request.params
      const { updates } = request.body as { updates: Array<{ id: string; [key: string]: any }> }
      if (!updates || !Array.isArray(updates)) return reply.code(400).send({ error: 'updates array required' })

      const user = (request as any).user
      const allFields = [...LABOR_HOUR_FIELDS, ...EXPENSE_FIELDS]
      let updated = 0

      for (const update of updates) {
        const record = await prisma.record.findUnique({ where: { id: update.id } })
        if (!record) continue
        const data = record.data as Record<string, any>
        if (data.installation !== installationId) continue

        const newData = { ...data }
        for (const [key, value] of Object.entries(update)) {
          if (key === 'id') continue
          if (allFields.includes(key)) {
            newData[key] = round2(value)
          }
        }

        await prisma.record.update({
          where: { id: update.id },
          data: { data: newData, modifiedById: user.sub },
        })
        updated++
      }

      return { updated }
    }
  )

  // ── POST /:installationId/recalculate ────────────────────────────
  app.post<{ Params: { installationId: string } }>(
    '/:installationId/recalculate',
    async (request, reply) => {
      const { installationId } = request.params
      const user = (request as any).user

      const installation = await prisma.record.findUnique({ where: { id: installationId } })
      if (!installation) return reply.code(404).send({ error: 'Installation not found' })

      const [costObjectId, techExpenseObjectId, junctionObjectId] = await Promise.all([
        getObjectId('InstallationCost'),
        getObjectId('InstallationTechExpense'),
        getObjectId('InstallationTechnician'),
      ])

      // Sum all cost record fields
      let totalCostFromWeeks = 0
      if (costObjectId) {
        const costs = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
        for (const cost of costs) {
          const d = cost.data as Record<string, any>
          for (const field of COST_FIELDS) {
            totalCostFromWeeks += parseFloat(d[field]) || 0
          }
        }
      }

      // Sum all tech expense costs
      let techExpenseTotal = 0
      if (techExpenseObjectId && junctionObjectId) {
        // Build junction rate map
        const junctions = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)
        const rateMap: Record<string, number> = {}
        for (const j of junctions) {
          rateMap[j.id] = (j.data as any).assignedHourlyRate || 0
        }

        const expenses = await findRecordsByObjectAndField(techExpenseObjectId, 'installation', installationId)
        for (const exp of expenses) {
          const d = exp.data as Record<string, any>
          const rate = rateMap[d.installationTechnician] || 0

          // Sum labor hours × rate
          let totalHours = 0
          for (const field of LABOR_HOUR_FIELDS) {
            totalHours += parseFloat(d[field]) || 0
          }
          const laborCost = totalHours * rate

          // Add expenses (per diem, mileage, materials)
          const expenseCost = (parseFloat(d.perDiem) || 0) + (parseFloat(d.mileage) || 0) + (parseFloat(d.materials) || 0)

          techExpenseTotal += laborCost + expenseCost
        }
      }

      const instData = installation.data as Record<string, any>
      const finalCost = round2(totalCostFromWeeks + techExpenseTotal)
      const budget = parseFloat(instData.installationBudget) || 0
      const finalProfit = round2(budget - finalCost)

      await prisma.record.update({
        where: { id: installationId },
        data: {
          data: {
            ...instData,
            finalCost,
            finalProfit,
            techExpenseTotal: round2(techExpenseTotal),
          },
          modifiedById: user.sub,
        },
      })

      return { finalCost, finalProfit, techExpenseTotal: round2(techExpenseTotal) }
    }
  )

  // ── POST /:installationId/weeks/add ──────────────────────────────
  app.post<{ Params: { installationId: string } }>(
    '/:installationId/weeks/add',
    async (request, reply) => {
      const { installationId } = request.params
      const user = (request as any).user

      const installation = await prisma.record.findUnique({ where: { id: installationId } })
      if (!installation) return reply.code(404).send({ error: 'Installation not found' })

      const instData = installation.data as Record<string, any>
      if (!instData.endDate) return reply.code(400).send({ error: 'Installation has no end date' })

      const [costObjectId, techExpenseObjectId, junctionObjectId] = await Promise.all([
        getObjectId('InstallationCost'),
        getObjectId('InstallationTechExpense'),
        getObjectId('InstallationTechnician'),
      ])
      if (!costObjectId || !techExpenseObjectId) return reply.code(500).send({ error: 'Missing required objects' })

      // Find current max week
      const existingCosts = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
      const maxWeek = existingCosts.reduce((max: number, r: any) => Math.max(max, (r.data as any).weekNumber || 0), 0)

      // Extend end date by 7 days
      const oldEndDate = new Date(instData.endDate)
      const newEndDate = new Date(oldEndDate.getTime() + 7 * 86400000)
      const newWeekNum = maxWeek + 1
      const weekStart = new Date(oldEndDate.getTime() + 86400000) // Day after old end
      const weekStartStr = weekStart.toISOString().split('T')[0]
      const weekEndStr = newEndDate.toISOString().split('T')[0]

      // Create cost record for new week
      await prisma.record.create({
        data: {
          id: generateRecordId('InstallationCost'),
          objectId: costObjectId,
          data: {
            installation: installationId,
            weekNumber: newWeekNum,
            weekStartDate: weekStartStr,
            weekEndDate: weekEndStr,
            flightsActual: 0, lodgingActual: 0, carRental: 0, airportTransportation: 0,
            parking: 0, equipment: 0, miscellaneousExpenses: 0, waterproofing: 0, woodBucks: 0,
          },
          createdById: user.sub,
          modifiedById: user.sub,
        },
      })

      // Create tech expense records for each technician
      if (junctionObjectId) {
        const junctions = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)
        for (const junc of junctions) {
          await prisma.record.create({
            data: {
              id: generateRecordId('InstallationTechExpense'),
              objectId: techExpenseObjectId,
              data: {
                installation: installationId,
                installationTechnician: junc.id,
                weekNumber: newWeekNum,
                weekStartDate: weekStartStr,
                weekEndDate: weekEndStr,
                containerUnload: 0, woodbucks: 0, waterproofing: 0, installationLabor: 0,
                travel: 0, waterTesting: 0, sills: 0, finishCaulking: 0,
                screenLutronShades: 0, punchListWork: 0, finishHardware: 0, finalAdjustments: 0,
                perDiem: 0, mileage: 0, materials: 0,
              },
              createdById: user.sub,
              modifiedById: user.sub,
            },
          })
        }
      }

      // Update installation end date
      await prisma.record.update({
        where: { id: installationId },
        data: { data: { ...instData, endDate: weekEndStr }, modifiedById: user.sub },
      })

      return { weekNumber: newWeekNum, weekStartDate: weekStartStr, weekEndDate: weekEndStr }
    }
  )

  // ── POST /:installationId/weeks/remove ───────────────────────────
  app.post<{ Params: { installationId: string } }>(
    '/:installationId/weeks/remove',
    async (request, reply) => {
      const { installationId } = request.params
      const user = (request as any).user

      const [costObjectId, techExpenseObjectId] = await Promise.all([
        getObjectId('InstallationCost'),
        getObjectId('InstallationTechExpense'),
      ])
      if (!costObjectId || !techExpenseObjectId) return reply.code(500).send({ error: 'Missing required objects' })

      const existingCosts = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
      if (existingCosts.length <= 1) return reply.code(400).send({ error: 'Cannot remove the only week' })

      const maxWeek = existingCosts.reduce((max: number, r: any) => Math.max(max, (r.data as any).weekNumber || 0), 0)

      // Delete cost record for max week
      const costToDelete = existingCosts.find((r: any) => (r.data as any).weekNumber === maxWeek)
      if (costToDelete) {
        await prisma.record.delete({ where: { id: costToDelete.id } })
      }

      // Delete all tech expense records for max week
      const existingExpenses = await findRecordsByObjectAndField(techExpenseObjectId, 'installation', installationId)
      const expensesToDelete = existingExpenses.filter((r: any) => (r.data as any).weekNumber === maxWeek)
      for (const exp of expensesToDelete) {
        await prisma.record.delete({ where: { id: exp.id } })
      }

      // Shorten end date by 7 days
      const installation = await prisma.record.findUnique({ where: { id: installationId } })
      if (installation) {
        const instData = installation.data as Record<string, any>
        const oldEndDate = new Date(instData.endDate)
        const newEndDate = new Date(oldEndDate.getTime() - 7 * 86400000)
        await prisma.record.update({
          where: { id: installationId },
          data: { data: { ...instData, endDate: newEndDate.toISOString().split('T')[0] }, modifiedById: user.sub },
        })
      }

      return { removedWeek: maxWeek, remainingWeeks: existingCosts.length - 1 }
    }
  )

  // ── GET /:installationId/technicians ─────────────────────────────
  app.get<{ Params: { installationId: string } }>(
    '/:installationId/technicians',
    async (request, reply) => {
      const { installationId } = request.params

      const [junctionObjectId, techObjectId] = await Promise.all([
        getObjectId('InstallationTechnician'),
        getObjectId('Technician'),
      ])
      if (!junctionObjectId) return []

      const junctions = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)

      const result: Array<{ junctionId: string; technicianId: string; technicianName: string; assignedHourlyRate: number }> = []
      for (const junc of junctions) {
        const jd = junc.data as Record<string, any>
        let techName = 'Unknown'
        if (jd.technician && techObjectId) {
          const techRecord = await prisma.record.findUnique({ where: { id: jd.technician }, select: { data: true } })
          if (techRecord) techName = (techRecord.data as any).technicianName || 'Unknown'
        }
        result.push({
          junctionId: junc.id,
          technicianId: jd.technician || '',
          technicianName: techName,
          assignedHourlyRate: jd.assignedHourlyRate || 0,
        })
      }

      return result
    }
  )

  // ── POST /:installationId/technicians ────────────────────────────
  app.post<{ Params: { installationId: string }; Body: { technicianId: string } }>(
    '/:installationId/technicians',
    async (request, reply) => {
      const { installationId } = request.params
      const { technicianId } = request.body as { technicianId: string }
      const user = (request as any).user

      if (!technicianId) return reply.code(400).send({ error: 'technicianId required' })

      // Look up technician to get current hourly rate
      const techRecord = await prisma.record.findUnique({ where: { id: technicianId }, select: { data: true } })
      if (!techRecord) return reply.code(404).send({ error: 'Technician not found' })
      const techData = techRecord.data as Record<string, any>
      const hourlyRate = parseFloat(techData.hourlyRate) || 0

      const [junctionObjectId, costObjectId, techExpenseObjectId] = await Promise.all([
        getObjectId('InstallationTechnician'),
        getObjectId('InstallationCost'),
        getObjectId('InstallationTechExpense'),
      ])
      if (!junctionObjectId || !techExpenseObjectId) return reply.code(500).send({ error: 'Missing required objects' })

      // Check for duplicate assignment
      const existing = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)
      const duplicate = existing.find((r: any) => (r.data as any).technician === technicianId)
      if (duplicate) return reply.code(409).send({ error: 'Technician already assigned to this installation' })

      // Create junction record with frozen rate
      const junction = await prisma.record.create({
        data: {
          id: generateRecordId('InstallationTechnician'),
          objectId: junctionObjectId,
          data: {
            installation: installationId,
            technician: technicianId,
            assignedHourlyRate: hourlyRate,
          },
          createdById: user.sub,
          modifiedById: user.sub,
        },
      })

      // If installation already has weeks, create tech expense records for each week
      if (costObjectId) {
        const costs = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
        for (const cost of costs) {
          const cd = cost.data as Record<string, any>
          await prisma.record.create({
            data: {
              id: generateRecordId('InstallationTechExpense'),
              objectId: techExpenseObjectId,
              data: {
                installation: installationId,
                installationTechnician: junction.id,
                weekNumber: cd.weekNumber,
                weekStartDate: cd.weekStartDate,
                weekEndDate: cd.weekEndDate,
                containerUnload: 0, woodbucks: 0, waterproofing: 0, installationLabor: 0,
                travel: 0, waterTesting: 0, sills: 0, finishCaulking: 0,
                screenLutronShades: 0, punchListWork: 0, finishHardware: 0, finalAdjustments: 0,
                perDiem: 0, mileage: 0, materials: 0,
              },
              createdById: user.sub,
              modifiedById: user.sub,
            },
          })
        }
      }

      return {
        junctionId: junction.id,
        technicianId,
        technicianName: techData.technicianName || 'Unknown',
        assignedHourlyRate: hourlyRate,
      }
    }
  )

  // ── DELETE /:installationId/technicians/:junctionId ──────────────
  app.delete<{ Params: { installationId: string; junctionId: string } }>(
    '/:installationId/technicians/:junctionId',
    async (request, reply) => {
      const { installationId, junctionId } = request.params

      const techExpenseObjectId = await getObjectId('InstallationTechExpense')

      // Delete all tech expense records linked to this junction
      if (techExpenseObjectId) {
        const expenses = await findRecordsByObjectAndField(techExpenseObjectId, 'installation', installationId)
        const toDelete = expenses.filter((r: any) => (r.data as any).installationTechnician === junctionId)
        for (const exp of toDelete) {
          await prisma.record.delete({ where: { id: exp.id } })
        }
      }

      // Delete the junction record
      await prisma.record.delete({ where: { id: junctionId } })

      return { deleted: true }
    }
  )

  // ── PUT /:installationId/estimates ───────────────────────────────
  app.put<{ Params: { installationId: string }; Body: Record<string, any> }>(
    '/:installationId/estimates',
    async (request, reply) => {
      const { installationId } = request.params
      const updates = request.body as Record<string, any>
      const user = (request as any).user

      const installation = await prisma.record.findUnique({ where: { id: installationId } })
      if (!installation) return reply.code(404).send({ error: 'Installation not found' })

      const instData = installation.data as Record<string, any>
      const newData = { ...instData }

      for (const [key, value] of Object.entries(updates)) {
        if (ESTIMATED_FIELDS.includes(key)) {
          newData[key] = round2(value)
        }
      }

      await prisma.record.update({
        where: { id: installationId },
        data: { data: newData, modifiedById: user.sub },
      })

      return { updated: true }
    }
  )
}
```

- [ ] **Step 2: Register controller in registry**

Replace the contents of `apps/api/src/controllers/registry.ts`:

```typescript
import type { ControllerRegistration } from '../lib/controllers/types.js'
import { config as installationGridConfig } from './installation-grid/controller.config.js'
import { registerRoutes as installationGridRoutes } from './installation-grid/index.js'

export const controllerRegistrations: ControllerRegistration[] = [
  { manifest: installationGridConfig, registerRoutes: installationGridRoutes },
]

export const controllers = controllerRegistrations.map(r => r.manifest)
```

- [ ] **Step 3: Build and verify**

Run: `cd apps/api && pnpm build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/controllers/installation-grid/ apps/api/src/controllers/registry.ts
git commit -m "feat(installation): implement installation-grid controller with all endpoints"
```

---

### Task 6: Final verification and push

**Files:** None new — verification only.

- [ ] **Step 1: Full build**

Run: `pnpm --filter @crm/triggers build && pnpm --filter @crm/controllers build && pnpm --filter api build`

Expected: All three build successfully.

- [ ] **Step 2: Verify Settings UI shows new automations**

After deploying, navigate to Settings > Automations:
- **Triggers tab**: "Create Installation Cost Records" card visible with events `afterCreate, afterUpdate` and object badge `Installation`
- **Controllers tab**: "Installation Grid Controller" card visible with object badge `Installation` and route `/controllers/installation-grid`

- [ ] **Step 3: End-to-end verification checklist**

1. Create a Technician record with hourlyRate = 50
2. Create an Installation record with startDate and endDate (2 weeks apart)
3. Assign the technician via `POST /controllers/installation-grid/:id/technicians`
4. Verify InstallationCost and InstallationTechExpense records were created
5. Update a cost record via `PUT /controllers/installation-grid/:id/costs`
6. Recalculate via `POST /controllers/installation-grid/:id/recalculate`
7. Verify finalCost and finalProfit are computed correctly
8. Add a week via `POST /controllers/installation-grid/:id/weeks/add`
9. Remove a week via `POST /controllers/installation-grid/:id/weeks/remove`
10. Change the Technician's hourlyRate to 60 — verify the junction still shows 50

- [ ] **Step 4: Push to New-Test-To-Main**

```bash
git push origin claude/intelligent-tu:New-Test-To-Main
```
