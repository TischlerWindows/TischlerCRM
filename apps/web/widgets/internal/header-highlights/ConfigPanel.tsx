'use client'
import { useState } from 'react'
import type { ConfigPanelProps } from '@/lib/widgets/types'

type ActionKey = 'edit' | 'delete' | 'clone' | 'print'

const ACTION_OPTIONS: Array<{ key: ActionKey; label: string; description: string }> = [
  { key: 'edit', label: 'Edit', description: 'Open edit form for this record' },
  { key: 'delete', label: 'Delete', description: 'Permanently delete this record' },
  { key: 'clone', label: 'Clone Record', description: 'Duplicate this record' },
  { key: 'print', label: 'Print Page', description: 'Print the current record page' },
]

export default function HeaderHighlightsConfigPanel({ config, onChange, object }: ConfigPanelProps) {
  const [filterQuery, setFilterQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const selectedApiNames: string[] = Array.isArray(config.fieldApiNames)
    ? (config.fieldApiNames as string[])
    : []
  const visibleActions: ActionKey[] = Array.isArray(config.visibleActions)
    ? (config.visibleActions as ActionKey[])
    : ['edit', 'delete']

  const availableFields = object?.fields ?? []

  const filteredFields = availableFields.filter(
    (f) =>
      !selectedApiNames.includes(f.apiName) &&
      (f.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
        f.apiName.toLowerCase().includes(filterQuery.toLowerCase()))
  )

  const handleAddField = (apiName: string) => {
    if (selectedApiNames.includes(apiName) || selectedApiNames.length >= 6) return
    onChange({ ...config, type: 'HeaderHighlights', fieldApiNames: [...selectedApiNames, apiName] })
    setDropdownOpen(false)
    setFilterQuery('')
  }

  const handleRemoveField = (apiName: string) => {
    onChange({ ...config, type: 'HeaderHighlights', fieldApiNames: selectedApiNames.filter((n) => n !== apiName) })
  }

  const handleToggleAction = (action: ActionKey) => {
    const next = visibleActions.includes(action)
      ? visibleActions.filter((a) => a !== action)
      : [...visibleActions, action]
    onChange({ ...config, type: 'HeaderHighlights', visibleActions: next })
  }

  return (
    <div className="space-y-5">
      {/* Highlight Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-brand-dark">Highlight Fields</label>
          <span className="text-[10px] text-brand-gray">{selectedApiNames.length}/6</span>
        </div>

        {selectedApiNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedApiNames.map((apiName) => {
              const fd = availableFields.find((f) => f.apiName === apiName)
              return (
                <span
                  key={apiName}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-navy/10 px-2.5 py-1 text-xs font-medium text-brand-navy"
                >
                  {fd?.label ?? apiName}
                  <button
                    type="button"
                    onClick={() => handleRemoveField(apiName)}
                    className="text-brand-navy/50 hover:text-brand-navy ml-0.5 leading-none"
                    aria-label={`Remove ${fd?.label ?? apiName}`}
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {selectedApiNames.length === 0 && (
          <p className="text-[11px] text-brand-gray italic">No fields selected — add up to 6 key fields to surface in the record header.</p>
        )}

        {selectedApiNames.length < 6 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-400 text-base leading-none">+</span> Add field
            </button>
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => { setDropdownOpen(false); setFilterQuery('') }}
                />
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="sticky top-0 border-b border-gray-100 bg-white p-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Search fields..."
                      className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs outline-none focus:border-brand-navy transition"
                    />
                  </div>
                  {filteredFields.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-gray-400">No fields available</div>
                  ) : (
                    filteredFields.map((f) => (
                      <button
                        key={f.apiName}
                        type="button"
                        onClick={() => handleAddField(f.apiName)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 text-left transition-colors"
                      >
                        <span className="font-medium text-brand-dark">{f.label}</span>
                        <span className="ml-auto text-[10px] text-gray-400 font-mono">{f.apiName}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Action Buttons */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-brand-dark">Action Buttons</label>
        <div className="space-y-2">
          {ACTION_OPTIONS.map(({ key, label, description }) => (
            <label
              key={key}
              className="flex items-start gap-2.5 cursor-pointer select-none group"
            >
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={visibleActions.includes(key)}
                  onChange={() => handleToggleAction(key)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    visibleActions.includes(key)
                      ? 'bg-brand-navy border-brand-navy'
                      : 'bg-white border-gray-300 group-hover:border-gray-400'
                  }`}
                >
                  {visibleActions.includes(key) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand-dark">{label}</p>
                <p className="text-[10px] text-brand-gray">{description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
