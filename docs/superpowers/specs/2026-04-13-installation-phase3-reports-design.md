# Installation Phase 3: Variance Report & Executive Summary

## Context

Phase 1 built the backend (data model, trigger, controller). Phase 2 built the Cost Grid widget with tabs for Project Costs, Technicians, and a placeholder Summary tab. Phase 3 completes the financial reporting suite by replacing the Summary tab with a full Variance Report and adding an Executive Summary tab — both replicating the Salesforce originals exactly.

**Scope:** Two new tab components inside the existing InstallationCostGrid widget, plus 5 new estimated fields on the Installation object. No new API endpoints — the Phase 1 controller already provides everything needed.

---

## 1. Data Model Updates

### 5 New Estimated Fields on Installation Object

The Salesforce variance report has 18 categories. Phase 1 defined 15 estimated fields. These 5 are missing:

| Field | API Name | Type | Notes |
|-------|----------|------|-------|
| Estimated Labor Hours | estimatedLaborHours | Number | Hours, not currency |
| Estimated WP Labor | estimatedWaterproofingLabor | Currency | Waterproofing labor cost |
| Estimated WB Labor | estimatedWoodBucksLabor | Currency | Woodbucks labor cost |
| Estimated Travel Time | estimatedTravelTime | Currency | Travel time labor cost |
| Estimated Internal Labor | estimatedInternalLabor | Currency | Internal TUS labor cost |

**Files to update:**
- `apps/api/src/ensure-core-objects.ts` — add 5 fields to Installation definition
- `apps/web/lib/schema-service.ts` — add 5 fields to `ensureInstallationCostObjects` migration
- `apps/api/src/controllers/installation-grid/index.ts` — add to `ESTIMATED_FIELDS` allow-list
- `apps/web/widgets/internal/installation-cost-grid/utils/calculations.ts` — add to constants

---

## 2. Variance Report Tab

Replaces the existing `summary-tab.tsx`. Matches Salesforce's `installationVarianceReport` layout exactly.

### 2.1 Variance Categories

18 rows in this exact order, matching Salesforce:

| # | Label | Estimated Field | Type | Actual Calculation |
|---|-------|----------------|------|-------------------|
| 1 | Labor Hours | estimatedLaborHours | Hours | Sum of all tech expense LABOR_HOUR_FIELDS across all weeks |
| 2 | Technician Labor Cost | estimatedLaborCost | Currency | Sum of (total labor hours × assignedHourlyRate) per tech |
| 3 | Waterproofing Labor Cost | estimatedWaterproofingLabor | Currency | Sum of (waterproofing hours × assignedHourlyRate) per tech |
| 4 | Woodbucks Labor Cost | estimatedWoodBucksLabor | Currency | Sum of (woodbucks hours × assignedHourlyRate) per tech |
| 5 | Travel Time | estimatedTravelTime | Currency | Sum of (travel hours × assignedHourlyRate) per tech |
| 6 | Flights | estimatedFlights | Currency | Sum of flightsActual from InstallationCost |
| 7 | Lodging | estimatedHotel | Currency | Sum of lodgingActual from InstallationCost |
| 8 | Airport Transportation | estimatedAirportTransportation | Currency | Sum of airportTransportation from InstallationCost |
| 9 | Car Rental | estimatedCarRental | Currency | Sum of carRental from InstallationCost |
| 10 | Parking | estimatedParking | Currency | Sum of parking from InstallationCost |
| 11 | Equipment | estimatedEquipment | Currency | Sum of equipment from InstallationCost |
| 12 | Miscellaneous | estimatedMiscellaneous | Currency | Sum of miscellaneousExpenses from InstallationCost |
| 13 | Waterproofing | estimatedWaterproofing | Currency | Sum of waterproofing from InstallationCost |
| 14 | Woodbucks | estimatedWoodBucks | Currency | Sum of woodBucks from InstallationCost |
| 15 | Per Diem | estimatedPerDiem | Currency | Sum of perDiem from InstallationTechExpense |
| 16 | Mileage | estimatedMileage | Currency | Sum of mileage from InstallationTechExpense |
| 17 | Materials | estimatedMaterials | Currency | Sum of materials from InstallationTechExpense |
| 18 | Internal TUS Labor | estimatedInternalLabor | Currency | No automatic calculation — actual is 0 unless manually set |

### 2.2 Table Layout

**Columns:** Category | Estimated | Actual | Variance

- **Estimated column:** Editable `<input>` fields. Currency inputs show `$` formatting. Hours input shows plain number.
- **Actual column:** Read-only. Calculated client-side from the loaded cost/tech expense data (same data the widget already has).
- **Variance column:** Read-only. Calculated as `Estimated - Actual`. Color-coded:
  - Positive (under budget): green text (#27ae60)
  - Negative (over budget): red text (#c0392b)
  - Zero or no estimate: gray text

**Total row:** Sums all 18 rows for Estimated, Actual, and Variance. Bold, gray background.

### 2.3 Save Behavior

A single **"Save Estimates"** button at the top-right of the variance table (matches the Cost Grid's save pattern). Editable fields are tracked in local dirty state. When Save is clicked:
1. Collect all dirty estimated fields
2. Call `PUT /:id/estimates` with the changed fields as a batch
3. Reload data to update actuals and variances
4. Clear dirty state

The button shows a dirty indicator (amber dot) when there are unsaved changes, identical to the toolbar's Save button.

### 2.4 Footer Text

"Actuals are calculated from the cost grid and technician data. Estimates are editable above."

---

## 3. Executive Summary Tab

New tab added after Variance Report. Matches Salesforce's `installationExecutiveSummary` — a professional, print-ready financial report.

### 3.1 Layout Sections

**A. Report Header**
- Company name: "TISCHLER UND SOHN" (centered, uppercase, tracked)
- Subtitle: "End of Project Final Report"
- Report date (current date)
- Red underline divider (#DA291C)

**B. Project Information Table**
| Label | Value |
|-------|-------|
| Project | project name (from Installation's project lookup) |
| Address | project address |
| Start Date | Installation startDate |
| End Date | Installation endDate |

**C. Financial Summary Table**
| Label | Value |
|-------|-------|
| Budget / Sales Price | installationBudget |
| Actual Cost | finalCost |
| Profit / Loss | finalProfit (green if positive, red if negative) |

**D. Cost Breakdown Table**

Headers: Category | Estimated | Actual | Variance

Same 18 categories as the Variance Report, but with parent/subcategory hierarchy:

- Labor Hours *(hours row — shows hours not currency)*
- Technician Labor Cost
  - ↳ Waterproofing Labor Cost *(subcategory — indented, light blue background #f4f7fb, italic, blue left border)*
  - ↳ Woodbucks Labor Cost *(subcategory)*
- Travel Time
- Flights
- Lodging
- Airport Transportation
- Car Rental
- Parking
- Equipment
- Miscellaneous
- Waterproofing
- Woodbucks
- Per Diem
- Mileage
- Materials
- Internal TUS Labor

**Footer total row:** Total Cost | sum estimated | sum actual | sum variance

**E. Report Footer**
"Tischler und Sohn | Confidential"

### 3.2 Styling

Matches Salesforce's CSS exactly:

| Element | Style |
|---------|-------|
| Font family | 'Segoe UI', Arial, sans-serif |
| Max width | 800px, centered |
| Report title | 20px bold, navy (#2c3e50) |
| Section titles | 16px bold, navy |
| Table headers | 14px bold, white text on navy background |
| Table cells | 14px normal |
| Subcategory rows | 13px italic, #f4f7fb background, 3px solid #a8c0e0 left border |
| Header underline | 2px solid #DA291C (Tischler red) |
| Profit text | #27ae60 (green), #e8f5e9 background |
| Loss text | #c0392b (red), #ffebee background |
| Total row | #f5f5f5 background, bold |

### 3.3 Actions

- **Download PDF** button — generates a branded PDF using jsPDF library. Includes:
  - Company logo/name
  - All 4 sections (header, project info, financial summary, cost breakdown)
  - Same color scheme as on-screen
  - Page margins, professional layout
- **Print** button — triggers `window.print()` with print-specific CSS

### 3.4 Read-Only

The Executive Summary is entirely read-only. All data is calculated from the same loaded data the widget already has. Estimates come from the Installation record fields. Actuals come from the child cost/expense records.

---

## 4. Component Architecture

### Files to Create

| File | Purpose |
|------|---------|
| `widgets/internal/installation-cost-grid/components/variance-report-tab.tsx` | Replaces `summary-tab.tsx`. 18-row variance table with editable estimates |
| `widgets/internal/installation-cost-grid/components/executive-summary-tab.tsx` | Professional report view with print/PDF export |

### Files to Modify

| File | Change |
|------|--------|
| `apps/api/src/ensure-core-objects.ts` | Add 5 estimated fields to Installation |
| `apps/web/lib/schema-service.ts` | Add 5 fields to `ensureInstallationCostObjects` |
| `apps/api/src/controllers/installation-grid/index.ts` | Add 5 fields to `ESTIMATED_FIELDS` |
| `widgets/.../utils/calculations.ts` | Add variance category definitions, actual-value calculation functions, new estimated field names |
| `widgets/.../index.tsx` | Replace Summary tab with Variance Report tab, add Executive Summary tab |
| `widgets/.../components/summary-tab.tsx` | Delete (replaced by variance-report-tab.tsx) |

### Files to Delete

| File | Reason |
|------|--------|
| `widgets/.../components/summary-tab.tsx` | Replaced by `variance-report-tab.tsx` |

---

## 5. Data Flow

Both tabs use the **same data** already loaded by the widget's `useInstallationData` hook:
- `data.installation` — Installation record with all estimated fields
- `data.costs` — InstallationCost records (for project cost actuals)
- `data.techExpenses` — InstallationTechExpense records (for labor/expense actuals)

**Variance Report saves** → calls existing `PUT /:id/estimates` endpoint → reloads data → Executive Summary automatically shows updated values (same data source).

**No message channel needed** (unlike Salesforce) — both tabs share the same React state. When estimates are saved and data reloads, both tabs re-render with fresh data.

---

## 6. Dependencies

- **jsPDF** library for PDF generation. Check if already in `package.json`; if not, add it.
- All other dependencies (React, Tailwind, Lucide icons, apiClient) are already available.

---

## 7. Verification Plan

1. **New fields seeded:** Start API, verify 5 new estimated fields exist on Installation object
2. **Variance Report tab:**
   - Replaces Summary tab — tab now says "Variance Report"
   - Shows 18 rows with correct category labels in correct order
   - Estimated column is editable, Actual is calculated, Variance is color-coded
   - Save persists estimates via API
   - Total row sums correctly
3. **Executive Summary tab:**
   - Shows professional report layout matching Salesforce styling
   - Project info section populated from Installation + Project data
   - Financial summary shows Budget / Actual / Profit with color coding
   - Cost breakdown table shows 18 categories with subcategory indentation
   - Download PDF generates a properly formatted PDF
   - Print button opens browser print dialog
4. **Data sync:**
   - Edit an estimate in Variance Report → save → switch to Executive Summary → shows updated value
   - Edit costs in Project Costs tab → save → Variance Report actuals update
