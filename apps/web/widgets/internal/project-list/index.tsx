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
 *
 * Rendered as a single horizontally-scrollable table row (one segment of
 * the master sheet). Some source-sheet columns bundle several related
 * values into one cell (e.g. Shop Drawings' Set 1-4 + Final dates, Loading
 * List's RF/RS/OF) — those are modeled as "compound" columns below, whose
 * cell stacks each sub-field as its own labeled subrow instead of spanning
 * multiple top-level table columns.
 */
import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, Save, Table2 } from 'lucide-react'
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
  /** Fixed column width in pixels, applied via <colgroup> so multi-column groups don't get auto-shrunk. */
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
      col('Screen', [{ key: 'screenFlag', label: 'Screen', type: 'text' }]),
      col('Lutron', [{ key: 'lutronFlag', label: 'Lutron', type: 'text' }]),
      col('Check', [{ key: 'checkFlag', label: 'Check', type: 'text' }]),
    ],
  },
  {
    title: 'Order Info',
    columns: [
      col('Tischler PM', [{ key: 'tischlerPM', label: 'Tischler PM', type: 'text' }]),
      col('Factory PM', [{ key: 'factoryPM', label: 'Factory PM', type: 'text' }]),
      // Auto-filled (overridable): who created the Opportunity this Project is
      // attached to (via the `opportunity`/`OpportunityId` lookup field). Editing
      // and saving this cell stores an explicit override that always wins.
      col('Salesman', [{ key: 'projectSalesman', label: 'Salesman', type: 'text', computed: true }]),
      // Auto-filled (overridable): the state/province of the Property this Project
      // is attached to (via the `property`/`PropertyId` lookup field). Editing and
      // saving this cell stores an explicit override that always wins.
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
    // Values (not labels) are auto-filled on load with the sheet's fixed row
    // identities — 2 Shop Drawing Submission rows then CO Down/Out/Back — same
    // "computed but overridable" pattern as Salesman/Location/Factory below.
    title: 'Change Order in Estim / To Client',
    columns: [
      col('Change Order in Estim / To Client', rowsN(5, 'changeOrder', 'Change Order').map(f => (
        { ...f, computed: true }
      )), { width: 200 }),
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
      col('Completion Sign-off', rowsN(2, 'completionSignOff', 'Completion Sign-off'), { width: 170 }),
    ],
  },
]

const ALL_COLUMNS: ColumnDef[] = GROUPS.flatMap(g => g.columns)
const ALL_KEYS = ALL_COLUMNS.flatMap(c => c.fields.map(f => f.key))

/** Fixed pixel width for the leading, read-only "Project Name" column (sticky, not part of GROUPS/ALL_KEYS). */
const PROJECT_NAME_WIDTH = 170

function toDateInputValue(v: unknown): string {
  if (!v) return ''
  const s = String(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1]! : ''
}

function columnWidthPx(column: ColumnDef): number {
  if (column.width) return column.width
  if (column.fields.length > 1) return 180
  switch (column.fields[0]!.type) {
    case 'checkbox':
      return 52
    case 'date':
      return 136
    case 'number':
      return 92
    case 'select':
      return 150
    default:
      return 140
  }
}

export default function ProjectListWidget({ record, object }: WidgetProps) {
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

      // Auto-fill Salesman/Location from the Project's related Opportunity/Property,
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
      // Change Order's 5 rows always auto-fill to these fixed sheet row identities
      // (still overridable) — 2 Shop Drawing Submission rows, then CO Down/Out/Back.
      const computedChangeOrderRows: Record<string, string> = {
        changeOrderRow1: 'Shop Dwg Subm',
        changeOrderRow2: 'Shop Dwg Subm',
        changeOrderRow3: 'CO Down',
        changeOrderRow4: 'CO Out',
        changeOrderRow5: 'CO Back',
      }
      setComputedValues({
        projectSalesman: computedSalesman,
        projectLocation: computedLocation,
        factory: computedFactory,
        jobStatusOrderDateRow2: computedJobStatusRow2,
        ...computedChangeOrderRows,
      })
      // Only fall back to the computed default when the field has genuinely
      // never been saved (undefined/null in the raw record) — NOT when it's an
      // empty string, which means the user explicitly cleared it and that
      // clear must stick on every later load, not get silently refilled.
      const applyIfUnset = (raw: any, computed: string) => (raw === undefined || raw === null) ? computed : raw
      next.projectSalesman = applyIfUnset(flat.projectSalesman, computedSalesman)
      next.projectLocation = applyIfUnset(flat.projectLocation, computedLocation)
      next.factory = applyIfUnset(flat.factory, computedFactory)
      next.jobStatusOrderDateRow2 = applyIfUnset(flat.jobStatusOrderDateRow2, computedJobStatusRow2)
      for (const key of Object.keys(computedChangeOrderRows)) {
        next[key] = applyIfUnset(flat[key], computedChangeOrderRows[key]!)
      }

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

  const renderInput = (f: FieldDef, compact: boolean) => {
    const size = compact ? 'text-xs px-1.5 py-1' : 'text-xs px-1.5 py-1'
    if (f.type === 'checkbox') {
      return (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={!!values[f.key]}
            onChange={e => setField(f.key, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
          />
        </div>
      )
    }
    if (f.type === 'select') {
      return (
        <select
          value={values[f.key] || ''}
          onChange={e => setField(f.key, e.target.value)}
          className={`w-full border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy ${size}`}
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
          className={`w-full border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy ${size}`}
        />
      )
    }
    return (
      <input
        type={f.type === 'number' ? 'number' : 'text'}
        value={values[f.key] ?? ''}
        onChange={e => setField(f.key, e.target.value)}
        title={f.computed ? 'Auto-filled from the linked Opportunity/Property — edit to override' : undefined}
        className={`w-full border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-navy ${size} ${f.computed && values[f.key] && values[f.key] === computedValues[f.key] ? 'text-gray-500 italic' : ''}`}
      />
    )
  }

  const renderCell = (column: ColumnDef) => {
    if (column.fields.length === 1) {
      const f = column.fields[0]!
      if (column.tall) {
        return (
          <textarea
            value={values[f.key] || ''}
            onChange={e => setField(f.key, e.target.value)}
            rows={2}
            className="w-full text-xs border border-gray-300 rounded px-1.5 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        )
      }
      return renderInput(f, true)
    }
    // Compound column: stack each sub-field as its own labeled subrow within the cell.
    // Columns with fixed descriptive row labels (e.g. Change Order's "CO Down") set
    // `labelWidth` so the marker can hold real text instead of just a row number.
    return (
      <div className="flex flex-col gap-1">
        {column.fields.map(f => (
          <div key={f.key} className="flex items-center gap-1">
            <span
              className="text-[9px] font-medium text-gray-400 w-2.5 shrink-0 text-center"
              title={f.label}
            >
              {f.shortLabel || f.label}
            </span>
            <div className="flex-1 min-w-0">{renderInput(f, true)}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
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

      <div className="overflow-x-auto border border-gray-200 rounded-lg" role="table">
        <div className="flex" role="row">
          <div
            role="columnheader"
            style={{ width: PROJECT_NAME_WIDTH, flex: `0 0 auto` }}
            className="sticky left-0 top-0 z-20 bg-gray-100 border-b border-r border-gray-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap overflow-hidden"
          >
            Project
          </div>
          {GROUPS.map((group, i) => (
            <div
              key={`${group.title}-${i}`}
              role="columnheader"
              style={{ width: group.columns.reduce((sum, c) => sum + columnWidthPx(c), 0), flex: `0 0 auto` }}
              className="sticky top-0 z-10 bg-gray-100 border-b border-r border-gray-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap overflow-hidden"
            >
              {group.title}
            </div>
          ))}
        </div>
        <div className="flex" role="row">
          <div
            role="columnheader"
            style={{ width: PROJECT_NAME_WIDTH, flex: `0 0 auto` }}
            className="sticky left-0 top-[22px] z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis"
          >
            Project Name
          </div>
          {ALL_COLUMNS.map(column => (
            <div
              key={column.key}
              role="columnheader"
              style={{ width: columnWidthPx(column), flex: `0 0 auto` }}
              className="sticky top-[22px] z-10 bg-gray-50 border-b border-r border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {column.title}
            </div>
          ))}
        </div>
        <div className="flex" role="row">
          <div
            role="cell"
            style={{ width: PROJECT_NAME_WIDTH, flex: `0 0 auto` }}
            className="sticky left-0 z-10 bg-white border-r border-b border-gray-100 px-2 py-1.5 text-xs text-gray-700 truncate"
            title={projectName}
          >
            {projectName || '—'}
          </div>
          {ALL_COLUMNS.map(column => (
            <div
              key={column.key}
              role="cell"
              style={{ width: columnWidthPx(column), flex: `0 0 auto` }}
              className="border-r border-b border-gray-100 px-1 py-1.5"
            >
              {renderCell(column)}
            </div>
          ))}
        </div>
      </div>

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
