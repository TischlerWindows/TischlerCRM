# Service Department Module — Design Spec (v2)

> **Status:** Approved 2026-04-20. Supersedes [v1 spec (2026-04-16)](./2026-04-16-service-department-module-design.md) and its [v1 plan](../plans/2026-04-16-service-department-module.md).

## Context

The v1 spec at `docs/superpowers/specs/2026-04-16-service-department-module-design.md` and its implementation plan at `docs/superpowers/plans/2026-04-16-service-department-module.md` defined a Service Department module to migrate Tischler Windows' service workflow from Salesforce to TischlerCRM.

Before starting implementation, the user asked for a pressure-test pass — *"ensure what we want to build is the correct product, making sure we don't miss any little detail."* A brainstorming session on 2026-04-20 surfaced twelve gaps and edge cases in the v1 docs and resolved them. This v2 spec is the result.

The material changes vs v1 are captured in the "Deltas" section below. The rest of the spec is self-contained — read this file, not v1, as the authoritative design going forward.

---

## Deltas from v1 spec

### Scope removed (YAGNI'd out)
| Item | Reason |
|---|---|
| `overtimeRate` field on Technician | User: "I do not believe we need [overtime logic]" |
| Rate history for overtime changes | Dependent on `overtimeRate` — removed with it |
| Structured `Tool` object + checklist | User: rarely used today; free-text field is enough |
| Property-level maintenance / warranty tracking | Deferred entirely — revisit post-launch |
| Salesforce data migration | Deferred — Michael handles separately |
| Customer signature capture | Deferred but not precluded |
| Email/in-app notification triggers | Already deferred in v1 plan — stays deferred |

### Scope added
| Item | Reason |
|---|---|
| `Open` state (pre-scheduled) | WOs are often created before tech/date known |
| `On Hold` state | Needed for parts-late / weather / customer delay |
| `Cancelled` state (recoverable by manager) | Customer cancellations happen regularly |
| Modal reason UX for On Hold + Cancelled | User: "similar to closed loss on opportunities" |
| `workOrderSource` picklist (intake tracking) | User: "wouldn't be a bad idea to ask this question" |
| Tischler-as-Property pattern for Internal WOs | Resolves conflict: "everything is tied to a property" vs. Internal WOs |
| Dropbox widget on WO page layout | User: "existing widget, no need to plan for anything" |
| Mobile-first tech view | User: "tech view should have a thought of iPhone use" |
| Explicit walled garden permission model | Not spelled out in v1 |

### Scope changed
| Item | v1 | v2 |
|---|---|---|
| Schedule Calendar + Assignment Board | Two separate pages | **One merged Schedule page** (calendar grid + unassigned pool sidebar + drag-drop onto tech+day cells) |
| `workOrderStatus` picklist | 4 values | 7 values (Open, Scheduled, In Progress, On Hold, Completed, Closed, Cancelled) |
| `toolsNeeded` | Structured JSON checklist | Simple LongTextArea |
| Tech permissions | "admin decides" | Walled garden defaults spelled out below |

---

## 1. Data Model

Every object uses the existing `CustomObject → CustomField → Record` pattern.

### 1.1 Technician (enhanced)
Dropped `overtimeRate`. Otherwise matches v1 spec.

| Field | Type | Notes |
|---|---|---|
| `user` | Lookup → User | Login link |
| `techCode` | Text, unique | e.g., "MM", "AS" |
| `departmentTags` | MultiPicklist | Install / Service |
| `hourlyRate` | Currency | Current rate |
| `skills` | MultiPicklist | Glazing / Framing / Electrical / Plumbing / General |
| `active` | Checkbox | Default true |
| `notes` | LongTextArea | |

### 1.2 WorkOrder (enhanced)

New / changed fields:

| Field | Type | Notes |
|---|---|---|
| `property` | Lookup → Property | **Required, always** (Internal WOs anchor to a Tischler-owned property) |
| `workOrderCategory` | Picklist | Client Service / Internal |
| `workOrderSource` | Picklist | Customer Call / Warranty Claim / Maintenance Contract / Internal Request / Referred from Project / Other |
| `workOrderStatus` | Picklist | **Open / Scheduled / In Progress / On Hold / Completed / Closed / Cancelled** (default: Open) |
| `holdReason` | Picklist | Waiting on Parts / Waiting on Materials / Weather Delay / Customer Delay / Warranty Decision Pending / Subcontractor Delay / Tech Unavailable / Other |
| `holdNotes` | LongTextArea | Populated by the On Hold modal |
| `cancelReason` | Picklist | Customer Cancelled / Duplicate Work Order / Issue Resolved / Covered Under Different WO / Warranty Denied / Not Reproducible / Other |
| `cancelNotes` | LongTextArea | Populated by the Cancelled modal |
| `leadTech` | Lookup → Technician | Denormalized convenience (also derivable from Assignments) |
| `scheduledStartDate` / `scheduledEndDate` | DateTime | |
| `completedDate` / `completedBy` | DateTime / Lookup → User | Auto-set by trigger on → Completed |
| `closedDate` / `closedBy` | DateTime / Lookup → User | Auto-set by trigger on → Closed |
| `workDescription` | LongTextArea | |
| `toolsNeeded` | LongTextArea | Free text (not structured) |
| `outsideContractors` | LongTextArea | Free text |
| `invoiceNumber` | Text | |
| `totalEstimatedHours` / `totalActualHours` | Number | Roll-up via trigger |
| `totalLaborCost` / `totalExpenses` / `totalJobCost` | Currency | Roll-up via trigger |

**Dropped from v1:** `customerSignature`, `signatureDate` (deferred with customer touchpoints).

**Contacts:** inherited from Property team members, not duplicated on WO.

### 1.3–1.6 Assignment / PunchList / TimeEntry / Expense — unchanged from v1

No changes to WorkOrderAssignment, PunchListItem, TimeEntry, or WorkOrderExpense. Field lists stand as-is. See v1 spec for field definitions.

### 1.7 TechnicianRateHistory — simplified

Drop `rateType` and only track hourly (no overtime). Keep `effectiveDate`, `previousRate`, `newRate`, `notes`, `technician`.

### 1.8 Tischler-owned Property records (new seed data)

During `ensure-core-objects`, seed three Property records if they don't exist:
- **Tischler HQ — Office** (category: Internal)
- **Tischler HQ — Warehouse** (category: Internal)
- **Tischler Fleet — Service Trucks** (category: Internal)

Internal WOs anchor to one of these. No special-case logic in reporting — category filter does the work.

---

## 2. Work Order Lifecycle (state machine)

### States

| State | Meaning | Default? |
|---|---|---|
| **Open** | Created, may lack tech or date | **Yes — default on creation** |
| **Scheduled** | Tech + start date both set | |
| **In Progress** | Tech has started work | |
| **On Hold** | Paused (has reason) | |
| **Completed** | Tech declared done (24-hr tech edit window) | |
| **Closed** | Manager signed off, locked for all | Terminal |
| **Cancelled** | Won't be performed (has reason) | Terminal* |

*Cancelled is recoverable by Manager: Cancelled → Open, reason preserved.

### Transitions

Happy path: `Open → Scheduled → In Progress → Completed → Closed`

Branches:
- **Scheduled ↔ On Hold** (bidirectional, Manager or Lead Tech)
- **In Progress ↔ On Hold** (bidirectional, Manager or Lead Tech)
- **Open / Scheduled / In Progress / On Hold → Cancelled** (Manager only)
- **Cancelled → Open** (Manager only, recover)
- **Completed → In Progress** (Manager only, reopen for rework — resets 24-hr window)
- **Scheduled → Open** (tech removed or date cleared)

### Modal reason UX

When a user advances to **On Hold** or **Cancelled**, a modal intercepts the transition:
- Dropdown for reason (picklist values above)
- Long text notes field
- Save → transition completes; Cancel → status reverts
- Pattern mirrors Opportunity Closed Lost modal

### Auto-stamping (lifecycle trigger)

On status change:
- → `Completed`: stamp `completedDate` and `completedBy`
- → `Closed`: stamp `closedDate` and `closedBy`
- `Completed → In Progress`: clear `completedDate` / `completedBy` (resets 24-hr window on re-completion)
- Invalid transitions revert silently (same as v1)

### Reason-field semantics

`holdReason` / `holdNotes` / `cancelReason` / `cancelNotes` hold the **most recent** occurrence only. If a WO goes On Hold twice, the second modal overwrites the first. The full audit trail lives in the activity feed (every transition logged with timestamp, user, and reason). A recovered Cancelled WO keeps its cancel reason fields populated for historical context until the WO is cancelled again.

---

## 3. Walled Garden Permissions (tech profile)

The Service Technician profile operates on a strict walled garden, analogous to how salespeople only see their own Opportunities/Leads.

### What a tech sees

| Entity | Visibility |
|---|---|
| WorkOrders where they are currently assigned | Full (edit per field permissions) |
| WorkOrders they were previously removed from | **Hidden entirely** |
| Property linked to a visible WO | **Read-only** view |
| Other Technicians assigned to the same WO | Visible (roster helps coordination) |
| PunchListItems on a visible WO | **All visible + editable by the WO team** |
| TimeEntries on a visible WO | **Only their own** (others hidden) |
| WorkOrderExpenses on a visible WO | **Only their own** (others hidden) |
| Accounts / Opportunities / Quotes / Projects / other modules | **Hidden by default** (admin can grant per-field if ever needed) |

### Manager profile

Service Managers see everything in the Service module. No walled garden.

### 24-hour edit window (clarified)

- The 24-hour window applies **only to the assigned tech who completed the WO**.
- Starts at `completedDate`.
- After window expires: tech can no longer edit their TimeEntry / WorkOrderExpense records on that WO.
- **Managers are never cut off** — they can edit at any status until Closed.
- Enforced via permission check comparing `now()` against `completedDate + 24h` in the TimeEntry / Expense widgets and API layer.

### Implementation notes

- Leverage existing `canAccess()` / `hasAppPermission()` helpers.
- TimeEntry and Expense widgets filter client-side by current user ID when the user is a tech; managers see all.
- The Service Technician profile ships with these defaults pre-configured (not "admin decides from scratch").

---

## 4. UI Pages & Widgets

### 4.1 Enhanced WorkOrder Detail
Standard `RecordDetailPage` with:
- **Path bar** at top showing the 7 states, clickable to advance
- **Reason modal** intercepts On Hold / Cancelled transitions
- **Dropbox widget** on page layout (existing widget, drops in place — no new field work)
- **Related tabs**: Assignments, Punch List, Time Entries, Expenses
- Each tab is a widget registered in `apps/web/widgets/internal/registry.ts`

### 4.2 Tech Dashboard (`/tech-dashboard`)
**Mobile-first design** — primary devices are iPhone + Surface Tablet in-vehicle.

Sections:
1. **Today** — WOs assigned to me with `scheduledStartDate = today`
2. **Upcoming** — next 14 days
3. **Pending Review** — my Completed WOs still within the 24-hr edit window
4. **Missing Hours** — my Completed WOs with no TimeEntry from me

Each WO card: property address, status badge, scheduled dates, teammates, quick-actions (Log Hours, Open WO).

Core field workflow is photo capture → Dropbox, handled by the Dropbox widget on the WO detail — not the dashboard itself.

### 4.3 Schedule (`/schedule`) — **merged Calendar + Assignment Board**

Single page serving both "where is everyone?" and "plan next week":
- **Main grid**: techs as rows, days as columns (week view default, month toggle available)
- **WO blocks**: colored by status, spanning their scheduled date range, click-to-open
- **Unassigned pool** (left sidebar): WOs in `Open` or `Scheduled` status with no tech
- **Drag-and-drop**: drag an unassigned WO onto a tech's row at a specific day cell → creates Assignment + sets `scheduledStartDate`
- **Filters**: category (Client / Internal / all), status
- Internal WOs visually distinguished (pattern or border)

Use `@dnd-kit` for drag-drop (as already planned in v1).

### 4.4 Cost Dashboard (`/cost-dashboard`) — unchanged from v1

- Summary cards, per-tech table, per-WO table, hours breakdown
- Date range picker, CSV export
- Uses snapshotted rates from TimeEntry.rateAtEntry for historical accuracy

### 4.5 Widgets (registered in `apps/web/widgets/internal/registry.ts`)

- `work-order-assignments` (tab on WO): add/remove techs, toggle lead
- `punch-list` (tab on WO): all items visible + editable for WO team; "Print PDF"
- `time-entries` (tab on WO): **scoped to current user for techs**, all for managers
- `work-order-expenses` (tab on WO): same scoping rule
- Dropbox widget (already exists — just placed on WO page layout)

---

## 5. Triggers

| Trigger | Events | Purpose |
|---|---|---|
| `rate-change-history` | Technician afterUpdate | Record hourly rate changes only (no overtime) |
| `snapshot-rate-on-time-entry` | TimeEntry beforeCreate/beforeUpdate | Snapshot rate + compute totals |
| `work-order-lifecycle` | WorkOrder beforeUpdate | Validate transitions, auto-stamp date/user fields |
| `work-order-rollup` | TimeEntry / WorkOrderExpense afterCreate/Update/Delete | Recompute roll-ups on parent WO |

**Deferred triggers** (add in a follow-up plan once email infra is confirmed):
- Tech Assigned notification
- Schedule Reminder (24hrs before)
- WO → Completed manager alert
- Hours Missing reminder

---

## 6. PDF & Print

- **Punch List PDF** — combined punch list for a WO (pattern same as Quote Summary PDF)
- **Work Order Summary PDF** — deferred to follow-up; not critical for v1
- **Cost Report CSV Export** — inline in Cost Dashboard

---

## 7. Roles & Profiles

Seed two profiles + one department during `ensure-core-objects`:

- **Service** department
- **Service Manager** profile — defaults grant full access to Service module objects
- **Service Technician** profile — defaults implement the walled garden described in §3

**Change from v1:** profile `permissions` JSON is **not** empty. It ships with the walled-garden defaults pre-configured so a tech can be productive immediately. Admin can still adjust via Settings > Profiles.

---

## 8. Critical Files to Modify

| Purpose | File |
|---|---|
| Object + field + seed definitions | `apps/api/src/ensure-core-objects.ts` |
| Record ID prefix registration | `packages/db/src/record-id.ts` |
| Triggers | `apps/api/src/triggers/{rate-change-history,snapshot-rate-on-time-entry,work-order-lifecycle,work-order-rollup}/` |
| Trigger registry | `apps/api/src/triggers/registry.ts` |
| Trigger ID list | `packages/triggers/src/index.ts` |
| Widgets | `apps/web/widgets/internal/{work-order-assignments,punch-list,time-entries,work-order-expenses}/` |
| Widget registry | `apps/web/widgets/internal/registry.ts` |
| New pages | `apps/web/app/{tech-dashboard,schedule,cost-dashboard}/page.tsx` |
| Nav registration | `apps/web/app/app-wrapper.tsx` (`hrefToObjectMap`) |

### Patterns to reuse (do not reinvent)

- `recordsService` — all CRUD
- `DynamicFormDialog` — create/edit forms
- `RecordDetailPage` — detail view base
- List page pattern from `apps/web/app/service/page.tsx`
- PDF pattern from existing Quote Summary PDF generator
- Trigger engine from `packages/triggers/`
- Permission helpers `canAccess()` / `hasAppPermission()`
- Existing Dropbox widget (Michael's integration — locate under `apps/web/widgets/` during implementation; drop onto WO page layout, no new field work)
- Opportunity Closed Lost modal — model the On Hold / Cancelled modals after it

---

## 9. Verification Plan

End-to-end test path, in order:

1. **Data model sanity** — restart API; Object Manager shows all new/enhanced objects with correct fields. Tischler-owned Property records seeded.
2. **Intake** — Service Manager creates a new WO via standard create form. Status = Open. Source = Customer Call. No tech/date required.
3. **Assign + schedule** — on the Schedule page, drag the WO from unassigned pool onto Tech A, Wednesday. Verify Assignment record created, `scheduledStartDate` set, status → Scheduled (auto).
4. **Walled garden** — log in as a tech not assigned to the WO; WO is invisible. Log in as Tech A; WO is visible with read-only Property view.
5. **Tech field flow** — Tech A opens the WO on their phone. Marks In Progress. Adds a punch list item. Logs 4 work hours + 1 travel hour. Verifies rate snapshot captured.
6. **Pause** — Tech A hits the "On Hold" transition. Modal appears, Tech A picks "Waiting on Parts" + notes. Status → On Hold; reason persists in the activity feed.
7. **Resume + complete** — move back to In Progress. Mark Completed. Modal does not appear. `completedDate` / `completedBy` stamped.
8. **24-hr window** — Tech A edits their time entry within 24h: allowed. Simulated 25h later: blocked. Manager edits at hour 25: allowed.
9. **Cancel + recover** — Manager cancels a different WO. Modal picks "Customer Cancelled". Status → Cancelled. Manager restores → Open; reason preserved.
10. **Manager review** — Manager reviews Completed WO, checks time entries + expenses + punch list. Advances to Closed. All records locked.
11. **Cost Dashboard** — verify per-tech / per-WO totals use snapshotted rates. Export CSV.
12. **Internal WO** — create WO with property = "Tischler Fleet — Service Trucks", category = Internal. Flows through same lifecycle.

---

## 10. Deferred for Follow-up Plans

These are explicitly out of scope for the refined v1 implementation. Track as future work:

1. Email / in-app notification triggers (Tech Assigned, Schedule Reminder, WO → Completed, Hours Missing)
2. Customer touchpoints — signature capture on Surface Tablet, invoice emails, "tech on the way" notifications
3. Property-level maintenance / warranty tracking + renewal reminders
4. Salesforce data migration (Michael leads)
5. Structured Tool object (revisit if the free-text field proves insufficient)
6. Work Order Summary PDF (only Punch List PDF in v1)

---

## Next Steps

1. A fresh implementation plan is generated from this spec via `superpowers:writing-plans` and placed at `docs/superpowers/plans/2026-04-20-service-department-module-v2.md`. The v1 plan at `docs/superpowers/plans/2026-04-16-service-department-module.md` is marked superseded.
2. Implementation proceeds task-by-task via `superpowers:subagent-driven-development`.
