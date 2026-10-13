'use client'

import { useMemo, useState } from 'react'
import {
  getDefaultPicklistTarget,
  getDistinctPicklistSourceValues,
  PICKLIST_LEAVE_BLANK,
  resolvePicklistImportValue,
} from '@/lib/salesforce-import-templates'

export function PicklistValueMapping({
  column,
  rows,
  options,
  mappings,
  onChange,
}: {
  column: string
  rows: Record<string, string>[]
  options: string[]
  mappings: Record<string, string>
  onChange: (sourceValue: string, targetValue: string) => void
}) {
  const sourceValues = useMemo(() => getDistinctPicklistSourceValues(rows, column), [rows, column])
  const [open, setOpen] = useState(false)
  const unresolvedCount = sourceValues.filter((source) =>
    !resolvePicklistImportValue(source, mappings, options).resolved,
  ).length

  if (sourceValues.length === 0) return null

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="relative mt-2">
      <summary className="cursor-pointer select-none text-xs font-medium text-brand-navy hover:text-brand-dark">
        Map picklist values ({sourceValues.length})
        {unresolvedCount > 0 && <span className="ml-2 text-amber-700">{unresolvedCount} need mapping</span>}
      </summary>
      {open && <div className="absolute left-0 top-full z-40 mt-2 w-[min(34rem,80vw)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="grid grid-cols-2 gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase text-gray-500">
          <span>Source value</span>
          <span>CRM value</span>
        </div>
        <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
          {sourceValues.map((sourceValue) => {
            const targetValue = Object.prototype.hasOwnProperty.call(mappings, sourceValue)
              ? mappings[sourceValue]
              : getDefaultPicklistTarget(sourceValue, options)
            return (
              <div key={sourceValue || '__blank__'} className="grid grid-cols-2 items-center gap-3 px-3 py-2">
                <span className="min-w-0 truncate text-xs text-gray-700">{sourceValue || '(blank)'}</span>
                <select
                  aria-label={`CRM value for ${column} ${sourceValue || 'blank source'}`}
                  value={targetValue}
                  onChange={(event) => onChange(sourceValue, event.target.value)}
                  className="h-8 min-w-0 rounded border border-gray-300 bg-white px-2 text-xs"
                >
                  <option value="">— Choose a CRM value —</option>
                  <option value={PICKLIST_LEAVE_BLANK}>Leave blank</option>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      </div>}
    </details>
  )
}
