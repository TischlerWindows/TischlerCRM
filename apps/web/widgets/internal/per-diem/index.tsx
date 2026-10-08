'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, FileText, Loader2, Plus, Trash2, WalletCards, X } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'
import { restoreGridRows, snapshotGridRows } from '@/lib/grid-undo-records'
import { useGridUndo } from '@/lib/use-grid-undo'
import { apiClient } from '@/lib/api-client'
import { resolveLookupDisplayName } from '@/lib/utils'
import { MultiLookupUserSearch } from '@/components/form/lookup-search'
import type { NavDirection } from '@/lib/cell-navigation'
import {
  getGridFillTargets,
  getGridFillRangeCellClasses,
  isCaretAtHorizontalEdge,
  isValidGridDecimalInput,
  getGridSelectionBounds,
  getGridSelectionOrigin,
  isInGridSelection,
  parseGridClipboard,
  serializeGridClipboard,
  spreadsheetColumnLabel,
  tileGridClipboardToSelection,
  type GridCoordinate,
  type GridSelection,
} from '@/lib/cad-index-grid'
import { GridRangeDecoration, GridRangeStyles } from '../shared/grid-range-decoration'
import { generatePerDiemPdf } from './pdf'

type PerDiemGridSelection = GridSelection & { view: 'desktop' | 'mobile' }

type FieldType = 'text' | 'textarea' | 'currency' | 'date' | 'user'

interface FieldDef {
  key: string
  label: string
  type: FieldType
}

interface FillDrag {
  selection: PerDiemGridSelection
  target: GridCoordinate
}

const FIELDS: FieldDef[] = [
  { key: 'serviceTechPerDiem', label: 'Service Tech Per Diem', type: 'user' },
  { key: 'perDiemAmount', label: 'Per Diem Amount', type: 'currency' },
  { key: 'perDiemNotes', label: 'Per Diem Notes', type: 'textarea' },
  { key: 'perDiemStartDate', label: 'Per Diem Start Date', type: 'date' },
  { key: 'perDiemEndDate', label: 'Per Diem End Date', type: 'date' },
]

const MOBILE_FIELDS: Array<FieldDef & { width: string }> = [
  { key: 'serviceTechPerDiem', label: 'Tech', type: 'text', width: 'w-28' },
  { key: 'perDiemStartDate', label: 'Start Date', type: 'date', width: 'w-28' },
  { key: 'perDiemEndDate', label: 'End Date', type: 'date', width: 'w-28' },
  { key: 'perDiemAmount', label: 'Amount', type: 'currency', width: 'w-24' },
  { key: 'perDiemNotes', label: 'Notes', type: 'textarea', width: 'min-w-[14rem] flex-1' },
]

const gridFieldsForView = (view: 'desktop' | 'mobile'): FieldDef[] =>
  view === 'desktop' ? FIELDS : MOBILE_FIELDS

function dateValue(value: unknown): string {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? ''
}

function dateDisplay(value: unknown): string {
  const iso = dateValue(value)
  if (!iso) return '-'
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year}`
}

function displayValue(value: unknown, type: FieldType): string {
  if (value === undefined || value === null || value === '') return '-'
  if (type === 'date') return dateDisplay(value)
  if (type === 'currency') return `$${Number(value).toFixed(2)}`
  if (type === 'user') {
    const ids = String(value).split(';').map((id) => id.trim()).filter(Boolean)
    return ids.length > 0 ? ids.map((id) => resolveLookupDisplayName(id, 'User')).join(', ') : '-'
  }
  return String(value)
}

interface UserRecord {
  id: string
  name?: string
  email?: string
  title?: string
  isActive: boolean
}

/** Fixed column widths for the desktop table (via <colgroup>) — with
 * `table-layout: fixed`, columns never resize when a cell's content swaps
 * between its display value and an inline-edit input/textarea. */
function getColWidthRem(type: FieldType): string {
  if (type === 'user') return '12rem'
  if (type === 'currency') return '8rem'
  if (type === 'date') return '9rem'
  return '20rem'
}

function UserLookupField({
  value,
  onChange,
  onClose,
  initialQuery = '',
}: {
  value: unknown
  onChange: (value: unknown) => void
  onClose?: () => void
  initialQuery?: string
}) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [query, setQuery] = useState(initialQuery)
  const [active, setActive] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiClient.get<UserRecord[]>('/admin/users').then((result) => {
      if (!cancelled) setUsers(Array.isArray(result) ? result : [])
    }).catch(() => {
      if (!cancelled) setUsers([])
    })
    return () => { cancelled = true }
  }, [])

  return (
    <MultiLookupUserSearch
      fieldDef={{ id: 'serviceTechPerDiem', apiName: 'serviceTechPerDiem', label: 'Service Tech Per Diem', type: 'MultiLookupUser' }}
      value={value}
      onChange={onChange}
      userRecords={users.filter((user) => user.isActive)}
      selectedUserRecords={users}
      lookupQuery={query}
      isActive={active}
      onQueryChange={setQuery}
      onFocus={() => setActive(true)}
      onBlur={() => {
        setTimeout(() => setActive(false), 150)
        onClose?.()
      }}
      portalDropdown
    />
  )
}

function EditableCell({
  cellId,
  value,
  type,
  saving,
  isEditing,
  onStartEdit,
  onStopEdit,
  onCommit,
  editSeed,
}: {
  cellId?: string
  value: unknown
  type: FieldType
  saving: boolean
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
  onCommit: (value: unknown) => void
  editSeed?: string | null
}) {
  const [draft, setDraft] = useState<unknown>(value)

  useEffect(() => {
    if (isEditing) setDraft(editSeed ?? value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const userCellRef = useRef<HTMLDivElement>(null)
  const editorInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!isEditing) return
    const focusFrame = requestAnimationFrame(() => {
      const editor = type === 'user'
        ? userCellRef.current?.querySelector<HTMLInputElement>('input')
        : type === 'textarea' ? textareaRef.current : editorInputRef.current
      const rect = editor?.getBoundingClientRect()
      if (!editor || !rect || (rect.width === 0 && rect.height === 0)) return
      editor.focus()
      if (editSeed !== null && !(editor instanceof HTMLInputElement && editor.type === 'date')) {
        editor.setSelectionRange(editor.value.length, editor.value.length)
      }
    })
    return () => cancelAnimationFrame(focusFrame)
  }, [isEditing, type, editSeed])

  // Grows the textarea to match its wrapped-text content height (same as
  // the display button's height) so the row doesn't shrink to a fixed
  // 2-row textarea and then jump back when editing ends.
  useEffect(() => {
    if (isEditing && type === 'textarea' && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [isEditing, draft, type])

  const startEditing = () => {
    if (saving) return
    onStartEdit?.()
  }

  const commit = () => {
    onStopEdit?.()
    if (draft !== value) onCommit(draft)
  }

  const dataCellId = cellId

  if (isEditing) {
    if (type === 'user') {
      // Keep Escape available without interfering with the lookup's own arrows.
      return (
        <div
          ref={userCellRef}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onStopEdit?.()
          }}
        >
          <UserLookupField
            value={draft}
            initialQuery={editSeed ?? ''}
            onClose={() => onStopEdit?.()}
            onChange={(nextValue) => {
              setDraft(nextValue)
              if (nextValue !== value) onCommit(nextValue)
            }}
          />
        </div>
      )
    }
    if (type === 'textarea') {
      return (
        <textarea
          ref={textareaRef}
          data-cell-id={dataCellId}
          value={typeof draft === 'string' ? draft : ''}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { onStopEdit?.(); return }
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commit(); }
          }}
          rows={1}
          className="w-full resize-none overflow-hidden rounded border border-brand-navy/40 px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    const isNumber = type === 'currency'
    return (
      <input
        ref={editorInputRef}
        data-cell-id={dataCellId}
        type={type === 'date' ? 'date' : 'text'}
        inputMode={isNumber ? 'decimal' : undefined}
        value={type === 'date' ? dateValue(draft) : typeof draft === 'string' || typeof draft === 'number' ? String(draft) : ''}
        onChange={(event) => {
          if (isNumber && !isValidGridDecimalInput(event.target.value)) return
          setDraft(event.target.value)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commit(); return }
          if (event.key === 'Escape') { onStopEdit?.(); return }
        }}
        className="w-full rounded border border-brand-navy/40 px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  return (
    <button
      type="button"
      data-cell-id={dataCellId}
      onDoubleClick={startEditing}
      disabled={saving}
      className="w-full rounded px-1 py-0.5 text-left hover:bg-brand-navy/5 disabled:opacity-50"
      title={type === 'textarea' ? displayValue(value, type) : undefined}
    >
      {displayValue(value, type)}
    </button>
  )
}

function NewPerDiemModal({
  saving,
  onCancel,
  onSubmit,
}: {
  saving: boolean
  onCancel: () => void
  onSubmit: (values: Record<string, unknown>) => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const setField = (key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value }))

  const renderField = (field: FieldDef) => {
    if (field.type === 'user') {
      return <UserLookupField value={values[field.key]} onChange={(value) => setField(field.key, value)} />
    }
    if (field.type === 'textarea') {
      return <textarea rows={3} value={String(values[field.key] ?? '')} onChange={(event) => setField(field.key, event.target.value)} className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy" />
    }
    return (
      <input
        type={field.type === 'date' ? 'date' : field.type === 'currency' ? 'number' : 'text'}
        step={field.type === 'currency' ? '0.01' : undefined}
        value={field.type === 'date' ? dateValue(values[field.key]) : String(values[field.key] ?? '')}
        onChange={(event) => setField(field.key, event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-per-diem-title">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="new-per-diem-title" className="text-lg font-bold text-brand-navy">New Per Diem</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{field.label}</span>
              {renderField(field)}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={() => onSubmit(values)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PerDiemWidget({ record, object }: WidgetProps) {
  const recordId = record?.id ? String(record.id) : undefined
  const [rows, setRows] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const workOrderName = String(record?.name ?? record?.title ?? record?.workOrderNumber ?? '')
  const [editingCellId, setEditingCellId] = useState<string | null>(null)
  const [editSeed, setEditSeed] = useState<string | null>(null)
  const [fillDrag, setFillDrag] = useState<FillDrag | null>(null)
  const [gridSelection, setGridSelection] = useState<PerDiemGridSelection | null>(null)
  const [copiedGridSelection, setCopiedGridSelection] = useState<PerDiemGridSelection | null>(null)
  const { pushUndo, popUndo, clearUndo } = useGridUndo<RecordData[]>()
  const gridRootRef = useRef<HTMLDivElement>(null)
  const selectingGridRef = useRef(false)

  const focusGridCell = (coordinate: GridCoordinate, view: 'desktop' | 'mobile') => {
    requestAnimationFrame(() => {
      const cells = gridRootRef.current?.querySelectorAll<HTMLElement>(`[data-grid-view="${view}"][data-grid-row="${coordinate.row}"][data-grid-column="${coordinate.column}"]`)
      Array.from(cells ?? []).find(cell => cell.getClientRects().length > 0)?.focus()
    })
  }

  const navigateGrid = (row: number, column: number, direction: NavDirection, view: 'desktop' | 'mobile', extend = false) => {
    const fields = gridFieldsForView(view)
    let nextRow = row + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0)
    let nextColumn = column + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0)
    if (nextColumn < 0) { nextColumn = fields.length - 1; nextRow -= 1 }
    if (nextColumn >= fields.length) { nextColumn = 0; nextRow += 1 }
    nextRow = Math.max(0, Math.min(nextRow, rows.length - 1))
    nextColumn = Math.max(0, Math.min(nextColumn, fields.length - 1))
    const focus = { row: nextRow, column: nextColumn }
    setGridSelection(current => extend && current?.view === view
      ? { ...current, focus }
      : { view, anchor: focus, focus })
    setEditingCellId(null)
    setEditSeed(null)
    focusGridCell(focus, view)
  }

  const applyGridClipboard = async (start: GridCoordinate, view: 'desktop' | 'mobile', matrix: string[][]) => {
    if (!recordId || !matrix.length) return
    pushUndo(snapshotGridRows(rows))
    setError(null)
    setSaving(true)
    const targetRows = [...rows]
    try {
      while (targetRows.length < start.row + matrix.length) {
        const created = await recordsService.createRecord('PerDiem', { data: { workOrder: recordId } })
        if (!created) throw new Error('Failed to add a row for pasted cells')
        targetRows.push(created)
        setRows(current => [...current, created])
      }
      let invalidCount = 0
      const fields = gridFieldsForView(view)
      for (let rowOffset = 0; rowOffset < matrix.length; rowOffset++) {
        const row = targetRows[start.row + rowOffset]
        if (!row) continue
        const patch: Record<string, unknown> = {}
        matrix[rowOffset]?.forEach((rawValue, columnOffset) => {
          const field = fields[start.column + columnOffset]
          if (!field) { invalidCount += 1; return }
          if (field.key === 'serviceTechPerDiem' || field.type === 'date' || field.type === 'textarea' || field.type === 'text') {
            patch[field.key] = rawValue
            return
          }
          const parsed = parseGridCellValue(rawValue.replace(/[$,]/g, ''), 'number')
          if (!parsed.valid) { invalidCount += 1; return }
          patch[field.key] = parsed.value === '' ? '' : String(parsed.value)
        })
        if (!Object.keys(patch).length) continue
        setSavingRowId(row.id)
        const updated = await recordsService.updateRecord('PerDiem', row.id, { data: patch })
        if (updated) {
          targetRows[start.row + rowOffset] = updated
          setRows(current => current.map(item => item.id === row.id ? updated : item))
        }
      }
      const lastRow = Math.min(targetRows.length - 1, start.row + matrix.length - 1)
      const lastColumn = Math.min(fields.length - 1, start.column + Math.max(...matrix.map(row => row.length)) - 1)
      setGridSelection({ view, anchor: { row: lastRow, column: lastColumn }, focus: start })
      focusGridCell(start, view)
      if (invalidCount) setError(`${invalidCount} pasted cell${invalidCount === 1 ? '' : 's'} skipped because the value was invalid or outside the grid`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to paste Per Diem cells')
    } finally {
      setSavingRowId(null)
      setSaving(false)
    }
  }

  const gridClipboardMatrix = (selection: PerDiemGridSelection): unknown[][] => {
    const bounds = getGridSelectionBounds(selection)
    const fields = gridFieldsForView(selection.view)
    return rows.slice(bounds.top, bounds.bottom + 1).map(row =>
      fields.slice(bounds.left, bounds.right + 1).map(field => row.data?.[field.key]),
    )
  }

  const handleGridCopy = (event: React.ClipboardEvent<HTMLDivElement>, cut = false) => {
    if (!gridSelection || editingCellId) return
    event.clipboardData.setData('text/plain', serializeGridClipboard(gridClipboardMatrix(gridSelection)))
    event.preventDefault()
    setCopiedGridSelection(gridSelection)
    if (cut) {
      const bounds = getGridSelectionBounds(gridSelection)
      void applyGridClipboard(getGridSelectionOrigin(gridSelection), gridSelection.view, Array.from(
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
    void applyGridClipboard(getGridSelectionOrigin(gridSelection), gridSelection.view, matrix)
  }

  const handleGridCellMouseDown = (event: React.MouseEvent<HTMLElement>, row: number, column: number, view: 'desktop' | 'mobile') => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-grid-ignore-selection]')) return
    const coordinate = { row, column }
    setGridSelection(current => event.shiftKey && current?.view === view
      ? { ...current, focus: coordinate }
      : { view, anchor: coordinate, focus: coordinate })
    selectingGridRef.current = true
    if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault()
      event.currentTarget.focus()
    }
  }

  const handleGridCellMouseEnter = (row: number, column: number, view: 'desktop' | 'mobile') => {
    if (!selectingGridRef.current) return
    const coordinate = { row, column }
    setGridSelection(current => current?.view === view
      ? { ...current, focus: coordinate }
      : { view, anchor: coordinate, focus: coordinate })
  }

  const gridCellClassName = (row: number, column: number, view: 'desktop' | 'mobile', extra = '') =>
    `${extra} ${gridSelection?.view === view && isInGridSelection(row, column, gridSelection) ? 'bg-[#e2f0d9]' : ''} ${fillDrag?.selection.view === view ? getGridFillRangeCellClasses(row, column, fillDrag.selection, fillDrag.target) : ''}`

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLElement>, row: number, column: number, view: 'desktop' | 'mobile') => {
    if (event.defaultPrevented) return
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
      const target = event.target
      const direction = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null
      const atEdge = direction && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
        && isCaretAtHorizontalEdge(target.value, target.selectionStart, target.selectionEnd, direction)
      if (direction && atEdge) {
        event.preventDefault()
        navigateGrid(row, column, direction, view)
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
      if (rows.length) setGridSelection({ view, anchor: { row: rows.length - 1, column: gridFieldsForView(view).length - 1 }, focus: { row: 0, column: 0 } })
      return
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
      navigateGrid(row, column, event.key.slice(5).toLowerCase() as NavDirection, view, event.shiftKey)
      return
    }
    if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      navigateGrid(row, column, event.key === 'Enter' ? 'down' : event.shiftKey ? 'left' : 'right', view)
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      const rowData = rows[row]
      const field = gridFieldsForView(view)[column]
      if (rowData && field) {
        setEditSeed(null)
        setEditingCellId(`${rowData.id}:${field.key}`)
      }
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (gridSelection?.view === view) {
        const bounds = getGridSelectionBounds(gridSelection)
        void applyGridClipboard(getGridSelectionOrigin(gridSelection), view, Array.from(
          { length: bounds.bottom - bounds.top + 1 },
          () => Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
        ))
      }
      return
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      const rowData = rows[row]
      const field = gridFieldsForView(view)[column]
      if (rowData && field && field.type !== 'date') {
        event.preventDefault()
        setEditSeed(event.key)
        setEditingCellId(`${rowData.id}:${field.key}`)
      }
    }
  }

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await recordsService.getRecords('PerDiem', { filter: { workOrder: recordId } }))
      clearUndo()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load per diem records')
    } finally {
      setLoading(false)
    }
  }, [recordId, clearUndo])

  useEffect(() => { void load() }, [load])

  const handleCommit = useCallback(async (rowId: string, key: string, value: unknown) => {
    const previousRow = rows.find(row => row.id === rowId)
    if (previousRow && !Object.is(previousRow.data?.[key], value)) pushUndo(snapshotGridRows(rows))
    setSavingRowId(rowId)
    setError(null)
    try {
      const updated = await recordsService.updateRecord('PerDiem', rowId, { data: { [key]: value } })
      if (updated) setRows((current) => current.map((row) => row.id === rowId ? updated : row))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save per diem change')
    } finally {
      setSavingRowId(null)
    }
  }, [rows, pushUndo])

  async function undoGridAction() {
    const previousRows = popUndo()
    if (!previousRows) return
    try {
      setRows(await restoreGridRows('PerDiem', rows, previousRows))
    } catch (err: unknown) {
      pushUndo(previousRows)
      setError(err instanceof Error ? err.message : 'Failed to undo Per Diem change')
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
    const onMouseUp = async () => {
      const drag = fillDrag
      setFillDrag(null)
      const fields = gridFieldsForView(drag.selection.view)
      const patches = new Map<number, Record<string, unknown>>()
      for (const target of getGridFillTargets(drag.selection, drag.target)) {
        const sourceField = fields[target.sourceColumn]
        const sourceRow = rows[target.sourceRow]
        const field = fields[target.column]
        if (!field || !sourceField || !sourceRow) continue
        const patch = patches.get(target.row) ?? {}
        patch[field.key] = sourceRow.data?.[sourceField.key] ?? ''
        patches.set(target.row, patch)
      }
      if (patches.size) pushUndo(snapshotGridRows(rows))
      for (const [rowIndex, patch] of patches) {
        const row = rows[rowIndex]
        if (!row) continue
        setSavingRowId(row.id)
        setError(null)
        try {
          const updated = await recordsService.updateRecord('PerDiem', row.id, { data: patch })
          if (updated) setRows(current => current.map(item => item.id === row.id ? updated : item))
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to fill selected cells')
        } finally {
          setSavingRowId(null)
        }
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [fillDrag, rows, pushUndo])

  const handleFillDragEnter = (rowIndex: number, colIndex: number, view: 'desktop' | 'mobile') => {
    setFillDrag((previous) => previous?.selection.view === view
      ? { ...previous, target: { row: rowIndex, column: colIndex } }
      : previous)
  }

  if (object?.apiName && object.apiName !== 'WorkOrder') {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">The Per Diem widget can only be placed on the Work Order object&rsquo;s layout.</div>
  }

  const handleCreate = async (values: Record<string, unknown>) => {
    if (!recordId) return
    pushUndo(snapshotGridRows(rows))
    setSaving(true)
    setError(null)
    try {
      const created = await recordsService.createRecord('PerDiem', { data: { ...values, workOrder: recordId } })
      if (created) {
        setRows((current) => [...current, created])
        setShowNewModal(false)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create per diem')
    } finally {
      setSaving(false)
    }
  }

  const handleAddBlankRow = async () => {
    if (!recordId) return
    pushUndo(snapshotGridRows(rows))
    setSaving(true)
    setError(null)
    try {
      const created = await recordsService.createRecord('PerDiem', { data: { workOrder: recordId } })
      if (created) setRows((current) => [...current, created])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add per diem row')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: RecordData) => {
    if (!window.confirm('Delete this per diem record? This cannot be undone.')) return
    clearUndo()
    setDeletingRowId(row.id)
    setError(null)
    try {
      await recordsService.deleteRecord('PerDiem', row.id)
      setRows((current) => current.filter((item) => item.id !== row.id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete per diem')
    } finally {
      setDeletingRowId(null)
    }
  }

  const handlePreviewPdf = async () => {
    const previewWindow = window.open('', '_blank')
    setGeneratingPdf(true)
    setError(null)
    try {
      await generatePerDiemPdf({
        rows,
        workOrderName,
        workOrderNumber: String(record?.workOrderNumber ?? ''),
        previewWindow,
      })
    } catch (err: unknown) {
      previewWindow?.close()
      setError(err instanceof Error ? err.message : 'Failed to generate Per Diem PDF')
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
          <WalletCards className="h-5 w-5 text-brand-navy" />
          <div>
            <h3 className="text-sm font-bold text-brand-navy">Per Diem</h3>
            <p className="text-xs text-gray-500">{rows.length} record{rows.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void handlePreviewPdf()} disabled={generatingPdf} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Preview PDF
          </button>
          <button type="button" onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy/90">
            <Plus className="h-3.5 w-3.5" />
            New Per Diem
          </button>
          <button type="button" onClick={() => void handleAddBlankRow()} disabled={saving} aria-label="Add blank Per Diem row" title="Add blank Per Diem row" className="inline-flex h-8 w-8 items-center justify-center rounded border border-brand-navy text-brand-navy hover:bg-brand-navy/5 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <WalletCards className="h-5 w-5 shrink-0 text-brand-navy" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-brand-navy">Per Diem</h3>
            <p className="text-xs text-gray-500">{rows.length} record{rows.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => void handlePreviewPdf()} disabled={generatingPdf} aria-label="Preview Per Diem PDF" title="Preview Per Diem PDF" className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-700 disabled:opacity-50">
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-2 text-xs font-semibold text-white">
            <Plus className="h-3.5 w-3.5" />
            New Per Diem
          </button>
          <button type="button" onClick={() => void handleAddBlankRow()} disabled={saving} aria-label="Add blank Per Diem row" title="Add blank Per Diem row" className="inline-flex h-8 w-8 items-center justify-center rounded border border-brand-navy text-brand-navy disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="h-4 w-4 shrink-0 text-red-500" />{error}</div>}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand-navy" /></div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400"><CalendarDays className="mx-auto mb-2 h-8 w-8 text-gray-300" />No per diem records yet.</div>
      ) : (
        <div className="hidden overflow-visible rounded-lg border border-gray-200 md:block">
          <table data-per-diem-grid="desktop" className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              {FIELDS.map((field) => (
                <col key={field.key} style={{ width: getColWidthRem(field.type) }} />
              ))}
              <col style={{ width: '2rem' }} />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                {FIELDS.map((field) => <th key={field.key} className="border-b border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">{field.label}</th>)}
                <th className="w-8 border-b border-gray-200 px-1 py-1.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {FIELDS.map((field, colIndex) => {
                    const cellId = `${row.id}:${field.key}`
                    return <td
                      key={field.key}
                      data-grid-view="desktop"
                      data-grid-row={index}
                      data-grid-column={colIndex}
                      tabIndex={gridSelection?.view === 'desktop' && gridSelection.focus.row === index && gridSelection.focus.column === colIndex ? 0 : -1}
                      aria-selected={gridSelection?.view === 'desktop' ? isInGridSelection(index, colIndex, gridSelection) : false}
                      onMouseDown={(event) => handleGridCellMouseDown(event, index, colIndex, 'desktop')}
                      onMouseEnter={() => { handleFillDragEnter(index, colIndex, 'desktop'); handleGridCellMouseEnter(index, colIndex, 'desktop') }}
                      onKeyDown={(event) => handleGridKeyDown(event, index, colIndex, 'desktop')}
                      className={gridCellClassName(index, colIndex, 'desktop', 'relative border-b border-gray-100 px-2 py-1.5 align-top whitespace-normal break-words')}
                    >
                      <GridRangeDecoration row={index} column={colIndex} selection={gridSelection?.view === 'desktop' ? gridSelection : null} copiedSelection={copiedGridSelection?.view === 'desktop' ? copiedGridSelection : null} />
                      <EditableCell cellId={cellId} value={row.data?.[field.key]} type={field.type} saving={savingRowId === row.id} isEditing={editingCellId === cellId} editSeed={editingCellId === cellId ? editSeed : null} onStartEdit={() => { setEditSeed(null); setEditingCellId(cellId) }} onStopEdit={() => { setEditSeed(null); setEditingCellId(null) }} onCommit={(value) => void handleCommit(row.id, field.key, value)} />
                      {gridSelection?.view === 'desktop' && !editingCellId && getGridSelectionBounds(gridSelection).bottom === index && getGridSelectionBounds(gridSelection).right === colIndex && (
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
                    </td>
                  })}
                  <td data-grid-ignore-selection="true" className="w-8 border-b border-gray-100 px-1 py-1.5 align-top"><button type="button" onClick={() => void handleDelete(row)} disabled={deletingRowId === row.id || savingRowId === row.id} aria-label="Delete per diem record" title="Delete per diem record" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">{deletingRowId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div data-per-diem-grid="mobile" className="overflow-x-auto rounded-lg border border-gray-200 md:hidden">
          {rows.map((row, rowIndex) => (
            <article key={row.id} className="flex min-w-[36rem] items-center gap-3 border-b border-gray-100 bg-white px-2 py-2 last:border-b-0">
              {MOBILE_FIELDS.map((field, colIndex) => {
                const cellId = `${row.id}:${field.key}`
                return <div
                  key={field.key}
                  data-grid-view="mobile"
                  data-grid-row={rowIndex}
                  data-grid-column={colIndex}
                  tabIndex={gridSelection?.view === 'mobile' && gridSelection.focus.row === rowIndex && gridSelection.focus.column === colIndex ? 0 : -1}
                  aria-selected={gridSelection?.view === 'mobile' ? isInGridSelection(rowIndex, colIndex, gridSelection) : false}
                  onMouseDown={(event) => handleGridCellMouseDown(event, rowIndex, colIndex, 'mobile')}
                  onMouseEnter={() => { handleFillDragEnter(rowIndex, colIndex, 'mobile'); handleGridCellMouseEnter(rowIndex, colIndex, 'mobile') }}
                  onKeyDown={(event) => handleGridKeyDown(event, rowIndex, colIndex, 'mobile')}
                  className={gridCellClassName(rowIndex, colIndex, 'mobile', `relative shrink-0 ${field.width}`)}
                >
                  <GridRangeDecoration row={rowIndex} column={colIndex} selection={gridSelection?.view === 'mobile' ? gridSelection : null} copiedSelection={copiedGridSelection?.view === 'mobile' ? copiedGridSelection : null} />
                  <p className="text-[9px] font-semibold uppercase text-gray-400">{field.label}</p>
                  <EditableCell cellId={cellId} value={row.data?.[field.key]} type={field.type} saving={savingRowId === row.id} isEditing={editingCellId === cellId} editSeed={editingCellId === cellId ? editSeed : null} onStartEdit={() => { setEditSeed(null); setEditingCellId(cellId) }} onStopEdit={() => { setEditSeed(null); setEditingCellId(null) }} onCommit={(value) => void handleCommit(row.id, field.key, value)} />
                  {gridSelection?.view === 'mobile' && !editingCellId && getGridSelectionBounds(gridSelection).bottom === rowIndex && getGridSelectionBounds(gridSelection).right === colIndex && (
                    <span
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setFillDrag({ selection: gridSelection, target: { row: rowIndex, column: colIndex } })
                      }}
                      aria-hidden="true"
                      className="absolute bottom-0 right-0 h-2 w-2 cursor-crosshair rounded-[1px] bg-green-600"
                    />
                  )}
                </div>
              })}
              <button type="button" onClick={() => void handleDelete(row)} disabled={deletingRowId === row.id || savingRowId === row.id} aria-label="Delete per diem record" className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                {deletingRowId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </article>
          ))}
        </div>
      )}

      {showNewModal && <NewPerDiemModal saving={saving} onCancel={() => setShowNewModal(false)} onSubmit={(values) => void handleCreate(values)} />}
      <div className="flex min-h-7 items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
        <span className="font-mono font-medium text-gray-700">{gridSelection ? `${spreadsheetColumnLabel(gridSelection.focus.column)}${gridSelection.focus.row + 1}` : ' '}</span>
        <span>{gridSelection ? `${(Math.abs(gridSelection.focus.row - gridSelection.anchor.row) + 1) * (Math.abs(gridSelection.focus.column - gridSelection.anchor.column) + 1)} cells selected` : ''}</span>
        <span>{savingRowId ? 'Saving…' : ' '}</span>
      </div>
    </div>
  )
}