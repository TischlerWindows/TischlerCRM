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
import { apiClient } from '@/lib/api-client'
import { resolveLookupDisplayName } from '@/lib/utils'
import { MultiLookupUserSearch } from '@/components/form/lookup-search'
import { findAdjacentCellId, type NavDirection } from '@/lib/cell-navigation'
import { getRecordName } from '../shared/recordName'

type FieldType = 'user' | 'combobox' | 'number'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** Searchable dropdown options — only used when type is 'combobox'. */
  options?: string[]
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
  { key: 'tusProjectManager', label: 'TUS Project Manager', type: 'user' },
  { key: 'fastener', label: 'Fastener', type: 'combobox', options: FASTENER_OPTIONS },
  { key: 'totalQty', label: 'Total QTY', type: 'number' },
]

/** Fixed column widths for the desktop table (via <colgroup>) — with
 * `table-layout: fixed`, columns never resize when a cell's content swaps
 * between its display value and an inline-edit input/select. */
function getColWidthRem(key: string): string {
  if (key === 'tusProjectManager') return '12rem'
  if (key === 'fastener') return '22rem'
  if (key === 'totalQty') return '6rem'
  return '8rem'
}

function getMobileRowWidthClass(field: FieldDef): string {
  if (field.key === 'fastener') return 'w-64'
  if (field.key === 'totalQty') return 'w-20'
  return 'w-32'
}

interface UserRecord {
  id: string
  name?: string
  email?: string
  title?: string
}

function UserLookupField({
  value,
  onChange,
  onClose,
}: {
  value: unknown
  onChange: (value: unknown) => void
  onClose?: () => void
}) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [query, setQuery] = useState('')
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
      fieldDef={{ id: 'tusProjectManager', apiName: 'tusProjectManager', label: 'TUS Project Manager', type: 'MultiLookupUser' }}
      value={value}
      onChange={onChange}
      userRecords={users}
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

/** Searchable dropdown for the Fastener column — a portal-rendered list
 * (like MultiLookupUserSearch's `portalDropdown`) so it isn't clipped by
 * the table's horizontally-scrolling wrapper. */
function FastenerComboBox({
  value,
  options,
  onSelect,
  onSelectAndNavigate,
  onCancel,
}: {
  value: unknown
  options: string[]
  onSelect: (value: string) => void
  onSelectAndNavigate: (value: string, el: HTMLElement) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState(typeof value === 'string' ? value : '')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const rect = inputRef.current?.getBoundingClientRect()
    // The desktop table and mobile card list both render an EditableCell for
    // every cell id, with only one hidden via CSS (`hidden`/`md:hidden`) at
    // any given viewport width — so the hidden copy's input has a zero-size
    // rect (display:none collapses layout). Skip it, or its dropdown portal
    // renders floating at (0,0) in the corner of the page.
    if (rect && (rect.width > 0 || rect.height > 0)) {
      setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) })
    }
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
            if (picked) { e.preventDefault(); onSelectAndNavigate(picked, e.currentTarget) }
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

function displayValue(value: unknown, type: FieldType): string {
  if (value === undefined || value === null || value === '') return '-'
  if (type === 'user') {
    const ids = String(value).split(';').map((id) => id.trim()).filter(Boolean)
    return ids.length > 0 ? ids.map((id) => resolveLookupDisplayName(id, 'User')).join(', ') : '-'
  }
  return String(value)
}

/**
 * Click-to-edit grid cell, same conventions as the Punch List/Per Diem
 * widgets: editing state is lifted to the parent so keyboard navigation
 * (Tab/Enter/arrows) can move it to the adjacent cell.
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
  onNavigate,
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
  onNavigate?: (fromEl: HTMLElement, direction: NavDirection) => void
}) {
  const [draft, setDraft] = useState<unknown>(value)

  useEffect(() => {
    if (isEditing) setDraft(value ?? '')
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

  const navigateFrom = (el: HTMLElement, direction: NavDirection, newValue: unknown) => {
    onStopEdit?.()
    if (newValue !== value) onCommit(newValue)
    onNavigate?.(el, direction)
  }

  // A row that's merely mid-save (saving=true for the whole row while any
  // one field in it is in flight) must stay reachable by keyboard nav, or
  // Tab/Enter/arrows stop working across the entire row.
  const dataCellId = cellId

  // MultiLookupUserSearch's input has no autoFocus of its own, so nothing
  // gives it DOM focus when keyboard nav lands here — without this,
  // Tab/Escape/typing all silently do nothing since nothing is focused.
  const userCellRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isEditing && type === 'user') userCellRef.current?.querySelector('input')?.focus()
  }, [isEditing, type])

  if (isEditing) {
    if (type === 'user') {
      // MultiLookupUserSearch owns its own input/dropdown and has no notion
      // of cell navigation, so Tab/Escape are intercepted here (ArrowUp/Down
      // are left alone — the dropdown uses them to highlight options).
      return (
        <div
          ref={userCellRef}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              if (onNavigate) navigateFrom(e.currentTarget, 'right', draft)
              else onStopEdit?.()
            } else if (e.key === 'Escape') {
              onStopEdit?.()
            }
          }}
        >
          <UserLookupField
            value={draft}
            onClose={() => onStopEdit?.()}
            onChange={(nextValue) => {
              setDraft(nextValue)
              if (nextValue !== value) onCommit(nextValue)
            }}
          />
        </div>
      )
    }
    if (type === 'combobox') {
      return (
        <FastenerComboBox
          value={draft}
          options={options ?? []}
          onSelect={(nextValue) => { setDraft(nextValue); commit(nextValue) }}
          onSelectAndNavigate={(nextValue, el) => { setDraft(nextValue); navigateFrom(el, 'right', nextValue) }}
          onCancel={() => onStopEdit?.()}
        />
      )
    }
    const isNumber = type === 'number'
    return (
      <input
        type={isNumber ? 'number' : 'text'}
        data-cell-id={dataCellId}
        autoFocus
        value={typeof draft === 'string' || typeof draft === 'number' ? String(draft) : ''}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onNavigate ? navigateFrom(e.currentTarget, 'right', draft) : commit(draft); return }
          if (e.key === 'Escape') { onStopEdit?.(); return }
          if (!onNavigate) return
          if (e.key === 'Tab') { e.preventDefault(); navigateFrom(e.currentTarget, 'right', draft); return }
          // Number inputs don't reliably support selectionStart/End (throws
          // in Firefox), and native ArrowUp/Down increments the value —
          // arrow keys always navigate instead of moving the caret.
          if (isNumber) {
            if (e.key === 'ArrowDown') { e.preventDefault(); navigateFrom(e.currentTarget, 'down', draft) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); navigateFrom(e.currentTarget, 'up', draft) }
            else if (e.key === 'ArrowRight') { e.preventDefault(); navigateFrom(e.currentTarget, 'right', draft) }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateFrom(e.currentTarget, 'left', draft) }
            return
          }
          const el = e.currentTarget
          const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
          const atStart = el.selectionStart === 0 && el.selectionEnd === 0
          if (e.key === 'ArrowRight' && atEnd) { e.preventDefault(); navigateFrom(el, 'right', draft) }
          else if (e.key === 'ArrowLeft' && atStart) { e.preventDefault(); navigateFrom(el, 'left', draft) }
          else if (e.key === 'ArrowDown') { e.preventDefault(); navigateFrom(el, 'down', draft) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); navigateFrom(el, 'up', draft) }
        }}
        className="w-full border border-brand-navy/40 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  return (
    <button
      type="button"
      data-cell-id={dataCellId}
      onClick={startEdit}
      disabled={saving}
      onKeyDown={(e) => {
        if (!onNavigate) return
        const dir: NavDirection | undefined =
          e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down' : undefined
        if (dir) { e.preventDefault(); onNavigate(e.currentTarget, dir) }
      }}
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

  const handleNavigate = (el: HTMLElement, direction: NavDirection) => {
    const td = el.closest('td')
    setEditingCellId(td ? findAdjacentCellId(td, direction) : null)
  }

  const load = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await recordsService.getRecords('AutoCad', { filter: { project: recordId } }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load AutoCad items')
    } finally {
      setLoading(false)
    }
  }, [recordId])

  useEffect(() => { void load() }, [load])

  if (object?.apiName && object.apiName !== 'Project') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        The AutoCad widget can only be placed on the Project object&rsquo;s layout.
      </div>
    )
  }

  const handleCellCommit = async (rowId: string, key: string, value: unknown) => {
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
  }

  const handleAddBlankRow = async () => {
    if (!recordId) return
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
    setDeletingRowId(row.id)
    setError(null)
    try {
      await recordsService.deleteRecord('AutoCad', row.id)
      setRows((prev) => prev.filter((item) => item.id !== row.id))
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
      const pmRaw = record?.internal_project_manager ?? record?.Project__internal_project_manager
      const projectManager = pmRaw
        ? String(pmRaw).split(';').map((id) => id.trim()).filter(Boolean).map((id) => resolveLookupDisplayName(id, 'User')).join(', ')
        : ''
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
    <div className="space-y-3">
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
                  {ALL_FIELDS.map((f) => (
                    <td key={f.key} className="px-1.5 py-1 border-b border-gray-100 align-top whitespace-normal break-words">
                      <EditableCell
                        cellId={`${row.id}:${f.key}`}
                        value={row.data?.[f.key]}
                        type={f.type}
                        saving={savingRowId === row.id}
                        options={f.options}
                        isEditing={editingCellId === `${row.id}:${f.key}`}
                        onStartEdit={() => setEditingCellId(`${row.id}:${f.key}`)}
                        onStopEdit={() => setEditingCellId(null)}
                        onCommit={(value) => handleCellCommit(row.id, f.key, value)}
                        onNavigate={handleNavigate}
                      />
                    </td>
                  ))}
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
          {rows.map((row) => (
            <article key={row.id} className="flex min-w-[48rem] items-center gap-2 border-b border-gray-100 bg-white px-2 py-2 last:border-b-0">
              {ALL_FIELDS.map((field) => (
                <div key={field.key} className={`${getMobileRowWidthClass(field)} shrink-0`}>
                  <p className="truncate text-[9px] font-semibold uppercase text-gray-400">{field.label}</p>
                  <EditableCell
                    cellId={`${row.id}:${field.key}`}
                    value={row.data?.[field.key]}
                    type={field.type}
                    saving={savingRowId === row.id}
                    options={field.options}
                    isEditing={editingCellId === `${row.id}:${field.key}`}
                    onStartEdit={() => setEditingCellId(`${row.id}:${field.key}`)}
                    onStopEdit={() => setEditingCellId(null)}
                    onCommit={(value) => handleCellCommit(row.id, field.key, value)}
                  />
                </div>
              ))}
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
    </div>
  )
}
