# Installation Object — Phase 1: Data Model + Trigger + Controller

## Context

Tischler Windows uses a Salesforce Installation object to track multi-week installation projects with detailed cost breakdowns and technician labor expenses. This system needs to be ported to the CRM — not as a direct copy, but rethought for the CRM's metadata-driven architecture.

**Phase 1 scope:** Data model (5 objects), trigger (auto-create child records), and controller (API endpoints for grid data, CRUD, calculations). No UI components in this phase.

**Future phases:**
- Phase 2: Cost Grid UI (the main editable grid)
- Phase 3: Executive Summary + Variance Report + Technician Manager

**Future integrations (out of scope, designed for extensibility):** Property lookup, deeper Project integration, object summaries.

---

## 1. Data Model

### 1.1 Technician (new core object)

A standalone object — NOT a User in the CRM. Managed by installation managers for cost analysis. Service technicians (future) will be Users; installation technicians are just objects assigned to records.

| Field | API Name | Type | Required | Notes |
|-------|----------|------|----------|-------|
| Technician Name | technicianName | Text | Yes | Full name |
| Hourly Rate | hourlyRate | Currency | Yes | Current rate. NOT used for historical calcs — rate is frozen on the junction at assignment time |
| Phone | phone | Phone | No | |
| Email | email | Email | No | |
| Status | status | Picklist | Yes | Values: Active, Inactive. Default: Active |

Defined in `ensure-core-objects.ts` alongside existing core objects.

### 1.2 Installation (extend existing)

The Installation object already exists with 5 fields (installationNumber, installationName, scheduledDate, completedDate, status). Add the following fields:

**Core Fields:**
| Field | API Name | Type | Required | Notes |
|-------|----------|------|----------|-------|
| Start Date | startDate | Date | No | Installation start date. Drives week calculation |
| End Date | endDate | Date | No | Installation end date |
| Project | project | Lookup | No | Lookup to Projects object |
| Installation Budget | installationBudget | Currency | No | Total budget for the installation |

**Calculated Fields (set by controller, read-only):**
| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Final Cost | finalCost | Currency | Sum of all costs (weekly + tech expenses). Set by recalculate endpoint |
| Final Profit | finalProfit | Currency | installationBudget - finalCost |
| Tech Expense Total | techExpenseTotal | Currency | Sum of all tech expense costs |

**Estimated Cost Fields (editable, for variance reporting):**
| Field | API Name | Type |
|-------|----------|------|
| Estimated Labor Cost | estimatedLaborCost | Currency |
| Estimated Hotel | estimatedHotel | Currency |
| Estimated Travel Expense | estimatedTravelExp | Currency |
| Estimated Mileage | estimatedMileage | Currency |
| Estimated Per Diem | estimatedPerDiem | Currency |
| Estimated Flights | estimatedFlights | Currency |
| Estimated Car Rental | estimatedCarRental | Currency |
| Estimated Parking | estimatedParking | Currency |
| Estimated Equipment | estimatedEquipment | Currency |
| Estimated Miscellaneous | estimatedMiscellaneous | Currency |
| Estimated Waterproofing | estimatedWaterproofing | Currency |
| Estimated Wood Bucks | estimatedWoodBucks | Currency |
| Estimated Airport Transportation | estimatedAirportTransportation | Currency |
| Estimated Materials | estimatedMaterials | Currency |
| Estimated Container Unload | estimatedContainerUnload | Currency |

The existing `scheduledDate` and `completedDate` fields remain unchanged. `startDate`/`endDate` are the installation work dates (for week calculation), while `scheduledDate`/`completedDate` track scheduling lifecycle.

### 1.3 InstallationTechnician (new junction object)

Links technicians to installations. The key design decision: **hourly rate is frozen at assignment time** to prevent wage increases from affecting historical cost calculations.

| Field | API Name | Type | Required | Notes |
|-------|----------|------|----------|-------|
| Installation | installation | Lookup | Yes | Parent Installation record |
| Technician | technician | Lookup | Yes | The technician being assigned |
| Assigned Hourly Rate | assignedHourlyRate | Currency | Yes | Copied from technician.hourlyRate at assignment time. Immutable after creation. |

Unique constraint: one technician can only be assigned to an installation once (installation + technician).

### 1.4 InstallationCost (new child object)

One record per week of the installation. Tracks project-level costs not tied to a specific technician.

| Field | API Name | Type | Required | Notes |
|-------|----------|------|----------|-------|
| Installation | installation | Lookup | Yes | Parent Installation |
| Week Number | weekNumber | Number | Yes | Sequential: 1, 2, 3... |
| Week Start Date | weekStartDate | Date | Yes | |
| Week End Date | weekEndDate | Date | Yes | |
| Flights | flightsActual | Currency | No | |
| Lodging | lodgingActual | Currency | No | |
| Car Rental | carRental | Currency | No | |
| Airport Transportation | airportTransportation | Currency | No | |
| Parking | parking | Currency | No | |
| Equipment | equipment | Currency | No | |
| Miscellaneous | miscellaneousExpenses | Currency | No | |
| Waterproofing | waterproofing | Currency | No | |
| Wood Bucks | woodBucks | Currency | No | |

All cost fields default to 0 when created by the trigger.

Unique constraint: one cost record per week per installation (installation + weekNumber).

### 1.5 InstallationTechExpense (new child object)

One record per technician per week. Tracks labor hours and per-technician expenses.

| Field | API Name | Type | Required | Notes |
|-------|----------|------|----------|-------|
| Installation | installation | Lookup | Yes | Parent Installation |
| Installation Technician | installationTechnician | Lookup | Yes | Junction record (carries frozen rate) |
| Week Number | weekNumber | Number | Yes | Matches InstallationCost.weekNumber |
| Week Start Date | weekStartDate | Date | Yes | |
| Week End Date | weekEndDate | Date | Yes | |
| **Labor Hours** | | | | |
| Container Unload | containerUnload | Number | No | Hours |
| Woodbucks | woodbucks | Number | No | Hours |
| Waterproofing | waterproofing | Number | No | Hours |
| Installation Labor | installationLabor | Number | No | Hours |
| Travel | travel | Number | No | Hours |
| Water Testing | waterTesting | Number | No | Hours |
| Sills | sills | Number | No | Hours |
| Finish Caulking | finishCaulking | Number | No | Hours |
| Screen/Lutron/Shades | screenLutronShades | Number | No | Hours |
| Punch List Work | punchListWork | Number | No | Hours |
| Finish Hardware | finishHardware | Number | No | Hours |
| Final Adjustments | finalAdjustments | Number | No | Hours |
| **Expenses** | | | | |
| Per Diem | perDiem | Currency | No | |
| Mileage | mileage | Currency | No | |
| Materials | materials | Currency | No | |

All fields default to 0 when created by the trigger.

Unique constraint: one expense record per technician per week per installation (installation + installationTechnician + weekNumber).

---

## 2. Trigger: `create-installation-costs`

### Registration

```
triggers/create-installation-costs/
├── index.ts              # TriggerHandler
└── trigger.config.ts     # TriggerManifest
```

Manifest:
- **id:** `create-installation-costs`
- **name:** Create Installation Cost Records
- **objectApiName:** `Installation`
- **events:** `['afterCreate', 'afterUpdate']`
- **icon:** `Calculator`

### Trigger Logic

**Guard conditions** (return null immediately if any fail):
1. Record must have `startDate` and `endDate` set
2. `startDate` must be before `endDate`
3. At least one InstallationTechnician junction record must exist for this installation

**Week Calculation Algorithm:**
- Reference Sunday: March 17, 2024
- Calculate week boundaries by finding the Sunday on or after `startDate`, then incrementing by 7 days
- Week 1: startDate → first Sunday boundary (partial week)
- Weeks 2+: full 7-day increments
- Last week: ends at endDate (may be partial)
- Week count = number of boundary segments

**Record Creation:**
1. Query existing InstallationCost records for this installation (dedup check)
2. Query existing InstallationTechExpense records for this installation (dedup check)
3. Query InstallationTechnician junction records to get assigned technicians
4. For each week not already covered by an InstallationCost record:
   - Create InstallationCost with weekNumber, weekStartDate, weekEndDate, all cost fields = 0
5. For each technician × week combination not already covered:
   - Create InstallationTechExpense with weekNumber, dates, all fields = 0
6. Return null (no field updates to the Installation record itself — side effects only)

**Deduplication:** Checked by (installation + weekNumber) for costs and (installation + installationTechnician + weekNumber) for tech expenses. Prevents duplicates when the Installation is re-saved.

**Error handling:** Log and return null. Never block the record save.

### Trigger vs Controller Responsibility

Two user flows to consider:

**Flow A — Dates first, then technicians:**
1. User creates Installation with dates → trigger fires → creates InstallationCost records (no techs yet)
2. User assigns technician via controller → controller creates junction + creates InstallationTechExpense records for all existing weeks

**Flow B — Everything at once (or dates added later):**
1. User creates Installation without dates → trigger fires, guard fails → nothing
2. User assigns technician via controller → junction created, no weeks exist yet
3. User sets dates → trigger fires on update → creates InstallationCost records + queries junctions → creates InstallationTechExpense records

**Rule:** The trigger always handles bulk creation when dates change. The controller handles incremental creation when technicians are added to an existing installation with weeks.

---

## 3. Controller: `installation-grid`

### Registration

```
controllers/installation-grid/
├── index.ts              # registerRoutes function
└── controller.config.ts  # ControllerManifest
```

Manifest:
- **id:** `installation-grid`
- **name:** Installation Grid Controller
- **objectApiName:** `Installation`
- **routePrefix:** `/controllers/installation-grid`
- **icon:** `Table`

### API Endpoints

All endpoints require authentication. The controller checks `ControllerSetting.enabled` at request time and returns 403 if disabled.

#### GET `/:installationId/data` — Full data wrapper

Returns all data needed to render the cost grid:

```typescript
{
  installation: Record                    // The Installation record with all fields
  costs: InstallationCost[]              // All weekly cost records, sorted by weekNumber
  techExpenses: {
    [technicianId: string]: {
      technician: { id, name, assignedHourlyRate }
      expenses: InstallationTechExpense[]  // Sorted by weekNumber
    }
  }
  weekCount: number
}
```

Queries:
1. Installation record by ID (from Record table, JSON data)
2. All InstallationCost records where installation = ID, ordered by weekNumber
3. All InstallationTechExpense records where installation = ID, ordered by weekNumber
4. All InstallationTechnician junction records to get technician names + frozen rates

#### PUT `/:installationId/costs` — Bulk update cost records

Body: `{ updates: Array<{ id: string, [fieldApiName: string]: number }> }`

For each update:
- Look up the InstallationCost record by ID
- Validate it belongs to the specified installation
- Round all numeric values to 2 decimal places
- Update the record's JSON data

#### PUT `/:installationId/tech-expenses` — Bulk update tech expense records

Body: `{ updates: Array<{ id: string, [fieldApiName: string]: number }> }`

Same pattern as cost updates but for InstallationTechExpense records.

#### POST `/:installationId/recalculate` — Recalculate totals

Computes and saves:
1. **techExpenseTotal**: For each InstallationTechExpense record, calculate total weekly cost = (sum of all hour fields × assignedHourlyRate from junction) + perDiem + mileage + materials. Sum across all records.
2. **finalCost**: Sum of all InstallationCost actual fields + techExpenseTotal
3. **finalProfit**: installationBudget - finalCost

Updates the Installation record with these three values.

#### POST `/:installationId/weeks/add` — Add a week

1. Extend `endDate` by 7 days on the Installation record
2. Calculate the new week number and dates
3. Create a new InstallationCost record for the new week
4. Create InstallationTechExpense records for each assigned technician × new week

#### POST `/:installationId/weeks/remove` — Remove last week

1. Find the highest weekNumber for this installation
2. Delete the InstallationCost record for that week
3. Delete all InstallationTechExpense records for that week
4. Shorten `endDate` by 7 days on the Installation record
5. Validation: cannot remove if only 1 week remains

#### GET `/:installationId/technicians` — List assigned technicians

Returns InstallationTechnician junction records with technician details:
```typescript
Array<{
  junctionId: string
  technicianId: string
  technicianName: string
  assignedHourlyRate: number
}>
```

#### POST `/:installationId/technicians` — Assign technician

Body: `{ technicianId: string }`

1. Look up Technician record, get current hourlyRate
2. Create InstallationTechnician junction with frozen `assignedHourlyRate`
3. If the installation already has weeks, create InstallationTechExpense records for each existing week
4. Return the new junction record

#### DELETE `/:installationId/technicians/:junctionId` — Remove technician

1. Delete all InstallationTechExpense records linked to this junction
2. Delete the InstallationTechnician junction record

#### PUT `/:installationId/estimates` — Update estimated costs

Body: `{ [estimatedFieldApiName: string]: number }`

Updates the estimated cost fields on the Installation record. Validates that only `estimated*` fields are being set.

---

## 4. Object Definition Approach

All 4 new objects (Technician, InstallationTechnician, InstallationCost, InstallationTechExpense) and the Installation extensions are defined in `apps/api/src/ensure-core-objects.ts` alongside existing core objects.

The trigger and controller are registered in their respective registries:
- `packages/triggers/src/index.ts` — add `'create-installation-costs'` to TRIGGER_IDS
- `packages/controllers/src/index.ts` — add `'installation-grid'` to CONTROLLER_IDS
- `apps/api/src/triggers/registry.ts` — add registration
- `apps/api/src/controllers/registry.ts` — add registration

---

## 5. Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/triggers/create-installation-costs/trigger.config.ts` | Trigger manifest |
| `apps/api/src/triggers/create-installation-costs/index.ts` | Trigger handler (week calc, child record creation) |
| `apps/api/src/controllers/installation-grid/controller.config.ts` | Controller manifest |
| `apps/api/src/controllers/installation-grid/index.ts` | All API endpoints (data wrapper, CRUD, recalculate, week mgmt, technician mgmt, estimates) |

## 6. Files to Modify

| File | Change |
|------|--------|
| `apps/api/src/ensure-core-objects.ts` | Add Technician object, extend Installation fields, add InstallationTechnician, InstallationCost, InstallationTechExpense objects |
| `packages/triggers/src/index.ts` | Add `'create-installation-costs'` to TRIGGER_IDS |
| `packages/controllers/src/index.ts` | Add `'installation-grid'` to CONTROLLER_IDS |
| `apps/api/src/triggers/registry.ts` | Import and register create-installation-costs trigger |
| `apps/api/src/controllers/registry.ts` | Import and register installation-grid controller |

---

## 7. Verification Plan

1. **Objects seeded correctly:**
   - Start the API, verify Technician, InstallationTechnician, InstallationCost, InstallationTechExpense objects exist in the schema
   - Verify Installation object has all new fields
2. **Trigger works:**
   - Create an Installation record with startDate, endDate, and assign a technician
   - Verify InstallationCost records are auto-created (one per week)
   - Verify InstallationTechExpense records are auto-created (one per tech per week)
   - Re-save the installation — no duplicate records created
3. **Controller endpoints work:**
   - `GET /:id/data` returns the full data wrapper
   - `PUT /:id/costs` updates cost records
   - `PUT /:id/tech-expenses` updates tech expense records
   - `POST /:id/recalculate` computes correct totals
   - `POST /:id/weeks/add` and `/:id/weeks/remove` adjust week count
   - `POST /:id/technicians` assigns with frozen rate
   - `DELETE /:id/technicians/:junctionId` cleans up expenses
4. **Settings UI:**
   - Navigate to Settings > Automations
   - Trigger "Create Installation Cost Records" appears in the Triggers tab
   - Controller "Installation Grid Controller" appears in the Controllers tab
   - Enable/disable toggles work
5. **Historical rate protection:**
   - Assign a technician at rate $50/hr
   - Update the Technician's hourlyRate to $60/hr
   - Verify the InstallationTechnician junction still shows $50/hr
