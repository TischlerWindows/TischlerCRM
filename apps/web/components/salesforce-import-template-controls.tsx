'use client'

import { useEffect, useState } from 'react'
import { BookmarkPlus, Save, Trash2 } from 'lucide-react'
import {
  deleteSalesforceImportTemplate,
  loadSalesforceImportTemplates,
  saveSalesforceImportTemplate,
  type SalesforceImportTemplate,
  type SalesforceImportTemplateConfig,
} from '@/lib/salesforce-import-templates'

export function SalesforceImportTemplateControls({
  objectApiName,
  config,
  onApply,
}: {
  objectApiName: string
  config: SalesforceImportTemplateConfig
  onApply: (config: SalesforceImportTemplateConfig) => void
}) {
  const [templates, setTemplates] = useState<SalesforceImportTemplate[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setSelectedId('')
    setError(null)
    void loadSalesforceImportTemplates(objectApiName).then((loaded) => {
      if (active) setTemplates(loaded)
    })
    return () => { active = false }
  }, [objectApiName])

  const selected = templates.find((template) => template.id === selectedId)

  const save = async () => {
    const name = templateName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const next = await saveSalesforceImportTemplate(objectApiName, name, config)
      setTemplates(next)
      const saved = next.find((template) => template.name.trim().toLowerCase() === name.toLowerCase())
      setSelectedId(saved?.id ?? '')
      setTemplateName('')
    } catch {
      setError('Could not save this import template.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      setTemplates(await deleteSalesforceImportTemplate(objectApiName, selected.id))
      setSelectedId('')
    } catch {
      setError('Could not delete this import template.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-xs font-medium text-gray-700">
          Saved {objectApiName} templates
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="mt-1 block h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm"
          >
            <option value="">Choose a template</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => selected && onApply(structuredClone(selected.config))}
          disabled={!selected || busy}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={!selected || busy}
          aria-label="Delete selected import template"
          title="Delete selected import template"
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <label className="min-w-48 flex-1 text-xs font-medium text-gray-700">
          Save current mappings
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template name"
            className="mt-1 block h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!templateName.trim() || busy}
          className="inline-flex h-9 items-center gap-1.5 rounded bg-brand-navy px-3 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Save className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
          Save template
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}