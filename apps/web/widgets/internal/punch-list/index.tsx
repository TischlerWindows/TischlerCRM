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
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, AlertCircle, ListChecks, Plus, X, Trash2, FileText } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'
import { restoreGridRows, snapshotGridRows } from '@/lib/grid-undo-records'
import { useGridUndo } from '@/lib/use-grid-undo'
import { useAuth } from '@/lib/auth-context'
import type { NavDirection } from '@/lib/cell-navigation'
import {
  getGridFillTargets,
  getGridFillRangeCellClasses,
  isCaretAtHorizontalEdge,
  focusGridCellSurface,
  isValidGridDecimalInput,
  getGridSelectionBounds,
  getGridSelectionOrigin,
  isInGridSelection,
  parseGridCellValue,
  parseGridClipboard,
  serializeGridClipboard,
  spreadsheetColumnLabel,
  tileGridClipboardToSelection,
  type GridCoordinate,
  type GridSelection,
} from '@/lib/cad-index-grid'
import { GridRangeDecoration, GridRangeStyles } from '../shared/grid-range-decoration'
import { generatePunchListPdf } from './pdf'

type FieldType = 'text' | 'textarea' | 'checkbox' | 'number' | 'date'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** Computed from other fields on save — never directly editable. */
  computed?: boolean
}

interface FillDrag {
  selection: GridSelection
  target: GridCoordinate
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
  INFO_FIELDS[8]!,
  INFO_FIELDS[9]!,
  INFO_FIELDS[5]!,
  ...COMMENT_FIELDS,
]

/** Long numeric-estimate headers wrap onto two lines at a fixed width
 * instead of forcing the whole table wider — keeps more room for the
 * free-text columns (Description of Work, etc.) that need it more. */
const WRAPPED_HEADER_KEYS = new Set([
  'elevationPageNumber',
  'estimateOfMen',
  'estimateOfIndividualHours',
  'totalEstimateOfHours',
])

/** Fixed column widths for the desktop table (used via <colgroup>, not
 * min/max-width on individual cells) — with `table-layout: fixed`, columns
 * are sized once from these and never resize when a cell's content swaps
 * between its display value and an inline-edit input/textarea. */
function getColWidthRem(key: string): string {
  if (key === 'itemNumber') return '3.5rem'
  if (key === 'elevationPageNumber') return '5rem'
  if (key === 'descriptionOfWork') return '20rem'
  if (WRAPPED_HEADER_KEYS.has(key)) return '6.5rem'
  return '10rem'
}

function getMobileRowWidthClass(field: FieldDef): string {
  if (field.key === 'itemNumber') return 'w-12'
  if (field.key === 'elevationPageNumber') return 'w-20'
  if (field.key === 'descriptionOfWork') return 'w-64'
  if (field.type === 'textarea') return 'w-40'
  if (field.type === 'checkbox') return 'w-24'
  return 'w-24'
}

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

/** Cell editor; selection and keyboard movement belong to the surrounding grid. */
function EditableCell({
  cellId,
  value,
  type,
  saving,
  computed,
  isEditing,
  editSeed,
  onStartEdit,
  onStopEdit,
  onCommit,
}: {
  cellId?: string
  value: unknown
  type: FieldType
  saving: boolean
  /** Permanently non-editable (e.g. a calculated field) — always skipped by
   * keyboard navigation, unlike `saving` which is only temporarily true. */
  computed?: boolean
  isEditing?: boolean
  editSeed?: string | null
  onStartEdit?: () => void
  onStopEdit?: () => void
  onCommit: (newValue: unknown) => void
}) {
  const [draft, setDraft] = useState<unknown>(value)

  useEffect(() => {
    if (isEditing) setDraft(editSeed ?? value ?? (type === 'checkbox' ? false : ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const startEdit = () => {
    if (saving) return
    onStartEdit?.()
  }

  const commit = (newValue: unknown) => {
    onStopEdit?.()
    if (newValue !== value) onCommit(newValue)
  }

  // Only a permanently computed cell is skipped by keyboard navigation —
  // a cell that's merely mid-save (saving=true for the whole row while any
  // one field in it is in flight) must stay reachable, or Tab/Enter/arrows
  // stop working across the entire row until that save resolves.
  const dataCellId = computed ? undefined : cellId

  // Checkbox never remounts between editing/non-editing (there's no edit
  // mode to toggle into), so unlike the other field types nothing else
  // gives it DOM focus when keyboard navigation lands on it — do it here.
  const checkboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (isEditing) checkboxRef.current?.focus()
  }, [isEditing])

  // Grows the textarea to match its wrapped-text content height (same as
  // the display button's height) so the row doesn't shrink to a fixed
  // 2-row textarea and then jump back when editing ends.
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!isEditing) return
    const focusFrame = requestAnimationFrame(() => {
      const editor = type === 'textarea' ? textareaRef.current : inputRef.current
      const rect = editor?.getBoundingClientRect()
      if (!editor || !rect || (rect.width === 0 && rect.height === 0)) return
      editor.focus()
      if (editSeed !== null && !(editor instanceof HTMLInputElement && editor.type === 'date')) {
        editor.setSelectionRange(editor.value.length, editor.value.length)
      }
    })
    return () => cancelAnimationFrame(focusFrame)
  }, [isEditing, type, editSeed])

  useEffect(() => {
    if (isEditing && type === 'textarea' && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [isEditing, draft, type])

  if (type === 'checkbox') {
    return (
      <input
        type="checkbox"
        ref={checkboxRef}
        data-cell-id={dataCellId}
        checked={!!value}
        disabled={saving}
        onChange={(e) => onCommit(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
      />
    )
  }

  if (isEditing) {
    if (type === 'date') {
      return (
        <input
          ref={inputRef}
          type="date"
          data-cell-id={dataCellId}
          value={toDateInputValue(draft)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(draft); focusGridCellSurface(e.currentTarget); return }
            if (e.key === 'Escape') { onStopEdit?.(); return }
          }}
          className="w-full border border-brand-navy/40 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    if (type === 'textarea') {
      return (
        <textarea
          ref={textareaRef}
          data-cell-id={dataCellId}
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { onStopEdit?.(); return }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(draft); focusGridCellSurface(e.currentTarget) }
          }}
          rows={1}
          className="w-full border border-brand-navy/40 rounded px-1 py-1 text-sm resize-none overflow-hidden focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    const isNumber = type === 'number'
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode={isNumber ? 'decimal' : undefined}
        data-cell-id={dataCellId}
        value={typeof draft === 'string' || typeof draft === 'number' ? String(draft) : ''}
        onChange={(e) => {
          if (isNumber && !isValidGridDecimalInput(e.target.value)) return
          setDraft(e.target.value)
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(draft); focusGridCellSurface(e.currentTarget); return }
          if (e.key === 'Escape') { onStopEdit?.(); return }
        }}
        className="w-full border border-brand-navy/40 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  const display = type === 'date' ? toDateDisplayValue(value) : (value === undefined || value === null || value === '' ? '-' : String(value))
  return (
    <button
      type="button"
      data-cell-id={dataCellId}
      onDoubleClick={startEdit}
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

export default function PunchListWidget({ record, object, onRecordChange }: WidgetProps) {
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
  const [serviceDate, setServiceDate] = useState(() => toDateInputValue(record?.serviceDate))
  // WorkOrder__punchListCreated pre-dates this widget and always wins over the
  // bare `punchListCreated` mirror in flattenRecord's prefix-precedence rule.
  const [punchListCreated, setPunchListCreated] = useState(!!(record?.WorkOrder__punchListCreated ?? record?.punchListCreated))
  const [punchListCompleted, setPunchListCompleted] = useState(!!(record?.punchListCompleted ?? record?.punchListPrinted))
  const [savingFlagKey, setSavingFlagKey] = useState<string | null>(null)
  // Which grid cell (`${rowId}:${fieldKey}`) is currently being edited.
  const [editingCellId, setEditingCellId] = useState<string | null>(null)
  const [editSeed, setEditSeed] = useState<string | null>(null)
  const [fillDrag, setFillDrag] = useState<FillDrag | null>(null)
  const [gridSelection, setGridSelection] = useState<GridSelection | null>(null)
  const [copiedGridSelection, setCopiedGridSelection] = useState<GridSelection | null>(null)
  const { pushUndo, popUndo, clearUndo } = useGridUndo<RecordData[]>()
  const gridRootRef = useRef<HTMLDivElement>(null)
  const selectingGridRef = useRef(false)

  const focusGridCell = (coordinate: GridCoordinate) => {
    requestAnimationFrame(() => {
      const cells = gridRootRef.current?.querySelectorAll<HTMLElement>(`[data-grid-row="${coordinate.row}"][data-grid-column="${coordinate.column}"]`)
      Array.from(cells ?? []).find(cell => cell.getClientRects().length > 0)?.focus()
    })
  }

  const navigateGrid = (row: number, column: number, direction: NavDirection, extend = false) => {
    let nextRow = row + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0)
    let nextColumn = column + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0)
    if (nextColumn < 0) { nextColumn = ALL_FIELDS.length - 1; nextRow -= 1 }
    if (nextColumn >= ALL_FIELDS.length) { nextColumn = 0; nextRow += 1 }
    nextRow = Math.max(0, Math.min(nextRow, rows.length - 1))
    nextColumn = Math.max(0, Math.min(nextColumn, ALL_FIELDS.length - 1))
    const focus = { row: nextRow, column: nextColumn }
    setGridSelection(current => extend && current ? { ...current, focus } : { anchor: focus, focus })
    setEditingCellId(null)
    setEditSeed(null)
    focusGridCell(focus)
  }

  const applyGridClipboard = async (start: GridCoordinate, matrix: string[][]) => {
    if (!recordId || !matrix.length) return
    pushUndo(snapshotGridRows(rows))
    setError(null)
    setCreating(true)
    const targetRows = [...rows]
    try {
      while (targetRows.length < start.row + matrix.length) {
        const created = await recordsService.createRecord('PunchList', {
          data: { workOrder: recordId, serviceDate: serviceDate || undefined, totalEstimateOfHours: 0 },
        })
        if (!created) throw new Error('Failed to add a row for pasted cells')
        targetRows.push(created)
        setRows(current => [...current, created])
      }

      let skippedCount = 0
      for (let rowOffset = 0; rowOffset < matrix.length; rowOffset++) {
        const row = targetRows[start.row + rowOffset]
        if (!row) continue
        const patch: Record<string, unknown> = {}
        matrix[rowOffset]?.forEach((rawValue, columnOffset) => {
          const field = ALL_FIELDS[start.column + columnOffset]
          if (!field || field.computed) { skippedCount += 1; return }
          const valueType = field.type === 'checkbox' ? 'checkbox' : field.type === 'number' ? 'number' : 'text'
          const parsed = parseGridCellValue(rawValue, valueType)
          if (!parsed.valid) { skippedCount += 1; return }
          patch[field.key] = parsed.value
        })
        if (!Object.keys(patch).length) continue
        const merged = { ...(row.data ?? {}), ...patch }
        if ('estimateOfMen' in patch || 'estimateOfIndividualHours' in patch) {
          patch.totalEstimateOfHours = computeTotalHours(merged)
        }
        setSavingRowId(row.id)
        const updated = await recordsService.updateRecord('PunchList', row.id, { data: patch })
        if (updated) {
          targetRows[start.row + rowOffset] = updated
          setRows(current => current.map(item => item.id === row.id ? updated : item))
        }
      }
      const lastRow = Math.min(targetRows.length - 1, start.row + matrix.length - 1)
      const lastColumn = Math.min(ALL_FIELDS.length - 1, start.column + Math.max(...matrix.map(row => row.length)) - 1)
      setGridSelection({ anchor: { row: lastRow, column: lastColumn }, focus: start })
      focusGridCell(start)
      if (skippedCount) setError(`${skippedCount} pasted cell${skippedCount === 1 ? '' : 's'} skipped because the column is calculated or the value is invalid`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to paste punch list cells')
    } finally {
      setSavingRowId(null)
      setCreating(false)
    }
  }

  const gridClipboardMatrix = (selection: GridSelection): unknown[][] => {
    const bounds = getGridSelectionBounds(selection)
    return rows.slice(bounds.top, bounds.bottom + 1).map(row =>
      ALL_FIELDS.slice(bounds.left, bounds.right + 1).map(field => row.data?.[field.key]),
    )
  }

  const handleGridCopy = (event: React.ClipboardEvent<HTMLDivElement>, cut = false) => {
    if (!gridSelection || editingCellId) return
    event.clipboardData.setData('text/plain', serializeGridClipboard(gridClipboardMatrix(gridSelection)))
    event.preventDefault()
    setCopiedGridSelection(gridSelection)
    if (cut) {
      const bounds = getGridSelectionBounds(gridSelection)
      void applyGridClipboard(getGridSelectionOrigin(gridSelection), Array.from(
        { length: bounds.bottom - bounds.top + 1 },
        () => Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
      ))
    }
  }

  const handleGridPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!gridSelection || editingCellId) return
    event.preventDefault()
    setCopiedGridSelection(null)
    const matrix = tileGridClipboardToSelection(parseGridClipboard(event.clipboardData.getData('text/plain')), gridSelection)
    void applyGridClipboard(getGridSelectionOrigin(gridSelection), matrix)
  }

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLElement>, row: number, column: number) => {
    if (event.defaultPrevented) return
    if (event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLInputElement && event.target.type !== 'checkbox')) {
      const target = event.target
      const direction = event.key === 'ArrowLeft' ? 'left'
        : event.key === 'ArrowRight' ? 'right'
        : event.key === 'ArrowUp' ? 'up'
        : event.key === 'ArrowDown' ? 'down'
        : null
      const atHorizontalEdge = direction === 'left' || direction === 'right'
        ? isCaretAtHorizontalEdge(target.value, target.selectionStart, target.selectionEnd, direction)
        : direction !== null
      if (direction && atHorizontalEdge) {
        event.preventDefault()
        target.blur()
        navigateGrid(row, column, direction)
      }
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      void undoGridAction()
      return
    }
    if (event.key === 'Escape' && copiedGridSelection) { setCopiedGridSelection(null); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      if (rows.length) setGridSelection({ anchor: { row: rows.length - 1, column: ALL_FIELDS.length - 1 }, focus: { row: 0, column: 0 } })
      return
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
      navigateGrid(row, column, event.key.slice(5).toLowerCase() as NavDirection, event.shiftKey)
      return
    }
    if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      navigateGrid(row, column, event.key === 'Enter' ? 'down' : event.shiftKey ? 'left' : 'right')
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      const rowData = rows[row]
      const field = ALL_FIELDS[column]
      if (rowData && field && !field.computed) {
        setEditSeed(null)
        setEditingCellId(`${rowData.id}:${field.key}`)
      }
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (gridSelection) {
        const bounds = getGridSelectionBounds(gridSelection)
        void applyGridClipboard(getGridSelectionOrigin(gridSelection), Array.from(
          { length: bounds.bottom - bounds.top + 1 },
          () => Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
        ))
      }
      return
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      const rowData = rows[row]
      const field = ALL_FIELDS[column]
      if (rowData && field && !field.computed && field.type !== 'checkbox' && field.type !== 'date') {
        if (field.type === 'number' && !isValidGridDecimalInput(event.key)) {
          event.preventDefault()
          return
        }
        event.preventDefault()
        setEditSeed(event.key)
        setEditingCellId(`${rowData.id}:${field.key}`)
      }
    }
  }

  const handleGridCellMouseDown = (event: React.MouseEvent<HTMLElement>, row: number, column: number) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-grid-ignore-selection]')) return
    const coordinate = { row, column }
    setGridSelection(current => event.shiftKey && current
      ? { ...current, focus: coordinate }
      : { anchor: coordinate, focus: coordinate })
    selectingGridRef.current = true
    if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault()
      event.currentTarget.focus()
    }
  }

  const handleGridCellMouseEnter = (row: number, column: number) => {
    if (!selectingGridRef.current) return
    const coordinate = { row, column }
    setGridSelection(current => current ? { ...current, focus: coordinate } : { anchor: coordinate, focus: coordinate })
  }

  const gridCellClassName = (row: number, column: number, extra = '') =>
    `${extra} ${gridSelection && isInGridSelection(row, column, gridSelection) ? 'bg-[#e2f0d9]' : ''} ${fillDrag ? getGridFillRangeCellClasses(row, column, fillDrag.selection, fillDrag.target) : ''}`

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    try {
      const records = await recordsService.getRecords('PunchList', { filter: { workOrder: recordId } })
      setRows(records)
      clearUndo()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load punch list items')
    } finally {
      setLoading(false)
    }
  }, [recordId, clearUndo])

  useEffect(() => { load() }, [load])

  const handleCellCommit = useCallback(async (rowId: string, key: string, value: unknown) => {
    const previousRow = rows.find(row => row.id === rowId)
    if (previousRow && !Object.is(previousRow.data?.[key], value)) pushUndo(snapshotGridRows(rows))
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
  }, [rows, pushUndo])

  async function undoGridAction() {
    const previousRows = popUndo()
    if (!previousRows) return
    try {
      setRows(await restoreGridRows('PunchList', rows, previousRows))
    } catch (err: unknown) {
      pushUndo(previousRows)
      setError(err instanceof Error ? err.message : 'Failed to undo Punch List change')
    }
  }

  const handleGridUndoKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (event.defaultPrevented || target.matches('input, textarea, select') || target.isContentEditable) return
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      void undoGridAction()
    }
  }

  useEffect(() => {
    if (!fillDrag) return
    const onMouseUp = () => {
      const drag = fillDrag
      setFillDrag(null)
      const patches = new Map<number, Record<string, unknown>>()
      for (const target of getGridFillTargets(drag.selection, drag.target)) {
        const field = ALL_FIELDS[target.column]
        const sourceField = ALL_FIELDS[target.sourceColumn]
        const sourceRow = rows[target.sourceRow]
        const destinationRow = rows[target.row]
        if (!field || field.computed || !sourceField || !sourceRow || !destinationRow) continue
        const patch = patches.get(target.row) ?? {}
        patch[field.key] = sourceRow.data?.[sourceField.key] ?? ''
        patches.set(target.row, patch)
      }
      if (patches.size) pushUndo(snapshotGridRows(rows))
      for (const [rowIndex, patch] of patches) {
        const row = rows[rowIndex]
        if (!row) continue
        if ('estimateOfMen' in patch || 'estimateOfIndividualHours' in patch) {
          patch.totalEstimateOfHours = computeTotalHours({ ...(row.data ?? {}), ...patch })
        }
        void recordsService.updateRecord('PunchList', row.id, { data: patch })
          .then(updated => { if (updated) setRows(current => current.map(item => item.id === row.id ? updated : item)) })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to fill selected cells'))
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [fillDrag, rows, pushUndo])

  const handleFillDragEnter = (rowIndex: number, colIndex: number) => {
    setFillDrag(previous => previous ? { ...previous, target: { row: rowIndex, column: colIndex } } : previous)
  }

  if (object?.apiName && object.apiName !== 'WorkOrder') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The Punch List widget can only be placed on the Work Order object&rsquo;s layout.
      </div>
    )
  }

  const handleCreate = async (values: Record<string, unknown>) => {
    if (!recordId) return
    pushUndo(snapshotGridRows(rows))
    setCreating(true)
    setError(null)
    try {
      const data = {
        ...values,
        serviceDate: serviceDate || undefined,
        totalEstimateOfHours: computeTotalHours(values),
        workOrder: recordId,
      }
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

  const handleAddBlankRow = async () => {
    if (!recordId) return
    pushUndo(snapshotGridRows(rows))
    setCreating(true)
    setError(null)
    try {
      const data = {
        workOrder: recordId,
        serviceDate: serviceDate || undefined,
        totalEstimateOfHours: 0,
      }
      const created = await recordsService.createRecord('PunchList', { data })
      if (created) setRows((prev) => [...prev, created])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add punch list row')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (row: RecordData) => {
    if (!window.confirm('Delete this punch list item? This cannot be undone.')) return
    clearUndo()
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

  const handleToggleWorkOrderFlag = async (key: 'punchListCreated' | 'punchListCompleted', value: boolean) => {
    if (!recordId) return
    const setFlag = key === 'punchListCreated' ? setPunchListCreated : setPunchListCompleted
    setFlag(value)
    setSavingFlagKey(key)
    setError(null)
    try {
      // Must also write the prefixed key for 'punchListCreated' — it's the
      // pre-existing WorkOrder field and flattenRecord always prefers it over
      // the bare mirror, so a bare-only write gets silently shadowed on reload.
      const data = key === 'punchListCreated'
        ? { punchListCreated: value, WorkOrder__punchListCreated: value }
        : { [key]: value }
      await recordsService.updateRecord('WorkOrder', recordId, { data })
      onRecordChange?.(data)
    } catch (err: unknown) {
      setFlag(!value)
      setError(err instanceof Error ? err.message : 'Failed to save change')
    } finally {
      setSavingFlagKey(null)
    }
  }

  const handleServiceDateChange = async (value: string) => {
    const previous = serviceDate
    setServiceDate(value)
    if (!recordId) return
    setSavingFlagKey('serviceDate')
    setError(null)
    try {
      await recordsService.updateRecord('WorkOrder', recordId, { data: { serviceDate: value || null } })
      onRecordChange?.({ serviceDate: value || null })
    } catch (err: unknown) {
      setServiceDate(previous)
      setError(err instanceof Error ? err.message : 'Failed to save change')
    } finally {
      setSavingFlagKey(null)
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
    <div
      ref={gridRootRef}
      className="space-y-3"
      onKeyDown={handleGridUndoKeyDown}
      onMouseUp={() => { selectingGridRef.current = false }}
      onMouseLeave={() => { selectingGridRef.current = false }}
      onCopy={(event) => handleGridCopy(event)}
      onCut={(event) => handleGridCopy(event, true)}
      onPaste={handleGridPaste}
    >
      <GridRangeStyles />
      <div className="hidden items-center justify-between border-b border-gray-200 pb-3 md:flex">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-brand-navy" />
          <div>
            <h3 className="text-sm font-bold text-brand-navy">Punch List</h3>
            <p className="text-xs text-gray-500">{rows.length} item{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={punchListCreated}
              disabled={savingFlagKey === 'punchListCreated'}
              onChange={(e) => void handleToggleWorkOrderFlag('punchListCreated', e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
            />
            Punch List Created?
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={punchListCompleted}
              disabled={savingFlagKey === 'punchListCompleted'}
              onChange={(e) => void handleToggleWorkOrderFlag('punchListCompleted', e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
            />
            Punch List Completed
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            Service Date
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => void handleServiceDateChange(e.target.value)}
              className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy"
              aria-label="Service Date for new punch list items"
            />
          </label>
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
          <button
            type="button"
            onClick={() => void handleAddBlankRow()}
            disabled={creating}
            aria-label="Add blank punch list row"
            title="Add blank punch list row"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-brand-navy text-brand-navy hover:bg-brand-navy/5 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ListChecks className="h-5 w-5 shrink-0 text-brand-navy" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-brand-navy">Punch List</h3>
              <p className="text-xs text-gray-500">{rows.length} item{rows.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded bg-brand-navy px-3 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New Item
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={punchListCreated}
              disabled={savingFlagKey === 'punchListCreated'}
              onChange={(e) => void handleToggleWorkOrderFlag('punchListCreated', e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
            />
            Punch List Created?
          </label>
          <label className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={punchListCompleted}
              disabled={savingFlagKey === 'punchListCompleted'}
              onChange={(e) => void handleToggleWorkOrderFlag('punchListCompleted', e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
            />
            Punch List Completed
          </label>
          <label className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
            Service Date
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => void handleServiceDateChange(e.target.value)}
              className="min-w-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy"
              aria-label="Service Date for new punch list items"
            />
          </label>
          <button
            type="button"
            onClick={() => void handlePreviewPdf()}
            disabled={generatingPdf}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
          >
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Preview PDF
          </button>
          <button
            type="button"
            onClick={() => void handleAddBlankRow()}
            disabled={creating}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-brand-navy px-2 py-2 text-xs font-semibold text-brand-navy disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add blank row
          </button>
          <div className="flex items-center justify-end rounded border border-gray-200 bg-gray-50 px-2 py-2 text-[11px] text-gray-500">
            Tap a value below to edit
          </div>
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
        <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
          <table className="w-full table-fixed text-sm border-collapse">
            <colgroup>
              {ALL_FIELDS.map((f) => (
                <col key={f.key} style={{ width: getColWidthRem(f.key) }} />
              ))}
              <col style={{ width: '2rem' }} />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                {ALL_FIELDS.map((f) => (
                  <th
                    key={f.key}
                    className={`px-1.5 py-1 text-left font-semibold text-gray-600 border-b border-gray-200 ${WRAPPED_HEADER_KEYS.has(f.key) ? 'whitespace-normal break-words' : 'whitespace-nowrap'}`}
                  >
                    {f.label}
                  </th>
                ))}
                <th className="w-8 px-1 py-1 border-b border-gray-200" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {ALL_FIELDS.map((f, colIndex) => {
                    const cellId = `${row.id}:${f.key}`
                    return <td
                      key={f.key}
                      data-grid-row={i}
                      data-grid-column={colIndex}
                      tabIndex={gridSelection?.focus.row === i && gridSelection.focus.column === colIndex ? 0 : -1}
                      aria-selected={gridSelection ? isInGridSelection(i, colIndex, gridSelection) : false}
                      onMouseDown={(event) => handleGridCellMouseDown(event, i, colIndex)}
                      onMouseEnter={() => {
                        handleFillDragEnter(i, colIndex)
                        handleGridCellMouseEnter(i, colIndex)
                      }}
                      onKeyDown={(event) => handleGridKeyDown(event, i, colIndex)}
                      className={gridCellClassName(i, colIndex, 'relative px-1.5 py-1 border-b border-gray-100 align-top whitespace-normal break-words')}
                    >
                      <GridRangeDecoration row={i} column={colIndex} selection={gridSelection} copiedSelection={copiedGridSelection} />
                      <EditableCell
                        cellId={cellId}
                        value={row.data?.[f.key]}
                        type={f.type}
                        saving={savingRowId === row.id || f.computed === true}
                        computed={f.computed === true}
                        isEditing={editingCellId === cellId}
                        editSeed={editingCellId === cellId ? editSeed : null}
                        onStartEdit={() => { setEditSeed(null); setEditingCellId(cellId) }}
                        onStopEdit={() => { setEditSeed(null); setEditingCellId(null) }}
                        onCommit={(value) => handleCellCommit(row.id, f.key, value)}
                      />
                      {gridSelection && !editingCellId && getGridSelectionBounds(gridSelection).bottom === i && getGridSelectionBounds(gridSelection).right === colIndex && (
                        <span
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setFillDrag({ selection: gridSelection, target: { row: i, column: colIndex } })
                          }}
                          aria-hidden="true"
                          className="absolute bottom-0 right-0 h-2 w-2 cursor-crosshair rounded-[1px] bg-green-600"
                        />
                      )}
                    </td>
                  })}
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

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 md:hidden">
              {rows.map((row, index) => (
            <article key={row.id} className={`flex min-w-[72rem] items-center gap-2 border-b border-gray-100 px-2 py-2 last:border-b-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              {ALL_FIELDS.map((field, colIndex) => {
                const cellId = `${row.id}:${field.key}`
                return <div
                  key={field.key}
                  data-grid-row={index}
                  data-grid-column={colIndex}
                  tabIndex={gridSelection?.focus.row === index && gridSelection.focus.column === colIndex ? 0 : -1}
                  aria-selected={gridSelection ? isInGridSelection(index, colIndex, gridSelection) : false}
                  onMouseDown={(event) => handleGridCellMouseDown(event, index, colIndex)}
                  onMouseEnter={() => {
                    handleFillDragEnter(index, colIndex)
                    handleGridCellMouseEnter(index, colIndex)
                  }}
                  onKeyDown={(event) => handleGridKeyDown(event, index, colIndex)}
                  className={gridCellClassName(index, colIndex, `${getMobileRowWidthClass(field)} relative shrink-0`)}
                >
                  <GridRangeDecoration row={index} column={colIndex} selection={gridSelection} copiedSelection={copiedGridSelection} />
                  <p className="truncate text-[9px] font-semibold uppercase text-gray-400">{field.label}</p>
                  <EditableCell
                    cellId={cellId}
                    value={row.data?.[field.key] ?? (field.key === 'itemNumber' ? index + 1 : undefined)}
                    type={field.type}
                    saving={savingRowId === row.id || field.computed === true}
                    computed={field.computed === true}
                    isEditing={editingCellId === cellId}
                    editSeed={editingCellId === cellId ? editSeed : null}
                    onStartEdit={() => { setEditSeed(null); setEditingCellId(cellId) }}
                    onStopEdit={() => { setEditSeed(null); setEditingCellId(null) }}
                    onCommit={(value) => handleCellCommit(row.id, field.key, value)}
                  />
                  {gridSelection && !editingCellId && getGridSelectionBounds(gridSelection).bottom === index && getGridSelectionBounds(gridSelection).right === colIndex && (
                    <span
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setFillDrag({ selection: gridSelection, target: { row: index, column: colIndex } })
                      }}
                      aria-hidden="true"
                      className="absolute bottom-0 right-0 h-2 w-2 cursor-crosshair rounded-[1px] bg-green-600"
                    />
                  )}
                </div>
              })}
              <button
                type="button"
                onClick={() => void handleDelete(row)}
                disabled={deletingRowId === row.id || savingRowId === row.id}
                aria-label="Delete punch list item"
                className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                {deletingRowId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </article>
          ))}
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
      <div className="flex min-h-7 items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
        <span className="font-mono font-medium text-gray-700">
          {gridSelection ? (() => {
            const bounds = getGridSelectionBounds(gridSelection)
            const first = `${spreadsheetColumnLabel(bounds.left)}${bounds.top + 1}`
            const last = `${spreadsheetColumnLabel(bounds.right)}${bounds.bottom + 1}`
            return first === last ? first : `${first}:${last}`
          })() : ' '}
        </span>
        <span>{gridSelection
          ? `${(Math.abs(gridSelection.focus.row - gridSelection.anchor.row) + 1) * (Math.abs(gridSelection.focus.column - gridSelection.anchor.column) + 1)} cells selected`
          : ''}</span>
        <span>{savingRowId ? 'Saving…' : ' '}</span>
      </div>
    </div>
  )
}
