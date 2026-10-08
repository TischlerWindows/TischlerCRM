'use client'

/**
 * CAD Index List widget — 3 independent per-Project checklists
 * (Pre-Installation Survey List, Installation Progress List, Final
 * Adjustment Check List). All 3 share one underlying CadIndexItem object,
 * partitioned by a `reportType` field — rows added under one report never
 * appear under another (each "Add Row" stamps the currently-active
 * reportType), so from a data perspective they behave as 3 fully
 * independent lists, not 3 views onto shared rows.
 *
 * Each report gets its own "Preview PDF" (server-side PDFKit, see
 * apps/api/src/lib/cad-index-pdf/renderer.ts — one generic column-driven
 * renderer shared by all reports, not one hardcoded layout per report).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, FileText, GripVertical, ListChecks, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'
import { restoreGridRows, snapshotGridRows } from '@/lib/grid-undo-records'
import { useGridUndo } from '@/lib/use-grid-undo'
import { apiClient } from '@/lib/api-client'
import { getRecordName } from '../shared/recordName'
import { orderedColumns } from '@/lib/cad-index-column-order'
import { parseCadIndexComments } from '@/lib/cad-index-comments'
import {
  getGridFillTargets,
  getGridFillRangeCellClasses,
  isCaretAtHorizontalEdge,
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

type ColumnType = 'text' | 'number' | 'checkbox'

interface ColumnDef {
  key: string
  label: string
  type: ColumnType
  multiline?: boolean
}

interface FillDrag {
  selection: GridSelection
  target: GridCoordinate
}

const REPORT_TYPES = [
  'Pre-Installation Survey List',
  'Installation Progress List',
  'Final Adjustment Check List',
] as const

type ReportType = typeof REPORT_TYPES[number]

const BASE_UNIT_COLUMNS: ColumnDef[] = [
  { key: 'unit', label: 'Unit', type: 'text' },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'shopDrawingPage', label: 'Shop Drawing Page', type: 'text' },
  { key: 'itemType', label: 'Type', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
]

const REPORT_COLUMNS: Record<ReportType, ColumnDef[]> = {
  'Pre-Installation Survey List': [
    ...BASE_UNIT_COLUMNS,
    { key: 'roProperlyFramed', label: 'R.O. Properly Framed (Y/N)', type: 'checkbox' },
    { key: 'roWaterproofed', label: 'R.O. Waterproofed (Y/N)', type: 'checkbox' },
    { key: 'panReady', label: 'Pan Ready (if applicable) (Y/N)', type: 'checkbox' },
    { key: 'benchmarkShot', label: 'Tischler Benchmark Shot (Y/N)', type: 'checkbox' },
    { key: 'remarks', label: 'Remarks', type: 'text', multiline: true },
  ],
  'Installation Progress List': [
    { key: 'opening', label: 'Opening', type: 'text' },
    { key: 'unit', label: 'Unit', type: 'text' },
    { key: 'shopDrawingPage', label: 'Shop Drawing Page', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'unitInstalled', label: 'Unit Installed', type: 'checkbox' },
    { key: 'technicalCheckCompleted', label: 'Technical check completed', type: 'checkbox' },
    { key: 'alarmContactChecked', label: 'Alarm Contact Checked', type: 'checkbox' },
    { key: 'rollScreenAdjusted', label: 'Roll Screen Adjusted', type: 'checkbox' },
    { key: 'remarks', label: 'Remarks', type: 'text', multiline: true },
  ],
  'Final Adjustment Check List': [
    ...BASE_UNIT_COLUMNS,
    { key: 'unitInstalled', label: 'Unit Installed', type: 'checkbox' },
    { key: 'technicalCheckCompleted', label: 'Technical check completed', type: 'checkbox' },
    { key: 'alarmContactChecked', label: 'Alarm Contact Checked', type: 'checkbox' },
    { key: 'remarks', label: 'Remarks', type: 'text', multiline: true },
  ],
}

/** Click-to-edit text/number/textarea cell — commits on blur/Enter, Escape cancels. */
function TextCell({
  value,
  type,
  multiline,
  saving,
  editing,
  editSeed,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  value: unknown
  type: 'text' | 'number'
  multiline?: boolean
  saving: boolean
  editing: boolean
  editSeed: string | null
  onStartEdit: () => void
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cancelBlurRef = useRef(false)

  useEffect(() => {
    if (!editing) return
    setDraft(editSeed ?? (typeof value === 'string' || typeof value === 'number' ? String(value) : ''))
    requestAnimationFrame(() => {
      const editor = multiline ? textareaRef.current : inputRef.current
      editor?.focus()
      if (editSeed !== null) editor?.setSelectionRange(editSeed.length, editSeed.length)
    })
  }, [editing, editSeed, multiline, value])

  const commit = (next: string) => {
    if (!saving && next !== String(value ?? '')) onCommit(next)
  }

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelBlurRef.current = true
      onCancel()
      return
    }
    if (event.key === 'Enter' && (!multiline || !event.shiftKey)) {
      event.preventDefault()
      commit(draft)
    }
  }

  if (editing) {
    const editorProps = {
      value: draft,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (type === 'number' && !isValidGridDecimalInput(event.target.value)) return
        setDraft(event.target.value)
      },
      onBlur: () => {
        if (cancelBlurRef.current) {
          cancelBlurRef.current = false
          return
        }
        commit(draft)
        onCancel()
      },
      onKeyDown: handleEditorKeyDown,
      className: 'w-full rounded border border-brand-navy/50 bg-white px-1 py-0.5 text-xs outline-none ring-1 ring-[#217346]',
    }
    return multiline
      ? <textarea {...editorProps} ref={textareaRef} rows={2} />
      : <input {...editorProps} ref={inputRef} type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'decimal' : undefined} disabled={saving} />
  }

  const display = value === undefined || value === null || value === '' ? '\u2014' : String(value)
  return (
    <div
      onDoubleClick={() => { if (!saving) onStartEdit() }}
      className="min-h-5 whitespace-normal break-words px-1 py-0.5 text-xs"
    >
      {display}
    </div>
  )
}

export default function CadIndexListWidget({ record, object }: WidgetProps) {
  const projectId = record?.id ? String(record.id) : undefined
  const [rows, setRows] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [activeReportType, setActiveReportType] = useState<ReportType>(REPORT_TYPES[0])
  const [fillDrag, setFillDrag] = useState<FillDrag | null>(null)
  const [editingCellId, setEditingCellId] = useState<string | null>(null)
  const [columnOrder, setColumnOrder] = useState<unknown>(() => record?.cadIndexColumnOrder)
  const [savingColumns, setSavingColumns] = useState(false)
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null)
  const [dropBoundary, setDropBoundary] = useState<{ index: number; edge: 'before' | 'after' } | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnLabel, setNewColumnLabel] = useState('')
  const [newColumnType, setNewColumnType] = useState<ColumnType>('text')
  const [comments, setComments] = useState<Record<string, string>>(() => parseCadIndexComments(record?.cadIndexComments))
  const [savingComments, setSavingComments] = useState(false)
  const autoAddedRows = useRef(new Set<string>())
  const gridTableRef = useRef<HTMLTableElement>(null)
  const selectingCellsRef = useRef(false)
  const [selection, setSelection] = useState<GridSelection | null>(null)
  const [copiedSelection, setCopiedSelection] = useState<GridSelection | null>(null)
  const { pushUndo, popUndo, clearUndo } = useGridUndo<RecordData[]>()
  const [editSeed, setEditSeed] = useState<string | null>(null)

  useEffect(() => { setColumnOrder(record?.cadIndexColumnOrder) }, [projectId, record?.cadIndexColumnOrder])
  useEffect(() => { setComments(parseCadIndexComments(record?.cadIndexComments)) }, [projectId, record?.cadIndexComments])

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await recordsService.getRecords('CadIndexItem', { filter: { project: projectId } }))
      clearUndo()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load CAD Index List items')
    } finally {
      setLoading(false)
    }
  }, [projectId, clearUndo])

  useEffect(() => { void load() }, [load])

  const columns = orderedColumns(activeReportType, REPORT_COLUMNS[activeReportType], columnOrder)
  const activeRows = useMemo(
    () => rows.filter((r) => r.data?.reportType === activeReportType),
    [rows, activeReportType],
  )

  useEffect(() => {
    setSelection(null)
    setEditingCellId(null)
    clearUndo()
  }, [activeReportType, clearUndo])

  useEffect(() => {
    if (!selection && activeRows.length > 0 && columns.length > 0) {
      setSelection({ anchor: { row: 0, column: 0 }, focus: { row: 0, column: 0 } })
    }
  }, [activeRows.length, columns.length, selection])

  const focusGridCell = (coordinate: GridCoordinate) => {
    requestAnimationFrame(() => {
      gridTableRef.current
        ?.querySelector<HTMLElement>(`[data-grid-row="${coordinate.row}"][data-grid-column="${coordinate.column}"]`)
        ?.focus()
    })
  }

  const selectGridCell = (coordinate: GridCoordinate, extend = false, focus = true) => {
    setSelection((current) => extend && current
      ? { ...current, focus: coordinate }
      : { anchor: coordinate, focus: coordinate })
    if (focus) focusGridCell(coordinate)
  }

  const navigateGrid = (row: number, column: number, direction: 'left' | 'right' | 'up' | 'down', extend = false) => {
    let nextRow = row
    let nextColumn = column
    if (direction === 'left') nextColumn -= 1
    if (direction === 'right') nextColumn += 1
    if (direction === 'up') nextRow -= 1
    if (direction === 'down') nextRow += 1
    if (nextColumn < 0) { nextColumn = columns.length - 1; nextRow -= 1 }
    if (nextColumn >= columns.length) { nextColumn = 0; nextRow += 1 }
    nextRow = Math.max(0, Math.min(nextRow, activeRows.length - 1))
    nextColumn = Math.max(0, Math.min(nextColumn, columns.length - 1))
    selectGridCell({ row: nextRow, column: nextColumn }, extend)
  }

  const beginCellEdit = (row: number, column: number, seed: string | null = null) => {
    const cell = activeRows[row]
    const field = columns[column]
    if (!cell || !field || field.type === 'checkbox' || savingRowId === cell.id) return
    selectGridCell({ row, column }, false, false)
    setEditSeed(seed)
    setEditingCellId(`${cell.id}:${field.key}`)
  }

  const persistColumnOrder = async (nextColumns?: ColumnDef[]) => {
    if (!projectId || savingColumns) return
    const previous = columnOrder
    let saved: Record<string, unknown> = {}
    try {
      const parsed = typeof previous === 'string' ? JSON.parse(previous) : previous
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>
    } catch { /* Treat malformed saved settings as defaults. */ }
    if (nextColumns) {
      const custom = nextColumns.filter((column) => column.key.startsWith('cadCustom_'))
      saved[activeReportType] = custom.length
        ? { order: nextColumns.map((column) => column.key), custom }
        : nextColumns.map((column) => column.key)
    }
    else delete saved[activeReportType]
    const next = JSON.stringify(saved)
    setColumnOrder(next)
    setSavingColumns(true)
    setError(null)
    try {
      await recordsService.updateRecord('Project', projectId, { data: { cadIndexColumnOrder: next } })
    } catch (err: unknown) {
      setColumnOrder(previous)
      setError(err instanceof Error ? err.message : 'Failed to save column order')
    } finally {
      setSavingColumns(false)
    }
  }

  const moveColumn = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= columns.length || toIndex >= columns.length || fromIndex === toIndex) return
    const next = [...columns]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    next.splice(toIndex, 0, moved)
    void persistColumnOrder(next)
  }

  const handleAddColumn = (event: React.FormEvent) => {
    event.preventDefault()
    const label = newColumnLabel.trim()
    if (!label || savingColumns) return
    if (columns.some((column) => column.label.toLowerCase() === label.toLowerCase())) {
      setError('A column with that name already exists')
      return
    }
    const key = `cadCustom_${crypto.randomUUID().replace(/-/g, '')}`
    void persistColumnOrder([...columns, { key, label, type: newColumnType }])
    setNewColumnLabel('')
    setNewColumnType('text')
    setAddingColumn(false)
  }

  const handleRenameColumn = (column: ColumnDef) => {
    const label = window.prompt('Rename column:', column.label)?.trim()
    if (!label || label === column.label) return
    if (columns.some((item) => item.key !== column.key && item.label.toLowerCase() === label.toLowerCase())) {
      setError('A column with that name already exists')
      return
    }
    void persistColumnOrder(columns.map((item) => item.key === column.key ? { ...item, label } : item))
  }

  const handleRemoveColumn = (column: ColumnDef) => {
    if (!window.confirm(`Remove "${column.label}"? Existing values in this column will no longer be shown.`)) return
    void persistColumnOrder(columns.filter((item) => item.key !== column.key))
  }

  const handleResetColumns = () => {
    if (columns.some((column) => column.key.startsWith('cadCustom_')) &&
        !window.confirm('Reset this report to default columns? Custom columns and their values will no longer be shown.')) return
    void persistColumnOrder()
  }

  const persistComments = async (reportType: ReportType, value: string) => {
    if (!projectId || savingComments) return
    const next = { ...comments, [reportType]: value }
    setComments(next)
    setSavingComments(true)
    setError(null)
    try {
      await recordsService.updateRecord('Project', projectId, { data: { cadIndexComments: JSON.stringify(next) } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save additional comments')
    } finally {
      setSavingComments(false)
    }
  }

  const handleCellCommit = useCallback(async (rowId: string, key: string, value: unknown) => {
    const previousRow = rows.find(row => row.id === rowId)
    if (previousRow && !Object.is(previousRow.data?.[key], value)) pushUndo(snapshotGridRows(rows))
    setSavingRowId(rowId)
    setError(null)
    try {
      const updated = await recordsService.updateRecord('CadIndexItem', rowId, { data: { [key]: value } })
      if (updated) setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)))

      const lastActiveRow = activeRows[activeRows.length - 1]
      if (key === 'unit' && String(value).trim() && lastActiveRow?.id === rowId && !autoAddedRows.current.has(rowId)) {
        autoAddedRows.current.add(rowId)
        setCreating(true)
        try {
          const created = await recordsService.createRecord('CadIndexItem', { data: { project: projectId, reportType: activeReportType } })
          if (created) setRows((prev) => [...prev, created])
        } catch (err: unknown) {
          autoAddedRows.current.delete(rowId)
          setError(err instanceof Error ? err.message : 'Failed to add row')
        } finally {
          setCreating(false)
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save change')
    } finally {
      setSavingRowId(null)
    }
  }, [activeReportType, activeRows, projectId, rows, pushUndo])

  const applyClipboardMatrix = async (start: GridCoordinate, matrix: string[][]) => {
    if (!projectId || !matrix.length || !columns.length) return
    pushUndo(snapshotGridRows(rows))
    setError(null)
    setCreating(true)
    const targetRows = [...activeRows]
    const requiredRows = start.row + matrix.length
    try {
      while (targetRows.length < requiredRows) {
        const created = await recordsService.createRecord('CadIndexItem', {
          data: { project: projectId, reportType: activeReportType },
        })
        if (!created) throw new Error('Failed to add a row for pasted cells')
        targetRows.push(created)
        setRows((previous) => [...previous, created])
      }

      const updates = new Map<number, Record<string, unknown>>()
      let invalidCount = 0
      matrix.forEach((clipboardRow, rowOffset) => {
        clipboardRow.forEach((rawValue, columnOffset) => {
          const rowIndex = start.row + rowOffset
          const column = columns[start.column + columnOffset]
          if (!column || rowIndex >= targetRows.length) return
          const parsed = parseGridCellValue(rawValue, column.type)
          if (!parsed.valid) { invalidCount += 1; return }
          const patch = updates.get(rowIndex) ?? {}
          patch[column.key] = parsed.value
          updates.set(rowIndex, patch)
        })
      })

      for (const [rowIndex, patch] of updates) {
        const row = targetRows[rowIndex]
        if (!row) continue
        setSavingRowId(row.id)
        const updated = await recordsService.updateRecord('CadIndexItem', row.id, { data: patch })
        if (updated) {
          targetRows[rowIndex] = updated
          setRows((previous) => previous.map((item) => item.id === row.id ? updated : item))
        }
      }

      const lastRow = targetRows[targetRows.length - 1]
      const unitColumn = columns.find((column) => column.key === 'unit')
      const lastUnit = lastRow && updates.get(targetRows.length - 1)?.unit !== undefined
        ? updates.get(targetRows.length - 1)?.unit
        : lastRow?.data?.unit
      if (unitColumn && lastRow && String(lastUnit ?? '').trim() && !autoAddedRows.current.has(lastRow.id)) {
        autoAddedRows.current.add(lastRow.id)
        try {
          const created = await recordsService.createRecord('CadIndexItem', {
            data: { project: projectId, reportType: activeReportType },
          })
          if (created) setRows((previous) => [...previous, created])
          else throw new Error('Failed to add a row after the pasted Unit value')
        } catch (err) {
          autoAddedRows.current.delete(lastRow.id)
          throw err
        }
      }

      const lastRowIndex = Math.min(targetRows.length - 1, start.row + matrix.length - 1)
      const lastColumnIndex = Math.min(columns.length - 1, start.column + Math.max(...matrix.map((row) => row.length)) - 1)
      setSelection({ anchor: { row: lastRowIndex, column: lastColumnIndex }, focus: start })
      focusGridCell(start)
      if (invalidCount) setError(`${invalidCount} pasted cell${invalidCount === 1 ? '' : 's'} skipped because the value did not match its column type`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to paste cells')
    } finally {
      setSavingRowId(null)
      setCreating(false)
    }
  }

  const selectedClipboardMatrix = (range: GridSelection): unknown[][] => {
    const bounds = getGridSelectionBounds(range)
    return activeRows.slice(bounds.top, bounds.bottom + 1).map((row) =>
      columns.slice(bounds.left, bounds.right + 1).map((column) => row.data?.[column.key]),
    )
  }

  const handleGridCopy = (event: React.ClipboardEvent<HTMLTableElement>, cut = false) => {
    const target = event.target
    if (!selection || (target instanceof HTMLInputElement && target.type !== 'checkbox') || target instanceof HTMLTextAreaElement) return
    event.clipboardData.setData('text/plain', serializeGridClipboard(selectedClipboardMatrix(selection)))
    event.preventDefault()
    setCopiedSelection(selection)
    if (cut) {
      const bounds = getGridSelectionBounds(selection)
      const clear = Array.from({ length: bounds.bottom - bounds.top + 1 }, () =>
        Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
      )
      void applyClipboardMatrix({ row: bounds.top, column: bounds.left }, clear)
    }
  }

  const handleGridPaste = (event: React.ClipboardEvent<HTMLTableElement>) => {
    const target = event.target
    if (!selection || (target instanceof HTMLInputElement && target.type !== 'checkbox') || target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    setCopiedSelection(null)
    const matrix = tileGridClipboardToSelection(parseGridClipboard(event.clipboardData.getData('text/plain')), selection)
    void applyClipboardMatrix(getGridSelectionOrigin(selection), matrix)
  }

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>, row: number, column: number) => {
    const target = event.target
    if ((target instanceof HTMLInputElement && target.type !== 'checkbox') || target instanceof HTMLTextAreaElement) {
      const direction = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null
      const atEdge = direction && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
        && isCaretAtHorizontalEdge(target.value, target.selectionStart, target.selectionEnd, direction)
      if (direction && atEdge) {
        event.preventDefault()
        setEditingCellId(null)
        setEditSeed(null)
        navigateGrid(row, column, direction)
      }
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      void undoGridAction()
      return
    }
    if (event.key === 'Escape' && copiedSelection) {
      event.preventDefault()
      setCopiedSelection(null)
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      if (activeRows.length && columns.length) {
        setSelection({ anchor: { row: activeRows.length - 1, column: columns.length - 1 }, focus: { row: 0, column: 0 } })
      }
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      navigateGrid(row, column, event.key.slice(5).toLowerCase() as 'left' | 'right' | 'up' | 'down', event.shiftKey)
      return
    }
    if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      navigateGrid(row, column, event.key === 'Enter' ? 'down' : event.shiftKey ? 'left' : 'right')
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      beginCellEdit(row, column)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (selection) {
        const bounds = getGridSelectionBounds(selection)
        const clear = Array.from({ length: bounds.bottom - bounds.top + 1 }, () =>
          Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
        )
        void applyClipboardMatrix({ row: bounds.top, column: bounds.left }, clear)
      }
      return
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      const activeColumn = columns[column]
      if (activeColumn?.type === 'checkbox') {
        if (event.key === ' ') {
          event.preventDefault()
          const rowData = activeRows[row]
          if (rowData) void handleCellCommit(rowData.id, activeColumn.key, !rowData.data?.[activeColumn.key])
        }
        return
      }
      event.preventDefault()
      beginCellEdit(row, column, event.key)
    }
  }

  async function undoGridAction() {
    const previousRows = popUndo()
    if (!previousRows) return
    try {
      setRows(await restoreGridRows('CadIndexItem', rows, previousRows))
    } catch (err: unknown) {
      pushUndo(previousRows)
      setError(err instanceof Error ? err.message : 'Failed to undo CAD Index change')
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

  // Commit the fill-handle drag on mouseup, wherever the pointer is released —
  // re-registered on every fillDrag update so the closure always sees the
  // latest dragged-over range.
  useEffect(() => {
    if (!fillDrag) return
    const onMouseUp = async () => {
      const drag = fillDrag
      setFillDrag(null)
      const patches = new Map<number, Record<string, unknown>>()
      for (const target of getGridFillTargets(drag.selection, drag.target)) {
        const source = activeRows[target.sourceRow]
        const column = columns[target.column]
        const sourceColumn = columns[target.sourceColumn]
        if (!source || !column || !sourceColumn) continue
        const patch = patches.get(target.row) ?? {}
        patch[column.key] = source.data?.[sourceColumn.key] ?? ''
        patches.set(target.row, patch)
      }
      if (patches.size) pushUndo(snapshotGridRows(rows))
      for (const [rowIndex, patch] of patches) {
        const destination = activeRows[rowIndex]
        if (!destination) continue
        setSavingRowId(destination.id)
        try {
          const updated = await recordsService.updateRecord('CadIndexItem', destination.id, { data: patch })
          if (updated) setRows((current) => current.map((item) => item.id === destination.id ? updated : item))
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to fill selected cells')
          continue
        } finally {
          setSavingRowId(null)
        }

        if (patch.unit && String(patch.unit).trim() && rowIndex === activeRows.length - 1 && !autoAddedRows.current.has(destination.id)) {
          autoAddedRows.current.add(destination.id)
          setCreating(true)
          try {
            const created = await recordsService.createRecord('CadIndexItem', {
              data: { project: projectId, reportType: activeReportType },
            })
            if (created) setRows((current) => [...current, created])
            else throw new Error('Failed to add row after filling the Unit column')
          } catch (err: unknown) {
            autoAddedRows.current.delete(destination.id)
            setError(err instanceof Error ? err.message : 'Failed to add row')
          } finally {
            setCreating(false)
          }
        }
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [fillDrag, activeRows, columns, projectId, activeReportType, rows, pushUndo])

  if (object?.apiName && object.apiName !== 'Project') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The CAD Index List widget can only be placed on the Project object&rsquo;s layout.
      </div>
    )
  }

  const handleFillDragEnter = (rowIndex: number, colIndex: number) => {
    setFillDrag((prev) => prev ? { ...prev, target: { row: rowIndex, column: colIndex } } : prev)
  }

  const gridFillClassName = (rowIndex: number, colIndex: number) => fillDrag
    ? getGridFillRangeCellClasses(rowIndex, colIndex, fillDrag.selection, fillDrag.target)
    : ''

  const handleAddRow = async () => {
    if (!projectId) return
    pushUndo(snapshotGridRows(rows))
    setCreating(true)
    setError(null)
    try {
      const created = await recordsService.createRecord('CadIndexItem', { data: { project: projectId, reportType: activeReportType } })
      if (created) setRows((prev) => [...prev, created])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add row')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRow = async (row: RecordData) => {
    if (!window.confirm('Delete this row? This cannot be undone.')) return
    clearUndo()
    setDeletingRowId(row.id)
    setError(null)
    try {
      await recordsService.deleteRecord('CadIndexItem', row.id)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      setSelection(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete row')
    } finally {
      setDeletingRowId(null)
    }
  }

  const handlePreviewPdf = async () => {
    if (generatingPdf) return
    const previewWindow = window.open('', '_blank')
    setGeneratingPdf(true)
    setError(null)
    try {
      const projectName = record ? getRecordName(record as Record<string, unknown>) : 'Project'
      const payloadRows = activeRows.map((row) => {
        const out: Record<string, unknown> = {}
        for (const col of columns) out[col.key] = row.data?.[col.key]
        return out
      })
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const token = apiClient.getToken()
      const response = await fetch(`${apiBase}/cad-index-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: activeReportType,
          projectName,
          columns: columns.map((c) => ({ key: c.key, label: c.label, type: c.type })),
          rows: payloadRows,
          comments: comments[activeReportType] ?? '',
        }),
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
        link.download = `${activeReportType.replace(/\s+/g, '_')}.pdf`
        link.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err: unknown) {
      previewWindow?.close()
      setError(err instanceof Error ? err.message : 'Failed to generate CAD Index List PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="space-y-3" onKeyDown={handleGridUndoKeyDown}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-brand-navy" />
          <div>
            <h3 className="text-sm font-bold text-brand-navy">CAD Index List</h3>
            <p className="text-xs text-gray-500">{activeRows.length} row{activeRows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePreviewPdf()}
            disabled={generatingPdf}
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {generatingPdf ? 'Preparing PDF…' : 'Preview PDF'}
          </button>
          <button
            type="button"
            onClick={() => void handleAddRow()}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Row
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {REPORT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => { setActiveReportType(type); setDraggedColumnKey(null); setDropBoundary(null); setAddingColumn(false) }}
              disabled={savingColumns || savingComments}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeReportType === type
                  ? 'bg-brand-navy text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAddingColumn((current) => !current)} disabled={savingColumns || !projectId} className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> Add Column
          </button>
          <button
            type="button"
            onClick={handleResetColumns}
            disabled={savingColumns || !projectId || columns.every((column, index) => column.key === REPORT_COLUMNS[activeReportType][index]?.key)}
            title="Reset this report's columns to their default order"
            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
          </button>
        </div>
      </div>

      {addingColumn && (
        <form onSubmit={handleAddColumn} className="flex flex-wrap items-end gap-2 rounded border border-gray-200 bg-gray-50 p-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Column name
            <input autoFocus required maxLength={80} value={newColumnLabel} onChange={(event) => setNewColumnLabel(event.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
            Type
            <select value={newColumnType} onChange={(event) => setNewColumnType(event.target.value as ColumnType)} className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs">
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="checkbox">Checkbox</option>
            </select>
          </label>
          <button type="submit" disabled={savingColumns || !newColumnLabel.trim()} className="rounded bg-brand-navy px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40">Add</button>
          <button type="button" onClick={() => setAddingColumn(false)} className="rounded px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-200">Cancel</button>
        </form>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-brand-navy" />
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-lg border border-gray-200"
          onMouseUp={() => {
            selectingCellsRef.current = false
            if (selection) focusGridCell(selection.focus)
          }}
          onMouseLeave={() => { selectingCellsRef.current = false }}
        >
          <table
            ref={gridTableRef}
            role="grid"
            aria-label={`${activeReportType} spreadsheet`}
            aria-multiselectable="true"
            onCopy={(event) => handleGridCopy(event)}
            onCut={(event) => handleGridCopy(event, true)}
            onPaste={handleGridPaste}
            className="w-full border-collapse text-xs"
          >
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="sticky left-0 z-20 w-9 border-b border-r border-gray-200 bg-gray-100 px-1 py-1 text-center font-medium text-gray-400">#</th>
                {columns.map((col, colIndex) => (
                  <th
                    key={col.key}
                    scope="col"
                    draggable={!savingColumns}
                    onDragStart={(event) => {
                      setDraggedColumnKey(col.key)
                      setDropBoundary(null)
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', col.key)
                    }}
                    onDragOver={(event) => {
                      if (!draggedColumnKey) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      const edge = event.clientX < event.currentTarget.getBoundingClientRect().left + event.currentTarget.offsetWidth / 2 ? 'before' : 'after'
                      const boundary = colIndex + (edge === 'after' ? 1 : 0)
                      const fromIndex = columns.findIndex((column) => column.key === draggedColumnKey)
                      setDropBoundary(fromIndex === boundary || fromIndex + 1 === boundary ? null : { index: colIndex, edge })
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropBoundary(null)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const fromIndex = columns.findIndex((column) => column.key === event.dataTransfer.getData('text/plain'))
                      const after = event.clientX >= event.currentTarget.getBoundingClientRect().left + event.currentTarget.offsetWidth / 2
                      const boundary = colIndex + (after ? 1 : 0)
                      moveColumn(fromIndex, boundary - (fromIndex < boundary ? 1 : 0))
                      setDraggedColumnKey(null)
                      setDropBoundary(null)
                    }}
                    onDragEnd={() => { setDraggedColumnKey(null); setDropBoundary(null) }}
                    className={`group relative border-b border-gray-200 px-1.5 py-1 text-left font-semibold text-gray-600 ${draggedColumnKey === col.key ? 'opacity-40' : ''}`}
                  >
                    {dropBoundary?.index === colIndex && (
                      <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 z-10 w-[3px] bg-blue-600 ${dropBoundary.edge === 'before' ? 'left-0' : 'right-0'}`} />
                    )}
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-gray-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1">{col.label}</span>
                      {col.key.startsWith('cadCustom_') && (
                        <>
                          <button type="button" onClick={() => handleRenameColumn(col)} disabled={savingColumns} aria-label={`Rename ${col.label} column`} title="Rename column" className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30"><Pencil className="h-3 w-3" /></button>
                          <button type="button" onClick={() => handleRemoveColumn(col)} disabled={savingColumns} aria-label={`Remove ${col.label} column`} title="Remove column" className="rounded p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3 w-3" /></button>
                        </>
                      )}
                      <button type="button" onClick={() => moveColumn(colIndex, colIndex - 1)} disabled={savingColumns || colIndex === 0} aria-label={`Move ${col.label} column left`} title="Move column left" className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30"><ChevronLeft className="h-3 w-3" /></button>
                      <button type="button" onClick={() => moveColumn(colIndex, colIndex + 1)} disabled={savingColumns || colIndex === columns.length - 1} aria-label={`Move ${col.label} column right`} title="Move column right" className="rounded p-0.5 text-gray-400 hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="h-3 w-3" /></button>
                    </div>
                  </th>
                ))}
                <th className="w-8 border-b border-gray-200 px-1 py-1" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="py-8 text-center text-sm text-gray-400">No rows yet for this report.</td>
                </tr>
              )}
              {activeRows.map((row, rowIndex) => (
                <tr key={row.id} className="hover:bg-brand-navy/5">
                  <th scope="row" className="sticky left-0 z-10 w-9 border-b border-r border-gray-100 bg-gray-50 px-1 py-1 text-center font-normal tabular-nums text-gray-400">{rowIndex + 1}</th>
                  {columns.map((col, colIndex) => {
                    const cellId = `${row.id}:${col.key}`
                    return (
                      <td
                        key={col.key}
                        role="gridcell"
                        data-grid-row={rowIndex}
                        data-grid-column={colIndex}
                        tabIndex={selection?.focus.row === rowIndex && selection.focus.column === colIndex ? 0 : -1}
                        aria-selected={selection ? isInGridSelection(rowIndex, colIndex, selection) : false}
                        onMouseDown={(event) => {
                          if (event.button !== 0) return
                          const coordinate = { row: rowIndex, column: colIndex }
                          setSelection((current) => event.shiftKey && current
                            ? { ...current, focus: coordinate }
                            : { anchor: coordinate, focus: coordinate })
                          selectingCellsRef.current = true
                          if (!(event.target instanceof HTMLInputElement)) {
                            event.preventDefault()
                            event.currentTarget.focus()
                          }
                        }}
                        onMouseEnter={() => {
                          handleFillDragEnter(rowIndex, colIndex)
                          if (selectingCellsRef.current) setSelection((current) => current
                            ? { ...current, focus: { row: rowIndex, column: colIndex } }
                            : { anchor: { row: rowIndex, column: colIndex }, focus: { row: rowIndex, column: colIndex } })
                        }}
                        onKeyDown={(event) => handleGridKeyDown(event, rowIndex, colIndex)}
                        className={`relative border-b border-gray-100 px-1.5 py-1 align-top outline-none ${
                          selection && isInGridSelection(rowIndex, colIndex, selection)
                            ? 'bg-[#e2f0d9]'
                            : ''
                        } ${gridFillClassName(rowIndex, colIndex)}`}
                      >
                        <GridRangeDecoration row={rowIndex} column={colIndex} selection={selection} copiedSelection={copiedSelection} />
                        {col.type === 'checkbox' ? (
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={!!row.data?.[col.key]}
                              disabled={savingRowId === row.id}
                              onChange={(e) => void handleCellCommit(row.id, col.key, e.target.checked)}
                              aria-label={`${col.label}, row ${rowIndex + 1}`}
                              className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy disabled:opacity-60"
                            />
                          </div>
                        ) : (
                          <>
                            <TextCell
                              value={row.data?.[col.key]}
                              type={col.type}
                              multiline={col.multiline}
                              saving={savingRowId === row.id}
                              editing={editingCellId === cellId}
                              editSeed={editingCellId === cellId ? editSeed : null}
                              onStartEdit={() => beginCellEdit(rowIndex, colIndex)}
                              onCommit={(value) => void handleCellCommit(row.id, col.key, col.type === 'number' ? (value === '' ? '' : Number(value)) : value)}
                              onCancel={() => { setEditingCellId(null); setEditSeed(null) }}
                            />
                          </>
                        )}
                        {selection && editingCellId === null && getGridSelectionBounds(selection).bottom === rowIndex && getGridSelectionBounds(selection).right === colIndex && (
                          <span
                            onMouseDown={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              setFillDrag({ selection, target: { row: rowIndex, column: colIndex } })
                            }}
                            aria-hidden="true"
                            className="absolute bottom-0 right-0 h-2 w-2 cursor-crosshair rounded-[1px] bg-green-600"
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="border-b border-gray-100 px-1 py-1 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => void handleDeleteRow(row)}
                      disabled={deletingRowId === row.id || savingRowId === row.id}
                      aria-label="Delete row"
                      title="Delete row"
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      {deletingRowId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex min-h-7 items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
            <span className="font-mono font-medium text-gray-700">
              {selection
                ? (() => {
                    const bounds = getGridSelectionBounds(selection)
                    const first = `${spreadsheetColumnLabel(bounds.left)}${bounds.top + 1}`
                    const last = `${spreadsheetColumnLabel(bounds.right)}${bounds.bottom + 1}`
                    return first === last ? first : `${first}:${last}`
                  })()
                : ' '}
            </span>
            <span>
              {selection
                ? `${(Math.abs(selection.focus.row - selection.anchor.row) + 1) * (Math.abs(selection.focus.column - selection.anchor.column) + 1)} cells selected`
                : ''}
            </span>
            <span>{savingRowId ? 'Saving…' : ' '}</span>
          </div>
        </div>
      )}
      {!loading && (
        <label className="block space-y-1.5">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            Additional Comments
            {savingComments && <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-navy" />}
          </span>
          <textarea
            rows={4}
            maxLength={10000}
            value={comments[activeReportType] ?? ''}
            onChange={(event) => setComments((current) => ({ ...current, [activeReportType]: event.target.value }))}
            onBlur={(event) => void persistComments(activeReportType, event.target.value)}
            placeholder={`Additional comments for ${activeReportType}`}
            className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/30"
          />
        </label>
      )}
      <GridRangeStyles />
    </div>
  )
}
