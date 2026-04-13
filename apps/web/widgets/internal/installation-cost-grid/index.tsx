'use client'
import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
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
