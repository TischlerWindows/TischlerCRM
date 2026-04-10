'use client'
import { useState } from 'react'
import type { ConfigPanelProps } from '@/lib/widgets/types'
import type { TeamMemberAssociationsConfig } from '@/lib/schema'

// ── Per-object configuration rows ──────────────────────────────────────

const OBJECT_SECTIONS: Array<{
  key: keyof NonNullable<TeamMemberAssociationsConfig['displayFields']>
  label: string
  placeholder: string
}> = [
  { key: 'Property',     label: 'Property fields',     placeholder: 'propertyNumber, address, city' },
  { key: 'Opportunity',  label: 'Opportunity fields',  placeholder: 'opportunityNumber, amount, stage' },
  { key: 'Project',      label: 'Project fields',      placeholder: 'projectNumber, stage' },
  { key: 'WorkOrder',    label: 'Work Order fields',   placeholder: 'workOrderNumber, status' },
  { key: 'Installation', label: 'Installation fields', placeholder: 'installationNumber' },
]

function FieldTagInput({
  label,
  placeholder,
  fields,
  onChange,
}: {
  label: string
  placeholder: string
  fields: string[]
  onChange: (fields: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && !fields.includes(trimmed)) {
      onChange([...fields, trimmed])
    }
    setDraft('')
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold text-brand-dark mb-1">{label}</label>

      {fields.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {fields.map(f => (
            <span
              key={f}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy text-[10px] font-medium"
            >
              {f}
              <button
                type="button"
                onClick={() => onChange(fields.filter(x => x !== f))}
                className="ml-0.5 leading-none text-brand-navy/50 hover:text-brand-navy"
                aria-label={`Remove ${f}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1 px-2.5 text-[11px] text-brand-dark outline-none focus:border-brand-navy transition"
        value={draft}
        placeholder={fields.length ? 'Add a field API name…' : placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === ',' || e.key === ' ') { e.preventDefault(); commit() }
        }}
        onBlur={commit}
      />
    </div>
  )
}

// ── Config Panel ────────────────────────────────────────────────────────

export default function TeamMemberAssociationsConfigPanel({ config, onChange }: ConfigPanelProps) {
  const typed = config as TeamMemberAssociationsConfig
  const label = typed.label ?? ''
  const displayFields = typed.displayFields ?? {}

  const setObjectFields = (
    key: keyof NonNullable<TeamMemberAssociationsConfig['displayFields']>,
    fields: string[],
  ) => {
    onChange({
      ...typed,
      displayFields: { ...displayFields, [key]: fields },
    })
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

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Per-object display field configuration */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-brand-dark">Display Fields</p>
        <p className="text-[10px] text-gray-400">
          Choose which fields appear on each tile type. Type a field API name and press Enter to add it.
        </p>
      </div>

      <div className="space-y-3">
        {OBJECT_SECTIONS.map(({ key, label: sectionLabel, placeholder }) => (
          <FieldTagInput
            key={key}
            label={sectionLabel}
            placeholder={placeholder}
            fields={displayFields[key] ?? []}
            onChange={fields => setObjectFields(key, fields)}
          />
        ))}
      </div>
    </div>
  )
}
