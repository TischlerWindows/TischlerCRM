'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, FileText, Loader2, RotateCcw, Save } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'
import { apiClient } from '@/lib/api-client'
import { getRecordName } from '../shared/recordName'
import {
  HARDWARE_ITEMS, PRODUCT_OPTIONS, SPEC_ITEMS, applyFactoryOrderDefaults,
  factoryOrderDefaultsFromProject, hardwareKey, parseFactoryOrderSpec,
  readProjectField, refreshFactoryOrderDefaults, type FactoryOrderSpec,
} from '@/lib/factory-order-spec'
import { normalizeSingleLookupUserValue, type LookupUserIdentity } from '@/lib/user-lookup'

const inputClass = 'w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-sm text-gray-800 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-inset focus:ring-brand-navy'
const headingClass = 'bg-brand-navy px-3 py-2 text-sm font-bold uppercase text-white'

export default function FactoryOrderSpecWidget({ record, object }: WidgetProps) {
  const projectId = record?.id ? String(record.id) : ''
  const projectName = getRecordName(record as Record<string, unknown>)
  const recordData = record as Record<string, unknown>
  const managerValue = readProjectField(recordData, 'Project__internal_project_manager')
  const productSpecification = readProjectField(recordData, 'product_specification')
  const insectRollScreens = readProjectField(recordData, 'Insect_Roll_Screens__c')
  const projectDefaults = useMemo(
    () => factoryOrderDefaultsFromProject({ product_specification: productSpecification, Insect_Roll_Screens__c: insectRollScreens }),
    [productSpecification, insectRollScreens],
  )
  const rawSpec = record?.factoryOrderSpec ?? record?.Project__factoryOrderSpec
  const [spec, setSpec] = useState<FactoryOrderSpec>(() => applyFactoryOrderDefaults(parseFactoryOrderSpec(rawSpec), projectDefaults))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSpec(applyFactoryOrderDefaults(parseFactoryOrderSpec(rawSpec), projectDefaults))
    setDirty(false)
    if (managerValue) {
      apiClient.get<LookupUserIdentity[]>('/users/lookup')
        .then((users) => {
          const managerId = normalizeSingleLookupUserValue(managerValue, users)
          const user = users.find((candidate) => candidate.id === managerId)
          if (!cancelled && user) setSpec((current) => applyFactoryOrderDefaults(current, { from: user.name || user.email || undefined }))
        })
        .catch(() => { /* Legacy/orphaned user lookup: leave From blank for manual entry. */ })
    }
    return () => { cancelled = true }
  }, [projectId, rawSpec, managerValue, projectDefaults])

  const update = (patch: Partial<FactoryOrderSpec>, manualOverride?: string) => {
    setSpec((current) => ({
      ...current,
      ...patch,
      manualOverrides: manualOverride && !current.manualOverrides.includes(manualOverride)
        ? [...current.manualOverrides, manualOverride]
        : current.manualOverrides,
    }))
    setDirty(true)
    setSaved(false)
  }

  const resolveManagerName = async () => {
    if (!managerValue) return ''
    try {
      const users = await apiClient.get<LookupUserIdentity[]>('/users/lookup')
      const managerId = normalizeSingleLookupUserValue(managerValue, users)
      const user = users.find((candidate) => candidate.id === managerId)
      return user?.name || user?.email || ''
    } catch {
      return ''
    }
  }

  const refreshAutoFill = async () => {
    if (refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const managerName = await resolveManagerName()
      setSpec((current) => refreshFactoryOrderDefaults(current, { ...projectDefaults, from: managerName || undefined }))
      setDirty(true)
      setSaved(false)
    } finally {
      setRefreshing(false)
    }
  }

  const save = async () => {
    if (!projectId || saving) return
    setSaving(true)
    setError(null)
    try {
      await recordsService.updateRecord('Project', projectId, { data: { factoryOrderSpec: JSON.stringify({ ...spec, project: projectName }) } })
      setDirty(false)
      setSaved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save factory order spec')
    } finally {
      setSaving(false)
    }
  }

  const previewPdf = async () => {
    const previewWindow = window.open('', '_blank')
    setGeneratingPdf(true)
    setError(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const token = apiClient.getToken()
      const response = await fetch(`${apiBase}/factory-order-spec-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ spec: { ...spec, project: projectName }, projectName }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(detail.error || 'Failed to render Factory Order Spec PDF')
      }
      const url = URL.createObjectURL(await response.blob())
      if (previewWindow && !previewWindow.closed) previewWindow.location.href = url
      else {
        const link = document.createElement('a')
        link.href = url
        link.download = 'Factory_Order_Spec.pdf'
        link.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err: unknown) {
      previewWindow?.close()
      setError(err instanceof Error ? err.message : 'Failed to generate Factory Order Spec PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (object.apiName !== 'Project') {
    return <p className="text-sm text-amber-700">Factory Order Spec is available on Project records only.</p>
  }

  const hardwareGroups = HARDWARE_ITEMS.reduce<Array<{ group: string; items: string[] }>>((groups, { group, item }) => {
    const current = groups[groups.length - 1]
    if (current?.group === group) current.items.push(item)
    else groups.push({ group, items: [item] })
    return groups
  }, [])

  return (
    <div className="space-y-4 text-sm text-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-brand-navy">Factory Order Specification</h2>
          <p className="text-xs text-gray-500">{projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && !dirty && <span role="status" className="inline-flex items-center gap-1 text-xs text-green-700"><Check className="h-3.5 w-3.5" /> Saved</span>}
          <button type="button" onClick={() => void refreshAutoFill()} disabled={refreshing || saving} title="Reload From, Product, and Roll screen from this Project" className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {refreshing ? 'Refreshing' : 'Refresh Auto-Fill'}
          </button>
          <button type="button" onClick={() => void previewPdf()} disabled={generatingPdf} className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {generatingPdf ? 'Preparing PDF' : 'Preview PDF'}
          </button>
          <button type="button" onClick={() => void save()} disabled={!projectId || !dirty || saving} className="inline-flex items-center gap-1.5 rounded bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-40">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving' : 'Save Spec'}
          </button>
        </div>
      </div>
      {error && <div role="alert" className="flex items-center gap-2 border border-red-200 bg-red-50 p-2 text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}

      <section aria-label="Order information" className="border border-gray-200">
        <h3 className={headingClass}>Order Specification</h3>
        <div className="grid gap-px bg-gray-200 sm:grid-cols-2">
          <label className="flex min-w-0 items-center gap-2 bg-white px-2 py-1 text-xs font-semibold uppercase text-gray-600">
            <span className="w-16 shrink-0">Re</span>
            <input className={inputClass} value={spec.re} onChange={(event) => update({ re: event.target.value })} />
          </label>
          <div className="flex min-w-0 items-center gap-2 bg-white px-2 py-1 text-xs font-semibold uppercase text-gray-600">
            <span className="w-16 shrink-0">Project</span>
            <span className="min-w-0 break-words px-2 py-1.5 text-sm font-normal normal-case text-gray-800">{projectName}</span>
          </div>
          {(['to', 'from'] as const).map((key) => (
            <label key={key} className="flex min-w-0 items-center gap-2 bg-white px-2 py-1 text-xs font-semibold uppercase text-gray-600">
              <span className="w-16 shrink-0">{key}</span>
              <input className={inputClass} value={spec[key]} onChange={(event) => update({ [key]: event.target.value }, key === 'from' ? 'from' : undefined)} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 px-3 py-2">
          <span className="text-xs font-semibold uppercase text-gray-600">Product</span>
          {PRODUCT_OPTIONS.map((product) => (
            <label key={product} className="inline-flex items-center gap-1 text-xs">
              <input type="checkbox" checked={spec.products.includes(product)} onChange={(event) => update({ products: event.target.checked ? [...spec.products, product] : spec.products.filter((value) => value !== product) }, 'products')} />
              {product}
            </label>
          ))}
        </div>
        <label className="block border-t border-gray-200 px-3 py-2 text-xs font-semibold uppercase text-gray-600">
          Approved shop drawings for factory order, date &amp; revision number
          <input className={`${inputClass} mt-1 border border-gray-200`} value={spec.approvedDrawings} onChange={(event) => update({ approvedDrawings: event.target.value })} />
        </label>
        <label className="block border-t border-gray-200 px-3 py-2 text-xs font-semibold uppercase text-gray-600">
          On hold items / pre-production release
          <textarea rows={2} className={`${inputClass} mt-1 resize-y border border-gray-200`} value={spec.onHoldItems} onChange={(event) => update({ onHoldItems: event.target.value })} />
        </label>
      </section>

      <section aria-label="Specifications" className="overflow-x-auto border border-gray-200">
        <table className="w-full min-w-[650px] border-collapse text-xs">
          <thead className="bg-brand-navy text-left text-white"><tr><th className="w-10 px-2 py-2">#</th><th className="w-[34%] px-2 py-2">Item</th><th className="w-[32%] px-2 py-2">Specification</th><th className="px-2 py-2">Remarks</th></tr></thead>
          <tbody>{SPEC_ITEMS.map((item, index) => {
            const key = String(index + 1)
            const row = spec.specifications[key]
            return <tr key={key} className="border-t border-gray-200 even:bg-gray-50">
              <td className="px-2 py-1">{key}</td><th scope="row" className="px-2 py-1 text-left font-medium">{item}</th>
              <td className="border-l border-gray-200"><input aria-label={`${item} specification`} className={inputClass} value={row?.specification ?? ''} onChange={(event) => update({ specifications: { ...spec.specifications, [key]: { ...row, specification: event.target.value, remarks: row?.remarks ?? '' } } }, key === '19' ? 'rollScreen' : undefined)} /></td>
              <td className="border-l border-gray-200"><input aria-label={`${item} remarks`} className={inputClass} value={row?.remarks ?? ''} onChange={(event) => update({ specifications: { ...spec.specifications, [key]: { ...row, specification: row?.specification ?? '', remarks: event.target.value } } })} /></td>
            </tr>
          })}</tbody>
        </table>
      </section>

      <section aria-label="Hardware specifications" className="overflow-x-auto border border-gray-200">
        <table className="w-full min-w-[650px] border-collapse text-xs">
          <thead className="bg-brand-navy text-left text-white"><tr><th colSpan={2} className="px-2 py-2">Hardware</th><th colSpan={2} className="px-2 py-2">Specifications</th></tr><tr className="bg-gray-100 text-gray-700"><th className="w-[19%] px-2 py-1">Group</th><th className="w-[30%] px-2 py-1">Item</th><th className="w-[25%] px-2 py-1">Supplied by</th><th className="px-2 py-1">Finish / Type</th></tr></thead>
          {hardwareGroups.map(({ group, items }) => <tbody key={group}>{items.map((item, index) => {
            const key = hardwareKey(group, item)
            const row = spec.hardware[key]
            return <tr key={key} className="border-t border-gray-200 even:bg-gray-50">
              {index === 0 && (
                <th scope="rowgroup" rowSpan={items.length} className="border-r border-gray-200 bg-gray-100 px-2 py-2 text-left align-top font-semibold text-brand-navy">{group}</th>
              )}
              <td className="px-2 py-1">{item}</td>
              <td className="border-l border-gray-200"><input aria-label={`${group} ${item} supplied by`} className={inputClass} value={row?.suppliedBy ?? ''} onChange={(event) => update({ hardware: { ...spec.hardware, [key]: { ...row, suppliedBy: event.target.value, finishType: row?.finishType ?? '' } } })} /></td>
              <td className="border-l border-gray-200"><input aria-label={`${group} ${item} finish or type`} className={inputClass} value={row?.finishType ?? ''} onChange={(event) => update({ hardware: { ...spec.hardware, [key]: { ...row, suppliedBy: row?.suppliedBy ?? '', finishType: event.target.value } } })} /></td>
            </tr>
          })}</tbody>)}
        </table>
      </section>

      <section aria-label="Shipping" className="border border-gray-200">
        <h3 className={headingClass}>Shipping</h3>
        {([['jobsiteAddress', 'Jobsite Address'], ['destinationPort', 'Destination Port'], ['shippingWeek', 'Shipping Week']] as const).map(([key, label]) => (
          <label key={key} className="flex flex-col border-t border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 sm:flex-row sm:items-center">
            <span className="w-36 shrink-0">{label}</span><input className={inputClass} value={spec[key]} onChange={(event) => update({ [key]: event.target.value })} />
          </label>
        ))}
      </section>
      <section aria-label="Additional remarks" className="border border-gray-200">
        <h3 className={headingClass}>Additional Remarks</h3>
        <textarea rows={4} className={`${inputClass} resize-y`} aria-label="Additional remarks" value={spec.additionalRemarks} onChange={(event) => update({ additionalRemarks: event.target.value })} />
      </section>
      <div className="border-t border-gray-200 pt-3 text-sm">
        <p>Please confirm this order with me at your earliest convenience. Thank you!</p>
        <p className="mt-3">Sincerely,</p>
        <input aria-label="Signature name" className={`${inputClass} mt-2 max-w-xs`} value={spec.signatureName} onChange={(event) => update({ signatureName: event.target.value })} />
        <input aria-label="Signature title" className={`${inputClass} max-w-xs italic`} value={spec.signatureTitle} onChange={(event) => update({ signatureTitle: event.target.value })} />
      </div>
    </div>
  )
}