'use client'

/**
 * Install Progress Report widget — shop-drawing/unit install progress
 * tracker for an Installation. Progress-stage columns are dynamic (add,
 * rename, delete) — the set is stored as a JSON column-definition list on
 * the Installation record (`installProgressColumns`); each row is an
 * InstallProgressItem record with one `stage_<key>` boolean per defined
 * stage column (not declared as CustomFields — Record.data tolerates
 * arbitrary keys, same as how other widgets mirror state onto the parent).
 *
 * Rows are grouped into subtotal batches via the `groupBreak` checkbox
 * (checking it renders a subtotal row right after that row and starts a
 * new group) plus a grand total row at the end, matching the original
 * "Install Progress Report" spreadsheet's per-page subtotal + grand total.
 *
 * Stage checkboxes enforce a left-to-right progression: checking a later
 * stage marks all earlier stages complete too (and locks them); the only
 * checkbox a user can uncheck directly is the current furthest stage.
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ClipboardCheck, Loader2, Plus, Printer, Trash2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'

interface StageColumn {
  key: string
  label: string
}

const DEFAULT_STAGE_COLUMNS: StageColumn[] = [
  { key: 'openingNotReady', label: 'Opening not ready' },
  { key: 'openingReady', label: 'Opening Ready' },
  { key: 'openingPrepped', label: 'Opening prepped and waterproofed' },
  { key: 'unitInstalled', label: 'Unit Installed' },
  { key: 'unitWaterproofed', label: 'Unit Waterproofed' },
]

type TextFieldKey = 'page' | 'unitType' | 'itemId' | 'location' | 'remarks' | 'sequence'

interface TextFieldDef {
  key: TextFieldKey
  label: string
  multiline?: boolean
}

const LEADING_TEXT_FIELDS: TextFieldDef[] = [
  { key: 'page', label: 'Shop Drawing Page' },
  { key: 'unitType', label: 'Unit' },
  { key: 'itemId', label: 'Item ID' },
  { key: 'location', label: 'Location' },
]

const TRAILING_TEXT_FIELDS: TextFieldDef[] = [
  { key: 'remarks', label: 'Remarks', multiline: true },
  { key: 'sequence', label: 'Sequence' },
]

function parseStageColumns(raw: unknown): StageColumn[] {
  if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_STAGE_COLUMNS
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((c) => c && typeof c.key === 'string' && typeof c.label === 'string')) {
      return parsed.length > 0 ? parsed : DEFAULT_STAGE_COLUMNS
    }
  } catch {
    // fall through to default below
  }
  return DEFAULT_STAGE_COLUMNS
}

function slugifyColumnKey(label: string, existingKeys: Set<string>): string {
  const camel = label.trim().toLowerCase().replace(/[^a-z0-9]+(.)/g, (_m, c: string) => c.toUpperCase())
  const base = camel.replace(/[^a-zA-Z0-9]/g, '') || 'column'
  let key = base
  let n = 2
  while (existingKeys.has(key)) {
    key = `${base}${n}`
    n += 1
  }
  return key
}

/** Click-to-edit text/textarea cell — commits on blur/Enter, Escape cancels. */
function TextCell({
  value,
  multiline,
  saving,
  onCommit,
}: {
  value: unknown
  multiline?: boolean
  saving: boolean
  onCommit: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    if (saving) return
    setDraft(typeof value === 'string' ? value : String(value ?? ''))
    setEditing(true)
  }

  const commit = (next: string) => {
    setEditing(false)
    if (next !== (value ?? '')) onCommit(next)
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
          className="w-full resize-none rounded border border-brand-navy/40 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(draft) }
          else if (e.key === 'Escape') setEditing(false)
        }}
        className="w-full rounded border border-brand-navy/40 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  const display = value === undefined || value === null || value === '' ? '\u2014' : String(value)
  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={saving}
      className="w-full rounded px-1 py-0.5 text-left text-xs hover:bg-brand-navy/5 disabled:opacity-50 whitespace-normal break-words"
    >
      {display}
    </button>
  )
}

function StageColumnChip({
  column,
  onRename,
  onRemove,
}: {
  column: StageColumn
  onRename: (label: string) => void
  onRemove: () => void
}) {
  const [label, setLabel] = useState(column.label)
  useEffect(() => setLabel(column.label), [column.label])

  return (
    <span className="flex items-center gap-1 rounded border border-gray-300 bg-white py-0.5 pl-2 pr-0.5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { if (label.trim() && label !== column.label) onRename(label.trim()) }}
        className="w-32 border-none text-xs outline-none"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${column.label} column`}
        title={`Remove ${column.label} column`}
        className="rounded px-1.5 py-1 text-xs text-red-700 hover:bg-red-100"
      >
        &times;
      </button>
    </span>
  )
}

export default function InstallProgressReportWidget({ record, object }: WidgetProps) {
  const installationId = record?.id ? String(record.id) : undefined
  const [rows, setRows] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null)
  const [stageColumns, setStageColumns] = useState<StageColumn[]>(() => parseStageColumns(record?.installProgressColumns))

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await recordsService.getRecords('InstallProgressItem', { filter: { installation: installationId } }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Install Progress Report items')
    } finally {
      setLoading(false)
    }
  }, [installationId])

  useEffect(() => { void load() }, [load])

  if (object?.apiName && object.apiName !== 'Installation') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The Install Progress Report widget can only be placed on the Installation object&rsquo;s layout.
      </div>
    )
  }

  const persistStageColumns = async (next: StageColumn[]) => {
    const previous = stageColumns
    setStageColumns(next)
    if (!installationId) return
    try {
      await recordsService.updateRecord('Installation', installationId, { data: { installProgressColumns: JSON.stringify(next) } })
    } catch (err: unknown) {
      setStageColumns(previous)
      setError(err instanceof Error ? err.message : 'Failed to save progress columns')
    }
  }

  const handleAddColumn = () => {
    const label = window.prompt('Name for the new progress column:')
    if (!label || !label.trim()) return
    const key = slugifyColumnKey(label.trim(), new Set(stageColumns.map((c) => c.key)))
    void persistStageColumns([...stageColumns, { key, label: label.trim() }])
  }

  const handleRenameColumn = (key: string, newLabel: string) => {
    void persistStageColumns(stageColumns.map((c) => (c.key === key ? { ...c, label: newLabel } : c)))
  }

  const handleRemoveColumn = (key: string) => {
    const col = stageColumns.find((c) => c.key === key)
    if (!col) return
    if (!window.confirm(`Delete the "${col.label}" column? This cannot be undone.`)) return
    void persistStageColumns(stageColumns.filter((c) => c.key !== key))
  }

  const handleCellCommit = async (rowId: string, patch: Record<string, unknown>) => {
    setSavingRowId(rowId)
    setError(null)
    try {
      const updated = await recordsService.updateRecord('InstallProgressItem', rowId, { data: patch })
      if (updated) setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save change')
    } finally {
      setSavingRowId(null)
    }
  }

  const handleToggleStage = (row: RecordData, idx: number, nextChecked: boolean) => {
    const patch: Record<string, unknown> = {}
    stageColumns.forEach((c, i) => {
      const dataKey = `stage_${c.key}`
      patch[dataKey] = nextChecked
        ? (i <= idx ? true : !!row.data?.[dataKey])
        : (i < idx ? !!row.data?.[dataKey] : false)
    })
    void handleCellCommit(row.id, patch)
  }

  const handleAddRow = async () => {
    if (!installationId) return
    setCreating(true)
    setError(null)
    try {
      const created = await recordsService.createRecord('InstallProgressItem', { data: { installation: installationId } })
      if (created) setRows((prev) => [...prev, created])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add row')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRow = async (row: RecordData) => {
    if (!window.confirm('Delete this row? This cannot be undone.')) return
    setDeletingRowId(row.id)
    setError(null)
    try {
      await recordsService.deleteRecord('InstallProgressItem', row.id)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete row')
    } finally {
      setDeletingRowId(null)
    }
  }

  // Group rows into subtotal batches — a checked `groupBreak` ends the
  // current batch (and a subtotal row is rendered right after it).
  const groups: RecordData[][] = []
  let current: RecordData[] = []
  for (const row of rows) {
    current.push(row)
    if (row.data?.groupBreak) {
      groups.push(current)
      current = []
    }
  }
  if (current.length > 0) groups.push(current)

  const stageCount = (rowSet: RecordData[], key: string) => {
    const dataKey = `stage_${key}`
    return rowSet.filter((r) => !!r.data?.[dataKey]).length
  }

  return (
    <div id="install-progress-report-print-area" className="space-y-3">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #install-progress-report-print-area, #install-progress-report-print-area * { visibility: visible; }
          #install-progress-report-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-brand-navy" />
          <div>
            <h3 className="text-sm font-bold text-brand-navy">Install Progress Report</h3>
            <p className="text-xs text-gray-500">{rows.length} row{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
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

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-xs font-semibold text-gray-600">Progress columns:</span>
        {stageColumns.map((col) => (
          <StageColumnChip
            key={col.key}
            column={col}
            onRename={(label) => handleRenameColumn(col.key, label)}
            onRemove={() => handleRemoveColumn(col.key)}
          />
        ))}
        <button
          type="button"
          onClick={handleAddColumn}
          className="rounded border border-brand-navy px-2 py-1 text-xs font-semibold text-brand-navy hover:bg-brand-navy/5"
        >
          + Add Column
        </button>
      </div>

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
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">No rows yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-100">
              <tr>
                {LEADING_TEXT_FIELDS.map((f) => (
                  <th key={f.key} className="border-b border-gray-200 px-1.5 py-1 text-left font-semibold text-gray-600">{f.label}</th>
                ))}
                {stageColumns.map((col) => (
                  <th key={col.key} className="border-b border-gray-200 px-1 py-1 text-center font-semibold text-gray-600" style={{ writingMode: 'vertical-rl' }}>
                    <span style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>{col.label}</span>
                  </th>
                ))}
                {TRAILING_TEXT_FIELDS.map((f) => (
                  <th key={f.key} className="border-b border-gray-200 px-1.5 py-1 text-left font-semibold text-gray-600">{f.label}</th>
                ))}
                <th className="w-16 border-b border-gray-200 px-1 py-1 text-center font-semibold text-gray-600 print:hidden">End of Group</th>
              </tr>
            </thead>
            {groups.map((groupRows, groupIdx) => (
              <tbody key={groupIdx} className={groupIdx % 2 === 0 ? '' : 'bg-gray-50/40'}>
                {groupRows.map((row) => {
                  const highestStageIdx = stageColumns.reduce(
                    (acc, c, i) => (row.data?.[`stage_${c.key}`] ? i : acc), -1,
                  )
                  return (
                    <tr key={row.id} className="hover:bg-brand-navy/5">
                      {LEADING_TEXT_FIELDS.map((f) => (
                        <td key={f.key} className="border-b border-gray-100 px-1.5 py-1 align-top">
                          <TextCell
                            value={row.data?.[f.key]}
                            saving={savingRowId === row.id}
                            onCommit={(value) => void handleCellCommit(row.id, { [f.key]: value })}
                          />
                        </td>
                      ))}
                      {stageColumns.map((col, i) => {
                        const checked = !!row.data?.[`stage_${col.key}`]
                        const disabled = savingRowId === row.id || (checked && i !== highestStageIdx)
                        return (
                          <td key={col.key} className="border-b border-gray-100 px-1 py-1 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(e) => handleToggleStage(row, i, e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy disabled:opacity-60"
                            />
                          </td>
                        )
                      })}
                      {TRAILING_TEXT_FIELDS.map((f) => (
                        <td key={f.key} className="border-b border-gray-100 px-1.5 py-1 align-top">
                          <TextCell
                            value={row.data?.[f.key]}
                            multiline={f.multiline}
                            saving={savingRowId === row.id}
                            onCommit={(value) => void handleCellCommit(row.id, { [f.key]: value })}
                          />
                        </td>
                      ))}
                      <td className="border-b border-gray-100 px-1 py-1 text-center align-middle print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!row.data?.groupBreak}
                            title="End of group (show subtotal after this row)"
                            onChange={(e) => void handleCellCommit(row.id, { groupBreak: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
                          />
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
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-amber-50 font-semibold">
                  <td colSpan={LEADING_TEXT_FIELDS.length} className="border-b border-gray-200 px-1.5 py-1 text-right">Subtotal (this page):</td>
                  {stageColumns.map((col) => (
                    <td key={col.key} className="border-b border-gray-200 px-1 py-1 text-center">{stageCount(groupRows, col.key)}/{groupRows.length}</td>
                  ))}
                  <td colSpan={TRAILING_TEXT_FIELDS.length + 1} className="border-b border-gray-200 px-1.5 py-1 print:hidden" />
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr className="bg-sky-50 text-sm font-bold">
                <td colSpan={LEADING_TEXT_FIELDS.length} className="px-1.5 py-1.5 text-right">GRAND TOTAL:</td>
                {stageColumns.map((col) => (
                  <td key={col.key} className="px-1 py-1.5 text-center">{stageCount(rows, col.key)}/{rows.length}</td>
                ))}
                <td colSpan={TRAILING_TEXT_FIELDS.length + 1} className="print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
