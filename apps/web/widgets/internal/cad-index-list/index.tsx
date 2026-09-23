'use client'

/**
 * CAD Index List widget — 4 independent per-Project checklists
 * (Installation Completion Sign Off, Pre-Installation Survey List,
 * Installation Progress List, Final Adjustment Check List). All 4 share one
 * underlying CadIndexItem object, partitioned by a `reportType` field — rows
 * added under one report never appear under another (each "Add Row" stamps
 * the currently-active reportType), so from a data perspective they behave
 * as 4 fully independent lists, not 4 views onto shared rows.
 *
 * Each report gets its own "Preview PDF" (server-side PDFKit, see
 * apps/api/src/lib/cad-index-pdf/renderer.ts — one generic column-driven
 * renderer shared by all 4 reports, not 4 hardcoded layouts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, FileText, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'
import { apiClient } from '@/lib/api-client'
import { getRecordName } from '../shared/recordName'

type ColumnType = 'text' | 'number' | 'checkbox'

interface ColumnDef {
  key: string
  label: string
  type: ColumnType
  multiline?: boolean
}

const REPORT_TYPES = [
  'Installation Completion Sign Off',
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
  'Installation Completion Sign Off': [
    ...BASE_UNIT_COLUMNS,
    { key: 'installationCompleteNoPunch', label: 'Installation Complete / No Punch List Item', type: 'checkbox' },
    { key: 'punchListItem', label: 'Punch List Item', type: 'checkbox' },
  ],
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
  onCommit,
}: {
  value: unknown
  type: 'text' | 'number'
  multiline?: boolean
  saving: boolean
  onCommit: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    if (saving) return
    setDraft(typeof value === 'string' || typeof value === 'number' ? String(value) : '')
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
        type={type}
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

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await recordsService.getRecords('CadIndexItem', { filter: { project: projectId } }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load CAD Index List items')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const columns = REPORT_COLUMNS[activeReportType]
  const activeRows = useMemo(
    () => rows.filter((r) => r.data?.reportType === activeReportType),
    [rows, activeReportType],
  )

  if (object?.apiName && object.apiName !== 'Project') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The CAD Index List widget can only be placed on the Project object&rsquo;s layout.
      </div>
    )
  }

  const handleCellCommit = async (rowId: string, key: string, value: unknown) => {
    setSavingRowId(rowId)
    setError(null)
    try {
      const updated = await recordsService.updateRecord('CadIndexItem', rowId, { data: { [key]: value } })
      if (updated) setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save change')
    } finally {
      setSavingRowId(null)
    }
  }

  const handleAddRow = async () => {
    if (!projectId) return
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
    setDeletingRowId(row.id)
    setError(null)
    try {
      await recordsService.deleteRecord('CadIndexItem', row.id)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
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
    <div className="space-y-3">
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

      <div className="flex flex-wrap gap-1.5">
        {REPORT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveReportType(type)}
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
      ) : activeRows.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">No rows yet for this report.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-100">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="border-b border-gray-200 px-1.5 py-1 text-left font-semibold text-gray-600">{col.label}</th>
                ))}
                <th className="w-8 border-b border-gray-200 px-1 py-1" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => (
                <tr key={row.id} className="hover:bg-brand-navy/5">
                  {columns.map((col) => (
                    <td key={col.key} className="border-b border-gray-100 px-1.5 py-1 align-top">
                      {col.type === 'checkbox' ? (
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={!!row.data?.[col.key]}
                            disabled={savingRowId === row.id}
                            onChange={(e) => void handleCellCommit(row.id, col.key, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy disabled:opacity-60"
                          />
                        </div>
                      ) : (
                        <TextCell
                          value={row.data?.[col.key]}
                          type={col.type}
                          multiline={col.multiline}
                          saving={savingRowId === row.id}
                          onCommit={(value) => void handleCellCommit(row.id, col.key, col.type === 'number' ? (value === '' ? '' : Number(value)) : value)}
                        />
                      )}
                    </td>
                  ))}
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
        </div>
      )}
    </div>
  )
}
