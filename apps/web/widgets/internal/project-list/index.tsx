'use client'

/**
 * Project List widget — a hard-coded (non-configurable) row of fields
 * mirroring the Tischler master "Project List" tracking sheet, scoped to a
 * single Project record. Every field here is a real Project custom field
 * (added in apps/api/src/ensure-core-objects.ts), so edits made here are
 * also visible/editable from the Project's own Field Values elsewhere.
 *
 * "Customer" (the sheet's first column) is intentionally NOT duplicated
 * here — it maps 1:1 to the Project's own `projectName` field, shown
 * read-only at the top of this widget.
 */
import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, Save, Table2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'

type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'checkbox' | 'select'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
}

interface FieldGroup {
  title: string
  fields: FieldDef[]
}

const GROUPS: FieldGroup[] = [
  {
    title: 'Order Info',
    fields: [
      { key: 'tusOrderNumber', label: 'TUS Order #', type: 'text' },
      { key: 'factory', label: 'Factory', type: 'text' },
      { key: 'tischlerPM', label: 'Tischler PM', type: 'text' },
      { key: 'factoryPM', label: 'Factory PM', type: 'text' },
      { key: 'projectSalesman', label: 'Salesman', type: 'text' },
      { key: 'projectLocation', label: 'Location', type: 'text' },
    ],
  },
  {
    title: 'Product Type',
    fields: [
      { key: 'standardProductType', label: 'ST (Standard)', type: 'checkbox' },
      { key: 'dadeCountyProductType', label: 'DC (Dade County)', type: 'checkbox' },
      { key: 'doubleHungProductType', label: 'DH (Double Hung)', type: 'checkbox' },
      { key: 'rollSystem', label: 'Roll System', type: 'text' },
    ],
  },
  {
    title: 'Materials',
    fields: [
      { key: 'woodSpecies', label: 'Wood Species', type: 'text' },
      { key: 'finishColor', label: 'Finish Color', type: 'text' },
      { key: 'dcSilicone', label: 'DC Silicone', type: 'checkbox' },
      { key: 'solarControl', label: 'Solar Ctrl', type: 'checkbox' },
      { key: 'screenFlag', label: 'Screen', type: 'checkbox' },
      { key: 'lutronFlag', label: 'Lutron', type: 'checkbox' },
      { key: 'checkFlag', label: 'Check', type: 'checkbox' },
    ],
  },
  {
    title: 'Change Orders',
    fields: [
      { key: 'changeOrderEstimToClient', label: 'Change Order in Estim / To Client', type: 'textarea' },
      { key: 'coDownDate', label: 'CO Down Date', type: 'date' },
      { key: 'coOutDate', label: 'CO Out Date', type: 'date' },
      { key: 'coBackDate', label: 'CO Back Date', type: 'date' },
    ],
  },
  {
    title: 'Shop Drawings',
    fields: [
      { key: 'shopDrawingsStatus', label: 'Status', type: 'select', options: ['Not Started', 'In Progress', 'Done'] },
      { key: 'set1OrderDate', label: 'Set 1 — Order', type: 'date' },
      { key: 'set1BackDate', label: 'Set 1 — Back', type: 'date' },
      { key: 'set1DueDate', label: 'Set 1 — Due', type: 'date' },
      { key: 'set2OrderDate', label: 'Set 2 — Order', type: 'date' },
      { key: 'set2BackDate', label: 'Set 2 — Back', type: 'date' },
      { key: 'set2DueDate', label: 'Set 2 — Due', type: 'date' },
      { key: 'set3OrderDate', label: 'Set 3 — Order', type: 'date' },
      { key: 'set3BackDate', label: 'Set 3 — Back', type: 'date' },
      { key: 'set3DueDate', label: 'Set 3 — Due', type: 'date' },
      { key: 'set4OrderDate', label: 'Set 4 — Order', type: 'date' },
      { key: 'set4BackDate', label: 'Set 4 — Back', type: 'date' },
      { key: 'set4DueDate', label: 'Set 4 — Due', type: 'date' },
      { key: 'finalSetOrderDate', label: 'Final — Order', type: 'date' },
      { key: 'finalSetBackDate', label: 'Final — Back', type: 'date' },
      { key: 'finalSetDueDate', label: 'Final — Due', type: 'date' },
    ],
  },
  {
    title: 'Install & Job Status',
    fields: [
      { key: 'installSetDate', label: 'Install Set Date', type: 'date' },
      { key: 'jobStatusDetail', label: 'Job Status', type: 'select', options: ['To be scheduled', 'Ordered', 'Shipped', 'Delivered'] },
      { key: 'jobOrderDate', label: 'Job Order Date', type: 'date' },
      { key: 'percentComplete', label: '% Complete', type: 'number' },
      { key: 'onHoldUnits', label: 'On-Hold Units', type: 'number' },
    ],
  },
  {
    title: 'Hardware & Installation',
    fields: [
      { key: 'customHardware', label: 'Custom Hardware', type: 'text' },
      { key: 'factoryOC', label: 'Factory O.C.', type: 'text' },
      { key: 'installationMaterialNotes', label: 'Installation Material', type: 'textarea' },
      { key: 'installationInstructionNotes', label: 'Installation Instruction', type: 'textarea' },
    ],
  },
  {
    title: 'Shipping',
    fields: [
      { key: 'shippingWeek', label: 'Shipping Week', type: 'number' },
      { key: 'estimatedDeliveryWeek', label: 'Estimated Delivery Wk', type: 'number' },
    ],
  },
  {
    title: 'Loading List',
    fields: [
      { key: 'loadingListRF', label: 'RF (Received from Factory)', type: 'date' },
      { key: 'loadingListRS', label: 'RS (Received from Site)', type: 'date' },
      { key: 'loadingListOF', label: 'OF (Out to Factory)', type: 'date' },
    ],
  },
  {
    title: 'Completion Sign-off',
    fields: [
      { key: 'completionSignOffOrdered', label: 'Ordered', type: 'date' },
      { key: 'completionSignOffComplete', label: 'Complete', type: 'date' },
      { key: 'completionSignOffBilled', label: 'Billed', type: 'date' },
    ],
  },
]

const ALL_KEYS = GROUPS.flatMap(g => g.fields.map(f => f.key))

function toDateInputValue(v: unknown): string {
  if (!v) return ''
  const s = String(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1]! : ''
}

export default function ProjectListWidget({ record, object }: WidgetProps) {
  const recordId = record?.id ? String(record.id) : undefined
  const [values, setValues] = useState<Record<string, any>>({})
  const [initialValues, setInitialValues] = useState<Record<string, any>>({})
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    try {
      const rec = await recordsService.getRecord('Project', recordId)
      if (!rec) {
        setError('Project record not found')
        return
      }
      const flat = recordsService.flattenRecord(rec)
      const next: Record<string, any> = {}
      for (const key of ALL_KEYS) next[key] = flat[key] ?? ''
      setValues(next)
      setInitialValues(next)
      setProjectName(flat.projectName || '')
    } catch (err: any) {
      setError(err?.message || 'Failed to load project data')
    } finally {
      setLoading(false)
    }
  }, [recordId])

  useEffect(() => { load() }, [load])

  const isDirty = ALL_KEYS.some(key => values[key] !== initialValues[key])

  const setField = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const save = useCallback(async () => {
    if (!recordId || !isDirty) return
    setSaving(true)
    setError(null)
    try {
      const changed: Record<string, any> = {}
      for (const key of ALL_KEYS) {
        if (values[key] !== initialValues[key]) changed[key] = values[key]
      }
      await recordsService.updateRecord('Project', recordId, { data: changed })
      setInitialValues(values)
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [recordId, isDirty, values, initialValues])

  if (object?.apiName && object.apiName !== 'Project') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The Project List widget can only be placed on the Project object's layout.
      </div>
    )
  }

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <Table2 className="w-5 h-5 text-brand-navy" />
          <div>
            <h3 className="text-sm font-bold text-brand-navy">Project List</h3>
            <p className="text-xs text-gray-500">Customer: {projectName || '—'}</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={!isDirty || saving}
          className="text-xs px-4 py-1.5 bg-brand-navy text-white rounded hover:bg-brand-navy/90 transition-colors flex items-center gap-1.5 font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isDirty ? 'Save Changes' : 'Saved'}
        </button>
      </div>

      {GROUPS.map(group => (
        <div key={group.title}>
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{group.title}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {group.fields.map(f => (
              <label key={f.key} className={f.type === 'textarea' ? 'col-span-2 md:col-span-4' : ''}>
                <span className="block text-[11px] font-medium text-gray-500 mb-1">{f.label}</span>
                {f.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={!!values[f.key]}
                    onChange={e => setField(f.key, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
                  />
                ) : f.type === 'select' ? (
                  <select
                    value={values[f.key] || ''}
                    onChange={e => setField(f.key, e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  >
                    <option value="" />
                    {f.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    value={values[f.key] || ''}
                    onChange={e => setField(f.key, e.target.value)}
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  />
                ) : f.type === 'date' ? (
                  <input
                    type="date"
                    value={toDateInputValue(values[f.key])}
                    onChange={e => setField(f.key, e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  />
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={values[f.key] ?? ''}
                    onChange={e => setField(f.key, e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      {isDirty && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-xs text-amber-700 font-medium">You have unsaved changes</span>
          <button
            onClick={save}
            disabled={saving}
            className="text-xs px-4 py-1.5 bg-brand-navy text-white rounded hover:bg-brand-navy/90 transition-colors flex items-center gap-1.5 font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}
