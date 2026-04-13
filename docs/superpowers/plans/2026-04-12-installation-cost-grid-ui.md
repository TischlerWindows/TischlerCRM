# Installation Cost Grid UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Installation Cost Grid internal widget — a tabbed UI with editable grids for weekly project costs and per-technician labor expenses, placed on Installation record pages via the page editor.

**Architecture:** Internal widget registered in the widget system. Fetches data from the Phase 1 controller (`/controllers/installation-grid/`). State managed via a custom React hook. Sub-components for each section (KPI bar, toolbar, three tabs, tech modal). Client-side calculations for totals. Explicit save to controller bulk-update endpoints.

**Tech Stack:** Next.js 14 (React 18), TypeScript, Tailwind CSS, Lucide icons, `apiClient` for API calls

**Spec:** `docs/superpowers/specs/2026-04-12-installation-cost-grid-ui-design.md`

---

### Task 1: Register widget type and manifest

**Files:**
- Modify: `apps/web/lib/schema.ts`
- Create: `apps/web/widgets/internal/installation-cost-grid/widget.config.ts`
- Modify: `apps/web/widgets/internal/registry.ts`
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/palette-components.tsx`
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/dnd/drag-parser.ts`
- Modify: `apps/web/components/layout-widgets-inline.tsx`

- [ ] **Step 1: Add types to schema.ts**

In `apps/web/lib/schema.ts`:

Add `'InstallationCostGrid'` to the `WidgetType` union (around line 222):
```typescript
export type WidgetType = 'RelatedList' | 'CustomComponent' | 'ActivityFeed' | 'FileFolder' | 'Spacer' | 'HeaderHighlights' | 'ExternalWidget' | 'TeamMembersRollup' | 'TeamMemberAssociations' | 'Path' | 'InstallationCostGrid';
```

Add the config interface (after `PathConfig`):
```typescript
export interface InstallationCostGridConfig {
  type: 'InstallationCostGrid';
}
```

Add to the `WidgetConfig` union (around line 336):
```typescript
export type WidgetConfig =
  | RelatedListConfig
  | CustomComponentConfig
  | ActivityFeedConfig
  | FileFolderConfig
  | SpacerConfig
  | HeaderHighlightsConfig
  | ExternalWidgetLayoutConfig
  | TeamMembersRollupConfig
  | TeamMemberAssociationsConfig
  | PathConfig
  | InstallationCostGridConfig;
```

- [ ] **Step 2: Create widget manifest**

Create `apps/web/widgets/internal/installation-cost-grid/widget.config.ts`:

```typescript
import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'installation-cost-grid',
  name: 'Installation Cost Grid',
  description: 'View and edit weekly installation costs and technician labor expenses',
  icon: 'Table',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
```

- [ ] **Step 3: Create placeholder component**

Create `apps/web/widgets/internal/installation-cost-grid/index.tsx`:

```tsx
'use client'
import type { WidgetProps } from '@/lib/widgets/types'

export default function InstallationCostGridWidget({ record }: WidgetProps) {
  return (
    <div className="p-4 text-sm text-brand-gray">
      Installation Cost Grid — loading for {String(record?.id ?? 'unknown')}...
    </div>
  )
}
```

- [ ] **Step 4: Register in widget registry**

In `apps/web/widgets/internal/registry.ts`, add import:
```typescript
import { config as installationCostGridManifest } from './installation-cost-grid/widget.config'
```

Add registration entry to the `internalWidgetRegistrations` array:
```typescript
  {
    manifest: installationCostGridManifest,
    widgetConfigType: 'InstallationCostGrid',
    Component: dynamic(() => import('./installation-cost-grid/index')),
  },
```

- [ ] **Step 5: Add to page editor palette**

In `apps/web/app/object-manager/[objectApi]/page-editor/palette-components.tsx`, add to `MANIFEST_ID_TO_WIDGET_TYPE`:
```typescript
  'installation-cost-grid': 'InstallationCostGrid',
```

- [ ] **Step 6: Add to drag parser**

In `apps/web/app/object-manager/[objectApi]/page-editor/dnd/drag-parser.ts`, add `'InstallationCostGrid'` to the `WIDGET_TYPES` set:
```typescript
const WIDGET_TYPES: ReadonlySet<string> = new Set<string>([
  // ... existing entries ...
  'InstallationCostGrid',
]);
```

- [ ] **Step 7: Add widget label**

In `apps/web/components/layout-widgets-inline.tsx`, add a case to the `getWidgetLabel` function:
```typescript
    case 'InstallationCostGrid':
      return 'Installation Cost Grid'
```

- [ ] **Step 8: Build and verify**

Run: `cd apps/web && pnpm typecheck 2>&1 | grep -E "installation-cost-grid|InstallationCostGrid" || echo "No errors in new files"`

Also: `cd apps/api && pnpm build`

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/schema.ts apps/web/widgets/internal/installation-cost-grid/ apps/web/widgets/internal/registry.ts apps/web/app/object-manager/ apps/web/components/layout-widgets-inline.tsx
git commit -m "feat(installation): register InstallationCostGrid widget type with placeholder"
```

---

### Task 2: Calculation utilities and data hook

**Files:**
- Create: `apps/web/widgets/internal/installation-cost-grid/utils/calculations.ts`
- Create: `apps/web/widgets/internal/installation-cost-grid/hooks/use-installation-data.ts`

- [ ] **Step 1: Create calculation utilities**

Create `apps/web/widgets/internal/installation-cost-grid/utils/calculations.ts`:

```typescript
// Field lists matching the controller's allow-lists
export const COST_FIELDS = [
  'flightsActual', 'lodgingActual', 'carRental', 'airportTransportation',
  'parking', 'equipment', 'miscellaneousExpenses', 'waterproofing', 'woodBucks',
] as const

export const LABOR_HOUR_FIELDS = [
  'containerUnload', 'woodbucks', 'waterproofing', 'installationLabor',
  'travel', 'waterTesting', 'sills', 'finishCaulking', 'screenLutronShades',
  'punchListWork', 'finishHardware', 'finalAdjustments',
] as const

export const EXPENSE_FIELDS = ['perDiem', 'mileage', 'materials'] as const

// Column display config for the project costs grid
export const COST_COLUMNS = [
  { key: 'flightsActual', label: 'Flights', short: 'Flights' },
  { key: 'lodgingActual', label: 'Lodging', short: 'Lodging' },
  { key: 'airportTransportation', label: 'Airport', short: 'Airport' },
  { key: 'carRental', label: 'Car Rental', short: 'Car' },
  { key: 'parking', label: 'Parking', short: 'Parking' },
  { key: 'equipment', label: 'Equipment', short: 'Equip' },
  { key: 'miscellaneousExpenses', label: 'Miscellaneous', short: 'Misc' },
  { key: 'waterproofing', label: 'Waterproofing', short: 'WP' },
  { key: 'woodBucks', label: 'Wood Bucks', short: 'WB' },
] as const

// Column display config for tech expense grids
export const LABOR_COLUMNS = [
  { key: 'woodbucks', label: 'Woodbucks', short: 'WB', color: '#b3d9ff' },
  { key: 'waterproofing', label: 'Waterproofing', short: 'WP', color: '#b3ffb3' },
  { key: 'installationLabor', label: 'Installation Labor', short: 'Labor', color: '#ffe6b3' },
  { key: 'travel', label: 'Travel', short: 'Travel', color: '#ffe6b3' },
  { key: 'waterTesting', label: 'Water Testing', short: 'WTest', color: '#ffe6b3' },
  { key: 'sills', label: 'Sills', short: 'Sills', color: '#ffe6b3' },
  { key: 'finishCaulking', label: 'Finish Caulking', short: 'Caulk', color: '#ffe6b3' },
  { key: 'screenLutronShades', label: 'Screen/Lutron', short: 'Screen', color: '#ffe6b3' },
  { key: 'punchListWork', label: 'Punch List', short: 'Punch', color: '#ffe6b3' },
  { key: 'finishHardware', label: 'Finish Hardware', short: 'HW', color: '#ffe6b3' },
  { key: 'finalAdjustments', label: 'Final Adjustments', short: 'Adj', color: '#ffe6b3' },
  { key: 'containerUnload', label: 'Container Unload', short: 'Unload', color: '#ffe6b3' },
] as const

export const TECH_EXPENSE_COLUMNS = [
  { key: 'perDiem', label: 'Per Diem', short: 'P/D', color: '#ffb366' },
  { key: 'mileage', label: 'Mileage', short: 'Mile', color: '#ffb366' },
  { key: 'materials', label: 'Materials', short: 'Mat', color: '#ffb366' },
] as const

export function num(v: unknown): number {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

export function fmt(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export function fmtNum(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}

/** Sum specific fields from a record's data object, applying dirty overrides */
export function sumFields(data: Record<string, any>, fields: readonly string[], dirty?: Record<string, number>): number {
  let total = 0
  for (const f of fields) {
    total += dirty?.[f] !== undefined ? dirty[f] : num(data[f])
  }
  return total
}

/** Calculate total hours for a tech expense record */
export function totalHours(data: Record<string, any>, dirty?: Record<string, number>): number {
  return sumFields(data, LABOR_HOUR_FIELDS, dirty)
}

/** Calculate weekly cost for a tech expense: (hours × rate) + expenses */
export function techWeeklyCost(data: Record<string, any>, hourlyRate: number, dirty?: Record<string, number>): number {
  const hours = totalHours(data, dirty)
  const expenses = sumFields(data, EXPENSE_FIELDS, dirty)
  return (hours * hourlyRate) + expenses
}

/** Calculate weekly total for a cost record */
export function costWeeklyTotal(data: Record<string, any>, dirty?: Record<string, number>): number {
  return sumFields(data, COST_FIELDS, dirty)
}
```

- [ ] **Step 2: Create data hook**

Create `apps/web/widgets/internal/installation-cost-grid/hooks/use-installation-data.ts`:

```typescript
import { useState, useCallback, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'

const BASE = '/controllers/installation-grid'

interface InstallationData {
  installation: any
  costs: Array<{ id: string; data: Record<string, any> }>
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
  weekCount: number
}

interface DirtyState {
  costs: Record<string, Record<string, number>>       // costRecordId → { field → value }
  techExpenses: Record<string, Record<string, number>> // expenseRecordId → { field → value }
}

export function useInstallationData(installationId: string | undefined) {
  const [data, setData] = useState<InstallationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState<DirtyState>({ costs: {}, techExpenses: {} })

  const isDirty = Object.keys(dirty.costs).length > 0 || Object.keys(dirty.techExpenses).length > 0

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    setError(null)
    try {
      const result = await apiClient.get<InstallationData>(`${BASE}/${installationId}/data`)
      setData(result)
    } catch (err: any) {
      setError(err.message || 'Failed to load installation data')
    } finally {
      setLoading(false)
    }
  }, [installationId])

  useEffect(() => { load() }, [load])

  const setCostField = useCallback((recordId: string, field: string, value: number) => {
    setDirty(prev => ({
      ...prev,
      costs: {
        ...prev.costs,
        [recordId]: { ...prev.costs[recordId], [field]: value },
      },
    }))
  }, [])

  const setTechExpenseField = useCallback((recordId: string, field: string, value: number) => {
    setDirty(prev => ({
      ...prev,
      techExpenses: {
        ...prev.techExpenses,
        [recordId]: { ...prev.techExpenses[recordId], [field]: value },
      },
    }))
  }, [])

  const save = useCallback(async () => {
    if (!installationId) return
    setSaving(true)
    setError(null)
    try {
      // Save dirty costs
      const costUpdates = Object.entries(dirty.costs).map(([id, fields]) => ({ id, ...fields }))
      if (costUpdates.length > 0) {
        await apiClient.request(`${BASE}/${installationId}/costs`, {
          method: 'PUT',
          body: JSON.stringify({ updates: costUpdates }),
        })
      }

      // Save dirty tech expenses
      const expenseUpdates = Object.entries(dirty.techExpenses).map(([id, fields]) => ({ id, ...fields }))
      if (expenseUpdates.length > 0) {
        await apiClient.request(`${BASE}/${installationId}/tech-expenses`, {
          method: 'PUT',
          body: JSON.stringify({ updates: expenseUpdates }),
        })
      }

      // Recalculate totals
      await apiClient.request(`${BASE}/${installationId}/recalculate`, { method: 'POST' })

      // Reload and clear dirty state
      setDirty({ costs: {}, techExpenses: {} })
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [installationId, dirty, load])

  const addWeek = useCallback(async () => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/weeks/add`, { method: 'POST' })
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to add week')
    }
  }, [installationId, load])

  const removeWeek = useCallback(async () => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/weeks/remove`, { method: 'POST' })
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to remove week')
    }
  }, [installationId, load])

  const recalculate = useCallback(async () => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/recalculate`, { method: 'POST' })
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to recalculate')
    }
  }, [installationId, load])

  const assignTechnician = useCallback(async (technicianId: string) => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/technicians`, {
        method: 'POST',
        body: JSON.stringify({ technicianId }),
      })
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to assign technician')
    }
  }, [installationId, load])

  const removeTechnician = useCallback(async (junctionId: string) => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/technicians/${junctionId}`, {
        method: 'DELETE',
      })
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to remove technician')
    }
  }, [installationId, load])

  return {
    data, loading, error, saving, isDirty, dirty,
    setCostField, setTechExpenseField,
    save, addWeek, removeWeek, recalculate,
    assignTechnician, removeTechnician, reload: load,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/utils/ apps/web/widgets/internal/installation-cost-grid/hooks/
git commit -m "feat(installation): add calculation utilities and data management hook"
```

---

### Task 3: Main widget component, KPI bar, and toolbar

**Files:**
- Modify: `apps/web/widgets/internal/installation-cost-grid/index.tsx`
- Create: `apps/web/widgets/internal/installation-cost-grid/components/kpi-bar.tsx`
- Create: `apps/web/widgets/internal/installation-cost-grid/components/toolbar.tsx`

- [ ] **Step 1: Create KPI bar component**

Create `apps/web/widgets/internal/installation-cost-grid/components/kpi-bar.tsx`:

```tsx
'use client'
import { num, fmt } from '../utils/calculations'

interface KpiBarProps {
  budget: number
  totalCost: number
  profit: number
}

export function KpiBar({ budget, totalCost, profit }: KpiBarProps) {
  const profitPct = budget > 0 ? ((profit / budget) * 100).toFixed(1) : '0.0'
  const isPositive = profit >= 0

  return (
    <div className="flex items-center gap-0 rounded-lg border border-blue-100 overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #f0f4ff, #e8eeff)' }}>
      <div className="flex-1 text-center py-3 px-4">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Budget</div>
        <div className="text-xl font-bold text-brand-navy">{fmt(budget)}</div>
      </div>
      <div className="w-px bg-blue-200 self-stretch" />
      <div className="flex-1 text-center py-3 px-4">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Total Cost</div>
        <div className="text-xl font-bold text-brand-navy">{fmt(totalCost)}</div>
      </div>
      <div className="w-px bg-blue-200 self-stretch" />
      <div className="flex-1 text-center py-3 px-4">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Profit</div>
        <div className={`text-xl font-bold ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{fmt(profit)}
        </div>
        <div className={`text-[10px] ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {profitPct}%
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create toolbar component**

Create `apps/web/widgets/internal/installation-cost-grid/components/toolbar.tsx`:

```tsx
'use client'
import { Plus, Minus, Users, RefreshCw, Save, Loader2 } from 'lucide-react'

interface ToolbarProps {
  startDate: string | null
  endDate: string | null
  weekCount: number
  isDirty: boolean
  saving: boolean
  onAddWeek: () => void
  onRemoveWeek: () => void
  onManageTechnicians: () => void
  onRecalculate: () => void
  onSave: () => void
}

export function Toolbar({
  startDate, endDate, weekCount, isDirty, saving,
  onAddWeek, onRemoveWeek, onManageTechnicians, onRecalculate, onSave,
}: ToolbarProps) {
  const formatDate = (d: string | null) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg flex-wrap">
      <span className="text-xs text-gray-500">
        <span className="font-semibold">Dates:</span> {formatDate(startDate)} – {formatDate(endDate)}
      </span>
      <span className="text-xs text-gray-500 bg-green-50 px-2 py-0.5 rounded">
        {weekCount} week{weekCount !== 1 ? 's' : ''}
      </span>

      <div className="flex gap-1">
        <button onClick={onAddWeek} className="text-[10px] px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1">
          <Plus className="w-3 h-3" /> Week
        </button>
        <button onClick={onRemoveWeek} className="text-[10px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center gap-1">
          <Minus className="w-3 h-3" /> Week
        </button>
      </div>

      <div className="flex-1" />

      <button onClick={onManageTechnicians} className="text-[10px] px-2 py-1 bg-[#f0f1f9] text-brand-navy border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center gap-1">
        <Users className="w-3 h-3" /> Manage Technicians
      </button>
      <button onClick={onRecalculate} className="text-[10px] px-2 py-1 bg-[#f0f1f9] text-brand-navy border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center gap-1">
        <RefreshCw className="w-3 h-3" /> Recalculate
      </button>
      <button onClick={onSave} disabled={!isDirty && !saving} className="text-[10px] px-3 py-1 bg-brand-navy text-white rounded hover:bg-brand-navy/90 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed font-semibold relative">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save
        {isDirty && !saving && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Implement main widget component with tab structure**

Replace `apps/web/widgets/internal/installation-cost-grid/index.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { useInstallationData } from './hooks/use-installation-data'
import { KpiBar } from './components/kpi-bar'
import { Toolbar } from './components/toolbar'
import { ProjectCostsTab } from './components/project-costs-tab'
import { TechniciansTab } from './components/technicians-tab'
import { SummaryTab } from './components/summary-tab'
import { TechnicianModal } from './components/technician-modal'
import { num } from './utils/calculations'

type Tab = 'costs' | 'technicians' | 'summary'

export default function InstallationCostGridWidget({ record }: WidgetProps) {
  const installationId = record?.id ? String(record.id) : undefined
  const {
    data, loading, error, saving, isDirty, dirty,
    setCostField, setTechExpenseField,
    save, addWeek, removeWeek, recalculate,
    assignTechnician, removeTechnician, reload,
  } = useInstallationData(installationId)

  const [activeTab, setActiveTab] = useState<Tab>('costs')
  const [techModalOpen, setTechModalOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-brand-navy" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const instData = (data.installation?.data ?? {}) as Record<string, any>
  const techCount = Object.keys(data.techExpenses).length

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'costs', label: 'Project Costs' },
    { id: 'technicians', label: `Technicians (${techCount})` },
    { id: 'summary', label: 'Summary' },
  ]

  return (
    <div className="space-y-3">
      <KpiBar
        budget={num(instData.installationBudget)}
        totalCost={num(instData.finalCost)}
        profit={num(instData.finalProfit)}
      />

      <Toolbar
        startDate={instData.startDate}
        endDate={instData.endDate}
        weekCount={data.weekCount}
        isDirty={isDirty}
        saving={saving}
        onAddWeek={addWeek}
        onRemoveWeek={removeWeek}
        onManageTechnicians={() => setTechModalOpen(true)}
        onRecalculate={recalculate}
        onSave={save}
      />

      {/* Tabs */}
      <div className="flex gap-0 border-b-2 border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-t-md transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-navy text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={{ marginLeft: tab.id === 'costs' ? 0 : 2 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
        {activeTab === 'costs' && (
          <ProjectCostsTab
            costs={data.costs}
            dirtyCosts={dirty.costs}
            onFieldChange={setCostField}
          />
        )}
        {activeTab === 'technicians' && (
          <TechniciansTab
            techExpenses={data.techExpenses}
            dirtyExpenses={dirty.techExpenses}
            onFieldChange={setTechExpenseField}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryTab
            costs={data.costs}
            techExpenses={data.techExpenses}
            dirtyCosts={dirty.costs}
            dirtyExpenses={dirty.techExpenses}
          />
        )}
      </div>

      {/* Technician Modal */}
      {techModalOpen && (
        <TechnicianModal
          installationId={installationId!}
          techExpenses={data.techExpenses}
          onAssign={assignTechnician}
          onRemove={removeTechnician}
          onClose={() => setTechModalOpen(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/
git commit -m "feat(installation): add main widget component with KPI bar, toolbar, and tab structure"
```

---

### Task 4: Project Costs tab (editable grid)

**Files:**
- Create: `apps/web/widgets/internal/installation-cost-grid/components/project-costs-tab.tsx`

- [ ] **Step 1: Create project costs tab**

Create `apps/web/widgets/internal/installation-cost-grid/components/project-costs-tab.tsx`:

```tsx
'use client'
import { COST_COLUMNS, costWeeklyTotal, num, fmt } from '../utils/calculations'

interface ProjectCostsTabProps {
  costs: Array<{ id: string; data: Record<string, any> }>
  dirtyCosts: Record<string, Record<string, number>>
  onFieldChange: (recordId: string, field: string, value: number) => void
}

export function ProjectCostsTab({ costs, dirtyCosts, onFieldChange }: ProjectCostsTabProps) {
  const getValue = (recordId: string, field: string, data: Record<string, any>): number => {
    return dirtyCosts[recordId]?.[field] !== undefined
      ? dirtyCosts[recordId][field]
      : num(data[field])
  }

  // Calculate column totals
  const columnTotals: Record<string, number> = {}
  let grandTotal = 0
  for (const col of COST_COLUMNS) {
    columnTotals[col.key] = 0
  }
  for (const cost of costs) {
    const d = cost.data as Record<string, any>
    for (const col of COST_COLUMNS) {
      columnTotals[col.key] += getValue(cost.id, col.key, d)
    }
    grandTotal += costWeeklyTotal(d, dirtyCosts[cost.id])
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs min-w-[700px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-2 text-left font-semibold border-b border-gray-200 sticky left-0 bg-gray-50 z-10">Week</th>
            {COST_COLUMNS.map(col => (
              <th key={col.key} className="px-2 py-2 text-right font-semibold border-b border-gray-200 whitespace-nowrap">
                {col.short}
              </th>
            ))}
            <th className="px-2 py-2 text-right font-bold border-b border-gray-200 whitespace-nowrap"
                style={{ background: 'rgba(200,200,255,0.2)', borderLeft: '3px solid #8b9cf7' }}>
              Weekly Total
            </th>
          </tr>
        </thead>
        <tbody>
          {costs.map(cost => {
            const d = cost.data as Record<string, any>
            const weekTotal = costWeeklyTotal(d, dirtyCosts[cost.id])

            return (
              <tr key={cost.id} className="hover:bg-gray-50/50">
                <td className="px-2 py-1 border-b border-gray-100 font-medium sticky left-0 bg-white z-10">
                  Wk {d.weekNumber}
                </td>
                {COST_COLUMNS.map(col => (
                  <td key={col.key} className="p-0.5 border-b border-gray-100">
                    <input
                      type="number"
                      step="0.01"
                      value={getValue(cost.id, col.key, d)}
                      onChange={e => onFieldChange(cost.id, col.key, parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-right text-xs focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none"
                    />
                  </td>
                ))}
                <td className="px-2 py-1 border-b border-gray-100 text-right font-semibold"
                    style={{ background: 'rgba(200,200,255,0.1)', borderLeft: '3px solid #8b9cf7' }}>
                  {fmt(weekTotal)}
                </td>
              </tr>
            )
          })}
          {/* Totals row */}
          <tr style={{ background: '#fef3c7' }}>
            <td className="px-2 py-2 font-bold text-amber-800 sticky left-0 z-10" style={{ background: '#fef3c7' }}>
              TOTAL
            </td>
            {COST_COLUMNS.map(col => (
              <td key={col.key} className="px-2 py-2 text-right font-bold text-amber-800">
                {fmt(columnTotals[col.key])}
              </td>
            ))}
            <td className="px-2 py-2 text-right font-extrabold text-amber-800"
                style={{ background: 'rgba(251,191,36,0.2)', borderLeft: '3px solid #f59e0b' }}>
              {fmt(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/components/project-costs-tab.tsx
git commit -m "feat(installation): add Project Costs editable grid tab"
```

---

### Task 5: Technicians tab and tech expense card

**Files:**
- Create: `apps/web/widgets/internal/installation-cost-grid/components/technicians-tab.tsx`
- Create: `apps/web/widgets/internal/installation-cost-grid/components/tech-expense-card.tsx`

- [ ] **Step 1: Create tech expense card**

Create `apps/web/widgets/internal/installation-cost-grid/components/tech-expense-card.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { LABOR_COLUMNS, TECH_EXPENSE_COLUMNS, totalHours, techWeeklyCost, num, fmt, fmtNum } from '../utils/calculations'

interface TechExpenseCardProps {
  junctionId: string
  technician: { id: string; name: string; assignedHourlyRate: number }
  expenses: Array<{ id: string; data: Record<string, any> }>
  dirtyExpenses: Record<string, Record<string, number>>
  onFieldChange: (recordId: string, field: string, value: number) => void
}

export function TechExpenseCard({ junctionId, technician, expenses, dirtyExpenses, onFieldChange }: TechExpenseCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  const getValue = (recordId: string, field: string, data: Record<string, any>): number => {
    return dirtyExpenses[recordId]?.[field] !== undefined
      ? dirtyExpenses[recordId][field]
      : num(data[field])
  }

  // Calculate tech total cost
  let techTotalCost = 0
  let techTotalHours = 0
  for (const exp of expenses) {
    const d = exp.data as Record<string, any>
    techTotalCost += techWeeklyCost(d, technician.assignedHourlyRate, dirtyExpenses[exp.id])
    techTotalHours += totalHours(d, dirtyExpenses[exp.id])
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-2 bg-gray-50 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          <span className="text-xs font-semibold text-brand-dark">{technician.name}</span>
          <span className="text-[10px] text-gray-500">(${technician.assignedHourlyRate}/hr)</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">{fmtNum(techTotalHours)} hrs</span>
          <span className="font-semibold text-brand-navy">{fmt(techTotalCost)}</span>
        </div>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px] min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200 sticky left-0 bg-gray-50 z-10">Wk</th>
                {LABOR_COLUMNS.map(col => (
                  <th key={col.key} className="px-1 py-1.5 text-center font-semibold border-b border-gray-200 whitespace-nowrap"
                      style={{ background: `${col.color}20` }}>
                    {col.short}
                  </th>
                ))}
                {TECH_EXPENSE_COLUMNS.map(col => (
                  <th key={col.key} className="px-1 py-1.5 text-center font-semibold border-b border-gray-200 whitespace-nowrap"
                      style={{ background: `${col.color}20` }}>
                    {col.short}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center font-bold border-b border-gray-200" style={{ background: 'rgba(200,200,255,0.2)' }}>Hrs</th>
                <th className="px-2 py-1.5 text-center font-bold border-b border-gray-200" style={{ background: 'rgba(200,200,255,0.2)' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => {
                const d = exp.data as Record<string, any>
                const hours = totalHours(d, dirtyExpenses[exp.id])
                const cost = techWeeklyCost(d, technician.assignedHourlyRate, dirtyExpenses[exp.id])

                return (
                  <tr key={exp.id} className="hover:bg-gray-50/50">
                    <td className="px-2 py-0.5 border-b border-gray-100 font-medium sticky left-0 bg-white z-10">
                      {d.weekNumber}
                    </td>
                    {LABOR_COLUMNS.map(col => (
                      <td key={col.key} className="p-0.5 border-b border-gray-100">
                        <input
                          type="number"
                          step="0.5"
                          value={getValue(exp.id, col.key, d)}
                          onChange={e => onFieldChange(exp.id, col.key, parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-200 rounded px-1 py-0.5 text-center text-[10px] focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none"
                          style={{ background: `${col.color}08` }}
                        />
                      </td>
                    ))}
                    {TECH_EXPENSE_COLUMNS.map(col => (
                      <td key={col.key} className="p-0.5 border-b border-gray-100">
                        <input
                          type="number"
                          step="0.01"
                          value={getValue(exp.id, col.key, d)}
                          onChange={e => onFieldChange(exp.id, col.key, parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-200 rounded px-1 py-0.5 text-center text-[10px] focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none"
                          style={{ background: `${col.color}08` }}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-0.5 border-b border-gray-100 text-center font-semibold" style={{ background: 'rgba(200,200,255,0.1)' }}>
                      {fmtNum(hours)}
                    </td>
                    <td className="px-2 py-0.5 border-b border-gray-100 text-center font-semibold" style={{ background: 'rgba(200,200,255,0.1)' }}>
                      {fmt(cost)}
                    </td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr style={{ background: '#fef3c7' }}>
                <td className="px-2 py-1.5 font-bold text-amber-800 sticky left-0 z-10" style={{ background: '#fef3c7' }}>TOT</td>
                {LABOR_COLUMNS.map(col => {
                  let colTotal = 0
                  for (const exp of expenses) colTotal += getValue(exp.id, col.key, exp.data)
                  return <td key={col.key} className="px-1 py-1.5 text-center font-bold text-amber-800">{fmtNum(colTotal)}</td>
                })}
                {TECH_EXPENSE_COLUMNS.map(col => {
                  let colTotal = 0
                  for (const exp of expenses) colTotal += getValue(exp.id, col.key, exp.data)
                  return <td key={col.key} className="px-1 py-1.5 text-center font-bold text-amber-800">{fmt(colTotal)}</td>
                })}
                <td className="px-2 py-1.5 text-center font-bold text-amber-800" style={{ background: 'rgba(251,191,36,0.2)' }}>{fmtNum(techTotalHours)}</td>
                <td className="px-2 py-1.5 text-center font-bold text-amber-800" style={{ background: 'rgba(251,191,36,0.2)' }}>{fmt(techTotalCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create technicians tab container**

Create `apps/web/widgets/internal/installation-cost-grid/components/technicians-tab.tsx`:

```tsx
'use client'
import { TechExpenseCard } from './tech-expense-card'

interface TechniciansTabProps {
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
  dirtyExpenses: Record<string, Record<string, number>>
  onFieldChange: (recordId: string, field: string, value: number) => void
}

export function TechniciansTab({ techExpenses, dirtyExpenses, onFieldChange }: TechniciansTabProps) {
  const entries = Object.entries(techExpenses)

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No technicians assigned yet.</p>
        <p className="text-xs mt-1">Use "Manage Technicians" in the toolbar to assign technicians.</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {entries.map(([junctionId, { technician, expenses }]) => (
        <TechExpenseCard
          key={junctionId}
          junctionId={junctionId}
          technician={technician}
          expenses={expenses}
          dirtyExpenses={dirtyExpenses}
          onFieldChange={onFieldChange}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/components/technicians-tab.tsx apps/web/widgets/internal/installation-cost-grid/components/tech-expense-card.tsx
git commit -m "feat(installation): add Technicians tab with collapsible per-tech expense grids"
```

---

### Task 6: Summary tab

**Files:**
- Create: `apps/web/widgets/internal/installation-cost-grid/components/summary-tab.tsx`

- [ ] **Step 1: Create summary tab**

Create `apps/web/widgets/internal/installation-cost-grid/components/summary-tab.tsx`:

```tsx
'use client'
import { COST_COLUMNS, LABOR_HOUR_FIELDS, EXPENSE_FIELDS, num, fmt } from '../utils/calculations'

interface SummaryTabProps {
  costs: Array<{ id: string; data: Record<string, any> }>
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
  dirtyCosts: Record<string, Record<string, number>>
  dirtyExpenses: Record<string, Record<string, number>>
}

export function SummaryTab({ costs, techExpenses, dirtyCosts, dirtyExpenses }: SummaryTabProps) {
  const getVal = (recordId: string, field: string, data: Record<string, any>, dirtyMap: Record<string, Record<string, number>>): number => {
    return dirtyMap[recordId]?.[field] !== undefined ? dirtyMap[recordId][field] : num(data[field])
  }

  // Sum project costs by category
  const projectTotals: Record<string, number> = {}
  for (const col of COST_COLUMNS) projectTotals[col.key] = 0
  for (const cost of costs) {
    for (const col of COST_COLUMNS) {
      projectTotals[col.key] += getVal(cost.id, col.key, cost.data, dirtyCosts)
    }
  }
  const projectSubtotal = Object.values(projectTotals).reduce((a, b) => a + b, 0)

  // Sum technician costs
  let techLaborTotal = 0
  let techPerDiemTotal = 0
  let techMileageTotal = 0
  let techMaterialsTotal = 0
  for (const { technician, expenses } of Object.values(techExpenses)) {
    for (const exp of expenses) {
      const d = exp.data as Record<string, any>
      let hours = 0
      for (const f of LABOR_HOUR_FIELDS) hours += getVal(exp.id, f, d, dirtyExpenses)
      techLaborTotal += hours * technician.assignedHourlyRate
      techPerDiemTotal += getVal(exp.id, 'perDiem', d, dirtyExpenses)
      techMileageTotal += getVal(exp.id, 'mileage', d, dirtyExpenses)
      techMaterialsTotal += getVal(exp.id, 'materials', d, dirtyExpenses)
    }
  }
  const techSubtotal = techLaborTotal + techPerDiemTotal + techMileageTotal + techMaterialsTotal

  const rows: Array<{ label: string; value: number; bold?: boolean; separator?: boolean }> = [
    ...COST_COLUMNS.map(col => ({ label: col.label, value: projectTotals[col.key] })),
    { label: 'Subtotal: Project Costs', value: projectSubtotal, bold: true },
    { label: '', value: 0, separator: true },
    { label: 'Technician Labor', value: techLaborTotal },
    { label: 'Per Diem', value: techPerDiemTotal },
    { label: 'Mileage', value: techMileageTotal },
    { label: 'Materials (Tech)', value: techMaterialsTotal },
    { label: 'Subtotal: Technician Costs', value: techSubtotal, bold: true },
    { label: '', value: 0, separator: true },
    { label: 'Grand Total', value: projectSubtotal + techSubtotal, bold: true },
  ]

  return (
    <div className="p-4">
      <table className="w-full max-w-lg border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Category</th>
            <th className="px-3 py-2 text-right font-semibold border-b border-gray-200">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.separator) {
              return <tr key={i}><td colSpan={2} className="py-1" /></tr>
            }
            return (
              <tr key={i} className={row.bold ? 'bg-gray-50' : ''}>
                <td className={`px-3 py-1.5 border-b border-gray-100 ${row.bold ? 'font-bold text-brand-dark' : 'text-gray-600'}`}>
                  {row.label}
                </td>
                <td className={`px-3 py-1.5 border-b border-gray-100 text-right ${row.bold ? 'font-bold text-brand-dark' : ''}`}>
                  {fmt(row.value)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/components/summary-tab.tsx
git commit -m "feat(installation): add Summary tab with category-level totals"
```

---

### Task 7: Technician management modal

**Files:**
- Create: `apps/web/widgets/internal/installation-cost-grid/components/technician-modal.tsx`

- [ ] **Step 1: Create technician modal**

Create `apps/web/widgets/internal/installation-cost-grid/components/technician-modal.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { X, Trash2, Plus, Loader2, Search } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { fmt } from '../utils/calculations'

interface TechnicianModalProps {
  installationId: string
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: any[]
  }>
  onAssign: (technicianId: string) => Promise<void>
  onRemove: (junctionId: string) => Promise<void>
  onClose: () => void
}

interface TechnicianRecord {
  id: string
  data: { technicianName?: string; hourlyRate?: number; status?: string }
}

export function TechnicianModal({ installationId, techExpenses, onAssign, onRemove, onClose }: TechnicianModalProps) {
  const [allTechnicians, setAllTechnicians] = useState<TechnicianRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRate, setNewRate] = useState('')
  const [creating, setCreating] = useState(false)

  // Get assigned technician IDs
  const assignedTechIds = new Set(
    Object.values(techExpenses).map(te => te.technician.id)
  )

  useEffect(() => {
    loadTechnicians()
  }, [])

  const loadTechnicians = async () => {
    try {
      // Fetch all Technician records
      const techObjectRecords = await apiClient.get<{ records: TechnicianRecord[] }>('/objects/Technician/records')
      setAllTechnicians(techObjectRecords.records || [])
    } catch {
      // Object may not exist yet
      setAllTechnicians([])
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (techId: string) => {
    setAssigning(true)
    try {
      await onAssign(techId)
    } finally {
      setAssigning(false)
    }
  }

  const handleRemove = async (junctionId: string) => {
    if (!confirm('Remove this technician? Their expense records for this installation will be deleted.')) return
    setRemoving(junctionId)
    try {
      await onRemove(junctionId)
    } finally {
      setRemoving(null)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newRate.trim()) return
    setCreating(true)
    try {
      const result = await apiClient.request('/objects/Technician/records', {
        method: 'POST',
        body: JSON.stringify({
          technicianName: newName.trim(),
          hourlyRate: parseFloat(newRate) || 0,
          status: 'Active',
        }),
      }) as any
      // Assign newly created technician
      if (result?.id) {
        await onAssign(result.id)
      }
      setNewName('')
      setNewRate('')
      setShowCreate(false)
      await loadTechnicians()
    } finally {
      setCreating(false)
    }
  }

  const available = allTechnicians.filter(t => {
    if (assignedTechIds.has(t.id)) return false
    const name = (t.data?.technicianName ?? '').toLowerCase()
    if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-dark">Manage Technicians</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Assigned technicians */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Assigned ({Object.keys(techExpenses).length})</h4>
            {Object.entries(techExpenses).length === 0 ? (
              <p className="text-xs text-gray-400">No technicians assigned</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(techExpenses).map(([junctionId, { technician }]) => (
                  <div key={junctionId} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-xs font-medium text-brand-dark">{technician.name}</span>
                      <span className="text-[10px] text-gray-500 ml-2">{fmt(technician.assignedHourlyRate)}/hr</span>
                    </div>
                    <button
                      onClick={() => handleRemove(junctionId)}
                      disabled={removing === junctionId}
                      className="text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {removing === junctionId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available technicians */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Available</h4>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search technicians..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none"
              />
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
            ) : available.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No available technicians</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {available.map(tech => (
                  <div key={tech.id} className="flex items-center justify-between px-3 py-2 border border-gray-100 rounded-lg hover:bg-gray-50">
                    <div>
                      <span className="text-xs font-medium">{tech.data?.technicianName}</span>
                      <span className="text-[10px] text-gray-500 ml-2">{fmt(tech.data?.hourlyRate ?? 0)}/hr</span>
                    </div>
                    <button
                      onClick={() => handleAssign(tech.id)}
                      disabled={assigning}
                      className="text-[10px] px-2 py-1 bg-brand-navy text-white rounded hover:bg-brand-navy/90 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create new technician */}
          <div>
            {!showCreate ? (
              <button onClick={() => setShowCreate(true)} className="text-xs text-brand-navy hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Create New Technician
              </button>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">New Technician</h4>
                <input
                  type="text"
                  placeholder="Name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-brand-navy outline-none"
                />
                <input
                  type="number"
                  placeholder="Hourly Rate"
                  step="0.01"
                  value={newRate}
                  onChange={e => setNewRate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-brand-navy outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={creating || !newName.trim() || !newRate.trim()} className="text-[10px] px-3 py-1 bg-brand-navy text-white rounded disabled:opacity-50 flex items-center gap-1">
                    {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Create & Assign
                  </button>
                  <button onClick={() => setShowCreate(false)} className="text-[10px] px-3 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/widgets/internal/installation-cost-grid/components/technician-modal.tsx
git commit -m "feat(installation): add technician management modal with search, assign, create"
```

---

### Task 8: Final build, verify, and push

- [ ] **Step 1: Build all packages**

Run: `pnpm --filter @crm/triggers build && pnpm --filter @crm/controllers build && pnpm --filter api build`

Expected: All succeed.

- [ ] **Step 2: Verify web typecheck**

Run: `cd apps/web && pnpm typecheck 2>&1 | grep -E "installation-cost-grid|InstallationCostGrid" || echo "No errors in new files"`

Expected: No errors in the new widget files.

- [ ] **Step 3: Verify widget registration is complete**

Checklist:
- `schema.ts`: `InstallationCostGrid` in `WidgetType` union ✓
- `schema.ts`: `InstallationCostGridConfig` interface ✓
- `schema.ts`: Added to `WidgetConfig` union ✓
- `registry.ts`: Import + registration entry with `widgetConfigType: 'InstallationCostGrid'` ✓
- `palette-components.tsx`: `'installation-cost-grid': 'InstallationCostGrid'` ✓
- `drag-parser.ts`: `'InstallationCostGrid'` in `WIDGET_TYPES` set ✓
- `layout-widgets-inline.tsx`: `case 'InstallationCostGrid'` in `getWidgetLabel` ✓

- [ ] **Step 4: Push to New-Test-To-Main**

```bash
git push origin claude/intelligent-tu:New-Test-To-Main
```
