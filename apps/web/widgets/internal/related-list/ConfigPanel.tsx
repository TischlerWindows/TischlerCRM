'use client'
import { useState, useEffect } from 'react'
import type { ConfigPanelProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'

interface ObjectField { apiName: string; label: string; type: string }

export default function RelatedListConfigPanel({ config, onChange }: ConfigPanelProps) {
  const [objects, setObjects] = useState<Array<{ apiName: string; label: string }>>([])
  const [fields, setFields] = useState<ObjectField[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiClient.getObjects().then(objs => setObjects(objs.map(o => ({ apiName: o.apiName, label: o.label }))))
  }, [])

  useEffect(() => {
    const obj = config.objectApiName as string
    if (!obj) { setFields([]); return }
    setLoading(true)
    apiClient.getObject(obj)
      .then(o => setFields(o.fields ?? []))
      .finally(() => setLoading(false))
  }, [config.objectApiName])

  const base = 'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <div className="space-y-3">
      {/* Related Object */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Related Object *</label>
        <select className={base} value={(config.objectApiName as string) ?? ''}
          onChange={e => onChange({ ...config, objectApiName: e.target.value, columns: [], linkField: '', sortField: '' })}>
          <option value="">— Select object —</option>
          {objects.map(o => <option key={o.apiName} value={o.apiName}>{o.label}</option>)}
        </select>
      </div>

      {loading && <p className="text-xs text-brand-gray">Loading fields...</p>}

      {fields.length > 0 && (
        <>
          {/* Columns (multi-select) */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Columns to Display</label>
            <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {fields.map(f => {
                const cols = (config.columns as string[]) ?? []
                return (
                  <label key={f.apiName} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={cols.includes(f.apiName)}
                      onChange={e => {
                        const next = e.target.checked ? [...cols, f.apiName] : cols.filter(c => c !== f.apiName)
                        onChange({ ...config, columns: next })
                      }} />
                    {f.label}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Link Field */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Link Field *</label>
            <select className={base} value={(config.linkField as string) ?? ''}
              onChange={e => onChange({ ...config, linkField: e.target.value })}>
              <option value="">— Select field —</option>
              {fields.map(f => <option key={f.apiName} value={f.apiName}>{f.label}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-0.5">Field that references the current record</p>
          </div>

          {/* Sort Field */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Sort By</label>
            <select className={base} value={(config.sortField as string) ?? ''}
              onChange={e => onChange({ ...config, sortField: e.target.value })}>
              <option value="">— Default (created date) —</option>
              {fields.map(f => <option key={f.apiName} value={f.apiName}>{f.label}</option>)}
            </select>
          </div>

          {/* Sort Direction */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Sort Direction</label>
            <div className="flex gap-1">
              {(['asc', 'desc'] as const).map(dir => (
                <button key={dir} onClick={() => onChange({ ...config, sortDirection: dir })}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all ${
                    config.sortDirection === dir
                      ? 'bg-[#ede9f5] border-brand-navy text-brand-navy font-semibold'
                      : 'bg-white border-gray-200 text-brand-gray'
                  }`}>{dir === 'asc' ? 'Ascending' : 'Descending'}</button>
              ))}
            </div>
          </div>

          {/* Row Limit */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Row Limit</label>
            <input type="number" className={base} min={1} max={50} value={(config.rowLimit as number) ?? 10}
              onChange={e => onChange({ ...config, rowLimit: Number(e.target.value) })} />
          </div>

          {/* Show Search */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-brand-dark">Show Search</label>
            <button role="switch" aria-checked={!!config.showSearch}
              onClick={() => onChange({ ...config, showSearch: !config.showSearch })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.showSearch ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${config.showSearch ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
