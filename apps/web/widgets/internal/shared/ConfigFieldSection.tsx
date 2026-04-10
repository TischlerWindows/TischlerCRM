'use client'
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────

export type FieldOption = { apiName: string; label: string }

// ── Searchable select ──────────────────────────────────────────────────

export function SearchableSelect({
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

export function ObjectFieldSection({
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
    while (next.length > 0 && !next[next.length - 1]) next.pop()
    onChange(next)
  }

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
