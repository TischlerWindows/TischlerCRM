'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, FileText, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'
import { recordsService } from '@/lib/records-service'
import { getRecordName } from '../shared/recordName'
import { DELIVERY_METHODS, parseTransmittal, SUBMITTED_FOR, type Transmittal, type TransmittalRow } from '@/lib/transmittal'

const inputClass = 'w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-brand-navy focus:outline-none'

export default function TransmittalWidget({ record, object, onRecordChange }: WidgetProps) {
  const projectId = record?.id ? String(record.id) : ''
  const raw = record?.transmittal ?? record?.Project__transmittal
  const projectName = getRecordName(record)
  const [form, setForm] = useState<Transmittal>(() => parseTransmittal(raw))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(parseTransmittal(raw))
    setDirty(false)
    setSaved(false)
  }, [projectId, raw])

  const update = (patch: Partial<Transmittal>) => {
    setForm(current => ({ ...current, ...patch }))
    setDirty(true)
    setSaved(false)
  }

  const updateRow = (index: number, patch: Partial<TransmittalRow>) => {
    update({ rows: form.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) })
  }

  const save = async () => {
    if (!projectId || saving) return
    setSaving(true)
    setError(null)
    try {
      const serialized = JSON.stringify(form)
      await recordsService.updateRecord('Project', projectId, { data: { transmittal: serialized } })
      onRecordChange?.({ transmittal: serialized })
      setDirty(false)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save transmittal')
    } finally {
      setSaving(false)
    }
  }

  const previewPdf = async () => {
    const previewWindow = window.open('', '_blank')
    setGenerating(true)
    setError(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const token = apiClient.getToken()
      const response = await fetch(`${apiBase}/transmittal-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ transmittal: form, projectName }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(detail.error || 'Failed to render transmittal PDF')
      }
      const url = URL.createObjectURL(await response.blob())
      if (previewWindow && !previewWindow.closed) previewWindow.location.href = url
      else {
        const link = document.createElement('a')
        link.href = url
        link.download = 'Transmittal.pdf'
        link.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (cause) {
      previewWindow?.close()
      setError(cause instanceof Error ? cause.message : 'Failed to generate transmittal PDF')
    } finally {
      setGenerating(false)
    }
  }

  if (object.apiName !== 'Project') {
    return <p className="text-sm text-amber-700">Transmittal is available on Project records only.</p>
  }

  return (
    <div className="space-y-4 text-sm text-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-brand-navy">Transmittal</h2>
          <p className="text-xs text-gray-500">{projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && !dirty && <span role="status" className="inline-flex items-center gap-1 text-xs text-green-700"><Check className="h-4 w-4" /> Saved</span>}
          <button type="button" onClick={() => void previewPdf()} disabled={generating} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Preview PDF
          </button>
          <button type="button" onClick={() => void save()} disabled={!projectId || !dirty || saving} className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Transmittal
          </button>
        </div>
      </div>
      {error && <div role="alert" className="flex items-center gap-2 border border-red-200 bg-red-50 p-2 text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold uppercase text-gray-600">Date
          <input type="date" className={inputClass} value={form.date} onChange={event => update({ date: event.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase text-gray-600">Submitted For
          <select className={inputClass} value={form.submittedFor} onChange={event => update({ submittedFor: event.target.value })}>
            {SUBMITTED_FOR.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase text-gray-600">To
          <textarea rows={5} placeholder={'Company name\n\nStreet address\n\nCity, State ZIP'} className={inputClass} value={form.to} onChange={event => update({ to: event.target.value })} />
        </label>
        {(['attn', 're', 'submittedBy'] as const).map(field => (
          <label key={field} className="space-y-1 text-xs font-semibold uppercase text-gray-600">
            {field === 'submittedBy' ? 'Submitted By' : field === 'attn' ? 'Attn' : 'Re'}
            <input className={inputClass} value={form[field]} onChange={event => update({ [field]: event.target.value })} />
          </label>
        ))}
        <fieldset className="rounded border border-gray-300 px-3 py-2">
          <legend className="px-1 text-xs font-semibold uppercase text-gray-600">Delivery Via</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {DELIVERY_METHODS.map(option => {
              const checked = form.deliveryVia.includes(option)
              return (
                <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => update({ deliveryVia: checked
                      ? form.deliveryVia.filter(method => method !== option)
                      : [...form.deliveryVia, option] })}
                    className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
                  />
                  {option}
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
      <div className="overflow-x-auto border border-gray-200">
        <table className="w-full min-w-[480px] text-left">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-600"><tr><th className="w-24 px-2 py-2">Qty.</th><th className="px-2 py-2">Description</th><th className="w-32 px-2 py-2">Code</th><th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-gray-200">
            {form.rows.map((row, index) => (
              <tr key={index}>
                {(['qty', 'description', 'code'] as const).map(field => (
                  <td key={field} className="p-1"><input aria-label={`${field} row ${index + 1}`} className={inputClass} value={row[field]} onChange={event => updateRow(index, { [field]: event.target.value })} /></td>
                ))}
                <td className="p-1"><button type="button" title="Remove row" aria-label={`Remove row ${index + 1}`} disabled={form.rows.length === 1} onClick={() => update({ rows: form.rows.filter((_, rowIndex) => rowIndex !== index) })} className="p-1 text-gray-500 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={() => update({ rows: [...form.rows, { qty: '', description: '', code: '' }] })} disabled={form.rows.length >= 30} className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-brand-navy disabled:opacity-40"><Plus className="h-4 w-4" /> Add Row</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold uppercase text-gray-600">Approval Instructions
          <textarea rows={3} className={inputClass} value={form.approvalInstructions} onChange={event => update({ approvalInstructions: event.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase text-gray-600">Remarks
          <textarea rows={3} className={inputClass} value={form.remarks} onChange={event => update({ remarks: event.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase text-gray-600">Copies To
          <input className={inputClass} value={form.copiesTo} onChange={event => update({ copiesTo: event.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-semibold uppercase text-gray-600">Signature / Sign-off
          <input className={inputClass} value={form.signature} onChange={event => update({ signature: event.target.value })} />
        </label>
      </div>
    </div>
  )
}