# Service Department Module — Design Spec

> **⚠️ SUPERSEDED 2026-04-20** — This v1 spec is preserved for history only. The authoritative design is now [v2 spec (2026-04-20)](./2026-04-20-service-department-module-design-v2.md), which was produced from a pressure-test brainstorming pass. Material changes include: 7-state lifecycle (Open/On Hold/Cancelled added), walled garden tech permissions, merged Schedule page (Calendar + Assignment Board), Tischler-as-Property pattern for Internal WOs, intake source tracking, dropped overtime logic, and dropped structured Tool object. See the "Deltas from v1 spec" section of the v2 spec for the full list.

## Context

Tischler Windows is migrating their Service Department from Salesforce to the TischlerCRM. The Salesforce system had significant limitations: all 10-15 service technicians shared a single login, tech email addresses were hardcoded across 4+ code files, the tech assignment system was mid-migration between a legacy multi-picklist and a junction table, and half the automation flows were in Draft state.

The new CRM gives every technician their own user account, which fundamentally changes what's possible. This spec designs a Service Department module that leverages the CRM's dynamic metadata architecture (CustomObject → CustomField → Record) and existing patterns to deliver a significantly better experience than the Salesforce system.

**Key improvements over Salesforce:**
- Individual tech logins with graduated permissions
- Property-anchored work orders (inheriting team members, no duplicate contact fields)
- Shared Technician object across Install and Service departments
- Historical rate protection via snapshots
- Visual scheduling (calendar + assignment board)
- Path-guided work order lifecycle with 24-hour tech edit window
- Tools checklist instead of free text
- Configurable automations (opt-out model via trigger engine)

---

## 1. Data Model

All objects use the existing `CustomObject` → `CustomField` → `Record` pattern with JSON data storage. No dedicated Prisma tables — consistent with the rest of the CRM.

### 1.1 Technician (Enhanced Existing Object)

Shared across Install and Service departments. Linked to a User record for login.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user` | Lookup → User | Yes | Links to CRM login account |
| `techCode` | Text | Yes, unique | Short identifier (e.g., "MM", "AS") |
| `departmentTags` | Multi-select Picklist | Yes | Values: Install, Service. Filters which contexts the tech appears in |
| `hourlyRate` | Currency | No | Current hourly rate |
| `overtimeRate` | Currency | No | Current overtime rate |
| `skills` | Multi-select Picklist | No | e.g., Glazing, Framing, Electrical |
| `active` | Checkbox | Yes | Default: true |
| `notes` | Long Text | No | Internal notes |

### 1.2 WorkOrder (`032`, Enhanced)

Anchored to a **Property** (not a Project). Supports both client service and internal work.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `property` | Lookup → Property | Conditional | Required when category = Client Service. Null for Internal |
| `project` | Lookup → Project | No | Optional context link |
| `workOrderCategory` | Picklist | Yes | Values: Client Service, Internal. Drives UI behavior and reporting |
| `workOrderStatus` | Picklist (Path) | Yes | Values: Scheduled → In Progress → Completed → Closed |
| `leadTech` | Lookup → Technician | No | Convenience field for the lead technician |
| `scheduledStartDate` | DateTime | No | |
| `scheduledEndDate` | DateTime | No | |
| `completedDate` | DateTime | No | Auto-set when status → Completed |
| `completedBy` | Lookup → User | No | Auto-set when status → Completed |
| `closedDate` | DateTime | No | Auto-set when status → Closed |
| `closedBy` | Lookup → User | No | Auto-set when status → Closed |
| `workDescription` | Long Text | No | |
| `toolsNeeded` | JSON/Structured | No | Checklist: array of `{ name, checked, isCustom }`. Predefined common tools + custom additions |
| `outsideContractors` | Long Text | No | Free text for non-system contractors |
| `customerSignature` | Text/URL | No | Future: signature capture |
| `signatureDate` | Date | No | |
| `invoiceNumber` | Text | No | |
| `totalEstimatedHours` | Roll-up | — | Sum of PunchListItem.estimatedHours |
| `totalActualHours` | Roll-up | — | Sum of TimeEntry.totalHours |
| `totalLaborCost` | Roll-up | — | Sum of TimeEntry.totalCost |
| `totalExpenses` | Roll-up | — | Sum of WorkOrderExpense.amount |
| `totalJobCost` | Formula | — | totalLaborCost + totalExpenses |

**Contacts:** No contact fields on WorkOrder. Contacts are inherited from the Property's team member associations.

### 1.3 WorkOrderAssignment (`034`)

Junction table: WorkOrder ↔ Technician. Replaces Salesforce's dual picklist/junction system.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `workOrder` | Lookup → WorkOrder | Yes | |
| `technician` | Lookup → Technician | Yes | |
| `isLead` | Checkbox | No | Only one per work order |
| `notes` | Long Text | No | Assignment-specific notes for this tech |
| `notified` | Checkbox | No | Whether the tech has been notified |
| `notifiedDate` | DateTime | No | When notification was sent |

### 1.4 PunchListItem (`035`)

Work items within a work order. Preserves the Salesforce model (it worked well).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `workOrder` | Lookup → WorkOrder | Yes | |
| `itemNumber` | Auto Number | — | Sequential within the work order |
| `location` | Text | No | Where in the building/property |
| `description` | Long Text | No | What needs to be done |
| `assignedTech` | Lookup → Technician | No | Specific tech for this item |
| `status` | Picklist | Yes | Values: Open, In Progress, Completed, N/A |
| `estimatedHours` | Number | No | |
| `estimatedMen` | Number | No | How many techs needed |
| `materialsInWarehouse` | Long Text | No | Materials already available |
| `materialsToOrder` | Long Text | No | Materials that need ordering |
| `specialEquipment` | Long Text | No | Special tools/equipment needed |
| `elevationPage` | Text | No | Reference to elevation drawings |
| `serviceDate` | Date | No | |

**Print capability:** Combined punch list PDF generation preserved from Salesforce.

### 1.5 TimeEntry (`036`)

Hours tracking per tech per work order. Rate snapshotted at creation for historical accuracy.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `workOrder` | Lookup → WorkOrder | Yes | |
| `technician` | Lookup → Technician | Yes | |
| `date` | Date | Yes | Defaults to today |
| `workHours` | Number | No | |
| `travelHours` | Number | No | |
| `prepHours` | Number | No | |
| `miscHours` | Number | No | |
| `totalHours` | Formula | — | workHours + travelHours + prepHours + miscHours |
| `rateAtEntry` | Currency | Yes | **Snapshotted** from tech's hourlyRate at creation. Immutable after save |
| `totalCost` | Formula | — | totalHours × rateAtEntry |
| `notes` | Long Text | No | |

**Rate snapshot:** When a TimeEntry is created, `rateAtEntry` is auto-populated from the tech's current `hourlyRate`. This ensures historical cost reporting remains accurate when techs receive raises.

### 1.6 WorkOrderExpense (`037`)

Per diem, mileage, materials, and other job expenses.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `workOrder` | Lookup → WorkOrder | Yes | |
| `technician` | Lookup → Technician | No | Which tech incurred the expense |
| `expenseType` | Picklist | Yes | Values: Per Diem, Mileage, Materials, Equipment, Other |
| `amount` | Currency | Yes | Total expense amount |
| `quantity` | Number | No | e.g., miles driven |
| `rate` | Currency | No | e.g., per-mile rate (snapshotted at entry) |
| `date` | Date | Yes | |
| `description` | Text | No | |

### 1.7 TechnicianRateHistory (`038`)

Audit trail for technician rate changes. Auto-created via trigger when rates change.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `technician` | Lookup → Technician | Yes | |
| `effectiveDate` | Date | Yes | When the new rate took effect |
| `previousRate` | Currency | Yes | Rate before the change |
| `newRate` | Currency | Yes | Rate after the change |
| `rateType` | Picklist | Yes | Values: Hourly, Overtime |
| `notes` | Long Text | No | Reason for change, authorization |

---

## 2. Work Order Lifecycle & Path

### 2.1 Status Path

```
Scheduled → In Progress → Completed → Closed
```

Visual path bar displayed at top of Work Order detail page. Users click the next status to advance.

### 2.2 Permissions Per Status

| Status | Who can advance | Who can edit | Special behavior |
|--------|----------------|-------------|-----------------|
| **Scheduled** | Manager or Lead Tech | Managers: all fields. Techs: view only | Default state on creation |
| **In Progress** | Lead Tech or Manager | Managers: all fields. Assigned techs: time entries, punch list updates, notes | Set when work begins on site |
| **Completed** | Lead Tech or Manager | Completing tech: 24-hr edit window for time/expenses. Managers: all fields | `completedDate` and `completedBy` auto-set |
| **Closed** | Manager only | Managers only | `closedDate`/`closedBy` auto-set. Final state. Locked for techs permanently |

### 2.3 24-Hour Tech Edit Window

When a tech advances a work order to Completed:
1. `completedDate` is stamped with current datetime
2. `completedBy` is set to the current user
3. For the next 24 hours, that tech can still edit their TimeEntry and WorkOrderExpense records on this work order
4. After 24 hours, those records lock for the tech (enforced by permission check comparing current time against `completedDate + 24h`)
5. Managers can still edit at any time until the WO is Closed

### 2.4 Internal Work Orders

When `workOrderCategory` = Internal:
- Property field is hidden and not required
- Work order does not appear in client-facing reports
- Same lifecycle, same tech assignments, same time tracking
- Reporting can filter/group by category

---

## 3. UI & Features

### 3.1 Manager Views

#### A. Schedule Calendar — "Where is everyone?"
- Week and month views with technicians as rows, days as columns
- Work orders rendered as colored blocks spanning their date range
- Color-coded by status: blue (Scheduled), green (In Progress), yellow (Completed), gray (Closed)
- Internal WOs visually distinguished (different pattern or icon)
- Click a block to open work order detail
- Filters: by tech, by category (Client/Internal), by status

#### B. Assignment Board — "Plan upcoming work"
- Left column: unassigned work orders (pool)
- Right area: tech cards showing current load and upcoming assignments
- Drag work orders from pool onto tech cards to assign
- Each tech card shows total scheduled hours for the visible period
- Quick-create work order directly from the board

#### C. Work Order List — enhanced standard list page
- Uses existing list page pattern with sidebar filters
- Additional filters: by tech, by property, by category, by date range
- Bulk actions: assign tech, change status

#### D. Cost Dashboard — manager reporting
- Per-tech cost summaries (hours × snapshotted rate, expenses)
- Per-work-order total cost breakdown (labor + expenses)
- Period comparisons (this month vs last, this quarter vs last)
- Hours breakdown by category (work, travel, prep, misc)
- Exportable to CSV/Excel for payroll processing

### 3.2 Technician Views

#### E. Tech Dashboard — "My work today"
- Today's assignments at top: property address, start time, team members, tools checklist
- Upcoming assignments (next 7-14 days)
- Action buttons: Log Hours, Update Status, View Punch List
- Pending items: WOs in Completed status still within 24-hr edit window
- Missing hours alerts: completed WOs without time entries

#### F. Time Entry Form — streamlined for field use
- Select date (defaults to today)
- Simple number inputs for work/travel/prep/misc hours
- Rate auto-populated and read-only (snapshotted from current hourly rate)
- Quick notes field
- Submit shows running total for the work order

#### G. Punch List View — per work order
- List of items with status toggles (Open → In Progress → Completed)
- Add new items on-the-fly
- Print combined punch list as PDF

### 3.3 Shared Components

#### H. Work Order Detail Page — enhanced RecordDetailPage
- **Path bar** at top: lifecycle status with advancement buttons
- **Summary section**: property info with inherited contacts, schedule, description
- **Tools checklist**: checkboxes (predefined common tools + custom additions)
- **Related tabs**: Assignments, Punch List, Time Entries, Expenses
- **Activity feed**: status changes, notifications sent, notes

#### I. Notification System — via existing trigger engine
All notifications support both email and in-app delivery. All are configurable via Settings > Automations (opt-out model — enabled by default, managers can disable specific ones).

---

## 4. Roles & Permissions

### 4.1 New Profiles

| Profile | Purpose |
|---------|---------|
| **Service Manager** | Full access to service module objects and features |
| **Service Technician** | Graduated access — starts restricted, managers unlock capabilities |

Both belong to a **Service** department.

### 4.2 Permission Configuration

Specific object and field permissions are configured by the admin through the existing profile permission UI. The system provides the profile containers; the admin decides what each role can see and edit.

### 4.3 Graduated Access Model

The Service Technician profile starts with limited permissions. As techs become comfortable with the CRM, managers can progressively enable:
- Phase 1: View assigned WOs, log hours, update punch list status
- Phase 2: Create time entries, add notes, update WO status
- Phase 3: Create punch list items, mark WOs complete
- Phase 4: Full field access (if ever needed)

No code changes required — all managed through the existing permission system.

---

## 5. Automation Triggers

Using the existing trigger engine. All fire by default (opt-out model). Managers disable specific automations from Settings > Automations.

| Trigger | Event | Action |
|---------|-------|--------|
| **Tech Assigned** | WorkOrderAssignment created | Email + in-app notification to tech with WO details, property address, schedule, team |
| **Schedule Reminder** | 24 hours before WO scheduledStartDate | Email + in-app reminder to all assigned techs |
| **WO → Completed** | Status changes to Completed | Notify Service Managers that a WO is ready for review |
| **Hours Missing** | 48 hours post-completion, no TimeEntry exists | Reminder to assigned techs to log their hours |
| **Rate Changed** | Technician hourlyRate or overtimeRate updated | Auto-create TechnicianRateHistory record with previous/new rate and effective date |
| **24-hr Window Expired** | 24 hours after completedDate | Lock tech editing on that WO (enforced via permission check) |

---

## 6. PDF & Print

| Document | Purpose | Pattern |
|----------|---------|---------|
| **Punch List PDF** | Combined punch list items for a work order, formatted for print | Similar to existing PDF generation patterns |
| **Work Order Summary PDF** | Full WO summary: property, schedule, team, description, tools, punch list, costs | Similar to existing Quote Summary PDF |
| **Cost Report Export** | CSV/Excel of time entries and expenses per period | Standard export functionality |

---

## 7. Technical Implementation Notes

### 7.1 Architecture Approach
- **Approach A: Extend the Generic Record System** — all new objects defined as CustomObjects with fields stored as Records with JSON data
- Consistent with how every other CRM object works
- Leverages existing CRUD, permissions, search, relationships, page layouts, Object Manager
- Custom UI only where generic pages don't suffice (calendar, assignment board, tech dashboard, path component)

### 7.2 Record ID Prefixes
- Technician: existing or next available
- WorkOrderAssignment: `034`
- PunchListItem: `035`
- TimeEntry: `036`
- WorkOrderExpense: `037`
- TechnicianRateHistory: `038`

### 7.3 Key Files to Modify
- `packages/db/prisma/seed-full.ts` — register new objects, fields, relationships, page layouts
- `apps/web/app/` — new pages for calendar, assignment board, tech dashboard
- `apps/web/app/workorders/[id]/page.tsx` — enhance with path bar, related tabs
- `packages/triggers/` — new automation triggers
- `packages/types/` — shared types for new objects
- `apps/api/src/routes/` — any custom API endpoints beyond generic CRUD

### 7.4 Existing Patterns to Reuse
- `recordsService` — all CRUD operations
- `DynamicFormDialog` — form rendering for create/edit
- `RecordDetailPage` — base for detail views
- List page pattern from `apps/web/app/service/page.tsx`
- PDF generation pattern from existing Quote Summary PDF
- Trigger engine from `packages/triggers/`
- Permission checks via `canAccess()` and `hasAppPermission()`

---

## 8. Verification Plan

### 8.1 Data Model Verification
- Create each object via Object Manager and verify fields render correctly
- Create test records and verify relationships (WO → Property, WO → Assignments → Technician, etc.)
- Verify roll-up calculations (totalActualHours, totalJobCost)
- Verify rate snapshot: create TimeEntry, change tech rate, confirm old entry unchanged

### 8.2 Lifecycle Verification
- Walk a WO through Scheduled → In Progress → Completed → Closed
- Verify completedDate/completedBy auto-set
- Verify 24-hour edit window: tech can edit within window, locked after
- Verify manager can edit at all statuses
- Verify Closed status locks for all non-manager users

### 8.3 UI Verification
- Calendar view shows all techs and their scheduled work
- Assignment board allows drag-to-assign
- Tech dashboard shows correct filtered data for logged-in tech
- Punch list print generates correct PDF
- Cost dashboard shows accurate historical costs

### 8.4 Automation Verification
- Assign tech → notification fires
- 24 hours before start → reminder fires
- Mark complete → manager notification fires
- Change tech rate → TechnicianRateHistory record created
- Disable a trigger in Settings > Automations → verify it stops firing
