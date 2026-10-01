'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, FileText, Loader2, Save } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'
import { recordsService } from '@/lib/records-service'
import { getRecordName } from '../shared/recordName'
import {
  calculateMaterialTotal, formatMaterialTotal, INSTALLATION_MATERIAL_TEMPLATES,
  INSTALLATION_METHODS, MATERIAL_SOURCES, parseInstallationMaterial,
  type InstallationMaterial, type InstallationMaterialRow,
} from '@/lib/installation-material'

const inputClass = 'w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-brand-navy focus:outline-none'

export default function InstallationMaterialWidget({ record, object, onRecordChange }: WidgetProps) {
  const projectId = record?.id ? String(record.id) : ''
  const recordData = record as Record<string, unknown>
  const projectName = getRecordName(recordData)
  const raw = record?.installationMaterialForm ?? record?.Project__installationMaterialForm
  const factory = String(recordData.factory ?? recordData.Project__factory ?? '')
  const location = String(recordData.location ?? recordData.Project__location ?? '')
  const manager = String(recordData.projectManager ?? recordData.Project__projectManager ?? '')
  const attn = String(recordData.attn ?? recordData.Project__attn ?? '')
  const [form, setForm] = useState<InstallationMaterial>(() => {
    const initial = parseInstallationMaterial(raw, projectName)
    return {
      ...initial,
      factory: initial.factory || factory,
      location: initial.location || location,
      projectManager: initial.projectManager || manager,
      attn: initial.attn || attn,
    }
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loaded = parseInstallationMaterial(raw, projectName)
    setForm({
      ...loaded,
      factory: loaded.factory || factory,
      location: loaded.location || location,
      projectManager: loaded.projectManager || manager,
      attn: loaded.attn || attn,
    })
    setDirty(false)
    setSaved(false)
  }, [projectId, raw, projectName, factory, location, manager, attn])

  const update = (patch: Partial<InstallationMaterial>) => {
    setForm(current => ({ ...current, ...patch }))
    setDirty(true)
    setSaved(false)
  }

  const updateRow = (index: number, patch: Partial<InstallationMaterialRow>) => {
    update({ rows: form.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) })
  }

  const save = async () => {
    if (!projectId || saving) return
    setSaving(true)
    setError(null)
    try {
      const value = JSON.stringify(form)
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

  if (object.apiName !== 'Project') return <p className="text-sm text-amber-700">Installation Material is available on Project records only.</p>

  const total = form.rows.reduce((sum, row) => sum + calculateMaterialTotal(row), 0)
  const toggleOption = (current: string[], option: string) => current.includes(option)
    ? current.filter(value => value !== option)
    : [...current, option]

  return (
    <div className="space-y-4 text-sm text-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-brand-navy">Installation Material</h2>
          <p className="text-xs text-gray-500">{projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && !dirty && <span role="status" className="inline-flex items-center gap-1 text-xs text-green-700"><Check className="h-4 w-4" /> Saved</span>}
          <button type="button" onClick={() => void previewPdf()} disabled={previewing} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40">
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{previewing ? 'Preparing PDF' : 'Preview PDF'}
          </button>
          <button type="button" onClick={() => void save()} disabled={!projectId || !dirty || saving} className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving' : 'Save Materials'}
          </button>
        </div>
      </div>
      {error && <div role="alert" className="flex items-center gap-2 border border-red-200 bg-red-50 p-2 text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded border border-gray-200 p-3">
          <label className="block text-xs font-semibold uppercase text-gray-600">Material Template
            <select className={`${inputClass} mt-1`} value={form.template} onChange={event => update({ template: event.target.value })}>
              {INSTALLATION_MATERIAL_TEMPLATES.map(template => <option key={template} value={template}>{template}</option>)}
            </select>
          </label>
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

      <section className="overflow-x-auto border border-gray-300">
        <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
          <thead className="bg-brand-navy text-white"><tr>
            <th className="w-16 border border-gray-400 px-2 py-2">Qty.</th>
            <th className="w-20 border border-gray-400 px-2 py-2">Units</th>
            <th className="border border-gray-400 px-2 py-2">Description</th>
            <th className="w-32 border border-gray-400 px-2 py-2">US Screw Size</th>
            <th className="w-32 border border-gray-400 px-2 py-2">Unit Price (€)</th>
            <th className="w-32 border border-gray-400 px-2 py-2">TOTAL (€)</th>
          </tr></thead>
          <tbody>
            {form.rows.map((row, index) => {
              const rowTotal = calculateMaterialTotal(row)
              return <tr key={index} className="h-9">
                <td className="border border-gray-300 bg-yellow-100 p-1"><input aria-label={`Quantity row ${index + 1}`} className={inputClass} value={row.qty} onChange={event => updateRow(index, { qty: event.target.value })} /></td>
                <td className="border border-gray-300 p-1"><input aria-label={`Units row ${index + 1}`} className={inputClass} value={row.units} onChange={event => updateRow(index, { units: event.target.value })} /></td>
                <td className="border border-gray-300 p-1"><input aria-label={`Description row ${index + 1}`} className={inputClass} value={row.description} onChange={event => updateRow(index, { description: event.target.value })} /></td>
                <td className="border border-gray-300 bg-gray-100 p-1"><input aria-label={`US screw size row ${index + 1}`} className={inputClass} value={row.screwSize} onChange={event => updateRow(index, { screwSize: event.target.value })} /></td>
                <td className="border border-gray-300 p-1"><input aria-label={`Unit price row ${index + 1}`} inputMode="decimal" className={`${inputClass} text-right`} value={row.unitPrice} onChange={event => updateRow(index, { unitPrice: event.target.value })} /></td>
                <td className="border border-gray-300 bg-rose-200 px-2 text-right font-medium">{rowTotal ? formatMaterialTotal(rowTotal) : ''}</td>
              </tr>
            })}
          </tbody>
          <tfoot><tr className="font-semibold"><td colSpan={5} className="border border-gray-300 px-2 py-2 text-right">Grand Total (€)</td><td className="border border-gray-300 bg-rose-300 px-2 py-2 text-right">{formatMaterialTotal(total)}</td></tr></tfoot>
        </table>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase text-gray-600">Signature
          <input className={`${inputClass} mt-1`} value={form.signature} onChange={event => update({ signature: event.target.value })} />
        </label>
        <label className="text-xs font-semibold uppercase text-gray-600">Date
          <input type="date" className={`${inputClass} mt-1`} value={form.signatureDate} onChange={event => update({ signatureDate: event.target.value })} />
        </label>
      </div>
    </div>
  )
}