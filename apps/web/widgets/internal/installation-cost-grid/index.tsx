/**
 * Installation Cost Grid widget — main entry point.
 * Renders KPI bar, tabbed views (costs, technicians, variance, executive),
 * and the technician assignment modal for a single Installation record.
 */
'use client'
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Save } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { useInstallationData } from './hooks/use-installation-data'
import { KpiBar } from './components/kpi-bar'
import { Toolbar } from './components/toolbar'
import { ProjectCostsTab } from './components/project-costs-tab'
import { TechniciansTab } from './components/technicians-tab'
import { VarianceReportTab } from './components/variance-report-tab'
import { ExecutiveSummaryTab } from './components/executive-summary-tab'
import { TechnicianModal } from './components/technician-modal'
import { num } from './utils/calculations'

type Tab = 'costs' | 'technicians' | 'variance' | 'executive'

export default function InstallationCostGridWidget({ record }: WidgetProps) {
  const installationId = record?.id ? String(record.id) : undefined
  const {
    data, loading, error, saving, isDirty, dirty,
    setCostField, setTechExpenseField, setEstimateField,
    save, saveEstimates, addWeek, removeWeek, recalculate,
    assignTechnician, removeTechnician, reload,
  } = useInstallationData(installationId)

  const [activeTab, setActiveTab] = useState<Tab>('costs')
  const [techModalOpen, setTechModalOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty) save()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, save])

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
    { id: 'variance', label: 'Variance Report' },
    { id: 'executive', label: 'Executive Summary' },
  ]

  return (
    <div className="space-y-4">
      {/* Installation Header */}
      <div className="text-center py-2">
        <h2 className="text-lg font-bold text-brand-navy">
          {instData.installationName || 'Installation'}
        </h2>
        {data.projectName && (
          <p className="text-sm text-gray-500 mt-0.5">
            Project: <span className="font-medium text-brand-dark">{data.projectName}</span>
          </p>
        )}
      </div>

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

      <div className="flex gap-0 border-b-2 border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-md transition-colors ${
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

      <div className="border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
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
      </div>

      {/* Bottom save bar — visible when there are unsaved changes */}
      {isDirty && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-xs text-amber-700 font-medium">
            You have unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-amber-600">Ctrl+S to save</span>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-4 py-1.5 bg-brand-navy text-white rounded hover:bg-brand-navy/90 transition-colors flex items-center gap-1.5 font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </div>
      )}

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
