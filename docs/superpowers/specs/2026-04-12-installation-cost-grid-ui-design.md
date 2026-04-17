# Installation Cost Grid UI — Phase 2 Design

## Context

Phase 1 built the backend: data model (Technician, InstallationTechnician, InstallationCost, InstallationTechExpense), a trigger that auto-creates child records, and a controller with 10 API endpoints for data, CRUD, calculations, and technician management.

Phase 2 builds the **Cost Grid Widget** — an internal widget placed on the Installation record page that lets users view and edit weekly installation costs and per-technician labor expenses.

**Dependencies:** Phase 1 controller endpoints at `/controllers/installation-grid/`.

---

## 1. Widget Registration

Register as a new internal widget type `InstallationCostGrid`.

**Widget manifest:**
- **id:** `installation-cost-grid`
- **name:** Installation Cost Grid
- **icon:** `Table`
- **category:** `internal`
- **defaultDisplayMode:** `full`

**Widget config type:** `InstallationCostGrid` (added to `WidgetType` union in `schema.ts`)

**Config interface:**
```typescript
interface InstallationCostGridConfig {
  type: 'InstallationCostGrid'
}
```

No user-configurable settings — the widget auto-detects the Installation record it's placed on.

**Files:**
- `apps/web/widgets/internal/installation-cost-grid/widget.config.ts`
- `apps/web/widgets/internal/installation-cost-grid/index.tsx` (main component)
- `apps/web/widgets/internal/installation-cost-grid/components/` (sub-components)
- Register in `apps/web/widgets/internal/registry.ts`
- Add `InstallationCostGrid` to `WidgetType` union and `WidgetConfig` union in `apps/web/lib/schema.ts`
- Add to page editor palette in `apps/web/app/object-manager/[objectApi]/page-editor/palette-components.tsx`

---

## 2. Widget Layout

### KPI Header Bar

A horizontal bar at the top showing three financial KPIs:

| KPI | Source | Color |
|-----|--------|-------|
| Budget | `installation.data.installationBudget` | Navy (#151f6d) |
| Total Cost | `installation.data.finalCost` | Navy (#151f6d) |
| Profit | `installation.data.finalProfit` | Green (#2e8540) if positive, Red (#dc3545) if negative |

Profit also shows percentage: `(finalProfit / installationBudget) * 100`.

Background: gradient light blue (#f0f4ff → #e8eeff). Dividers between KPIs.

### Toolbar

A horizontal row below the KPI bar with:

| Control | Type | Action |
|---------|------|--------|
| Date range | Display (read-only) | Shows `startDate – endDate` from Installation |
| Week count | Badge | Shows number of InstallationCost records |
| + Week | Green button | Calls `POST /:id/weeks/add`, refreshes data |
| − Week | Red button | Calls `POST /:id/weeks/remove`, refreshes data |
| Manage Technicians | Button | Opens technician management modal |
| Recalculate | Button | Calls `POST /:id/recalculate`, refreshes KPIs |
| Save | Navy button (primary) | Saves all dirty cost + tech expense records |

The Save button shows a dirty indicator (dot or text) when there are unsaved changes.

### Tabs

Three tabs below the toolbar:

1. **Project Costs** — weekly cost grid
2. **Technicians (N)** — per-technician expense cards, count in tab label
3. **Summary** — category-level totals breakdown

---

## 3. Project Costs Tab

An editable table with one row per week.

**Columns:**

| Column | Field | Editable | Style |
|--------|-------|----------|-------|
| Week | weekNumber | No | Bold label "Wk N" |
| Flights | flightsActual | Yes | Input |
| Lodging | lodgingActual | Yes | Input |
| Airport | airportTransportation | Yes | Input |
| Car Rental | carRental | Yes | Input |
| Parking | parking | Yes | Input |
| Equipment | equipment | Yes | Input |
| Misc | miscellaneousExpenses | Yes | Input |
| WP | waterproofing | Yes | Input |
| WB | woodBucks | Yes | Input |
| Weekly Total | Calculated | No | Blue background, left border, bold |

**Weekly Total** = sum of all 9 cost fields for that row. Calculated client-side on every input change.

**Totals Row:** Last row shows column sums. Amber/gold background (#fef3c7), bold dark amber text (#92400e).

**Editable cells:** Rendered as `<input type="number">` with right-aligned text. On change, the value is stored in local state (dirty). Only persisted when Save is clicked.

**Horizontal scrolling:** The table is wider than most screens. Wrap in `overflow-x: auto` with the Week column sticky on the left.

---

## 4. Technicians Tab

Shows one **collapsible card** per assigned technician, stacked vertically.

### Card Header

Each card shows:
- Technician name
- Frozen hourly rate (e.g., "$50/hr")
- Total cost for this technician across all weeks (calculated client-side)

Clicking the header toggles the card body (collapsed/expanded).

### Card Body — Tech Expense Grid

An editable table with one row per week.

**Columns:**

| Column | Field | Editable | Color |
|--------|-------|----------|-------|
| Week | weekNumber | No | — |
| WB | woodbucks | Yes | Light blue (#b3d9ff) tint |
| WP | waterproofing | Yes | Light green (#b3ffb3) tint |
| Labor | installationLabor | Yes | Light orange (#ffe6b3) tint |
| Travel | travel | Yes | Light orange tint |
| Water Test | waterTesting | Yes | Light orange tint |
| Sills | sills | Yes | Light orange tint |
| Caulking | finishCaulking | Yes | Light orange tint |
| Screen | screenLutronShades | Yes | Light orange tint |
| Punch | punchListWork | Yes | Light orange tint |
| Hardware | finishHardware | Yes | Light orange tint |
| Adjustments | finalAdjustments | Yes | Light orange tint |
| Unload | containerUnload | Yes | Light orange tint |
| Per Diem | perDiem | Yes | Darker orange (#ffb366) tint |
| Mileage | mileage | Yes | Darker orange tint |
| Materials | materials | Yes | Darker orange tint |
| Total Hours | Calculated | No | Blue background |
| Weekly Cost | Calculated | No | Blue background |

**Total Hours** = sum of all 12 labor hour fields.

**Weekly Cost** = (Total Hours × assignedHourlyRate) + perDiem + mileage + materials. Calculated client-side.

**Totals Row:** Same amber/gold styling as the Project Costs tab.

---

## 5. Summary Tab

A simple read-only table showing total costs by category. No editing.

**Rows:**

| Category | Total |
|----------|-------|
| Flights | Sum of all flightsActual |
| Lodging | Sum of all lodgingActual |
| Airport Transportation | Sum of all airportTransportation |
| Car Rental | Sum of all carRental |
| Parking | Sum of all parking |
| Equipment | Sum of all equipment |
| Miscellaneous | Sum of all miscellaneousExpenses |
| Waterproofing (Materials) | Sum of all waterproofing (from InstallationCost) |
| Wood Bucks (Materials) | Sum of all woodBucks (from InstallationCost) |
| **Subtotal: Project Costs** | Sum of above |
| | |
| Technician Labor | Sum of (hours × rate) across all tech expenses |
| Per Diem | Sum of all perDiem |
| Mileage | Sum of all mileage |
| Materials (Tech) | Sum of all materials (from InstallationTechExpense) |
| **Subtotal: Technician Costs** | Sum of above |
| | |
| **Grand Total** | Project + Technician subtotals |

All values calculated client-side from the loaded data. Phase 3 will add estimated vs. actual variance columns.

---

## 6. Technician Management Modal

Opened via the "Manage Technicians" toolbar button. A dialog/modal with:

### Assigned Technicians List

A list of currently assigned technicians, each showing:
- Name
- Frozen hourly rate
- Remove button (with confirmation)

### Add Technician Section

- A searchable dropdown/combobox to select from existing Technician records
- Shows technician name + current hourly rate
- "Assign" button that calls `POST /:id/technicians`
- After assignment, the list updates and the tech appears in the grid

### Create New Technician (inline)

- A collapsible "Create New" section within the modal
- Fields: Name (required), Hourly Rate (required)
- Creates the Technician record first, then assigns to the installation
- Keeps the flow within the modal without navigating away

---

## 7. Data Flow

### Loading

1. Widget mounts with `record.id` (Installation record ID) from widget props
2. Calls `GET /controllers/installation-grid/:id/data`
3. Stores response in component state: `{ installation, costs, techExpenses, weekCount }`
4. Renders KPIs, tabs, and grids from this state

### Editing

1. User types in an editable cell
2. Value stored in local `dirtyChanges` state (map of recordId → field → value)
3. Client-side totals recalculate immediately from the combined clean + dirty values
4. Save button shows dirty indicator

### Saving

1. User clicks Save
2. Collect all dirty cost changes → `PUT /:id/costs` with `{ updates: [...] }`
3. Collect all dirty tech expense changes → `PUT /:id/tech-expenses` with `{ updates: [...] }`
4. Call `POST /:id/recalculate` to update Installation totals
5. Reload data via `GET /:id/data`
6. Clear dirty state
7. Show success toast

### Week Management

- **Add Week:** `POST /:id/weeks/add` → reload data → new row appears in grids
- **Remove Week:** Confirmation dialog → `POST /:id/weeks/remove` → reload data

### Technician Management

- **Assign:** Modal → select tech → `POST /:id/technicians` → reload data → new card appears
- **Remove:** Confirmation → `DELETE /:id/technicians/:junctionId` → reload data → card disappears

---

## 8. Component File Structure

```
apps/web/widgets/internal/installation-cost-grid/
├── widget.config.ts                    # Widget manifest
├── index.tsx                           # Main component (data loading, state, layout)
├── components/
│   ├── kpi-bar.tsx                     # Budget / Total Cost / Profit display
│   ├── toolbar.tsx                     # Date range, week buttons, save, manage techs
│   ├── project-costs-tab.tsx           # Editable weekly cost grid
│   ├── technicians-tab.tsx             # Stacked tech cards container
│   ├── tech-expense-card.tsx           # Single technician's expense grid
│   ├── summary-tab.tsx                 # Category totals breakdown
│   └── technician-modal.tsx            # Assign/create/remove technicians
├── hooks/
│   └── use-installation-data.ts        # Data fetching + dirty state management
└── utils/
    └── calculations.ts                 # Client-side total calculations
```

Each sub-component receives data via props from the parent. The `useInstallationData` hook manages:
- API calls to the controller
- Dirty state tracking
- Save orchestration
- Reload after mutations

---

## 9. Files to Create

| File | Purpose |
|------|---------|
| `widgets/internal/installation-cost-grid/widget.config.ts` | Manifest |
| `widgets/internal/installation-cost-grid/index.tsx` | Main widget component |
| `widgets/internal/installation-cost-grid/components/kpi-bar.tsx` | KPI header |
| `widgets/internal/installation-cost-grid/components/toolbar.tsx` | Action toolbar |
| `widgets/internal/installation-cost-grid/components/project-costs-tab.tsx` | Cost grid |
| `widgets/internal/installation-cost-grid/components/technicians-tab.tsx` | Tech cards container |
| `widgets/internal/installation-cost-grid/components/tech-expense-card.tsx` | Single tech grid |
| `widgets/internal/installation-cost-grid/components/summary-tab.tsx` | Summary totals |
| `widgets/internal/installation-cost-grid/components/technician-modal.tsx` | Tech management |
| `widgets/internal/installation-cost-grid/hooks/use-installation-data.ts` | Data hook |
| `widgets/internal/installation-cost-grid/utils/calculations.ts` | Calculation helpers |

## 10. Files to Modify

| File | Change |
|------|--------|
| `apps/web/lib/schema.ts` | Add `InstallationCostGrid` to `WidgetType` union, add `InstallationCostGridConfig` interface, add to `WidgetConfig` union |
| `apps/web/widgets/internal/registry.ts` | Import and register the widget |
| `apps/web/app/object-manager/[objectApi]/page-editor/palette-components.tsx` | Add to widget palette |

---

## 11. Verification Plan

1. **Widget appears in page editor palette:** Open Object Manager > Installation > Page Editor. "Installation Cost Grid" appears in the widget palette and can be dragged onto the layout.
2. **Widget renders on record page:** Navigate to an Installation record. The cost grid widget loads, shows KPIs, toolbar, and tabs.
3. **Project Costs tab works:** Editable cells accept input. Weekly totals calculate in real-time. Totals row sums correctly. Save persists changes.
4. **Technicians tab works:** Cards show for each assigned technician. Labor hours and expenses are editable. Total hours and weekly cost calculate correctly per tech.
5. **Summary tab works:** Shows correct category totals derived from the loaded data.
6. **Toolbar actions work:** Add/Remove week creates/removes rows. Recalculate updates KPIs. Manage Technicians opens the modal.
7. **Technician modal works:** Lists assigned techs. Can assign new tech (searchable). Can remove tech (with confirmation). Can create new tech inline.
8. **Dirty state indicator:** Save button shows indicator when changes are pending. Clears after successful save.
