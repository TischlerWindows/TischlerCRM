# Installation Phase 3: Variance Report & Executive Summary — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cost Grid widget's Summary tab with a full Variance Report (18 editable estimated-vs-actual rows matching Salesforce), and add an Executive Summary tab (professional print-ready report with PDF export).

**Architecture:** Two new tab components inside the existing InstallationCostGrid widget. Both consume the same data already loaded by `useInstallationData`. The Variance Report saves estimates via the existing `PUT /:id/estimates` controller endpoint. The Executive Summary generates PDFs client-side with jsPDF. Five new estimated fields are added to the Installation object.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, jsPDF (new dependency), existing apiClient

**Spec:** `docs/superpowers/specs/2026-04-13-installation-phase3-reports-design.md`

---

### Task 1: Add 5 missing estimated fields + install jsPDF

**Files:**
- Modify: `apps/api/src/ensure-core-objects.ts`
- Modify: `apps/web/lib/schema-service.ts`
- Modify: `apps/api/src/controllers/installation-grid/index.ts`
- Modify: `apps/web/widgets/internal/installation-cost-grid/utils/calculations.ts`
- Modify: `apps/web/package.json` (add jsPDF)

- [ ] **Step 1: Add 5 fields to ensure-core-objects.ts**

In `apps/api/src/ensure-core-objects.ts`, find the Installation object's fields array and add these 5 fields after the existing `estimatedContainerUnload` field:

```typescript
      { apiName: 'estimatedLaborHours', label: 'Estimated Labor Hours', type: 'Number' },
      { apiName: 'estimatedWaterproofingLabor', label: 'Estimated WP Labor', type: 'Currency' },
      { apiName: 'estimatedWoodBucksLabor', label: 'Estimated WB Labor', type: 'Currency' },
      { apiName: 'estimatedTravelTime', label: 'Estimated Travel Time', type: 'Currency' },
      { apiName: 'estimatedInternalLabor', label: 'Estimated Internal Labor', type: 'Currency' },
```

- [ ] **Step 2: Add 5 fields to OrgSchema migration**

In `apps/web/lib/schema-service.ts`, find the `ensureInstallationCostObjects` method. Inside the `newFields` array (where the other `Installation__estimated*` fields are), add:

```typescript
      { id: generateId(), apiName: 'Installation__estimatedLaborHours', label: 'Estimated Labor Hours', type: 'Number', custom: true },
      { id: generateId(), apiName: 'Installation__estimatedWaterproofingLabor', label: 'Estimated WP Labor', type: 'Currency', custom: true },
      { id: generateId(), apiName: 'Installation__estimatedWoodBucksLabor', label: 'Estimated WB Labor', type: 'Currency', custom: true },
      { id: generateId(), apiName: 'Installation__estimatedTravelTime', label: 'Estimated Travel Time', type: 'Currency', custom: true },
      { id: generateId(), apiName: 'Installation__estimatedInternalLabor', label: 'Estimated Internal Labor', type: 'Currency', custom: true },
```

- [ ] **Step 3: Add 5 fields to controller ESTIMATED_FIELDS**

In `apps/api/src/controllers/installation-grid/index.ts`, find the `ESTIMATED_FIELDS` array and add:

```typescript
  'estimatedLaborHours', 'estimatedWaterproofingLabor', 'estimatedWoodBucksLabor',
  'estimatedTravelTime', 'estimatedInternalLabor',
```

- [ ] **Step 4: Add variance category definitions to calculations.ts**

In `apps/web/widgets/internal/installation-cost-grid/utils/calculations.ts`, add at the end of the file:

```typescript
// ── Variance Report categories (18 rows matching Salesforce) ──────────

export interface VarianceCategory {
  label: string
  estimatedField: string
  type: 'currency' | 'hours'
  isSubcategory?: boolean
  /** Field key from tech expenses to calculate labor cost for this specific category */
  laborField?: string
  /** Field key from cost records to sum for actual */
  costField?: string
  /** Field key from tech expense records to sum for actual (non-labor, e.g. perDiem) */
  expenseField?: string
}

export const VARIANCE_CATEGORIES: VarianceCategory[] = [
  { label: 'Labor Hours', estimatedField: 'estimatedLaborHours', type: 'hours' },
  { label: 'Technician Labor Cost', estimatedField: 'estimatedLaborCost', type: 'currency' },
  { label: 'Waterproofing Labor Cost', estimatedField: 'estimatedWaterproofingLabor', type: 'currency', isSubcategory: true, laborField: 'waterproofing' },
  { label: 'Woodbucks Labor Cost', estimatedField: 'estimatedWoodBucksLabor', type: 'currency', isSubcategory: true, laborField: 'woodbucks' },
  { label: 'Travel Time', estimatedField: 'estimatedTravelTime', type: 'currency', laborField: 'travel' },
  { label: 'Flights', estimatedField: 'estimatedFlights', type: 'currency', costField: 'flightsActual' },
  { label: 'Lodging', estimatedField: 'estimatedHotel', type: 'currency', costField: 'lodgingActual' },
  { label: 'Airport Transportation', estimatedField: 'estimatedAirportTransportation', type: 'currency', costField: 'airportTransportation' },
  { label: 'Car Rental', estimatedField: 'estimatedCarRental', type: 'currency', costField: 'carRental' },
  { label: 'Parking', estimatedField: 'estimatedParking', type: 'currency', costField: 'parking' },
  { label: 'Equipment', estimatedField: 'estimatedEquipment', type: 'currency', costField: 'equipment' },
  { label: 'Miscellaneous', estimatedField: 'estimatedMiscellaneous', type: 'currency', costField: 'miscellaneousExpenses' },
  { label: 'Waterproofing', estimatedField: 'estimatedWaterproofing', type: 'currency', costField: 'waterproofing' },
  { label: 'Woodbucks', estimatedField: 'estimatedWoodBucks', type: 'currency', costField: 'woodBucks' },
  { label: 'Per Diem', estimatedField: 'estimatedPerDiem', type: 'currency', expenseField: 'perDiem' },
  { label: 'Mileage', estimatedField: 'estimatedMileage', type: 'currency', expenseField: 'mileage' },
  { label: 'Materials', estimatedField: 'estimatedMaterials', type: 'currency', expenseField: 'materials' },
  { label: 'Internal TUS Labor', estimatedField: 'estimatedInternalLabor', type: 'currency' },
]

/** Calculate actual value for a variance category from loaded data */
export function calculateActual(
  category: VarianceCategory,
  costs: Array<{ id: string; data: Record<string, any> }>,
  techExpenses: Record<string, { technician: { assignedHourlyRate: number }; expenses: Array<{ id: string; data: Record<string, any> }> }>,
): number {
  // Cost field — sum from InstallationCost records
  if (category.costField) {
    let total = 0
    for (const cost of costs) total += num(cost.data[category.costField])
    return total
  }

  // Expense field — sum from InstallationTechExpense records (perDiem, mileage, materials)
  if (category.expenseField) {
    let total = 0
    for (const { expenses } of Object.values(techExpenses)) {
      for (const exp of expenses) total += num(exp.data[category.expenseField])
    }
    return total
  }

  // Labor field — sum of (specific field hours × hourlyRate) per tech
  if (category.laborField) {
    let total = 0
    for (const { technician, expenses } of Object.values(techExpenses)) {
      for (const exp of expenses) {
        total += num(exp.data[category.laborField]) * technician.assignedHourlyRate
      }
    }
    return total
  }

  // Special cases
  if (category.label === 'Labor Hours') {
    let total = 0
    for (const { expenses } of Object.values(techExpenses)) {
      for (const exp of expenses) total += totalHours(exp.data)
    }
    return total
  }

  if (category.label === 'Technician Labor Cost') {
    let total = 0
    for (const { technician, expenses } of Object.values(techExpenses)) {
      for (const exp of expenses) {
        total += totalHours(exp.data) * technician.assignedHourlyRate
      }
    }
    return total
  }

  // Internal TUS Labor — no automatic calculation
  return 0
}
```

- [ ] **Step 5: Install jsPDF**

Run: `cd apps/web && pnpm add jspdf`

- [ ] **Step 6: Build and verify**

Run: `pnpm --filter api build`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ensure-core-objects.ts apps/web/lib/schema-service.ts apps/api/src/controllers/installation-grid/index.ts apps/web/widgets/internal/installation-cost-grid/utils/calculations.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(installation): add 5 estimated fields, variance categories, and jsPDF dependency"
```

---

### Task 2: Add saveEstimates to the data hook

**Files:**
- Modify: `apps/web/widgets/internal/installation-cost-grid/hooks/use-installation-data.ts`

- [ ] **Step 1: Add estimate dirty state and save function**

In `apps/web/widgets/internal/installation-cost-grid/hooks/use-installation-data.ts`:

1. Extend `DirtyState` interface to include estimates:
```typescript
interface DirtyState {
  costs: Record<string, Record<string, number>>
  techExpenses: Record<string, Record<string, number>>
  estimates: Record<string, number>  // fieldName → value
}
```

2. Update initial state:
```typescript
const [dirty, setDirty] = useState<DirtyState>({ costs: {}, techExpenses: {}, estimates: {} })
```

3. Update `isDirty`:
```typescript
const isDirty = Object.keys(dirty.costs).length > 0 || Object.keys(dirty.techExpenses).length > 0 || Object.keys(dirty.estimates).length > 0
```

4. Add `setEstimateField` callback:
```typescript
const setEstimateField = useCallback((field: string, value: number) => {
  setDirty(prev => ({
    ...prev,
    estimates: { ...prev.estimates, [field]: value },
  }))
}, [])
```

5. Add `saveEstimates` callback:
```typescript
const saveEstimates = useCallback(async () => {
  if (!installationId || Object.keys(dirty.estimates).length === 0) return
  setSaving(true)
  setError(null)
  try {
    await apiClient.put(`${BASE}/${installationId}/estimates`, dirty.estimates)
    setDirty(prev => ({ ...prev, estimates: {} }))
    await load()
  } catch (err: any) {
    setError(err.message || 'Failed to save estimates')
  } finally {
    setSaving(false)
  }
}, [installationId, dirty.estimates, load])
```

6. Update the `save` function to also save estimates if dirty:
```typescript
// Inside the existing save callback, after saving tech expenses and before recalculate:
if (Object.keys(dirty.estimates).length > 0) {
  await apiClient.put(`${BASE}/${installationId}/estimates`, dirty.estimates)
}
```

7. Add to the return object:
```typescript
return {
  data, loading, error, saving, isDirty, dirty,
  setCostField, setTechExpenseField, setEstimateField,
  save, saveEstimates, addWeek, removeWeek, recalculate,
  assignTechnician, removeTechnician, reload: load,
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/hooks/use-installation-data.ts
git commit -m "feat(installation): add estimate dirty state and saveEstimates to data hook"
```

---

### Task 3: Create Variance Report tab component

**Files:**
- Create: `apps/web/widgets/internal/installation-cost-grid/components/variance-report-tab.tsx`
- Delete: `apps/web/widgets/internal/installation-cost-grid/components/summary-tab.tsx`

- [ ] **Step 1: Create variance-report-tab.tsx**

Create `apps/web/widgets/internal/installation-cost-grid/components/variance-report-tab.tsx`:

```tsx
'use client'
import { Save, Loader2 } from 'lucide-react'
import { VARIANCE_CATEGORIES, calculateActual, num, fmt, fmtNum } from '../utils/calculations'

interface VarianceReportTabProps {
  installationData: Record<string, any>
  costs: Array<{ id: string; data: Record<string, any> }>
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
  dirtyEstimates: Record<string, number>
  onEstimateChange: (field: string, value: number) => void
  onSaveEstimates: () => void
  saving: boolean
}

export function VarianceReportTab({
  installationData, costs, techExpenses,
  dirtyEstimates, onEstimateChange, onSaveEstimates, saving,
}: VarianceReportTabProps) {
  const hasDirty = Object.keys(dirtyEstimates).length > 0

  const getEstimated = (field: string): number => {
    return dirtyEstimates[field] !== undefined ? dirtyEstimates[field] : num(installationData[field])
  }

  // Calculate totals
  let totalEstimated = 0
  let totalActual = 0
  const rows = VARIANCE_CATEGORIES.map(cat => {
    const estimated = getEstimated(cat.estimatedField)
    const actual = calculateActual(cat, costs, techExpenses)
    const variance = estimated - actual
    // Don't include hours row in currency totals
    if (cat.type === 'currency') {
      totalEstimated += estimated
      totalActual += actual
    }
    return { ...cat, estimated, actual, variance }
  })
  const totalVariance = totalEstimated - totalActual

  const formatValue = (value: number, type: 'currency' | 'hours'): string => {
    return type === 'hours' ? fmtNum(value) : fmt(value)
  }

  const varianceColor = (v: number): string => {
    if (v > 0) return 'text-green-700'
    if (v < 0) return 'text-red-600'
    return 'text-gray-400'
  }

  return (
    <div className="p-4">
      {/* Save button */}
      <div className="flex justify-end mb-3">
        <button
          onClick={onSaveEstimates}
          disabled={!hasDirty && !saving}
          className="text-[10px] px-3 py-1 bg-brand-navy text-white rounded hover:bg-brand-navy/90 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed font-semibold relative"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save Estimates
          {hasDirty && !saving && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
        </button>
      </div>

      {/* Variance table */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr style={{ background: '#2c3e50', color: 'white' }}>
            <th className="px-3 py-2 text-left font-semibold">Category</th>
            <th className="px-3 py-2 text-right font-semibold">Estimated</th>
            <th className="px-3 py-2 text-right font-semibold">Actual</th>
            <th className="px-3 py-2 text-right font-semibold">Variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.estimatedField}
              className={row.isSubcategory ? 'italic' : ''}
              style={row.isSubcategory ? { background: '#f4f7fb', borderLeft: '3px solid #a8c0e0' } : {}}
            >
              <td className="px-3 py-1.5 border-b border-gray-200" style={{ fontSize: row.isSubcategory ? '11px' : '12px' }}>
                {row.isSubcategory ? '↳ ' : ''}{row.label}
              </td>
              <td className="px-1 py-1.5 border-b border-gray-200 text-right">
                <input
                  type="number"
                  step={row.type === 'hours' ? '0.5' : '0.01'}
                  value={getEstimated(row.estimatedField)}
                  onChange={e => onEstimateChange(row.estimatedField, parseFloat(e.target.value) || 0)}
                  className="w-24 border border-gray-200 rounded px-2 py-1 text-right text-xs focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none"
                />
              </td>
              <td className="px-3 py-1.5 border-b border-gray-200 text-right">
                {formatValue(row.actual, row.type)}
              </td>
              <td className={`px-3 py-1.5 border-b border-gray-200 text-right font-semibold ${varianceColor(row.variance)}`}>
                {row.variance > 0 ? '+' : ''}{formatValue(row.variance, row.type)}
              </td>
            </tr>
          ))}
          {/* Total row */}
          <tr style={{ background: '#f5f5f5' }}>
            <td className="px-3 py-2 font-bold border-t-2 border-gray-300">Total Expenses</td>
            <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300">{fmt(totalEstimated)}</td>
            <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300">{fmt(totalActual)}</td>
            <td className={`px-3 py-2 text-right font-bold border-t-2 border-gray-300 ${varianceColor(totalVariance)}`}>
              {totalVariance > 0 ? '+' : ''}{fmt(totalVariance)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="text-[10px] text-gray-400 mt-3 italic">
        Actuals are calculated from the cost grid and technician data. Estimates are editable above.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Delete summary-tab.tsx**

Delete `apps/web/widgets/internal/installation-cost-grid/components/summary-tab.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/components/variance-report-tab.tsx
git rm apps/web/widgets/internal/installation-cost-grid/components/summary-tab.tsx
git commit -m "feat(installation): add Variance Report tab replacing Summary tab"
```

---

### Task 4: Create Executive Summary tab with PDF export

**Files:**
- Create: `apps/web/widgets/internal/installation-cost-grid/components/executive-summary-tab.tsx`

- [ ] **Step 1: Create executive-summary-tab.tsx**

Create `apps/web/widgets/internal/installation-cost-grid/components/executive-summary-tab.tsx`:

```tsx
'use client'
import { Download, Printer } from 'lucide-react'
import { VARIANCE_CATEGORIES, calculateActual, num, fmt, fmtNum } from '../utils/calculations'

interface ExecutiveSummaryTabProps {
  installationData: Record<string, any>
  costs: Array<{ id: string; data: Record<string, any> }>
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
}

export function ExecutiveSummaryTab({ installationData, costs, techExpenses }: ExecutiveSummaryTabProps) {
  const budget = num(installationData.installationBudget)
  const actualCost = num(installationData.finalCost)
  const profit = num(installationData.finalProfit)
  const isProfitable = profit >= 0
  const profitPct = budget > 0 ? ((profit / budget) * 100).toFixed(1) : '0.0'

  const startDate = installationData.startDate
    ? new Date(installationData.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'
  const endDate = installationData.endDate
    ? new Date(installationData.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'
  const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Build cost breakdown rows
  const breakdownRows = VARIANCE_CATEGORIES.map(cat => {
    const estimated = num(installationData[cat.estimatedField])
    const actual = calculateActual(cat, costs, techExpenses)
    const variance = estimated - actual
    return { ...cat, estimated, actual, variance }
  })

  let totalEstimated = 0
  let totalActual = 0
  for (const row of breakdownRows) {
    if (row.type === 'currency') {
      totalEstimated += row.estimated
      totalActual += row.actual
    }
  }

  const formatVal = (v: number, type: 'currency' | 'hours') => type === 'hours' ? `${fmtNum(v)} hrs` : fmt(v)
  const varColor = (v: number) => v > 0 ? '#27ae60' : v < 0 ? '#c0392b' : '#666'

  const handlePrint = () => window.print()

  const handleDownloadPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const w = doc.internal.pageSize.getWidth()
    let y = 20

    // Header
    doc.setFontSize(18)
    doc.setTextColor(44, 62, 80)
    doc.text('TISCHLER UND SOHN', w / 2, y, { align: 'center' })
    y += 6
    doc.setFontSize(10)
    doc.setTextColor(127, 140, 141)
    doc.text('End of Project Final Report', w / 2, y, { align: 'center' })
    y += 4
    doc.text(reportDate, w / 2, y, { align: 'center' })
    y += 2
    doc.setDrawColor(218, 41, 28)
    doc.setLineWidth(0.5)
    doc.line(20, y, w - 20, y)
    y += 8

    // Project Info
    doc.setFontSize(12)
    doc.setTextColor(44, 62, 80)
    doc.text('Project Information', 20, y)
    y += 6
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    const projectName = installationData.installationName || '—'
    doc.text(`Project: ${projectName}`, 20, y); y += 5
    doc.text(`Start Date: ${startDate}`, 20, y)
    doc.text(`End Date: ${endDate}`, w / 2, y); y += 8

    // Financial Summary
    doc.setFontSize(12)
    doc.setTextColor(44, 62, 80)
    doc.text('Financial Summary', 20, y); y += 6
    doc.setFontSize(9)
    doc.text(`Budget / Sales Price:`, 20, y)
    doc.text(fmt(budget), w - 20, y, { align: 'right' }); y += 5
    doc.text(`Actual Cost:`, 20, y)
    doc.text(fmt(actualCost), w - 20, y, { align: 'right' }); y += 5
    doc.setTextColor(isProfitable ? 39 : 192, isProfitable ? 174 : 57, isProfitable ? 96 : 43)
    doc.setFont('helvetica', 'bold')
    doc.text(`${isProfitable ? 'Profit' : 'Loss'}:`, 20, y)
    doc.text(`${isProfitable ? '+' : ''}${fmt(profit)} (${profitPct}%)`, w - 20, y, { align: 'right' })
    y += 10
    doc.setFont('helvetica', 'normal')

    // Cost Breakdown Table
    doc.setFontSize(12)
    doc.setTextColor(44, 62, 80)
    doc.text('Cost Breakdown', 20, y); y += 6

    // Table header
    doc.setFillColor(44, 62, 80)
    doc.rect(20, y, w - 40, 6, 'F')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('Category', 22, y + 4)
    doc.text('Estimated', 95, y + 4, { align: 'right' })
    doc.text('Actual', 130, y + 4, { align: 'right' })
    doc.text('Variance', w - 22, y + 4, { align: 'right' })
    y += 8

    // Table rows
    doc.setFontSize(8)
    for (const row of breakdownRows) {
      if (y > 270) { doc.addPage(); y = 20 }

      if (row.isSubcategory) {
        doc.setFillColor(244, 247, 251)
        doc.rect(20, y - 3, w - 40, 5, 'F')
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(80, 80, 80)
        doc.text(`  ↳ ${row.label}`, 22, y)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(50, 50, 50)
        doc.text(row.label, 22, y)
      }

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(formatVal(row.estimated, row.type), 95, y, { align: 'right' })
      doc.text(formatVal(row.actual, row.type), 130, y, { align: 'right' })

      const vc = varColor(row.variance)
      doc.setTextColor(vc === '#27ae60' ? 39 : vc === '#c0392b' ? 192 : 100, vc === '#27ae60' ? 174 : vc === '#c0392b' ? 57 : 100, vc === '#27ae60' ? 96 : vc === '#c0392b' ? 43 : 100)
      doc.text(`${row.variance > 0 ? '+' : ''}${formatVal(row.variance, row.type)}`, w - 22, y, { align: 'right' })
      y += 5
    }

    // Total row
    y += 1
    doc.setDrawColor(200, 200, 200)
    doc.line(20, y - 3, w - 20, y - 3)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(44, 62, 80)
    doc.text('Total Cost', 22, y)
    doc.text(fmt(totalEstimated), 95, y, { align: 'right' })
    doc.text(fmt(totalActual), 130, y, { align: 'right' })
    const tv = totalEstimated - totalActual
    doc.setTextColor(tv >= 0 ? 39 : 192, tv >= 0 ? 174 : 57, tv >= 0 ? 96 : 43)
    doc.text(`${tv > 0 ? '+' : ''}${fmt(tv)}`, w - 22, y, { align: 'right' })

    // Footer
    y = 285
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text('Tischler und Sohn | Confidential', w / 2, y, { align: 'center' })

    doc.save(`Installation_Report_${projectName.replace(/\s+/g, '_')}.pdf`)
  }

  return (
    <div className="p-6" style={{ fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 800, margin: '0 auto' }}>
      {/* Action buttons */}
      <div className="flex justify-end gap-2 mb-4 print:hidden">
        <button onClick={handleDownloadPdf} className="text-xs px-3 py-1.5 bg-brand-navy text-white rounded hover:bg-brand-navy/90 flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Download PDF
        </button>
        <button onClick={handlePrint} className="text-xs px-3 py-1.5 bg-[#f0f1f9] text-brand-navy border border-blue-200 rounded hover:bg-blue-50 flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>

      {/* Report Header */}
      <div className="text-center mb-4" style={{ borderBottom: '2px solid #DA291C', paddingBottom: 12 }}>
        <h2 className="text-lg font-bold tracking-wider" style={{ color: '#2c3e50' }}>TISCHLER UND SOHN</h2>
        <p className="text-xs" style={{ color: '#7f8c8d' }}>End of Project Final Report</p>
        <p className="text-[10px]" style={{ color: '#7f8c8d' }}>{reportDate}</p>
      </div>

      {/* Project Information */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2" style={{ color: '#2c3e50' }}>Project Information</h3>
        <table className="w-full text-xs border border-gray-200">
          <tbody>
            <tr><td className="px-3 py-1.5 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d', width: '30%' }}>Project</td><td className="px-3 py-1.5 border-b border-gray-200">{installationData.installationName || '—'}</td></tr>
            <tr><td className="px-3 py-1.5 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d' }}>Start Date</td><td className="px-3 py-1.5 border-b border-gray-200">{startDate}</td></tr>
            <tr><td className="px-3 py-1.5 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d' }}>End Date</td><td className="px-3 py-1.5 border-b border-gray-200">{endDate}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Financial Summary */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2" style={{ color: '#2c3e50' }}>Financial Summary</h3>
        <table className="w-full text-xs border border-gray-200">
          <tbody>
            <tr><td className="px-3 py-2 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d', width: '50%' }}>Budget / Sales Price</td><td className="px-3 py-2 border-b border-gray-200 text-right font-semibold">{fmt(budget)}</td></tr>
            <tr><td className="px-3 py-2 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d' }}>Actual Cost</td><td className="px-3 py-2 border-b border-gray-200 text-right font-semibold">{fmt(actualCost)}</td></tr>
            <tr style={{ background: isProfitable ? '#e8f5e9' : '#ffebee' }}>
              <td className="px-3 py-2 font-bold" style={{ color: isProfitable ? '#27ae60' : '#c0392b' }}>
                {isProfitable ? 'Profit' : 'Loss'}
              </td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: isProfitable ? '#27ae60' : '#c0392b' }}>
                {isProfitable ? '+' : ''}{fmt(profit)} ({profitPct}%)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cost Breakdown */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2" style={{ color: '#2c3e50' }}>Cost Breakdown</h3>
        <table className="w-full text-xs border border-gray-200 border-collapse">
          <thead>
            <tr style={{ background: '#2c3e50', color: 'white' }}>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Estimated</th>
              <th className="px-3 py-2 text-right font-semibold">Actual</th>
              <th className="px-3 py-2 text-right font-semibold">Variance</th>
            </tr>
          </thead>
          <tbody>
            {breakdownRows.map((row) => (
              <tr
                key={row.estimatedField}
                style={row.isSubcategory ? { background: '#f4f7fb', borderLeft: '3px solid #a8c0e0', fontStyle: 'italic' } : {}}
              >
                <td className="px-3 py-1.5 border-b border-gray-200" style={{ fontSize: row.isSubcategory ? 11 : 12 }}>
                  {row.isSubcategory ? '↳ ' : ''}{row.label}
                </td>
                <td className="px-3 py-1.5 border-b border-gray-200 text-right">{formatVal(row.estimated, row.type)}</td>
                <td className="px-3 py-1.5 border-b border-gray-200 text-right">{formatVal(row.actual, row.type)}</td>
                <td className="px-3 py-1.5 border-b border-gray-200 text-right font-semibold" style={{ color: varColor(row.variance) }}>
                  {row.variance > 0 ? '+' : ''}{formatVal(row.variance, row.type)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f5f5f5' }}>
              <td className="px-3 py-2 font-bold border-t-2 border-gray-300">Total Cost</td>
              <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300">{fmt(totalEstimated)}</td>
              <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300">{fmt(totalActual)}</td>
              <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300" style={{ color: varColor(totalEstimated - totalActual) }}>
                {(totalEstimated - totalActual) > 0 ? '+' : ''}{fmt(totalEstimated - totalActual)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] pt-3 border-t border-gray-200" style={{ color: '#b0b0b0' }}>
        Tischler und Sohn | Confidential
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/components/executive-summary-tab.tsx
git commit -m "feat(installation): add Executive Summary tab with PDF export"
```

---

### Task 5: Wire new tabs into the main widget component

**Files:**
- Modify: `apps/web/widgets/internal/installation-cost-grid/index.tsx`

- [ ] **Step 1: Update imports and tabs**

In `apps/web/widgets/internal/installation-cost-grid/index.tsx`:

1. Replace the `SummaryTab` import with the two new tabs:
```typescript
// Remove this:
import { SummaryTab } from './components/summary-tab'
// Add these:
import { VarianceReportTab } from './components/variance-report-tab'
import { ExecutiveSummaryTab } from './components/executive-summary-tab'
```

2. Update the `Tab` type:
```typescript
type Tab = 'costs' | 'technicians' | 'variance' | 'executive'
```

3. Update the tabs array:
```typescript
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'costs', label: 'Project Costs' },
    { id: 'technicians', label: `Technicians (${techCount})` },
    { id: 'variance', label: 'Variance Report' },
    { id: 'executive', label: 'Executive Summary' },
  ]
```

4. Add `setEstimateField` and `saveEstimates` to the destructured hook values:
```typescript
  const {
    data, loading, error, saving, isDirty, dirty,
    setCostField, setTechExpenseField, setEstimateField,
    save, saveEstimates, addWeek, removeWeek, recalculate,
    assignTechnician, removeTechnician, reload,
  } = useInstallationData(installationId)
```

5. Replace the tab content rendering (the section inside `<div className="border border-gray-200 ..."`):
```tsx
        {activeTab === 'costs' && (
          <ProjectCostsTab costs={data.costs} dirtyCosts={dirty.costs} onFieldChange={setCostField} />
        )}
        {activeTab === 'technicians' && (
          <TechniciansTab techExpenses={data.techExpenses} dirtyExpenses={dirty.techExpenses} onFieldChange={setTechExpenseField} />
        )}
        {activeTab === 'variance' && (
          <VarianceReportTab
            installationData={instData}
            costs={data.costs}
            techExpenses={data.techExpenses}
            dirtyEstimates={dirty.estimates}
            onEstimateChange={setEstimateField}
            onSaveEstimates={saveEstimates}
            saving={saving}
          />
        )}
        {activeTab === 'executive' && (
          <ExecutiveSummaryTab
            installationData={instData}
            costs={data.costs}
            techExpenses={data.techExpenses}
          />
        )}
```

- [ ] **Step 2: Build and verify**

Run: `pnpm --filter api build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/index.tsx
git commit -m "feat(installation): wire Variance Report and Executive Summary tabs into widget"
```

---

### Task 6: Final build, verify, and push

- [ ] **Step 1: Full build**

Run: `pnpm --filter @crm/triggers build && pnpm --filter @crm/controllers build && pnpm --filter api build`

Expected: All succeed.

- [ ] **Step 2: Verify no type errors in widget files**

Run: `cd apps/web && pnpm typecheck 2>&1 | grep -E "installation-cost-grid|variance|executive" || echo "No errors in new files"`

- [ ] **Step 3: Push to New-Test-To-Main**

```bash
git push origin claude/intelligent-tu:New-Test-To-Main
```

- [ ] **Step 4: Verification checklist**

After deploy:
1. Open an Installation record with the Cost Grid widget
2. Tab bar now shows: **Project Costs | Technicians | Variance Report | Executive Summary**
3. **Variance Report tab**: 18 rows visible, Estimated column is editable, Actual column shows calculated values, Variance column is color-coded (green/red)
4. Edit an estimate → amber dot appears on Save Estimates button → click Save → value persists
5. **Executive Summary tab**: Professional report layout with Tischler branding, project info, financial summary, cost breakdown with subcategory indentation
6. Click **Download PDF** → PDF file downloads with proper formatting
7. Click **Print** → browser print dialog opens
