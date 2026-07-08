'use client'

/**
 * Project List (Vertical Page) widget — an exact data/logic copy of the
 * `project-list` widget (same GROUPS/fields, same load/save, same
 * auto-filled-but-overridable Salesman/Location/Factory), rendered as a
 * vertical, fill-out-style page (one field per row, grouped into sections)
 * instead of a single horizontally-scrolling spreadsheet row.
 *
 * Keep the field/group definitions and load/save/computed-value logic in
 * sync with `../project-list/index.tsx` if that widget's data model changes.
 */
import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Loader2, AlertCircle, Save, LayoutList } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'

type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'checkbox' | 'select'

interface FieldDef {
  key: string
  label: string
  shortLabel?: string
  type: FieldType
  options?: string[]
  /** Value is derived from a related record (Opportunity/Property) rather than edited directly. */
  computed?: boolean
}

interface ColumnDef {
  key: string
  title: string
  fields: FieldDef[]
  /** Render the (single) field as a taller multi-line box instead of a one-line input. */
  tall?: boolean
  width?: number
}

interface GroupDef {
  title: string
  columns: ColumnDef[]
}

const col = (title: string, fields: FieldDef[], opts?: { tall?: boolean; width?: number }): ColumnDef => ({
  key: fields[0]!.key,
  title,
  fields,
  tall: opts?.tall,
  width: opts?.width,
})

/** Build `count` stacked free-text subrows a column holds (one per physical sheet row). */
const rowsN = (count: number, keyPrefix: string, label: string): FieldDef[] =>
  Array.from({ length: count }, (_, i) => i + 1).map(n => ({
    key: `${keyPrefix}Row${n}`,
    label: `${label} — Row ${n}`,
    shortLabel: `${n}`,
    type: 'text' as FieldType,
  }))

const rows5 = (keyPrefix: string, label: string): FieldDef[] => rowsN(5, keyPrefix, label)

const GROUPS: GroupDef[] = [
  {
    title: 'Order Info',
    columns: [
      col('TUS Order #', [{ key: 'tusOrderNumber', label: 'TUS Order #', type: 'text' }]),
      // Auto-filled (overridable): the linked Opportunity's Supplier(s) field.
      col('Factory', [{ key: 'factory', label: 'Factory', type: 'text', computed: true }]),
    ],
  },
  {
    title: 'Product Type',
    columns: [
      col('ST (Standard)', [{ key: 'standardProductType', label: 'ST (Standard)', type: 'text' }]),
      col('DC (Dade County)', [{ key: 'dadeCountyProductType', label: 'DC (Dade County)', type: 'text' }]),
      col('DH (Double Hung)', [{ key: 'doubleHungProductType', label: 'DH (Double Hung)', type: 'text' }]),
    ],
  },
  {
    title: 'Roll System',
    columns: [
      col('Screen', [{ key: 'screenFlag', label: 'Screen', type: 'checkbox' }]),
      col('Lutron', [{ key: 'lutronFlag', label: 'Lutron', type: 'checkbox' }]),
      col('Check', [{ key: 'checkFlag', label: 'Check', type: 'checkbox' }]),
    ],
  },
  {
    title: 'Order Info',
    columns: [
      col('Tischler PM', [{ key: 'tischlerPM', label: 'Tischler PM', type: 'text' }]),
      col('Factory PM', [{ key: 'factoryPM', label: 'Factory PM', type: 'text' }]),
      // Auto-filled (overridable): who created the Opportunity this Project is
      // attached to (via the `opportunity`/`OpportunityId` lookup field). Editing
      // and saving this field stores an explicit override that always wins.
      col('Salesman', [{ key: 'projectSalesman', label: 'Salesman', type: 'text', computed: true }]),
      // Auto-filled (overridable): the state/province of the Property this Project
      // is attached to (via the `property`/`PropertyId` lookup field). Editing and
      // saving this field stores an explicit override that always wins.
      col('Location', [{ key: 'projectLocation', label: 'Location', type: 'text', computed: true }]),
    ],
  },
  {
    title: 'Materials',
    columns: [
      col('Wood Species', [{ key: 'woodSpecies', label: 'Wood Species', type: 'text' }]),
      col('DC Silicone', [{ key: 'dcSilicone', label: 'DC Silicone', type: 'checkbox' }]),
      col('Solar Ctrl', [{ key: 'solarControl', label: 'Solar Ctrl', type: 'checkbox' }]),
      col('Finish Color', [{ key: 'finishColor', label: 'Finish Color', type: 'text' }]),
    ],
  },
  {
    title: 'Change Order in Estim / To Client',
    columns: [
      col('Change Order in Estim / To Client', rowsN(4, 'changeOrder', 'Change Order'), { width: 200 }),
    ],
  },
  {
    title: 'Shop Drawings',
    columns: [
      col('Set 1', rows5('set1', 'Set 1'), { width: 170 }),
      col('Set 2', rows5('set2', 'Set 2'), { width: 170 }),
      col('Set 3', rows5('set3', 'Set 3'), { width: 170 }),
      col('Set 4', rows5('set4', 'Set 4'), { width: 170 }),
      col('Final', rows5('finalSet', 'Final'), { width: 170 }),
      col('Install Set', rows5('installSet', 'Install Set'), { width: 170 }),
    ],
  },
  {
    title: 'Install & Job Status',
    columns: [
      // Row 2 is always the Order Date, regardless of the generic per-row label.
      col('Job Status / Order Date', rowsN(3, 'jobStatusOrderDate', 'Job Status / Order Date').map((f, i) =>
        i === 1 ? { ...f, computed: true } : f
      ), { width: 190 }),
      col('On-Hold Units', [{ key: 'onHoldUnits', label: 'On-Hold Units', type: 'number' }]),
    ],
  },
  {
    title: 'Hardware & Installation',
    columns: [
      col('Custom Hardware', [{ key: 'customHardware', label: 'Custom Hardware', type: 'text' }]),
      col('Factory O.C.', rowsN(2, 'factoryOC', 'Factory O.C.'), { width: 170 }),
      col('Installation Material', rowsN(2, 'installationMaterial', 'Installation Material'), { width: 190 }),
      col('Installation Instruction', rowsN(3, 'installationInstruction', 'Installation Instruction'), { width: 190 }),
    ],
  },
  {
    title: 'Shipping',
    columns: [
      col('Shipping Week', rowsN(5, 'shippingWeek', 'Shipping Week'), { width: 190 }),
      col('Estimated Delivery Wk', rowsN(5, 'estimatedDeliveryWeek', 'Estimated Delivery Wk'), { width: 190 }),
    ],
  },
  {
    title: 'Loading List',
    columns: [
      col('RF', rows5('loadingListRF', 'RF'), { width: 170 }),
      col('RS', rows5('loadingListRS', 'RS'), { width: 170 }),
      col('OF', rows5('loadingListOF', 'OF'), { width: 170 }),
    ],
  },
  {
    title: 'Completion Sign-off',
    columns: [
      col('Completion Sign-off', [{ key: 'completionSignOff', label: 'Completion Sign-off', type: 'textarea' }], { tall: true, width: 180 }),
    ],
  },
]

const ALL_COLUMNS: ColumnDef[] = GROUPS.flatMap(g => g.columns)
const ALL_KEYS = ALL_COLUMNS.flatMap(c => c.fields.map(f => f.key))

function toDateInputValue(v: unknown): string {
  if (!v) return ''
  const s = String(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1]! : ''
}

/**
 * One label+input row within a section. Declared at module scope (not inside
 * the widget component) so it keeps a stable identity across renders — if it
 * were redefined on every render, React would treat it as a brand-new
 * component type on every keystroke and remount the input, which drops focus
 * after a single character.
 */
function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 px-4 py-2.5 border-b border-gray-100 last:border-b-0 items-start">
      <label className="text-xs font-medium text-gray-600 sm:pt-2">{label}</label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  )
}

export default function ProjectListVerticalWidget({ record, object }: WidgetProps) {
  const recordId = record?.id ? String(record.id) : undefined
  const [values, setValues] = useState<Record<string, any>>({})
  const [initialValues, setInitialValues] = useState<Record<string, any>>({})
  const [projectName, setProjectName] = useState('')
  // Read-only values derived from related records (see FieldDef.computed).
  const [computedValues, setComputedValues] = useState<Record<string, string>>({})
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
      setProjectName(flat.projectName || '')

      // Auto-fill Salesman/Location/Factory from the Project's related Opportunity/Property,
      // but only when the Project doesn't already have its own saved value — users can
      // freely overwrite the auto-filled value, and their override wins on every later load.
      // Older/imported Project records store the lookup under legacy
      // `OpportunityId`/`PropertyId` keys instead of the current `opportunity`/
      // `property` lookup field keys — check both.
      const opportunityId = flat.opportunity || flat.OpportunityId
      const propertyId = flat.property || flat.PropertyId
      const [oppRec, propRec] = await Promise.all([
        opportunityId ? recordsService.getRecord('Opportunity', String(opportunityId)).catch(() => null) : Promise.resolve(null),
        propertyId ? recordsService.getRecord('Property', String(propertyId)).catch(() => null) : Promise.resolve(null),
      ])
      const oppFlat = oppRec ? recordsService.flattenRecord(oppRec) : null
      const propFlat = propRec ? recordsService.flattenRecord(propRec) : null
      const computedSalesman = oppFlat?.createdBy || ''
      const computedLocation = propFlat?.state || ''
      // supplier_or_suppliers is a MultiPicklist stored as a ";"-joined string.
      const computedFactory = oppFlat?.supplier_or_suppliers
        ? String(oppFlat.supplier_or_suppliers).split(';').filter(Boolean).join(', ')
        : ''
      // Row 2 of the Job Status / Order Date stack always auto-fills to the literal
      // text "Order Date" (still overridable, like the other computed fields above).
      const computedJobStatusRow2 = 'Order Date'
      setComputedValues({
        projectSalesman: computedSalesman,
        projectLocation: computedLocation,
        factory: computedFactory,
        jobStatusOrderDateRow2: computedJobStatusRow2,
      })
      next.projectSalesman = next.projectSalesman || computedSalesman
      next.projectLocation = next.projectLocation || computedLocation
      next.factory = next.factory || computedFactory
      next.jobStatusOrderDateRow2 = next.jobStatusOrderDateRow2 || computedJobStatusRow2

      setValues(next)
      setInitialValues(next)
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
        The Project List (Vertical Page) widget can only be placed on the Project object's layout.
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

  const renderInput = (f: FieldDef) => {
    if (f.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={!!values[f.key]}
          onChange={e => setField(f.key, e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
        />
      )
    }
    if (f.type === 'select') {
      return (
        <select
          value={values[f.key] || ''}
          onChange={e => setField(f.key, e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        >
          <option value="" />
          {f.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }
    if (f.type === 'date') {
      return (
        <input
          type="date"
          value={toDateInputValue(values[f.key])}
          onChange={e => setField(f.key, e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    if (f.type === 'textarea') {
      return (
        <textarea
          value={values[f.key] || ''}
          onChange={e => setField(f.key, e.target.value)}
          rows={3}
          className="w-full max-w-md border border-gray-300 rounded px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    return (
      <input
        type={f.type === 'number' ? 'number' : 'text'}
        value={values[f.key] ?? ''}
        onChange={e => setField(f.key, e.target.value)}
        title={f.computed ? 'Auto-filled from the linked Opportunity/Property — edit to override' : undefined}
        className={`w-full max-w-md border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy ${f.computed && values[f.key] && values[f.key] === computedValues[f.key] ? 'text-gray-500 italic' : ''}`}
      />
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <LayoutList className="w-5 h-5 text-brand-navy" />
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

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
          Project Name
        </div>
        <div className="px-4 py-2.5 text-sm text-gray-700">{projectName || '—'}</div>
      </div>

      {GROUPS.map((group, i) => (
        <div key={`${group.title}-${i}`} className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-gray-100 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            {group.title}
          </div>
          <div>
            {group.columns.map(column =>
              column.fields.length === 1 ? (
                <FormRow key={column.key} label={column.title}>{renderInput(column.fields[0]!)}</FormRow>
              ) : (
                column.fields.map(f => <FormRow key={f.key} label={f.label}>{renderInput(f)}</FormRow>)
              )
            )}
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
