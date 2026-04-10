'use client'
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import type { ConfigPanelProps } from '@/lib/widgets/types'
import type { TeamMemberAssociationsConfig } from '@/lib/schema'
import { apiClient } from '@/lib/api-client'

// ── Types ──────────────────────────────────────────────────────────────

type FieldOption = { apiName: string; label: string }
type DisplayFieldsType = NonNullable<TeamMemberAssociationsConfig['displayFields']>

// ── Object sections ────────────────────────────────────────────────────

const OBJECT_SECTIONS: Array<{
  key: keyof DisplayFieldsType
  apiName: string
  label: string
}> = [
  { key: 'Property',     apiName: 'Property',     label: 'Property' },
  { key: 'Opportunity',  apiName: 'Opportunity',  label: 'Opportunity' },
  { key: 'Project',      apiName: 'Project',      label: 'Project' },
  { key: 'WorkOrder',    apiName: 'WorkOrder',    label: 'Work Order' },
  { key: 'Installation', apiName: 'Installation', label: 'Installation' },
]

// ── Searchable select ──────────────────────────────────────────────────

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  isRequired,
  loading,
}: {
  value: string
  options: FieldOption[]
  onChange: (value: string) => void
  placeholder: string
  isRequired?: boolean
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Auto-focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10)
  }, [open])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.apiName.toLowerCase().includes(search.toLowerCase())
  )

  const selected = options.find(o => o.apiName === value)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] text-left transition focus:outline-none ${
          isRequired && !value
            ? 'border-amber-200 bg-amber-50/50'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        } ${value ? 'text-brand-dark' : 'text-gray-400'}`}
      >
        <span className="flex-1 truncate">
          {selected ? (
            <>
              <span className="font-medium">{selected.label}</span>
              {selected.label !== selected.apiName && (
                <span className="ml-1 text-[9px] text-gray-400">{selected.apiName}</span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>

        {/* Clear button — only for optional slots with a value */}
        {value && !isRequired && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange('') }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onChange('') } }}
            className="shrink-0 text-gray-300 hover:text-red-400 transition cursor-pointer"
          >
            <X className="w-3 h-3" />
          </span>
        )}

        <ChevronDown className={`w-3 h-3 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-1.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-100">
              <Search className="w-3 h-3 text-gray-400 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                className="flex-1 bg-transparent text-[11px] text-brand-dark outline-none placeholder:text-gray-400 min-w-0"
                placeholder="Search fields…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-44 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 text-[10px] text-gray-400 text-center">
                Loading fields…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-3 text-[10px] text-gray-400 text-center">
                No fields match &ldquo;{search}&rdquo;
              </div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.apiName}
                  type="button"
                  onClick={() => { onChange(o.apiName); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] transition hover:bg-gray-50 flex items-center gap-2 ${
                    o.apiName === value ? 'bg-brand-navy/5 text-brand-navy' : 'text-brand-dark'
                  }`}
                >
                  <span className="flex-1 font-medium truncate">{o.label}</span>
                  <span className="text-[9px] text-gray-400 shrink-0 font-mono">{o.apiName}</span>
                </button>
              ))
            )}
          </div>

          {/* Clear option at bottom if a value is set */}
          {value && (
            <div className="border-t border-gray-100 p-1">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setSearch('') }}
                className="w-full text-left px-3 py-1.5 text-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Object section (3 slots) ───────────────────────────────────────────

function ObjectFieldSection({
  label,
  fields,
  loading,
  values,
  onChange,
}: {
  label: string
  fields: FieldOption[]
  loading: boolean
  values: string[]
  onChange: (values: string[]) => void
}) {
  const getVal = (i: number) => values[i] ?? ''

  const setVal = (i: number, v: string) => {
    const next = [getVal(0), getVal(1), getVal(2)]
    next[i] = v
    // Trim trailing empty slots
    while (next.length > 0 && !next[next.length - 1]) next.pop()
    onChange(next)
  }

  // Each slot filters out values already chosen in other slots
  const optionsFor = (slotIndex: number) =>
    fields.filter(f => {
      const otherValues = [getVal(0), getVal(1), getVal(2)].filter((_, i) => i !== slotIndex)
      return !otherValues.includes(f.apiName)
    })

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-brand-dark">{label}</p>
      <div className="space-y-1.5">
        <div>
          <p className="text-[10px] text-brand-gray mb-1">
            Field 1 <span className="text-amber-500 font-semibold">*</span>
          </p>
          <SearchableSelect
            value={getVal(0)}
            options={optionsFor(0)}
            onChange={v => setVal(0, v)}
            placeholder="Select primary field…"
            isRequired
            loading={loading}
          />
        </div>

        <div>
          <p className="text-[10px] text-gray-400 mb-1">Field 2 <span className="text-gray-300">(optional)</span></p>
          <SearchableSelect
            value={getVal(1)}
            options={optionsFor(1)}
            onChange={v => setVal(1, v)}
            placeholder="Select field…"
            loading={loading}
          />
        </div>

        <div>
          <p className="text-[10px] text-gray-400 mb-1">Field 3 <span className="text-gray-300">(optional)</span></p>
          <SearchableSelect
            value={getVal(2)}
            options={optionsFor(2)}
            onChange={v => setVal(2, v)}
            placeholder="Select field…"
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}

// ── Config Panel ────────────────────────────────────────────────────────

export default function TeamMemberAssociationsConfigPanel({ config, onChange }: ConfigPanelProps) {
  const typed = config as TeamMemberAssociationsConfig
  const label = typed.label ?? ''
  const displayFields = typed.displayFields ?? {}

  const [objectFields, setObjectFields] = useState<Record<string, FieldOption[]>>({})
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set(OBJECT_SECTIONS.map(s => s.apiName)))

  // Fetch field definitions for all 5 object types once on mount
  useEffect(() => {
    Promise.allSettled(
      OBJECT_SECTIONS.map(section =>
        apiClient.getFields(section.apiName)
          .then((fields: Array<{ apiName: string; label: string }>) => ({
            apiName: section.apiName,
            fields: fields.map(f => ({ apiName: f.apiName, label: f.label })),
          }))
          .catch(() => ({ apiName: section.apiName, fields: [] as FieldOption[] }))
      )
    ).then(results => {
      const map: Record<string, FieldOption[]> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map[r.value.apiName] = r.value.fields
        }
      }
      setObjectFields(map)
      setLoadingSet(new Set())
    })
  }, [])

  const setObjectValues = (key: keyof DisplayFieldsType, values: string[]) => {
    onChange({ ...typed, displayFields: { ...displayFields, [key]: values } })
  }

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <div className="space-y-5">
      {/* Widget label */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Widget Label</label>
        <input
          type="text"
          className={inputCls}
          value={label}
          placeholder="Team Member Associations"
          onChange={e => onChange({ ...typed, label: e.target.value })}
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Override the header title shown on the widget</p>
      </div>

      <div className="border-t border-gray-100" />

      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-brand-dark">Display Fields</p>
        <p className="text-[10px] text-gray-400">
          Choose up to 3 fields to display on each tile type. Field 1 is the primary identifier.
        </p>
      </div>

      {OBJECT_SECTIONS.map(({ key, apiName, label: sectionLabel }) => (
        <ObjectFieldSection
          key={key}
          label={sectionLabel}
          fields={objectFields[apiName] ?? []}
          loading={loadingSet.has(apiName)}
          values={displayFields[key] ?? []}
          onChange={values => setObjectValues(key, values)}
        />
      ))}
    </div>
  )
}
