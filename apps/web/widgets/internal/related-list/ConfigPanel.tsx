'use client'
import { useState, useEffect } from 'react'
import type { ConfigPanelProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'

interface ObjectField { apiName: string; label: string; type: string }

type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'

interface FilterRule {
  field: string
  operator: FilterOperator
  value: string
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  greater_than: 'is greater than',
  less_than: 'is less than',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
}

const VALUE_LESS_OPERATORS: FilterOperator[] = ['is_empty', 'is_not_empty']

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold text-brand-dark">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-brand-navy' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
        />
      </button>
    </div>
  )
}

export default function RelatedListConfigPanel({ config, onChange, objectOptions }: ConfigPanelProps) {
  const [objects, setObjects] = useState<Array<{ apiName: string; label: string }>>([])
  const [fields, setFields] = useState<ObjectField[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingObjects, setLoadingObjects] = useState(false)
  const [objectsError, setObjectsError] = useState<string | null>(null)

  // Use objectOptions from props (schema store) when available; fall back to API call
  useEffect(() => {
    if (objectOptions && objectOptions.length > 0) return
    setLoadingObjects(true)
    setObjectsError(null)
    apiClient.getObjects()
      .then(objs => setObjects(objs.map(o => ({ apiName: o.apiName, label: o.label }))))
      .catch((e: Error) => {
        console.error('[RelatedList] Failed to load objects:', e.message)
        setObjectsError(e.message)
      })
      .finally(() => setLoadingObjects(false))
  }, [objectOptions])

  useEffect(() => {
    const obj = config.objectApiName as string
    if (!obj) { setFields([]); return }
    setLoading(true)
    apiClient.getObject(obj)
      .then(o => setFields(o.fields ?? []))
      .catch((e: Error) => console.error('[RelatedList] Failed to load fields:', e.message))
      .finally(() => setLoading(false))
  }, [config.objectApiName])

  const effectiveObjects = (objectOptions && objectOptions.length > 0)
    ? objectOptions.map(o => ({ apiName: o.value, label: o.label }))
    : objects

  const selectCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'
  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  const filters: FilterRule[] = Array.isArray(config.filters) ? (config.filters as FilterRule[]) : []

  const updateFilter = (idx: number, patch: Partial<FilterRule>) => {
    const next = filters.map((f, i) => i === idx ? { ...f, ...patch } : f)
    onChange({ ...config, filters: next })
  }

  const addFilter = () => {
    if (filters.length >= 10) return
    onChange({ ...config, filters: [...filters, { field: fields[0]?.apiName ?? '', operator: 'equals' as FilterOperator, value: '' }] })
  }

  const removeFilter = (idx: number) => {
    onChange({ ...config, filters: filters.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-4">
      {/* ── Object ── */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Related Object *</label>
        <select
          className={selectCls}
          value={(config.objectApiName as string) ?? ''}
          onChange={e => onChange({ ...config, objectApiName: e.target.value, columns: [], linkField: '', sortField: '', filters: [] })}
        >
          <option value="">— Select object —</option>
          {effectiveObjects.map(o => <option key={o.apiName} value={o.apiName}>{o.label}</option>)}
        </select>
        {loadingObjects && <p className="text-[10px] text-gray-400 mt-0.5">Loading objects…</p>}
        {objectsError && (
          <p className="text-[10px] text-red-500 mt-0.5">
            Failed to load objects.{' '}
            <button type="button" onClick={() => {
              setObjectsError(null)
              setLoadingObjects(true)
              apiClient.getObjects()
                .then(objs => setObjects(objs.map(o => ({ apiName: o.apiName, label: o.label }))))
                .catch((e: Error) => setObjectsError(e.message))
                .finally(() => setLoadingObjects(false))
            }} className="underline hover:text-red-700">Retry</button>
          </p>
        )}
      </div>

      {/* ── Custom Label ── */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">List Label</label>
        <input
          type="text"
          className={inputCls}
          value={(config.label as string) ?? ''}
          placeholder="Defaults to object name"
          onChange={e => onChange({ ...config, label: e.target.value })}
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Override the header title shown on the widget</p>
      </div>

      {loading && <p className="text-xs text-brand-gray">Loading fields…</p>}

      {fields.length > 0 && (
        <>
          {/* ── Columns ── */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Columns to Display</label>
            <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
              {fields.map(f => {
                const cols = (config.columns as string[]) ?? []
                return (
                  <label key={f.apiName} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cols.includes(f.apiName)}
                      onChange={e => {
                        const next = e.target.checked ? [...cols, f.apiName] : cols.filter(c => c !== f.apiName)
                        onChange({ ...config, columns: next })
                      }}
                      className="rounded border-gray-300 accent-brand-navy"
                    />
                    <span className="text-brand-dark">{f.label}</span>
                    <span className="ml-auto text-[10px] text-gray-400 font-mono">{f.apiName}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* ── Link Field ── */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Link Field *</label>
            <select className={selectCls} value={(config.linkField as string) ?? ''}
              onChange={e => onChange({ ...config, linkField: e.target.value })}>
              <option value="">— Select field —</option>
              {fields.map(f => <option key={f.apiName} value={f.apiName}>{f.label}</option>)}
            </select>
            <p className="text-[10px] text-gray-400 mt-0.5">Field on the related object that references the current record</p>
          </div>

          {/* ── Sort ── */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Sort By</label>
            <select className={selectCls} value={(config.sortField as string) ?? ''}
              onChange={e => onChange({ ...config, sortField: e.target.value })}>
              <option value="">— Default (newest first) —</option>
              {fields.map(f => <option key={f.apiName} value={f.apiName}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Sort Direction</label>
            <div className="flex gap-1">
              {(['asc', 'desc'] as const).map(dir => (
                <button key={dir} type="button"
                  onClick={() => onChange({ ...config, sortDirection: dir })}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all ${
                    config.sortDirection === dir
                      ? 'bg-brand-navy/10 border-brand-navy text-brand-navy font-semibold'
                      : 'bg-white border-gray-200 text-brand-gray'
                  }`}
                >
                  {dir === 'asc' ? 'Ascending' : 'Descending'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Display ── */}
      <div className="border-t border-gray-100 pt-3 space-y-3">
        <p className="text-[11px] font-bold text-brand-dark uppercase tracking-wider">Display</p>

        {/* View mode */}
        <div>
          <label className="block text-[11px] font-semibold text-brand-dark mb-1">View Mode</label>
          <div className="flex gap-1">
            {(['list', 'tile'] as const).map(mode => (
              <button key={mode} type="button"
                onClick={() => onChange({ ...config, viewMode: mode })}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all capitalize ${
                  (config.viewMode ?? 'list') === mode
                    ? 'bg-brand-navy/10 border-brand-navy text-brand-navy font-semibold'
                    : 'bg-white border-gray-200 text-brand-gray'
                }`}
              >
                {mode === 'list' ? 'List' : 'Tile'}
              </button>
            ))}
          </div>
        </div>

        {/* Row limit */}
        <div>
          <label className="block text-[11px] font-semibold text-brand-dark mb-1">Rows to Display</label>
          <input type="number" className={inputCls} min={1} max={50} value={(config.rowLimit as number) ?? 10}
            onChange={e => onChange({ ...config, rowLimit: Number(e.target.value) })} />
          <p className="text-[10px] text-gray-400 mt-0.5">Up to 50 rows shown; use "View All" for more</p>
        </div>

        {/* Toggles */}
        <Toggle
          label="Show Search Bar"
          checked={!!config.showSearch}
          onChange={v => onChange({ ...config, showSearch: v })}
        />
        <Toggle
          label="Show Action Bar"
          checked={!!config.showActionBar}
          onChange={v => onChange({ ...config, showActionBar: v })}
        />
        {config.showActionBar && (
          <Toggle
            label="Show New Button"
            checked={!!config.showNewButton}
            onChange={v => onChange({ ...config, showNewButton: v })}
          />
        )}
      </div>

      {/* ── Filters ── */}
      <div className="border-t border-gray-100 pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-brand-dark uppercase tracking-wider">
            Filters <span className="text-gray-400 normal-case font-normal">({filters.length}/10)</span>
          </p>
          {filters.length < 10 && fields.length > 0 && (
            <button type="button" onClick={addFilter}
              className="text-[11px] text-brand-navy font-semibold hover:underline">
              + Add filter
            </button>
          )}
        </div>

        {filters.length === 0 && (
          <p className="text-[11px] text-gray-400 italic">No filters — all related records are shown</p>
        )}

        {filters.map((f, idx) => (
          <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Filter {idx + 1}</span>
              <button type="button" onClick={() => removeFilter(idx)}
                className="text-[10px] text-red-400 hover:text-red-600 font-medium">
                Remove
              </button>
            </div>
            {/* Field */}
            <select className={selectCls} value={f.field}
              onChange={e => updateFilter(idx, { field: e.target.value })}>
              <option value="">— Select field —</option>
              {fields.map(field => <option key={field.apiName} value={field.apiName}>{field.label}</option>)}
            </select>
            {/* Operator */}
            <select className={selectCls} value={f.operator}
              onChange={e => updateFilter(idx, { operator: e.target.value as FilterOperator, value: '' })}>
              {(Object.keys(OPERATOR_LABELS) as FilterOperator[]).map(op => (
                <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
              ))}
            </select>
            {/* Value (hidden for is_empty / is_not_empty) */}
            {!VALUE_LESS_OPERATORS.includes(f.operator) && (
              <input type="text" className={inputCls} value={f.value}
                placeholder="Value…"
                onChange={e => updateFilter(idx, { value: e.target.value })} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
