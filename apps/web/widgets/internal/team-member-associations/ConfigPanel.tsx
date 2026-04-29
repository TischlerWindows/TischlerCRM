'use client'
import { useState, useEffect } from 'react'
import type { ConfigPanelProps } from '@/lib/widgets/types'
import type { TeamMemberAssociationsConfig } from '@/lib/schema'
import { apiClient } from '@/lib/api-client'
import { ObjectFieldSection, type FieldOption } from '../shared/ConfigFieldSection'

// ── Types ──────────────────────────────────────────────────────────────

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
          placeholder="Connections"
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
