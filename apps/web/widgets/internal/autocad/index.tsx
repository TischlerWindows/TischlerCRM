'use client'

/**
 * AutoCad widget — a screw/fastener schedule grid for Projects. Fastener is
 * a single searchable picklist (replaces the old independent Width/Name/
 * Length dropdowns).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, FileText, Loader2, Plus, Trash2, Wrench } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'
import { restoreGridRows, snapshotGridRows } from '@/lib/grid-undo-records'
import { useGridUndo } from '@/lib/use-grid-undo'
import { apiClient } from '@/lib/api-client'
import type { NavDirection } from '@/lib/cell-navigation'
import { readProjectField } from '@/lib/factory-order-spec'
import { userLookupIds, type LookupUserIdentity } from '@/lib/user-lookup'
import {
  getGridFillTargets,
  getGridFillRangeCellClasses,
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
import { getRecordName } from '../shared/recordName'

type FieldType = 'combobox' | 'number'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** Searchable dropdown options — only used when type is 'combobox'. */
  options?: string[]
}

function isLikelyUserId(value: string): boolean {
  return /^\d+$/.test(value)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    || /^[0-9a-zA-Z]{20,}$/.test(value)
}

interface FillDrag {
  selection: GridSelection
  target: GridCoordinate
}

/** Full fastener catalog — a single searchable dropdown (replaces the old
 * independent width/name/length columns). */
const FASTENER_OPTIONS = [
  '1/4" Pan Head Self-drilling Screws x 3/4"',
  '1/4" Pan Head Self-drilling Screws x 1"',
  '1/4" Pan Head Self-drilling Screws x 1-1/4"',
  '1/4" Pan Head Self-drilling Screws x 1-1/2"',
  '1/4" Pan Head Self-drilling Screws x 2"',
  '1/4" Pan Head Self-drilling Screws x 2-1/2"',
  '1/4" Pan Head Self-drilling Screws x 3"',
  '1/4" Pan Head Self-drilling Screws x 4"',
  '1/4" FH Tapcon Screws x 1-3/4"',
  '1/4" FH Tapcon Screws x 2-1/4"',
  '1/4" FH Tapcon Screws x 2-3/4"',
  '1/4" FH Tapcon Screws x 3-1/4"',
  '1/4" FH Tapcon Screws x 3-3/4"',
  '1/4" FH Tapcon Screws x 4"',
  '1/4" FH Tapcon Screws x 5"',
  '1/4" FH Tapcon Screws x 6"',
  '1/4" Hex Head Tapcon Screws x 1-3/4"',
  '1/4" Hex Head Tapcon Screws x 2-3/4"',
  '1/4" Hex Head Tapcon Screws x 3-1/4"',
  '1/4" Hex Head Tapcon Screws x 3-3/4"',
  '1/4" Hex Head Tapcon Screws x 4"',
  '6/10 x 80mm Toptec',
  '6/10 x 100mm Toptec',
  '6/10 x 120mm Toptec',
  '6/10 x 135mm Toptec',
  '6/10 x 150mm Toptec',
  '6/10 x 200mm Toptec',
  '3 x 20mm FH Phil Wood Screws',
  '3 x 25mm FH Phil Wood Screws',
  '3 x 15mm FH Phil Wood Screws',
  '4 x 35mm FH Phil Wood Screws',
  '4 x 40mm FH Phil Wood Screws',
  '6 x 40mm FH Phil Wood Screws',
  '6 x 50mm FH Phil Wood Screws',
  '6 x 70mm FH Phil Wood Screws',
  'Aluminum Angle pieces',
  'Installation Clips',
  'BTI Brackets',
]

const ALL_FIELDS: FieldDef[] = [
  { key: 'fastener', label: 'Fastener', type: 'combobox', options: FASTENER_OPTIONS },
  { key: 'totalQty', label: 'Total QTY', type: 'number' },
]

/** Fixed column widths for the desktop table (via <colgroup>) — with
 * `table-layout: fixed`, columns never resize when a cell's content swaps
 * between its display value and an inline-edit input/select. */
function getColWidthRem(key: string): string {
  if (key === 'fastener') return '22rem'
  if (key === 'totalQty') return '6rem'
  return '8rem'
}

function getMobileRowWidthClass(field: FieldDef): string {
  if (field.key === 'fastener') return 'w-64'
  if (field.key === 'totalQty') return 'w-20'
  return 'w-32'
}

/** Searchable dropdown for the Fastener column — a portal-rendered list
 * (like MultiLookupUserSearch's `portalDropdown`) so it isn't clipped by
 * the table's horizontally-scrolling wrapper. */
function FastenerComboBox({
  value,
  options,
  onSelect,
  onCancel,
}: {
  value: unknown
  options: string[]
  onSelect: (value: string) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState(typeof value === 'string' ? value : '')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    // The desktop table and mobile card list both render an EditableCell for
    // every cell id, with only one hidden via CSS (`hidden`/`md:hidden`) at
    // any given viewport width. Only focus the visible editor or the hidden
    // copy can steal focus from the dropdown the user opened.
    const focusFrame = requestAnimationFrame(() => {
      const input = inputRef.current
      const rect = input?.getBoundingClientRect()
      if (!input || !rect || (rect.width === 0 && rect.height === 0)) return
      input.focus()
      input.select()
      setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) })
    })
    return () => cancelAnimationFrame(focusFrame)
  }, [])

  const filtered = options.filter((opt) => opt.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Search fasteners…"
        onChange={(e) => { setQuery(e.target.value); setHighlighted(0) }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); return }
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); return }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); return }
          if (e.key === 'Enter') {
            e.preventDefault()
            const picked = filtered[highlighted]
            if (picked) onSelect(picked)
            else onCancel()
            return
          }
          if (e.key === 'Tab') {
            const picked = filtered[highlighted]
            if (picked) { e.preventDefault(); onSelect(picked) }
          }
        }}
        onBlur={() => setTimeout(onCancel, 150)}
        className="w-full border border-brand-navy/40 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
      {dropdownPosition && typeof document !== 'undefined' && createPortal(
        <ul
          className="fixed z-[100] max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white text-sm shadow-lg"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
        >
          {filtered.length > 0 ? filtered.map((opt, i) => (
            <li
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); onSelect(opt) }}
              className={`cursor-pointer px-2 py-1.5 ${i === highlighted ? 'bg-brand-navy/10' : 'hover:bg-gray-50'}`}
            >
              {opt}
            </li>
          )) : (
            <li className="px-2 py-1.5 text-xs text-gray-400">No matches.</li>
          )}
        </ul>,
        document.body,
      )}
    </div>
  )
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

/**
 * Double-click or type-to-edit cell. Grid navigation is handled by the
 * spreadsheet selection surface, not by the cell editor.
 */
function EditableCell({
  cellId,
  value,
  type,
  saving,
  options,
  isEditing,
  onStartEdit,
  onStopEdit,
  onCommit,
}: {
  cellId?: string
  value: unknown
  type: FieldType
  saving: boolean
  /** Dropdown options — only used when type is 'select'. */
  options?: string[]
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
  onCommit: (newValue: unknown) => void
}) {
  const [draft, setDraft] = useState<unknown>(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const isNumber = type === 'number'

  useEffect(() => {
    if (isEditing) setDraft(value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  useEffect(() => {
    if (!isEditing || type === 'combobox') return
    const focusFrame = requestAnimationFrame(() => {
      const input = inputRef.current
      const rect = input?.getBoundingClientRect()
      if (!input || !rect || (rect.width === 0 && rect.height === 0)) return
      input.focus()
      if (!isNumber) input.select()
    })
    return () => cancelAnimationFrame(focusFrame)
  }, [isEditing, isNumber, type])

  const startEdit = () => {
    if (saving) return
    onStartEdit?.()
  }

  const commit = (newValue: unknown) => {
    onStopEdit?.()
    if (newValue !== value) onCommit(newValue)
  }

  const dataCellId = cellId

  if (isEditing) {
    if (type === 'combobox') {
      return (
        <FastenerComboBox
          value={draft}
          options={options ?? []}
          onSelect={(nextValue) => { setDraft(nextValue); commit(nextValue) }}
          onCancel={() => onStopEdit?.()}
        />
      )
    }
    return (
      <input
        ref={inputRef}
        type={isNumber ? 'number' : 'text'}
        data-cell-id={dataCellId}
        value={typeof draft === 'string' || typeof draft === 'number' ? String(draft) : ''}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(draft); return }
          if (e.key === 'Escape') { onStopEdit?.(); return }
        }}
        className="w-full border border-brand-navy/40 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  return (
    <button
      type="button"
      data-cell-id={dataCellId}
      onDoubleClick={startEdit}
      disabled={saving}
      className="w-full text-left rounded px-1 py-0.5 -mx-1 hover:bg-brand-navy/5 disabled:opacity-50 whitespace-normal break-words"
    >
      {displayValue(value, type)}
    </button>
  )
}

export default function AutoCadWidget({ record, object }: WidgetProps) {
  const recordId = record?.id ? String(record.id) : undefined
  const [rows, setRows] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  // Which grid cell (`${rowId}:${fieldKey}`) is currently in edit mode —
  // lifted here so keyboard navigation can move editing to the next cell.
  const [editingCellId, setEditingCellId] = useState<string | null>(null)
  const [fillDrag, setFillDrag] = useState<FillDrag | null>(null)
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [copiedSelection, setCopiedSelection] = useState<GridSelection | null>(null)
  const { pushUndo, popUndo, clearUndo } = useGridUndo<RecordData[]>()
  const gridRootRef = useRef<HTMLDivElement>(null)
  const selectingCellsRef = useRef(false)

  const focusGridCell = (coordinate: GridCoordinate) => {
    requestAnimationFrame(() => {
      const cells = gridRootRef.current?.querySelectorAll<HTMLElement>(
        `[data-grid-row="${coordinate.row}"][data-grid-column="${coordinate.column}"]`,
      )
      const visibleCell = Array.from(cells ?? []).find((cell) => cell.getClientRects().length > 0)
      visibleCell?.focus()
    })
  }

  const selectGridCell = (coordinate: GridCoordinate, extend = false) => {
    setSelection((current) => extend && current
      ? { ...current, focus: coordinate }
      : { anchor: coordinate, focus: coordinate })
    focusGridCell(coordinate)
  }

  const navigateGrid = (row: number, column: number, direction: NavDirection, extend = false) => {
    let nextRow = row + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0)
    let nextColumn = column + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0)
    if (nextColumn < 0) { nextColumn = ALL_FIELDS.length - 1; nextRow -= 1 }
    if (nextColumn >= ALL_FIELDS.length) { nextColumn = 0; nextRow += 1 }
    nextRow = Math.max(0, Math.min(nextRow, rows.length - 1))
    nextColumn = Math.max(0, Math.min(nextColumn, ALL_FIELDS.length - 1))
    selectGridCell({ row: nextRow, column: nextColumn }, extend)
  }

  const applyClipboardMatrix = async (start: GridCoordinate, matrix: string[][]) => {
    if (!recordId || !matrix.length) return
    pushUndo(snapshotGridRows(rows))
    setError(null)
    setCreating(true)
    const targetRows = [...rows]
    try {
      while (targetRows.length < start.row + matrix.length) {
        const created = await recordsService.createRecord('AutoCad', { data: { project: recordId } })
        if (!created) throw new Error('Failed to add a row for pasted cells')
        targetRows.push(created)
        setRows((previous) => [...previous, created])
      }

      const patches = new Map<number, Record<string, unknown>>()
      let invalidCount = 0
      matrix.forEach((clipboardRow, rowOffset) => clipboardRow.forEach((rawValue, columnOffset) => {
        const targetColumn = ALL_FIELDS[start.column + columnOffset]
        if (!targetColumn) return
        const parsed = parseGridCellValue(rawValue, targetColumn.type === 'number' ? 'number' : 'text')
        if (!parsed.valid) { invalidCount += 1; return }
        const targetRow = start.row + rowOffset
        const patch = patches.get(targetRow) ?? {}
        patch[targetColumn.key] = parsed.value
        patches.set(targetRow, patch)
      }))

      for (const [rowIndex, patch] of patches) {
        const targetRow = targetRows[rowIndex]
        if (!targetRow) continue
        setSavingRowId(targetRow.id)
        const updated = await recordsService.updateRecord('AutoCad', targetRow.id, { data: patch })
        if (updated) {
          targetRows[rowIndex] = updated
          setRows((previous) => previous.map((row) => row.id === targetRow.id ? updated : row))
        }
      }
      const lastRow = Math.min(targetRows.length - 1, start.row + matrix.length - 1)
      const lastColumn = Math.min(ALL_FIELDS.length - 1, start.column + Math.max(...matrix.map((row) => row.length)) - 1)
      setSelection({ anchor: { row: lastRow, column: lastColumn }, focus: start })
      focusGridCell(start)
      if (invalidCount) setError(`${invalidCount} pasted value${invalidCount === 1 ? '' : 's'} skipped because they were not valid numbers`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to paste AutoCad cells')
    } finally {
      setSavingRowId(null)
      setCreating(false)
    }
  }

  const getClipboardMatrix = (range: GridSelection): unknown[][] => {
    const bounds = getGridSelectionBounds(range)
    return rows.slice(bounds.top, bounds.bottom + 1).map((row) =>
      ALL_FIELDS.slice(bounds.left, bounds.right + 1).map((field) => row.data?.[field.key]),
    )
  }

  const handleGridCopy = (event: React.ClipboardEvent<HTMLDivElement>, cut = false) => {
    if (!selection || editingCellId) return
    event.clipboardData.setData('text/plain', serializeGridClipboard(getClipboardMatrix(selection)))
    event.preventDefault()
    setCopiedSelection(selection)
    if (cut) {
      const bounds = getGridSelectionBounds(selection)
      void applyClipboardMatrix({ row: bounds.top, column: bounds.left }, Array.from(
        { length: bounds.bottom - bounds.top + 1 },
        () => Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
      ))
    }
  }

  const handleGridPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!selection || editingCellId) return
    event.preventDefault()
    setCopiedSelection(null)
    const matrix = tileGridClipboardToSelection(parseGridClipboard(event.clipboardData.getData('text/plain')), selection)
    void applyClipboardMatrix(getGridSelectionOrigin(selection), matrix)
  }

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLElement>, row: number, column: number) => {
    if (event.target instanceof HTMLInputElement) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      void undoGridAction()
      return
    }
    if (event.key === 'Escape' && copiedSelection) { setCopiedSelection(null); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      if (rows.length) setSelection({ anchor: { row: rows.length - 1, column: ALL_FIELDS.length - 1 }, focus: { row: 0, column: 0 } })
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
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (selection) {
        const bounds = getGridSelectionBounds(selection)
        void applyClipboardMatrix({ row: bounds.top, column: bounds.left }, Array.from(
          { length: bounds.bottom - bounds.top + 1 },
          () => Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
        ))
      }
      return
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      const rowData = rows[row]
      const field = ALL_FIELDS[column]
      if (rowData && field) setEditingCellId(`${rowData.id}:${field.key}`)
    }
  }

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await recordsService.getRecords('AutoCad', { filter: { project: recordId } }))
      clearUndo()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load AutoCad items')
    } finally {
      setLoading(false)
    }
  }, [recordId, clearUndo])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!selection && rows.length) setSelection({ anchor: { row: 0, column: 0 }, focus: { row: 0, column: 0 } })
  }, [rows.length, selection])

  const handleCellCommit = useCallback(async (rowId: string, key: string, value: unknown) => {
    const previousRow = rows.find(row => row.id === rowId)
    if (previousRow && !Object.is(previousRow.data?.[key], value)) pushUndo(snapshotGridRows(rows))
    setSavingRowId(rowId)
    setError(null)
    try {
      const updated = await recordsService.updateRecord('AutoCad', rowId, { data: { [key]: value } })
      if (updated) setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)))
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
      setRows(await restoreGridRows('AutoCad', rows, previousRows))
    } catch (err: unknown) {
      pushUndo(previousRows)
      setError(err instanceof Error ? err.message : 'Failed to undo AutoCad change')
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
      const patches = new Map<number, Record<string, unknown>>()
      for (const target of getGridFillTargets(drag.selection, drag.target)) {
        const source = rows[target.sourceRow]
        const sourceField = ALL_FIELDS[target.sourceColumn]
        const destinationField = ALL_FIELDS[target.column]
        if (!source || !sourceField || !destinationField) continue
        const patch = patches.get(target.row) ?? {}
        patch[destinationField.key] = source.data?.[sourceField.key] ?? ''
        patches.set(target.row, patch)
      }
      if (patches.size) pushUndo(snapshotGridRows(rows))
      for (const [rowIndex, patch] of patches) {
        const row = rows[rowIndex]
        if (!row) continue
        setSavingRowId(row.id)
        try {
          const updated = await recordsService.updateRecord('AutoCad', row.id, { data: patch })
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
  }, [fillDrag, rows, handleCellCommit, pushUndo])

  const handleFillDragEnter = (rowIndex: number, colIndex: number) => {
    setFillDrag(previous => previous ? { ...previous, target: { row: rowIndex, column: colIndex } } : previous)
  }

  const gridFillClassName = (rowIndex: number, colIndex: number) => fillDrag
    ? getGridFillRangeCellClasses(rowIndex, colIndex, fillDrag.selection, fillDrag.target)
    : ''

  if (object?.apiName && object.apiName !== 'Project') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The AutoCad widget can only be placed on the Project object&rsquo;s layout.
      </div>
    )
  }

  const handleAddBlankRow = async () => {
    if (!recordId) return
    pushUndo(snapshotGridRows(rows))
    setCreating(true)
    setError(null)
    try {
      const created = await recordsService.createRecord('AutoCad', { data: { project: recordId } })
      if (created) setRows((prev) => [...prev, created])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add AutoCad row')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (row: RecordData) => {
    if (!window.confirm('Delete this AutoCad item? This cannot be undone.')) return
    clearUndo()
    setDeletingRowId(row.id)
    setError(null)
    try {
      await recordsService.deleteRecord('AutoCad', row.id)
      setRows((prev) => prev.filter((item) => item.id !== row.id))
      setSelection(null)
      setCopiedSelection(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete AutoCad item')
    } finally {
      setDeletingRowId(null)
    }
  }

  const handlePreviewPdf = async () => {
    if (generatingPdf) return
    // Open the tab synchronously inside the click handler so popup blockers
    // don't kill it after the await (matches the other list-widget PDF flows).
    const previewWindow = window.open('', '_blank')
    setGeneratingPdf(true)
    setError(null)
    try {
      const projectName = (typeof record?.projectName === 'string' && record.projectName)
        || (record ? getRecordName(record as Record<string, unknown>) : 'Project')
      const pmRaw = readProjectField(record as Record<string, unknown>, 'internal_project_manager')
      let projectManager = ''
      if (pmRaw) {
        const managerIds = userLookupIds(pmRaw)
        try {
          const users = await apiClient.get<LookupUserIdentity[]>('/users/lookup')
          const usersById = new Map(users.map((user) => [String(user.id), user]))
          projectManager = managerIds.map((id) => {
            const user = usersById.get(id)
            if (user) return user.name || user.email || ''
            return isLikelyUserId(id) ? '' : id
          }).filter(Boolean).join(', ')
        } catch {
          projectManager = managerIds.filter((id) => !isLikelyUserId(id)).join(', ')
        }
      }
      const payloadRows = rows.map((row) => ({
        fastener: row.data?.fastener,
        totalQty: row.data?.totalQty,
      }))
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const token = apiClient.getToken()
      const response = await fetch(`${apiBase}/autocad-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ projectName, projectManager, rows: payloadRows }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(detail.error || `Failed to render PDF (${response.status})`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = url
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = 'AutoCad_Fastener_Schedule.pdf'
        link.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err: unknown) {
      previewWindow?.close()
      setError(err instanceof Error ? err.message : 'Failed to generate AutoCad PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div
      ref={gridRootRef}
      className="space-y-3"
      onKeyDown={handleGridUndoKeyDown}
      onMouseUp={() => { selectingCellsRef.current = false; if (selection) focusGridCell(selection.focus) }}
      onMouseLeave={() => { selectingCellsRef.current = false }}
      onCopy={(event) => handleGridCopy(event)}
      onCut={(event) => handleGridCopy(event, true)}
      onPaste={handleGridPaste}
    >
      <div className="hidden items-center justify-between border-b border-gray-200 pb-3 md:flex">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-brand-navy" />
          <div>
            <h3 className="text-sm font-bold text-brand-navy">AutoCad</h3>
            <p className="text-xs text-gray-500">{rows.length} item{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePreviewPdf()}
            disabled={generatingPdf}
            aria-label="Preview PDF"
            title="Preview PDF"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void handleAddBlankRow()}
            disabled={creating}
            aria-label="Add blank AutoCad row"
            title="Add blank AutoCad row"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-brand-navy text-brand-navy hover:bg-brand-navy/5 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Wrench className="h-5 w-5 shrink-0 text-brand-navy" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-brand-navy">AutoCad</h3>
            <p className="text-xs text-gray-500">{rows.length} item{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handlePreviewPdf()}
          disabled={generatingPdf}
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
        >
          {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          PDF
        </button>
        <button
          type="button"
          onClick={() => void handleAddBlankRow()}
          disabled={creating}
          className="inline-flex shrink-0 items-center gap-1.5 rounded bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add Item
        </button>
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
        <div className="py-8 text-center text-sm text-gray-400">No AutoCad items yet.</div>
      ) : (
        <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
          <table role="grid" aria-label="AutoCad fastener spreadsheet" aria-multiselectable="true" className="w-full table-fixed text-sm border-collapse">
            <colgroup>
              {ALL_FIELDS.map((f) => (
                <col key={f.key} style={{ width: getColWidthRem(f.key) }} />
              ))}
              <col style={{ width: '2rem' }} />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                {ALL_FIELDS.map((f) => (
                  <th key={f.key} className="px-1.5 py-1 text-left font-semibold text-gray-600 border-b border-gray-200 whitespace-normal break-words">
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
                    const selectedBounds = selection ? getGridSelectionBounds(selection) : null
                    const isFillAnchor = selectedBounds?.bottom === i && selectedBounds.right === colIndex
                    return <td
                      key={f.key}
                      data-grid-row={i}
                      data-grid-column={colIndex}
                      tabIndex={selection?.focus.row === i && selection.focus.column === colIndex ? 0 : -1}
                      aria-selected={selection ? isInGridSelection(i, colIndex, selection) : false}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return
                        const coordinate = { row: i, column: colIndex }
                        setSelection((current) => event.shiftKey && current ? { ...current, focus: coordinate } : { anchor: coordinate, focus: coordinate })
                        selectingCellsRef.current = true
                      }}
                      onMouseEnter={() => handleFillDragEnter(i, colIndex)}
                      onMouseEnterCapture={() => {
                        if (selectingCellsRef.current) setSelection((current) => current
                          ? { ...current, focus: { row: i, column: colIndex } }
                          : { anchor: { row: i, column: colIndex }, focus: { row: i, column: colIndex } })
                      }}
                      onKeyDown={(event) => handleGridKeyDown(event, i, colIndex)}
                      className={`relative px-1.5 py-1 border-b border-gray-100 align-top whitespace-normal break-words ${selection && isInGridSelection(i, colIndex, selection) ? 'bg-[#e2f0d9]' : ''} ${gridFillClassName(i, colIndex)}`}
                    >
                      <GridRangeDecoration row={i} column={colIndex} selection={selection} copiedSelection={copiedSelection} />
                      <EditableCell
                        cellId={cellId}
                        value={row.data?.[f.key]}
                        type={f.type}
                        saving={savingRowId === row.id}
                        options={f.options}
                        isEditing={editingCellId === cellId}
                        onStartEdit={() => setEditingCellId(cellId)}
                        onStopEdit={() => setEditingCellId(null)}
                        onCommit={(value) => handleCellCommit(row.id, f.key, value)}
                      />
                      {isFillAnchor && editingCellId !== cellId && (
                        <span
                          onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            if (selection) setFillDrag({ selection, target: { row: i, column: colIndex } })
                          }}
                          aria-hidden="true"
                          className="absolute bottom-0 right-0 z-30 h-2 w-2 cursor-crosshair rounded-[1px] bg-[#217346]"
                        />
                      )}
                    </td>
                  })}
                  <td className="w-8 px-1 py-1 border-b border-gray-100 align-top">
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      disabled={deletingRowId === row.id || savingRowId === row.id}
                      aria-label="Delete AutoCad item"
                      title="Delete AutoCad item"
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
          {rows.map((row, rowIndex) => (
            <article key={row.id} className="flex min-w-[48rem] items-center gap-2 border-b border-gray-100 bg-white px-2 py-2 last:border-b-0">
              {ALL_FIELDS.map((field, colIndex) => {
                const cellId = `${row.id}:${field.key}`
                const selectedBounds = selection ? getGridSelectionBounds(selection) : null
                const isFillAnchor = selectedBounds?.bottom === rowIndex && selectedBounds.right === colIndex
                return <div
                  key={field.key}
                  data-grid-row={rowIndex}
                  data-grid-column={colIndex}
                  tabIndex={selection?.focus.row === rowIndex && selection.focus.column === colIndex ? 0 : -1}
                  aria-selected={selection ? isInGridSelection(rowIndex, colIndex, selection) : false}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return
                    const coordinate = { row: rowIndex, column: colIndex }
                    setSelection((current) => event.shiftKey && current ? { ...current, focus: coordinate } : { anchor: coordinate, focus: coordinate })
                    selectingCellsRef.current = true
                  }}
                  onMouseEnter={() => handleFillDragEnter(rowIndex, colIndex)}
                  onMouseEnterCapture={() => {
                    if (selectingCellsRef.current) setSelection((current) => current
                      ? { ...current, focus: { row: rowIndex, column: colIndex } }
                      : { anchor: { row: rowIndex, column: colIndex }, focus: { row: rowIndex, column: colIndex } })
                  }}
                  onKeyDown={(event) => handleGridKeyDown(event, rowIndex, colIndex)}
                  className={`${getMobileRowWidthClass(field)} relative shrink-0 ${selection && isInGridSelection(rowIndex, colIndex, selection) ? 'bg-[#e2f0d9]' : ''} ${gridFillClassName(rowIndex, colIndex)}`}
                >
                  <GridRangeDecoration row={rowIndex} column={colIndex} selection={selection} copiedSelection={copiedSelection} />
                  <p className="truncate text-[9px] font-semibold uppercase text-gray-400">{field.label}</p>
                  <EditableCell
                    cellId={cellId}
                    value={row.data?.[field.key]}
                    type={field.type}
                    saving={savingRowId === row.id}
                    options={field.options}
                    isEditing={editingCellId === cellId}
                    onStartEdit={() => setEditingCellId(cellId)}
                    onStopEdit={() => setEditingCellId(null)}
                    onCommit={(value) => handleCellCommit(row.id, field.key, value)}
                  />
                  {isFillAnchor && editingCellId !== cellId && (
                    <span
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (selection) setFillDrag({ selection, target: { row: rowIndex, column: colIndex } })
                      }}
                      aria-hidden="true"
                      className="absolute bottom-0 right-0 z-30 h-2 w-2 cursor-crosshair rounded-[1px] bg-[#217346]"
                    />
                  )}
                </div>
              })}
              <button
                type="button"
                onClick={() => void handleDelete(row)}
                disabled={deletingRowId === row.id || savingRowId === row.id}
                aria-label="Delete AutoCad item"
                className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                {deletingRowId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </article>
          ))}
        </div>
      )}
      <div className="flex min-h-7 items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
        <span className="font-mono font-medium text-gray-700">{selection ? `${spreadsheetColumnLabel(selection.focus.column)}${selection.focus.row + 1}` : ' '}</span>
        <span>{selection ? `${(Math.abs(selection.focus.row - selection.anchor.row) + 1) * (Math.abs(selection.focus.column - selection.anchor.column) + 1)} cells selected` : ''}</span>
        <span>{savingRowId ? 'Saving…' : ' '}</span>
      </div>
      <GridRangeStyles />
    </div>
  )
}
