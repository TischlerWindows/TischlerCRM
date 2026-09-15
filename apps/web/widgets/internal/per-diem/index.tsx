'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CalendarDays, Loader2, Plus, Trash2, WalletCards, X } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService, RecordData } from '@/lib/records-service'

type FieldType = 'text' | 'textarea' | 'currency' | 'date'

interface FieldDef {
  key: string
  label: string
  type: FieldType
}

const FIELDS: FieldDef[] = [
  { key: 'perDiemStartDate', label: 'Per Diem Start Date', type: 'date' },
  { key: 'perDiemEndDate', label: 'Per Diem End Date', type: 'date' },
  { key: 'serviceTechPerDiem', label: 'Service Tech Per Diem', type: 'text' },
  { key: 'perDiemAmount', label: 'Per Diem Amount', type: 'currency' },
  { key: 'perDiemNotes', label: 'Per Diem Notes', type: 'textarea' },
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
  return String(value)
}

function EditableCell({
  value,
  type,
  saving,
  onCommit,
}: {
  value: unknown
  type: FieldType
  saving: boolean
  onCommit: (value: unknown) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<unknown>(value)

  const startEditing = () => {
    if (saving) return
    setDraft(value ?? '')
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    if (draft !== value) onCommit(draft)
  }

  if (editing) {
    if (type === 'textarea') {
      return (
        <textarea
          autoFocus
          value={typeof draft === 'string' ? draft : ''}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === 'Escape') setEditing(false) }}
          rows={2}
          className="w-full min-w-[12rem] resize-none rounded border border-brand-navy/40 px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )
    }
    return (
      <input
        autoFocus
        type={type === 'date' ? 'date' : type === 'currency' ? 'number' : 'text'}
        step={type === 'currency' ? '0.01' : undefined}
        value={type === 'date' ? dateValue(draft) : typeof draft === 'string' || typeof draft === 'number' ? String(draft) : ''}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commit() }
          if (event.key === 'Escape') setEditing(false)
        }}
        className="w-full min-w-[7rem] rounded border border-brand-navy/40 px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
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
        <button type="button" onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy/90">
          <Plus className="h-3.5 w-3.5" />
          New Per Diem
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <WalletCards className="h-5 w-5 shrink-0 text-brand-navy" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-brand-navy">Per Diem</h3>
            <p className="text-xs text-gray-500">{rows.length} record{rows.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowNewModal(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded bg-brand-navy px-3 py-2 text-xs font-semibold text-white">
          <Plus className="h-3.5 w-3.5" />
          New Per Diem
        </button>
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertCircle className="h-4 w-4 shrink-0 text-red-500" />{error}</div>}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-brand-navy" /></div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400"><CalendarDays className="mx-auto mb-2 h-8 w-8 text-gray-300" />No per diem records yet.</div>
      ) : (
        <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
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
                  {FIELDS.map((field) => <td key={field.key} className="max-w-[24rem] border-b border-gray-100 px-2 py-1.5 align-top whitespace-normal break-words"><EditableCell value={row.data?.[field.key]} type={field.type} saving={savingRowId === row.id} onCommit={(value) => void handleCommit(row.id, field.key, value)} /></td>)}
                  <td className="w-8 border-b border-gray-100 px-1 py-1.5 align-top"><button type="button" onClick={() => void handleDelete(row)} disabled={deletingRowId === row.id || savingRowId === row.id} aria-label="Delete per diem record" title="Delete per diem record" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">{deletingRowId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <article key={row.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gray-50 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Service Tech Per Diem</p>
                  <EditableCell value={row.data?.serviceTechPerDiem} type="text" saving={savingRowId === row.id} onCommit={(value) => void handleCommit(row.id, 'serviceTechPerDiem', value)} />
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <EditableCell value={row.data?.perDiemStartDate} type="date" saving={savingRowId === row.id} onCommit={(value) => void handleCommit(row.id, 'perDiemStartDate', value)} />
                    <span aria-hidden="true">-</span>
                    <EditableCell value={row.data?.perDiemEndDate} type="date" saving={savingRowId === row.id} onCommit={(value) => void handleCommit(row.id, 'perDiemEndDate', value)} />
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <div className="rounded-lg bg-brand-navy px-2.5 py-1.5 text-right text-white">
                    <p className="text-[10px] uppercase tracking-wide text-white/70">Amount</p>
                    <EditableCell value={row.data?.perDiemAmount} type="currency" saving={savingRowId === row.id} onCommit={(value) => void handleCommit(row.id, 'perDiemAmount', value)} />
                  </div>
                  <button type="button" onClick={() => void handleDelete(row)} disabled={deletingRowId === row.id || savingRowId === row.id} aria-label="Delete per diem record" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                    {deletingRowId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="px-3 py-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Per Diem Notes</p>
                <EditableCell value={row.data?.perDiemNotes} type="textarea" saving={savingRowId === row.id} onCommit={(value) => void handleCommit(row.id, 'perDiemNotes', value)} />
              </div>
            </article>
          ))}
        </div>
      )}

      {showNewModal && <NewPerDiemModal saving={saving} onCancel={() => setShowNewModal(false)} onSubmit={(values) => void handleCreate(values)} />}
    </div>
  )
}