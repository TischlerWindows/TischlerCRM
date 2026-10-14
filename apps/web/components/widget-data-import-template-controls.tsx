'use client'

import { useEffect, useState } from 'react'
import { BookmarkPlus, Save, Trash2, X } from 'lucide-react'
import {
  deleteWidgetDataImportTemplate,
  loadWidgetDataImportTemplates,
  saveWidgetDataImportTemplate,
  type WidgetDataImportTemplate,
  type WidgetDataImportTemplateConfig,
} from '@/lib/widget-data-import-templates'
import type { WidgetImportObject } from '@/lib/widget-data-import'

const OBJECT_LABELS: Record<WidgetImportObject, string> = {
  PunchList: 'Punch List',
  PerDiem: 'Per Diem',
}

export function WidgetDataImportTemplateControls({
  objectApiName,
  config,
  onApply,
}: {
  objectApiName: WidgetImportObject
  config: WidgetDataImportTemplateConfig
  onApply: (config: WidgetDataImportTemplateConfig) => void
}) {
  const [templates, setTemplates] = useState<WidgetDataImportTemplate[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setSelectedId('')
    setTemplateName('')
    setCreatingNew(false)
    setError(null)
    void loadWidgetDataImportTemplates(objectApiName)
      .then((loaded) => { if (active) setTemplates(loaded) })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load widget import templates.')
      })
    return () => { active = false }
  }, [objectApiName])

  const selected = templates.find((template) => template.id === selectedId)

  const save = async () => {
    const name = creatingNew ? templateName.trim() : selected?.name ?? ''
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const next = await saveWidgetDataImportTemplate(objectApiName, name, config, selectedId || undefined)
      setTemplates(next)
      const saved = next.find((template) => template.name.trim().toLowerCase() === name.toLowerCase())
      setSelectedId(saved?.id ?? '')
      setTemplateName('')
      setCreatingNew(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this widget import template.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      setTemplates(await deleteWidgetDataImportTemplate(objectApiName, selected.id))
      setSelectedId('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this widget import template.')
    } finally {
      setBusy(false)
    }
  }

  const selectTemplate = (templateId: string) => {
    setSelectedId(templateId)
    setCreatingNew(false)
    setTemplateName('')
    const template = templates.find((candidate) => candidate.id === templateId)
    if (template) onApply(structuredClone(template.config))
  }

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-xs font-medium text-gray-700">
          {OBJECT_LABELS[objectApiName]} import templates
          <select
            value={selectedId}
            onChange={(event) => selectTemplate(event.target.value)}
            disabled={busy}
            className="mt-1 block h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm"
          >
            <option value="">Choose a template</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        {selected && !creatingNew && (
          <>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded bg-brand-navy px-3 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {busy ? 'Saving...' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              aria-label={`Delete selected ${OBJECT_LABELS[objectApiName]} template`}
              title="Delete selected template"
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
        {creatingNew ? (
          <>
            <label className="min-w-48 flex-1 text-xs font-medium text-gray-700">
              New template name
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
              <BookmarkPlus className="h-4 w-4" />
              {busy ? 'Creating...' : 'Create template'}
            </button>
            <button
              type="button"
              onClick={() => { setCreatingNew(false); setTemplateName('') }}
              disabled={busy}
              aria-label="Cancel new widget import template"
              title="Cancel"
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { setSelectedId(''); setCreatingNew(true); setTemplateName('') }}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BookmarkPlus className="h-4 w-4" />
            New template
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}