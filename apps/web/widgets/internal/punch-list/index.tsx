'use client'

/**
 * Punch List widget — shows every PunchList record linked (via its `workOrder`
 * Lookup) to the Work Order this widget is placed on, as an inline-editable
 * grid, plus a "+ New Punch List" form matching the field groups below.
 *
 * Field/group layout mirrors the requested "New Punch List" form:
 *   Information: name, item #, chosen, elevation page #, location, unit,
 *     total estimate of hours (calculated on save), client approved,
 *     service date, estimate of men, estimate of individual hours.
 *   Comments: description of work, material in WH, material to order,
 *     special equipment needed/comments.
 *   System Information: created by / last modified by (built-in record
 *     audit fields — not custom fields, read-only).
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, AlertCircle, ListChecks, Plus, X, Trash2, FileText } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'
import { useAuth } from '@/lib/auth-context'
import { generatePunchListPdf } from './pdf'

type FieldType = 'text' | 'textarea' | 'checkbox' | 'number' | 'date'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** Computed from other fields on save — never directly editable. */
  computed?: boolean
}

const INFO_FIELDS: FieldDef[] = [
  { key: 'itemNumber', label: 'Item#', type: 'text' },
  { key: 'techName', label: 'Tech Name', type: 'text' },
  { key: 'elevationPageNumber', label: 'Elevation Page #', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'unit', label: 'Unit', type: 'text' },
  { key: 'totalEstimateOfHours', label: 'Total Estimate of Hours', type: 'number', computed: true },
  { key: 'clientApproved', label: 'Client Approved', type: 'checkbox' },
  { key: 'serviceDate', label: 'Service Date', type: 'date' },
  { key: 'estimateOfMen', label: 'Estimate of Men', type: 'number' },
  { key: 'estimateOfIndividualHours', label: 'Estimate of Individual Hours', type: 'number' },
]

const COMMENT_FIELDS: FieldDef[] = [
  { key: 'descriptionOfWork', label: 'Description of Work', type: 'textarea' },
  { key: 'materialInWH', label: 'Material in WH', type: 'textarea' },
  { key: 'materialToOrder', label: 'Material to Order', type: 'textarea' },
  { key: 'specialEquipmentNeeded', label: 'Special Equipment Needed/Comments', type: 'textarea' },
]

const NEW_INFO_LEFT_FIELDS: FieldDef[] = [
  INFO_FIELDS[0]!,
  INFO_FIELDS[1]!,
  INFO_FIELDS[2]!,
  INFO_FIELDS[3]!,
  INFO_FIELDS[4]!,
]

const NEW_INFO_RIGHT_FIELDS: FieldDef[] = [
  INFO_FIELDS[6]!,
  INFO_FIELDS[7]!,
  INFO_FIELDS[8]!,
  INFO_FIELDS[9]!,
  INFO_FIELDS[5]!,
]

const ALL_FIELDS = [
  INFO_FIELDS[0]!,
  INFO_FIELDS[1]!,
  INFO_FIELDS[2]!,
  INFO_FIELDS[3]!,
  INFO_FIELDS[4]!,
  INFO_FIELDS[6]!,
  INFO_FIELDS[7]!,
  INFO_FIELDS[8]!,
  INFO_FIELDS[9]!,
  INFO_FIELDS[5]!,
  ...COMMENT_FIELDS,
]

function toDateInputValue(v: unknown): string {
  if (!v) return ''
  const s = String(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1]! : ''
}

function toDateDisplayValue(v: unknown): string {
  const iso = toDateInputValue(v)
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

/** estimateOfMen × estimateOfIndividualHours, per the "calculated upon save" spec. */
function computeTotalHours(values: Record<string, unknown>): number {
  const men = parseFloat(String(values.estimateOfMen ?? '')) || 0
  const hours = parseFloat(String(values.estimateOfIndividualHours ?? '')) || 0
  return Math.round(men * hours * 100) / 100
}

/**
 * Click-to-edit grid cell. Commits immediately on blur/Enter — punch list
 * rows are meant to be edited in place, one field at a time, with no
 * separate Save step.
 */
function EditableCell({
  value,
  type,
  saving,
  onCommit,
}: {
  value: unknown
  type: FieldType
  saving: boolean
  onCommit: (newValue: unknown) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<unknown>(value)

  const startEdit = () => {
    if (saving) return
    setDraft(value ?? (type === 'checkbox' ? false : ''))
    setEditing(true)
  }

  const commit = (newValue: unknown) => {
    setEditing(false)
    if (newValue !== value) onCommit(newValue)
  }

  if (type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        disabled={saving}
        onChange={(e) => onCommit(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
      />
    )
  }

  if (editing) {
    if (type === 'date') {
      return (
        <input
          type="date"
          autoFocus
          value={toDateInputValue(draft)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(draft) } else if (e.key === 'Escape') setEditing(false) }}
          className="w-full min-w-[7rem] border border-brand-navy/40 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    if (type === 'textarea') {
      return (
        <textarea
          autoFocus
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
          rows={2}
          className="w-full min-w-[9rem] border border-brand-navy/40 rounded px-1 py-1 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    return (
      <input
        type={type === 'number' ? 'number' : 'text'}
        autoFocus
        value={typeof draft === 'string' || typeof draft === 'number' ? String(draft) : ''}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(draft) } else if (e.key === 'Escape') setEditing(false) }}
        className="w-full min-w-[4.5rem] border border-brand-navy/40 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  const display = type === 'date' ? toDateDisplayValue(value) : (value === undefined || value === null || value === '' ? '-' : String(value))
  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={saving}
      className="w-full text-left rounded px-1 py-0.5 -mx-1 hover:bg-brand-navy/5 disabled:opacity-50 whitespace-normal break-words"
      title={type === 'textarea' ? display : undefined}
    >
      {display}
    </button>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy'

/** "+ New Punch List" modal — grouped exactly like the requested form. */
function NewPunchListModal({
  workOrderName,
  creatorName,
  saving,
  onCancel,
  onSubmit,
}: {
  workOrderName: string
  creatorName: string
  saving: boolean
  onCancel: () => void
  onSubmit: (values: Record<string, unknown>) => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>({ techName: creatorName })
  const setField = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }))
  const totalHours = computeTotalHours(values)

  const renderField = (f: FieldDef) => {
    if (f.computed) {
      return (
        <div className={`${inputClass} bg-gray-50 text-gray-500`}>
          {totalHours.toFixed(2)}
          <span className="ml-2 text-[11px] text-gray-400">This field is calculated upon save</span>
        </div>
      )
    }
    if (f.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={!!values[f.key]}
          onChange={(e) => setField(f.key, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
        />
      )
    }
    if (f.type === 'textarea') {
      return (
        <textarea
          value={typeof values[f.key] === 'string' ? (values[f.key] as string) : ''}
          onChange={(e) => setField(f.key, e.target.value)}
          rows={3}
          className={inputClass}
        />
      )
    }
    if (f.type === 'date') {
      return (
        <input
          type="date"
          value={toDateInputValue(values[f.key])}
          onChange={(e) => setField(f.key, e.target.value)}
          className={inputClass}
        />
      )
    }
    return (
      <input
        type={f.type === 'number' ? 'number' : 'text'}
        value={typeof values[f.key] === 'string' || typeof values[f.key] === 'number' ? String(values[f.key]) : ''}
        onChange={(e) => setField(f.key, e.target.value)}
        className={inputClass}
      />
    )
  }

  const canSave = !saving

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-punch-list-title">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="new-punch-list-title" className="text-lg font-bold text-brand-navy">New Punch List</h2>
          <button onClick={onCancel} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="px-6 pt-3 text-xs text-gray-400">* = Required Information</p>

        <div className="overflow-y-auto px-6 py-4 space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div className="space-y-4">
                {NEW_INFO_LEFT_FIELDS.map((f) => (
                  <FormField key={f.key} label={f.label}>
                    {renderField(f)}
                  </FormField>
                ))}
              </div>
              <div className="space-y-4">
                {NEW_INFO_RIGHT_FIELDS.map((f) => (
                  <FormField key={f.key} label={f.label}>
                    {renderField(f)}
                  </FormField>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Comments</h3>
            <div className="grid grid-cols-1 gap-4">
              {COMMENT_FIELDS.map((f) => (
                <FormField key={f.key} label={f.label}>
                  {renderField(f)}
                </FormField>
              ))}
              <FormField label="Work Order">
                <div className={`${inputClass} bg-gray-50 text-gray-500`}>{workOrderName || '—'}</div>
              </FormField>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">System Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Created By">
                <div className={`${inputClass} bg-gray-50 text-gray-400 italic`}>Set automatically on save</div>
              </FormField>
              <FormField label="Last Modified By">
                <div className={`${inputClass} bg-gray-50 text-gray-400 italic`}>Set automatically on save</div>
              </FormField>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(values)}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-navy rounded-lg hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PunchListWidget({ record, object }: WidgetProps) {
  const { user } = useAuth()
  const recordId = record?.id ? String(record.id) : undefined
  const workOrderName = String(record?.name ?? record?.title ?? record?.workOrderNumber ?? '')
  const creatorName = user?.name ?? ''
  const [rows, setRows] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    try {
      const records = await recordsService.getRecords('PunchList', { filter: { workOrder: recordId } })
      setRows(records)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load punch list items')
    } finally {
      setLoading(false)
    }
  }, [recordId])

  useEffect(() => { load() }, [load])

  if (object?.apiName && object.apiName !== 'WorkOrder') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The Punch List widget can only be placed on the Work Order object&rsquo;s layout.
      </div>
    )
  }

  const handleCellCommit = async (rowId: string, key: string, value: unknown) => {
    setSavingRowId(rowId)
    try {
      const changed: Record<string, unknown> = { [key]: value }
      if (key === 'estimateOfMen' || key === 'estimateOfIndividualHours') {
        const current = rows.find((r) => r.id === rowId)?.data ?? {}
        changed.totalEstimateOfHours = computeTotalHours({ ...current, [key]: value })
      }
      const updated = await recordsService.updateRecord('PunchList', rowId, { data: changed })
      if (updated) {
        setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save change')
    } finally {
      setSavingRowId(null)
    }
  }

  const handleCreate = async (values: Record<string, unknown>) => {
    if (!recordId) return
    setCreating(true)
    setError(null)
    try {
      const data = { ...values, totalEstimateOfHours: computeTotalHours(values), workOrder: recordId }
      const created = await recordsService.createRecord('PunchList', { data })
      if (created) {
        setRows((prev) => [...prev, created])
        setShowNewModal(false)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create punch list item')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (row: RecordData) => {
    if (!window.confirm('Delete this punch list item? This cannot be undone.')) return
    setDeletingRowId(row.id)
    setError(null)
    try {
      await recordsService.deleteRecord('PunchList', row.id)
      setRows((prev) => prev.filter((item) => item.id !== row.id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete punch list item')
    } finally {
      setDeletingRowId(null)
    }
  }

  const handlePreviewPdf = async () => {
    const previewWindow = window.open('', '_blank')
    setGeneratingPdf(true)
    setError(null)
    try {
      await generatePunchListPdf({
        rows,
        workOrderName,
        workOrderNumber: String(record?.workOrderNumber ?? ''),
        previewWindow,
      })
    } catch (err: unknown) {
      previewWindow?.close()
      setError(err instanceof Error ? err.message : 'Failed to generate Punch List PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-brand-navy" />
          <div>
            <h3 className="text-sm font-bold text-brand-navy">Punch List</h3>
            <p className="text-xs text-gray-500">{rows.length} item{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handlePreviewPdf()}
            disabled={generatingPdf}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-1.5 font-semibold text-gray-700 disabled:opacity-50"
          >
            {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Preview PDF
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-xs px-3 py-1.5 bg-brand-navy text-white rounded hover:bg-brand-navy/90 transition-colors flex items-center gap-1.5 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            New Punch List
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-brand-navy" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">No punch list items yet.</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                {ALL_FIELDS.map((f) => (
                  <th key={f.key} className="px-1.5 py-1 text-left font-semibold text-gray-600 whitespace-nowrap border-b border-gray-200">
                    {f.label}
                  </th>
                ))}
                <th className="w-8 px-1 py-1 border-b border-gray-200" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {ALL_FIELDS.map((f) => (
                    <td key={f.key} className="px-1.5 py-1 border-b border-gray-100 align-top min-w-[5rem] max-w-[18rem] whitespace-normal break-words">
                      <EditableCell
                        value={row.data?.[f.key]}
                        type={f.type}
                        saving={savingRowId === row.id || f.computed === true}
                        onCommit={(value) => handleCellCommit(row.id, f.key, value)}
                      />
                    </td>
                  ))}
                  <td className="w-8 px-1 py-1 border-b border-gray-100 align-top">
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      disabled={deletingRowId === row.id || savingRowId === row.id}
                      aria-label="Delete punch list item"
                      title="Delete punch list item"
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      {deletingRowId === row.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewModal && (
        <NewPunchListModal
          workOrderName={workOrderName}
          creatorName={creatorName}
          saving={creating}
          onCancel={() => setShowNewModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}
