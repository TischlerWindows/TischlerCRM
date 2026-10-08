'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Calculator, Check, FileText, Loader2, Save } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'
import { recordsService } from '@/lib/records-service'
import { getRecordName } from '../shared/recordName'
import {
  getGridFillRangeCellClasses,
  getGridFillTargets,
  getGridSelectionBounds,
  getGridSelectionOrigin,
  isCaretAtHorizontalEdge,
  isInGridSelection,
  parseGridClipboard,
  serializeGridClipboard,
  spreadsheetColumnLabel,
  tileGridClipboardToSelection,
  type GridCoordinate,
  type GridSelection,
} from '@/lib/cad-index-grid'
import { useGridUndo } from '@/lib/use-grid-undo'
import { GridRangeDecoration, GridRangeStyles } from '../shared/grid-range-decoration'
import { readProjectField } from '@/lib/factory-order-spec'
import { normalizeSingleLookupUserValue, type LookupUserIdentity } from '@/lib/user-lookup'
import {
  calculateMaterialTotal, formatMaterialTotal, generateInstallationMaterialWorkbookQuantities,
  INSTALLATION_MATERIAL_TEMPLATES, INSTALLATION_METHODS, MATERIAL_SOURCES, parseInstallationMaterialWorkbook,
  type InstallationMaterial, type InstallationMaterialRow, type InstallationMaterialWorkbook,
} from '@/lib/installation-material'

const inputClass = 'w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-brand-navy focus:outline-none'

interface MaterialFillDrag {
  template: InstallationMaterialWorkbook['activeTemplate']
  selection: GridSelection
  target: GridCoordinate
}

function hydrateWorkbook(
  value: InstallationMaterialWorkbook,
  defaults: { factory: string; location: string; projectManager: string; attn: string },
): InstallationMaterialWorkbook {
  return {
    ...value,
    sheets: Object.fromEntries(INSTALLATION_MATERIAL_TEMPLATES.map(template => {
      const sheet = value.sheets[template]
      return [template, {
        ...sheet,
        factory: sheet.factory || defaults.factory,
        location: sheet.location || defaults.location,
        projectManager: sheet.projectManager || defaults.projectManager,
        attn: sheet.attn || defaults.attn,
      }]
    })) as InstallationMaterialWorkbook['sheets'],
  }
}

export default function InstallationMaterialWidget({ record, object, onRecordChange }: WidgetProps) {
  const projectId = record?.id ? String(record.id) : ''
  const recordData = record as Record<string, unknown>
  const projectName = getRecordName(recordData)
  const raw = record?.installationMaterialForm ?? record?.Project__installationMaterialForm
  const location = String(recordData.location ?? recordData.Project__location ?? '')
  const managerValue = readProjectField(recordData, 'internal_project_manager')
  const attn = String(recordData.attn ?? recordData.Project__attn ?? '')
  const [workbook, setWorkbook] = useState<InstallationMaterialWorkbook>(() =>
    hydrateWorkbook(parseInstallationMaterialWorkbook(raw, projectName), {
      factory: '', location, projectManager: '', attn,
    }),
  )
  const form = workbook.sheets[workbook.activeTemplate]
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [generatingQuantities, setGeneratingQuantities] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantityMessage, setQuantityMessage] = useState<string | null>(null)
  const [fillDrag, setFillDrag] = useState<MaterialFillDrag | null>(null)
  const [gridSelection, setGridSelection] = useState<GridSelection | null>(null)
  const [copiedGridSelection, setCopiedGridSelection] = useState<GridSelection | null>(null)
  const { pushUndo, popUndo, clearUndo } = useGridUndo<InstallationMaterialWorkbook>()
  const gridTableRef = useRef<HTMLTableElement>(null)
  const selectingGridRef = useRef(false)

  useEffect(() => {
    if (!fillDrag) return
    const onMouseUp = () => {
      const drag = fillDrag
      setFillDrag(null)
      const fields = drag.template === 'US Supplied Inst.'
        ? ['qty', 'units', 'description', 'unitPrice', 'total']
        : ['qty', 'units', 'description', 'screwSize', 'unitPrice', 'total']
      const patches = new Map<number, Partial<InstallationMaterialRow>>()
      const sourceRows = workbook.sheets[drag.template].rows
      for (const target of getGridFillTargets(drag.selection, drag.target)) {
        const field = fields[target.column]
        const sourceField = fields[target.sourceColumn]
        if ((field !== 'qty' && field !== 'unitPrice')
          || (sourceField !== 'qty' && sourceField !== 'unitPrice')) continue
        const sourceRow = sourceRows[target.sourceRow]
        if (!sourceRow) continue
        const patch = patches.get(target.row) ?? {}
        patch[field] = sourceRow[field]
        patches.set(target.row, patch)
      }
      if (!patches.size) return
      pushUndo(structuredClone(workbook))
      setWorkbook(current => ({
        ...current,
        sheets: {
          ...current.sheets,
          [drag.template]: {
            ...current.sheets[drag.template],
            rows: current.sheets[drag.template].rows.map((row, index) =>
              patches.has(index) ? { ...row, ...patches.get(index) } : row,
            ),
          },
        },
      }))
      setDirty(true)
      setSaved(false)
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [fillDrag, workbook, pushUndo])

  useEffect(() => {
    setWorkbook(hydrateWorkbook(parseInstallationMaterialWorkbook(raw, projectName), {
      factory: '', location, projectManager: '', attn,
    }))
    setDirty(false)
    setSaved(false)
    clearUndo()
    setFillDrag(null)
  }, [projectId, raw, projectName, location, attn, clearUndo])

  useEffect(() => {
    setGridSelection(null)
    setCopiedGridSelection(null)
    setFillDrag(null)
  }, [workbook.activeTemplate])

  useEffect(() => {
    if (!managerValue) return
    let cancelled = false
    apiClient.get<LookupUserIdentity[]>('/users/lookup')
      .then(users => {
        if (cancelled) return
        const managerId = normalizeSingleLookupUserValue(managerValue, users)
        const selectedManager = users.find(user => user.id === managerId)
        const managerName = selectedManager?.name || selectedManager?.email || ''
        if (!managerName) return
        setWorkbook(current => ({
          ...current,
          sheets: Object.fromEntries(INSTALLATION_MATERIAL_TEMPLATES.map(template => {
            const sheet = current.sheets[template]
            return [template, { ...sheet, projectManager: sheet.projectManager || managerName }]
          })) as InstallationMaterialWorkbook['sheets'],
        }))
      })
      .catch(() => { /* Keep the field blank when the internal manager lookup cannot resolve. */ })
    return () => { cancelled = true }
  }, [managerValue, projectId])

  const update = (patch: Partial<InstallationMaterial>) => {
    pushUndo(structuredClone(workbook))
    setWorkbook(current => ({
      ...current,
      sheets: {
        ...current.sheets,
        [current.activeTemplate]: { ...current.sheets[current.activeTemplate], ...patch },
      },
    }))
    setDirty(true)
    setSaved(false)
  }

  const selectSheet = (template: typeof INSTALLATION_MATERIAL_TEMPLATES[number]) => {
    if (template !== workbook.activeTemplate) pushUndo(structuredClone(workbook))
    setWorkbook(current => ({ ...current, activeTemplate: template }))
    setDirty(true)
    setSaved(false)
    setQuantityMessage(null)
  }

  const generateQuantities = async () => {
    if (!projectId || generatingQuantities) return
    setGeneratingQuantities(true)
    setError(null)
    setQuantityMessage(null)
    try {
      const autocadRows = await recordsService.getRecords('AutoCad', { filter: { project: projectId } })
      const generated = generateInstallationMaterialWorkbookQuantities(workbook.sheets, autocadRows.map(row => ({
        fastener: row.data?.fastener,
        totalQty: row.data?.totalQty,
      })))
      if (generated.matchedFasteners > 0) {
        pushUndo(structuredClone(workbook))
        setWorkbook(current => ({
          ...current,
          sheets: generateInstallationMaterialWorkbookQuantities(current.sheets, autocadRows.map(row => ({
            fastener: row.data?.fastener,
            totalQty: row.data?.totalQty,
          }))).sheets,
        }))
        setDirty(true)
        setSaved(false)
      }
      const notes = [
        `${generated.matchedFasteners} AutoCad worksheet match${generated.matchedFasteners === 1 ? '' : 'es'}.`,
        generated.ambiguousFasteners.length ? `${generated.ambiguousFasteners.length} ambiguous sheet match${generated.ambiguousFasteners.length === 1 ? '' : 'es'} skipped.` : '',
        generated.unmatchedFasteners.length ? `${generated.unmatchedFasteners.length} unmatched item${generated.unmatchedFasteners.length === 1 ? '' : 's'} skipped.` : '',
      ].filter(Boolean)
      setQuantityMessage(notes.join(' '))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to generate quantities from AutoCad')
    } finally {
      setGeneratingQuantities(false)
    }
  }

  const updateRow = (index: number, patch: Partial<InstallationMaterialRow>) => {
    if (Object.keys(patch).some(field => field !== 'qty' && field !== 'unitPrice')) return
    update({ rows: form.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) })
  }

  const save = async () => {
    if (!projectId || saving) return
    setSaving(true)
    setError(null)
    try {
      const value = JSON.stringify(workbook)
      await recordsService.updateRecord('Project', projectId, { data: { installationMaterialForm: value } })
      onRecordChange?.({ installationMaterialForm: value })
      setDirty(false)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save installation material')
    } finally {
      setSaving(false)
    }
  }

  const previewPdf = async () => {
    const previewWindow = window.open('', '_blank')
    setPreviewing(true)
    setError(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const token = apiClient.getToken()
      const response = await fetch(`${apiBase}/installation-material-pdf/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ form, projectName }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(detail.error || 'Failed to render installation material PDF')
      }
      const url = URL.createObjectURL(await response.blob())
      if (previewWindow && !previewWindow.closed) previewWindow.location.href = url
      else {
        const link = document.createElement('a')
        link.href = url
        link.download = 'Installation_Material.pdf'
        link.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (cause) {
      previewWindow?.close()
      setError(cause instanceof Error ? cause.message : 'Failed to generate installation material PDF')
    } finally {
      setPreviewing(false)
    }
  }

  const total = form.rows.reduce((sum, row) => sum + calculateMaterialTotal(row), 0)
  const lockFixedColumns = true
  const isUsSupplied = form.template === 'US Supplied Inst.'
  const currencySymbol = isUsSupplied ? '$' : '€'
  const toggleOption = (current: string[], option: string) => current.includes(option)
    ? current.filter(value => value !== option)
    : [...current, option]

  const materialGridColumns = isUsSupplied
    ? ['qty', 'units', 'description', 'unitPrice', 'total']
    : ['qty', 'units', 'description', 'screwSize', 'unitPrice', 'total']

  const focusMaterialCell = (coordinate: GridCoordinate) => {
    requestAnimationFrame(() => {
      const cell = gridTableRef.current?.querySelector<HTMLElement>(`[data-grid-row="${coordinate.row}"][data-grid-column="${coordinate.column}"]`)
      const input = cell?.querySelector<HTMLInputElement>('input:not([disabled])')
      ;(input ?? cell)?.focus()
    })
  }

  const selectMaterialCell = (coordinate: GridCoordinate, extend = false) => {
    setGridSelection(current => extend && current ? { ...current, focus: coordinate } : { anchor: coordinate, focus: coordinate })
    focusMaterialCell(coordinate)
  }

  const navigateMaterialGrid = (row: number, column: number, direction: 'left' | 'right' | 'up' | 'down', extend = false) => {
    let nextRow = row + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0)
    let nextColumn = column + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0)
    if (nextColumn < 0) { nextColumn = materialGridColumns.length - 1; nextRow -= 1 }
    if (nextColumn >= materialGridColumns.length) { nextColumn = 0; nextRow += 1 }
    nextRow = Math.max(0, Math.min(nextRow, form.rows.length - 1))
    nextColumn = Math.max(0, Math.min(nextColumn, materialGridColumns.length - 1))
    selectMaterialCell({ row: nextRow, column: nextColumn }, extend)
  }

  const materialCellValue = (row: InstallationMaterialRow, column: string): string => {
    if (column === 'total') {
      const rowTotal = calculateMaterialTotal(row)
      return rowTotal ? formatMaterialTotal(rowTotal) : ''
    }
    return row[column as keyof InstallationMaterialRow] ?? ''
  }

  const applyMaterialClipboard = (start: GridCoordinate, matrix: string[][]) => {
    const template = workbook.activeTemplate
    let skippedCount = 0
    let changed = false
    const nextRows = form.rows.map((row, rowIndex) => {
      const rowOffset = rowIndex - start.row
      if (rowOffset < 0 || rowOffset >= matrix.length) return row
      let nextRow = row
      matrix[rowOffset]?.forEach((value, columnOffset) => {
        const column = materialGridColumns[start.column + columnOffset]
        if (column === 'qty' || column === 'unitPrice') {
          if (nextRow[column] !== value) {
            nextRow = { ...nextRow, [column]: value }
            changed = true
          }
        } else if (column) {
          skippedCount += 1
        }
      })
      return nextRow
    })

    matrix.forEach((row, rowOffset) => {
      if (start.row + rowOffset >= form.rows.length) skippedCount += row.length
    })

    if (changed) {
      pushUndo(structuredClone(workbook))
      setWorkbook(current => ({
        ...current,
        sheets: { ...current.sheets, [template]: { ...current.sheets[template], rows: nextRows } },
      }))
      setDirty(true)
      setSaved(false)
    }
    const lastRow = Math.min(form.rows.length - 1, start.row + matrix.length - 1)
    const lastColumn = Math.min(materialGridColumns.length - 1, start.column + Math.max(...matrix.map(row => row.length)) - 1)
    setGridSelection({ anchor: { row: lastRow, column: lastColumn }, focus: start })
    focusMaterialCell(start)
    if (skippedCount) setError(`${skippedCount} pasted cell${skippedCount === 1 ? '' : 's'} skipped because the column is read-only or outside this sheet`)
  }

  const materialClipboardMatrix = (selection: GridSelection): unknown[][] => {
    const bounds = getGridSelectionBounds(selection)
    return form.rows.slice(bounds.top, bounds.bottom + 1).map(row =>
      materialGridColumns.slice(bounds.left, bounds.right + 1).map(column => materialCellValue(row, column)),
    )
  }

  const handleMaterialCopy = (event: React.ClipboardEvent<HTMLTableElement>, cut = false) => {
    if (!gridSelection) return
    event.clipboardData.setData('text/plain', serializeGridClipboard(materialClipboardMatrix(gridSelection)))
    event.preventDefault()
    setCopiedGridSelection(gridSelection)
    if (cut) {
      const bounds = getGridSelectionBounds(gridSelection)
      applyMaterialClipboard({ row: bounds.top, column: bounds.left }, Array.from(
        { length: bounds.bottom - bounds.top + 1 },
        () => Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
      ))
    }
  }

  const handleMaterialPaste = (event: React.ClipboardEvent<HTMLTableElement>) => {
    if (!gridSelection) return
    event.preventDefault()
    setCopiedGridSelection(null)
    const matrix = tileGridClipboardToSelection(parseGridClipboard(event.clipboardData.getData('text/plain')), gridSelection)
    applyMaterialClipboard(getGridSelectionOrigin(gridSelection), matrix)
  }

  const handleMaterialGridKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>, row: number, column: number) => {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
      && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault()
      undoMaterialAction()
      return
    }
    if (event.key === 'Escape' && copiedGridSelection) { setCopiedGridSelection(null); return }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      if (form.rows.length) setGridSelection({ anchor: { row: form.rows.length - 1, column: materialGridColumns.length - 1 }, focus: { row: 0, column: 0 } })
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const input = event.target instanceof HTMLInputElement ? event.target : null
      const direction = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null
      const horizontalAtEdge = direction && input
        && isCaretAtHorizontalEdge(input.value, input.selectionStart, input.selectionEnd, direction)
      const atEdge = !input || event.key === 'ArrowUp' || event.key === 'ArrowDown'
        || !!horizontalAtEdge
      if (event.shiftKey || atEdge) {
        event.preventDefault()
        navigateMaterialGrid(row, column, event.key.slice(5).toLowerCase() as 'left' | 'right' | 'up' | 'down', event.shiftKey)
      }
      return
    }
    if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      navigateMaterialGrid(row, column, event.key === 'Enter' ? 'down' : event.shiftKey ? 'left' : 'right')
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      if (gridSelection) {
        const bounds = getGridSelectionBounds(gridSelection)
        applyMaterialClipboard({ row: bounds.top, column: bounds.left }, Array.from(
          { length: bounds.bottom - bounds.top + 1 },
          () => Array.from({ length: bounds.right - bounds.left + 1 }, () => ''),
        ))
      }
    }
  }

  const undoMaterialAction = () => {
    const previous = popUndo()
    if (!previous) return
    setWorkbook(previous)
    setDirty(true)
    setSaved(false)
    setGridSelection(null)
    setCopiedGridSelection(null)
    setError(null)
  }

  const handleUndoKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (event.defaultPrevented || target.matches('input, textarea, select') || target.isContentEditable) return
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      undoMaterialAction()
    }
  }

  const fillPreviewClassName = (row: number, column: number) =>
    fillDrag?.template === workbook.activeTemplate
      ? getGridFillRangeCellClasses(row, column, fillDrag.selection, fillDrag.target)
      : ''

  const isFillTargetCell = (row: number, column: number) =>
    fillPreviewClassName(row, column).includes('bg-gray-300')

  const gridCellClassName = (row: number, column: number, extra = '') =>
    `${extra} ${gridSelection && isInGridSelection(row, column, gridSelection) ? 'bg-[#e2f0d9]' : ''} ${fillPreviewClassName(row, column)}`

  const renderFillHandle = (row: number, column: number) => {
    if (!gridSelection || fillDrag || !form.rows.length) return null
    const bounds = getGridSelectionBounds(gridSelection)
    if (bounds.bottom !== row || bounds.right !== column) return null
    return (
      <span
        onMouseDown={event => {
          event.preventDefault()
          event.stopPropagation()
          setFillDrag({ template: workbook.activeTemplate, selection: gridSelection, target: { row, column } })
        }}
        aria-hidden="true"
        className="absolute bottom-0 right-0 z-30 h-2 w-2 cursor-crosshair border border-white bg-[#217346]"
      />
    )
  }

  const gridCellProps = (row: number, column: number): React.TdHTMLAttributes<HTMLTableCellElement> => ({
    role: 'gridcell',
    'data-grid-row': row,
    'data-grid-column': column,
    tabIndex: gridSelection?.focus.row === row && gridSelection.focus.column === column ? 0 : -1,
    'aria-selected': gridSelection ? isInGridSelection(row, column, gridSelection) : false,
    onMouseDown: event => {
      if (event.button !== 0) return
      const coordinate = { row, column }
      setGridSelection(current => event.shiftKey && current ? { ...current, focus: coordinate } : { anchor: coordinate, focus: coordinate })
      selectingGridRef.current = true
      if (!(event.target instanceof HTMLInputElement)) event.currentTarget.focus()
    },
    onMouseEnter: () => {
      if (fillDrag?.template === workbook.activeTemplate) {
        setFillDrag(current => current?.template === workbook.activeTemplate
          ? { ...current, target: { row, column } }
          : current)
      } else if (selectingGridRef.current) {
        setGridSelection(current => current
          ? { ...current, focus: { row, column } }
          : { anchor: { row, column }, focus: { row, column } })
      }
    },
    onKeyDown: event => handleMaterialGridKeyDown(event, row, column),
  })

  if (object.apiName !== 'Project') return <p className="text-sm text-amber-700">Installation Material is available on Project records only.</p>

  return (
    <div className="space-y-4 text-sm text-gray-800" onKeyDown={handleUndoKeyDown}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-brand-navy">Installation Material</h2>
          <p className="text-xs text-gray-500">{projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && !dirty && <span role="status" className="inline-flex items-center gap-1 text-xs text-green-700"><Check className="h-4 w-4" /> Saved</span>}
          <button type="button" onClick={() => void generateQuantities()} disabled={!projectId || generatingQuantities} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40">
            {generatingQuantities ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}{generatingQuantities ? 'Generating' : 'Generate Quantities'}
          </button>
          <button type="button" onClick={() => void previewPdf()} disabled={previewing} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{previewing ? 'Preparing PDF' : 'Preview PDF'}
          </button>
          <button type="button" onClick={() => void save()} disabled={!projectId || !dirty || saving} className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving' : 'Save Materials'}
          </button>
        </div>
      </div>
      {error && <div role="alert" className="flex items-center gap-2 border border-red-200 bg-red-50 p-2 text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
      {quantityMessage && <div role="status" className="border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">{quantityMessage}</div>}

      <div className="space-y-4">
        <div role="tablist" aria-label="Installation Material sheets" className="flex overflow-x-auto border-b border-gray-300">
          {INSTALLATION_MATERIAL_TEMPLATES.map(template => (
            <button
              key={template}
              id={`installation-material-tab-${template}`}
              type="button"
              role="tab"
              aria-selected={workbook.activeTemplate === template}
              onClick={() => selectSheet(template)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${workbook.activeTemplate === template ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {template}
            </button>
          ))}
        </div>

      <div role="tabpanel" aria-labelledby={`installation-material-tab-${workbook.activeTemplate}`} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded border border-gray-200 p-3">
          <label className="block text-xs font-semibold uppercase text-gray-600">Date
            <input type="date" className={`${inputClass} mt-1`} value={form.date} onChange={event => update({ date: event.target.value })} />
          </label>
          {([
            ['factory', 'Factory'], ['project', 'Project'], ['location', 'Location'],
            ['projectManager', 'Project Manager'], ['attn', 'Attn.'],
          ] as const).map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold uppercase text-gray-600">{label}
              <input className={`${inputClass} mt-1`} value={form[key]} onChange={event => update({ [key]: event.target.value })} />
            </label>
          ))}
        </section>
        <section className="space-y-4 rounded border border-gray-200 p-3">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase text-gray-700">Installation</legend>
            <div className="space-y-2">
              {INSTALLATION_METHODS.map(option => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.installationBy.includes(option)} onChange={() => update({ installationBy: toggleOption(form.installationBy, option) })} className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy" />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase text-gray-700">To be ordered from</legend>
            <div className="grid grid-cols-2 gap-2">
              {MATERIAL_SOURCES.map(option => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.orderedFrom.includes(option)} onChange={() => update({ orderedFrom: toggleOption(form.orderedFrom, option) })} className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy" />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        </div>

      <section
        className="overflow-x-auto border border-gray-300"
        onMouseUp={() => { selectingGridRef.current = false }}
        onMouseLeave={() => { selectingGridRef.current = false }}
      >
        <table
          ref={gridTableRef}
          role="grid"
          aria-label={`${workbook.activeTemplate} installation materials spreadsheet`}
          aria-multiselectable="true"
          onCopy={event => handleMaterialCopy(event)}
          onCut={event => handleMaterialCopy(event, true)}
          onPaste={handleMaterialPaste}
          className={`w-full ${isUsSupplied ? 'min-w-[920px]' : 'min-w-[1000px]'} border-collapse text-left text-xs`}
        >
          <thead className="bg-brand-navy text-white"><tr>
            <th className="sticky left-0 z-20 w-9 border border-gray-400 bg-brand-navy px-1 py-2 text-center">#</th>
            <th className="w-16 border border-gray-400 px-2 py-2">Qty.</th>
            <th className={`${isUsSupplied ? 'w-32' : 'w-20'} border border-gray-400 px-2 py-2`}>Units</th>
            <th className="border border-gray-400 px-2 py-2">Description</th>
            {!isUsSupplied && <th className="w-32 border border-gray-400 px-2 py-2">US Screw Size</th>}
            <th className="w-32 border border-gray-400 px-2 py-2">Unit Price ({currencySymbol})</th>
            <th className="w-32 border border-gray-400 px-2 py-2">TOTAL ({currencySymbol})</th>
          </tr></thead>
          <tbody>
            {form.rows.map((row, index) => {
              const rowTotal = calculateMaterialTotal(row)
              return <tr key={index} className="h-9">
                <th scope="row" className="sticky left-0 z-10 border border-gray-300 bg-gray-50 px-1 text-center font-normal tabular-nums text-gray-500">{index + 1}</th>
                <td
                  {...gridCellProps(index, 0)}
                  className={gridCellClassName(index, 0, 'relative border border-gray-300 bg-yellow-100 p-1')}
                >
                  <GridRangeDecoration row={index} column={0} selection={gridSelection} copiedSelection={copiedGridSelection} />
                  <input
                    aria-label={`Quantity row ${index + 1}`}
                    className={`${inputClass} ${isFillTargetCell(index, 0) ? '!bg-gray-300' : ''}`}
                    value={row.qty}
                    onChange={event => updateRow(index, { qty: event.target.value })}
                  />
                  {renderFillHandle(index, 0)}
                </td>
                <td {...gridCellProps(index, 1)} className={gridCellClassName(index, 1, 'relative border border-gray-300 p-1')}><GridRangeDecoration row={index} column={1} selection={gridSelection} copiedSelection={copiedGridSelection} /><input aria-label={`Units row ${index + 1}`} disabled={lockFixedColumns} className={`${inputClass} ${isFillTargetCell(index, 1) ? '!bg-gray-300' : ''} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-600`} value={row.units} onChange={event => updateRow(index, { units: event.target.value })} />{renderFillHandle(index, 1)}</td>
                <td {...gridCellProps(index, 2)} className={gridCellClassName(index, 2, 'relative border border-gray-300 p-1')}><GridRangeDecoration row={index} column={2} selection={gridSelection} copiedSelection={copiedGridSelection} /><input aria-label={`Description row ${index + 1}`} disabled={lockFixedColumns} className={`${inputClass} ${isFillTargetCell(index, 2) ? '!bg-gray-300' : ''} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-600`} value={row.description} onChange={event => updateRow(index, { description: event.target.value })} />{renderFillHandle(index, 2)}</td>
                {!isUsSupplied && <td {...gridCellProps(index, 3)} className={gridCellClassName(index, 3, 'relative border border-gray-300 bg-gray-100 p-1')}><GridRangeDecoration row={index} column={3} selection={gridSelection} copiedSelection={copiedGridSelection} /><input aria-label={`US screw size row ${index + 1}`} disabled={lockFixedColumns} className={`${inputClass} ${isFillTargetCell(index, 3) ? '!bg-gray-300' : ''} disabled:cursor-not-allowed disabled:text-gray-600`} value={row.screwSize} onChange={event => updateRow(index, { screwSize: event.target.value })} />{renderFillHandle(index, 3)}</td>}
                <td {...gridCellProps(index, isUsSupplied ? 3 : 4)} className={gridCellClassName(index, isUsSupplied ? 3 : 4, 'relative border border-gray-300 p-1')}><GridRangeDecoration row={index} column={isUsSupplied ? 3 : 4} selection={gridSelection} copiedSelection={copiedGridSelection} /><input aria-label={`Unit price row ${index + 1}`} inputMode="decimal" className={`${inputClass} text-right ${isFillTargetCell(index, isUsSupplied ? 3 : 4) ? '!bg-gray-300' : ''}`} value={row.unitPrice} onChange={event => updateRow(index, { unitPrice: event.target.value })} />{renderFillHandle(index, isUsSupplied ? 3 : 4)}</td>
                <td {...gridCellProps(index, isUsSupplied ? 4 : 5)} className={gridCellClassName(index, isUsSupplied ? 4 : 5, 'relative border border-gray-300 bg-rose-200 px-2 text-right font-medium')}><GridRangeDecoration row={index} column={isUsSupplied ? 4 : 5} selection={gridSelection} copiedSelection={copiedGridSelection} />{rowTotal ? formatMaterialTotal(rowTotal) : ''}{renderFillHandle(index, isUsSupplied ? 4 : 5)}</td>
              </tr>
            })}
          </tbody>
          <tfoot><tr className="font-semibold"><td colSpan={isUsSupplied ? 5 : 6} className="border border-gray-300 px-2 py-2 text-right">Grand Total ({currencySymbol})</td><td className="border border-gray-300 bg-rose-300 px-2 py-2 text-right">{formatMaterialTotal(total)}</td></tr></tfoot>
        </table>
      </section>
      <div className="flex min-h-7 items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
        <span className="font-mono font-medium text-gray-700">{gridSelection ? `${spreadsheetColumnLabel(gridSelection.focus.column)}${gridSelection.focus.row + 1}` : ' '}</span>
        <span>{gridSelection ? `${(Math.abs(gridSelection.focus.row - gridSelection.anchor.row) + 1) * (Math.abs(gridSelection.focus.column - gridSelection.anchor.column) + 1)} cells selected` : ''}</span>
        <span>{dirty ? 'Unsaved changes' : saved ? 'Saved' : ' '}</span>
      </div>
      <GridRangeStyles />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase text-gray-600">Signature
          <input className={`${inputClass} mt-1`} value={form.signature} onChange={event => update({ signature: event.target.value })} />
        </label>
        <label className="text-xs font-semibold uppercase text-gray-600">Date
          <input type="date" className={`${inputClass} mt-1`} value={form.signatureDate} onChange={event => update({ signatureDate: event.target.value })} />
        </label>
      </div>
      </div>
      </div>
    </div>
  )
}