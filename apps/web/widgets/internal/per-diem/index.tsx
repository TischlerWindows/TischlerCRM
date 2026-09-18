'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, FileText, Loader2, Plus, Trash2, WalletCards, X } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'
import { apiClient } from '@/lib/api-client'
import { resolveLookupDisplayName } from '@/lib/utils'
import { MultiLookupUserSearch } from '@/components/form/lookup-search'
import { findAdjacentCellId, type NavDirection } from '@/lib/cell-navigation'
import { generatePerDiemPdf } from './pdf'

type FieldType = 'text' | 'textarea' | 'currency' | 'date' | 'user'

interface FieldDef {
  key: string
  label: string
  type: FieldType
}

const FIELDS: FieldDef[] = [
  { key: 'serviceTechPerDiem', label: 'Service Tech Per Diem', type: 'user' },
  { key: 'perDiemAmount', label: 'Per Diem Amount', type: 'currency' },
  { key: 'perDiemNotes', label: 'Per Diem Notes', type: 'textarea' },
  { key: 'perDiemStartDate', label: 'Per Diem Start Date', type: 'date' },
  { key: 'perDiemEndDate', label: 'Per Diem End Date', type: 'date' },
]

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
      fieldDef={{ id: 'serviceTechPerDiem', apiName: 'serviceTechPerDiem', label: 'Service Tech Per Diem', type: 'MultiLookupUser' }}
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

function EditableCell({
  cellId,
  value,
  type,
  saving,
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
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
  onCommit: (value: unknown) => void
  onNavigate?: (fromEl: HTMLElement, direction: NavDirection) => void
}) {
  const [draft, setDraft] = useState<unknown>(value)

  useEffect(() => {
    if (isEditing) setDraft(value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  // MultiLookupUserSearch's input has no autoFocus of its own (unlike the
  // other field types' plain <input>/<textarea>), so nothing gives it DOM
  // focus when keyboard nav lands here — without this, Tab/Escape/typing
  // all silently do nothing since no element in the cell is focused.
  const userCellRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isEditing && type === 'user') userCellRef.current?.querySelector('input')?.focus()
  }, [isEditing, type])

  const startEditing = () => {
    if (saving) return
    onStartEdit?.()
  }

  const commit = () => {
    onStopEdit?.()
    if (draft !== value) onCommit(draft)
  }

  const navigateFrom = (el: HTMLElement, direction: NavDirection, newValue: unknown) => {
    onStopEdit?.()
    if (newValue !== value) onCommit(newValue)
    onNavigate?.(el, direction)
  }

  // Per Diem has no permanently non-editable fields, so unlike Punch List's
  // computed column, `saving` (temporary, whole-row) must never hide this
  // cell from keyboard navigation — that would stall Tab/Enter/arrows across
  // the entire row until the in-flight save resolves.
  const dataCellId = cellId

  if (isEditing) {
    if (type === 'user') {
      // MultiLookupUserSearch owns its own input/dropdown and has no notion
      // of cell navigation, so Tab/Escape are intercepted here (ArrowUp/Down
      // are left alone — the dropdown uses them to highlight options).
      return (
        <div
          ref={userCellRef}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault()
              if (onNavigate) navigateFrom(event.currentTarget, 'right', draft)
              else onStopEdit?.()
            } else if (event.key === 'Escape') {
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
    if (type === 'textarea') {
      return (
        <textarea
          data-cell-id={dataCellId}
          autoFocus
          value={typeof draft === 'string' ? draft : ''}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { onStopEdit?.(); return }
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onNavigate ? navigateFrom(event.currentTarget, 'right', draft) : commit(); return }
            if (!onNavigate) return
            if (event.key === 'Tab') { event.preventDefault(); navigateFrom(event.currentTarget, 'right', draft); return }
            const el = event.currentTarget
            const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
            const atStart = el.selectionStart === 0 && el.selectionEnd === 0
            if (event.key === 'ArrowRight' && atEnd) { event.preventDefault(); navigateFrom(el, 'right', draft) }
            else if (event.key === 'ArrowLeft' && atStart) { event.preventDefault(); navigateFrom(el, 'left', draft) }
            else if (event.key === 'ArrowDown') { event.preventDefault(); navigateFrom(el, 'down', draft) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); navigateFrom(el, 'up', draft) }
          }}
          rows={2}
          className="w-full min-w-[12rem] resize-none rounded border border-brand-navy/40 px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    const isNumber = type === 'currency'
    return (
      <input
        data-cell-id={dataCellId}
        autoFocus
        type={type === 'date' ? 'date' : isNumber ? 'number' : 'text'}
        step={isNumber ? '0.01' : undefined}
        value={type === 'date' ? dateValue(draft) : typeof draft === 'string' || typeof draft === 'number' ? String(draft) : ''}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); onNavigate ? navigateFrom(event.currentTarget, 'right', draft) : commit(); return }
          if (event.key === 'Escape') { onStopEdit?.(); return }
          if (!onNavigate) return
          if (event.key === 'Tab') { event.preventDefault(); navigateFrom(event.currentTarget, 'right', draft); return }
          // Number inputs don't reliably support selectionStart/End (throws
          // in Firefox) and native ArrowUp/Down increments the value, so
          // arrows always navigate instead of moving the caret. Date inputs
          // keep native ArrowLeft/Right to move between month/day/year.
          if (isNumber) {
            if (event.key === 'ArrowDown') { event.preventDefault(); navigateFrom(event.currentTarget, 'down', draft) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); navigateFrom(event.currentTarget, 'up', draft) }
            else if (event.key === 'ArrowRight') { event.preventDefault(); navigateFrom(event.currentTarget, 'right', draft) }
            else if (event.key === 'ArrowLeft') { event.preventDefault(); navigateFrom(event.currentTarget, 'left', draft) }
            return
          }
          if (type === 'date') {
            if (event.key === 'ArrowDown') { event.preventDefault(); navigateFrom(event.currentTarget, 'down', draft) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); navigateFrom(event.currentTarget, 'up', draft) }
            else if (event.key === 'ArrowRight') { event.preventDefault(); navigateFrom(event.currentTarget, 'right', draft) }
            else if (event.key === 'ArrowLeft') { event.preventDefault(); navigateFrom(event.currentTarget, 'left', draft) }
            return
          }
          const el = event.currentTarget
          const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
          const atStart = el.selectionStart === 0 && el.selectionEnd === 0
          if (event.key === 'ArrowRight' && atEnd) { event.preventDefault(); navigateFrom(el, 'right', draft) }
          else if (event.key === 'ArrowLeft' && atStart) { event.preventDefault(); navigateFrom(el, 'left', draft) }
          else if (event.key === 'ArrowDown') { event.preventDefault(); navigateFrom(el, 'down', draft) }
          else if (event.key === 'ArrowUp') { event.preventDefault(); navigateFrom(el, 'up', draft) }
        }}
        className="w-full min-w-[7rem] rounded border border-brand-navy/40 px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  return (
    <button
      type="button"
      data-cell-id={dataCellId}
      onClick={startEditing}
      disabled={saving}
      onKeyDown={(event) => {
        if (!onNavigate) return
        const dir: NavDirection | undefined =
          event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : event.key === 'ArrowUp' ? 'up' : event.key === 'ArrowDown' ? 'down' : undefined
        if (dir) { event.preventDefault(); onNavigate(event.currentTarget, dir) }
      }}
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
  // Which grid cell (`${rowId}:${fieldKey}`) is currently in edit mode — lifted
  // here so keyboard navigation can move editing to the next cell.
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
      setRows(await recordsService.getRecords('PerDiem', { filter: { workOrder: recordId } }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load per diem records')
    } finally {
      setLoading(false)
    }
  }, [recordId])

  useEffect(() => { void load() }, [load])

  if (object?.apiName && object.apiName !== 'WorkOrder') {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">The Per Diem widget can only be placed on the Work Order object&rsquo;s layout.</div>
  }

  const handleCommit = async (rowId: string, key: string, value: unknown) => {
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
  }

  const handleCreate = async (values: Record<string, unknown>) => {
    if (!recordId) return
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
    <div className="space-y-3">
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
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                {FIELDS.map((field) => <th key={field.key} className="border-b border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">{field.label}</th>)}
                <th className="w-8 border-b border-gray-200 px-1 py-1.5" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {FIELDS.map((field) => <td key={field.key} className="max-w-[24rem] border-b border-gray-100 px-2 py-1.5 align-top whitespace-normal break-words"><EditableCell cellId={`${row.id}:${field.key}`} value={row.data?.[field.key]} type={field.type} saving={savingRowId === row.id} isEditing={editingCellId === `${row.id}:${field.key}`} onStartEdit={() => setEditingCellId(`${row.id}:${field.key}`)} onStopEdit={() => setEditingCellId(null)} onCommit={(value) => void handleCommit(row.id, field.key, value)} onNavigate={handleNavigate} /></td>)}
                  <td className="w-8 border-b border-gray-100 px-1 py-1.5 align-top"><button type="button" onClick={() => void handleDelete(row)} disabled={deletingRowId === row.id || savingRowId === row.id} aria-label="Delete per diem record" title="Delete per diem record" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">{deletingRowId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 md:hidden">
          {rows.map((row) => (
            <article key={row.id} className="flex min-w-[36rem] items-center gap-3 border-b border-gray-100 bg-white px-2 py-2 last:border-b-0">
              <div className="w-28 shrink-0">
                <p className="text-[9px] font-semibold uppercase text-gray-400">Tech</p>
                <EditableCell cellId={`${row.id}:serviceTechPerDiem`} value={row.data?.serviceTechPerDiem} type="text" saving={savingRowId === row.id} isEditing={editingCellId === `${row.id}:serviceTechPerDiem`} onStartEdit={() => setEditingCellId(`${row.id}:serviceTechPerDiem`)} onStopEdit={() => setEditingCellId(null)} onCommit={(value) => void handleCommit(row.id, 'serviceTechPerDiem', value)} />
              </div>
              <div className="w-28 shrink-0">
                <p className="text-[9px] font-semibold uppercase text-gray-400">Start Date</p>
                <EditableCell cellId={`${row.id}:perDiemStartDate`} value={row.data?.perDiemStartDate} type="date" saving={savingRowId === row.id} isEditing={editingCellId === `${row.id}:perDiemStartDate`} onStartEdit={() => setEditingCellId(`${row.id}:perDiemStartDate`)} onStopEdit={() => setEditingCellId(null)} onCommit={(value) => void handleCommit(row.id, 'perDiemStartDate', value)} />
              </div>
              <div className="w-28 shrink-0">
                <p className="text-[9px] font-semibold uppercase text-gray-400">End Date</p>
                <EditableCell cellId={`${row.id}:perDiemEndDate`} value={row.data?.perDiemEndDate} type="date" saving={savingRowId === row.id} isEditing={editingCellId === `${row.id}:perDiemEndDate`} onStartEdit={() => setEditingCellId(`${row.id}:perDiemEndDate`)} onStopEdit={() => setEditingCellId(null)} onCommit={(value) => void handleCommit(row.id, 'perDiemEndDate', value)} />
              </div>
              <div className="w-24 shrink-0">
                <p className="text-[9px] font-semibold uppercase text-gray-400">Amount</p>
                <EditableCell cellId={`${row.id}:perDiemAmount`} value={row.data?.perDiemAmount} type="currency" saving={savingRowId === row.id} isEditing={editingCellId === `${row.id}:perDiemAmount`} onStartEdit={() => setEditingCellId(`${row.id}:perDiemAmount`)} onStopEdit={() => setEditingCellId(null)} onCommit={(value) => void handleCommit(row.id, 'perDiemAmount', value)} />
              </div>
              <div className="min-w-[14rem] flex-1">
                <p className="text-[9px] font-semibold uppercase text-gray-400">Notes</p>
                <EditableCell cellId={`${row.id}:perDiemNotes`} value={row.data?.perDiemNotes} type="textarea" saving={savingRowId === row.id} isEditing={editingCellId === `${row.id}:perDiemNotes`} onStartEdit={() => setEditingCellId(`${row.id}:perDiemNotes`)} onStopEdit={() => setEditingCellId(null)} onCommit={(value) => void handleCommit(row.id, 'perDiemNotes', value)} />
              </div>
              <button type="button" onClick={() => void handleDelete(row)} disabled={deletingRowId === row.id || savingRowId === row.id} aria-label="Delete per diem record" className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                {deletingRowId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </article>
          ))}
        </div>
      )}

      {showNewModal && <NewPerDiemModal saving={saving} onCancel={() => setShowNewModal(false)} onSubmit={(values) => void handleCreate(values)} />}
    </div>
  )
}