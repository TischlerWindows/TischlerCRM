'use client'

import { useMemo } from 'react'
import type { ConfigPanelProps } from '@/lib/widgets/types'
import type { TeamMemberSlotConfig, TeamMemberSlotCriterion } from '@/lib/schema'
import { useSchemaStore } from '@/lib/schema-store'

const FLAGS: Array<{ value: 'primaryContact' | 'contractHolder' | 'quoteRecipient'; label: string }> = [
  { value: 'primaryContact', label: 'Primary Contact' },
  { value: 'contractHolder', label: 'Contract Holder' },
  { value: 'quoteRecipient', label: 'Quote Recipient' },
]

const ROLE_FALLBACK = [
  'Homeowner',
  'General Contractor',
  'Subcontractor',
  'Architect / Designer',
  'Property Manager',
  'Sales Rep',
  'Installer',
  'Inspector',
  'Engineer',
  'Other',
]

function encodeCriterion(c: TeamMemberSlotCriterion): string {
  return c.kind === 'flag' ? `flag:${c.flag}` : `role:${c.role}`
}

function decodeCriterion(s: string): TeamMemberSlotCriterion | null {
  if (s.startsWith('flag:')) {
    const flag = s.slice(5)
    if (flag === 'primaryContact' || flag === 'contractHolder' || flag === 'quoteRecipient') {
      return { kind: 'flag', flag }
    }
    return null
  }
  if (s.startsWith('role:')) {
    const role = s.slice(5)
    if (!role) return null
    return { kind: 'role', role }
  }
  return null
}

export default function TeamMemberSlotConfigPanel({ config, onChange }: ConfigPanelProps) {
  const typed = (config as unknown as TeamMemberSlotConfig) ?? ({
    type: 'TeamMemberSlot',
    criterion: { kind: 'flag', flag: 'primaryContact' } as TeamMemberSlotCriterion,
    cardinality: 'single',
    mode: 'paired',
  } as TeamMemberSlotConfig)

  const schema = useSchemaStore(s => s.schema)
  const roleValues: string[] = useMemo(() => {
    const tm = schema?.objects.find(o => o.apiName === 'TeamMember')
    const role = tm?.fields.find(f => f.apiName === 'role')
    return role?.picklistValues && role.picklistValues.length > 0
      ? role.picklistValues
      : ROLE_FALLBACK
  }, [schema])

  const update = (patch: Partial<TeamMemberSlotConfig>) =>
    onChange({ ...typed, type: 'TeamMemberSlot', ...patch })

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <div className="space-y-5">
      {/* Slot label */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Slot Label</label>
        <input
          type="text"
          className={inputCls}
          value={typed.label ?? ''}
          placeholder="e.g., Quote Recipient"
          onChange={e => update({ label: e.target.value })}
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Falls back to the criterion name when blank.</p>
      </div>

      <div className="border-t border-gray-100" />

      {/* Criterion */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Bind to</label>
        <select
          className={inputCls}
          value={encodeCriterion(typed.criterion)}
          onChange={e => {
            const decoded = decodeCriterion(e.target.value)
            if (decoded) update({ criterion: decoded })
          }}
        >
          <optgroup label="Flags">
            {FLAGS.map(f => (
              <option key={f.value} value={`flag:${f.value}`}>{f.label}</option>
            ))}
          </optgroup>
          <optgroup label="Roles">
            {roleValues.map(r => (
              <option key={r} value={`role:${r}`}>{r}</option>
            ))}
          </optgroup>
        </select>
        <p className="text-[10px] text-gray-400 mt-0.5">
          Flag-bound slots may share a row with other flags; role-bound slots create a new row per pick.
        </p>
      </div>

      <div className="border-t border-gray-100" />

      {/* Cardinality */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Cardinality</label>
        <div className="flex gap-1">
          {(['single', 'multi'] as const).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => update({ cardinality: c })}
              className={`flex-1 px-3 py-1.5 text-xs rounded-md border ${
                (typed.cardinality ?? 'single') === c
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {c === 'single' ? 'Single' : 'Multi'}
            </button>
          ))}
        </div>
      </div>

      {/* Mode */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Mode</label>
        <div className="flex gap-1">
          {(['contact', 'account', 'paired'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => update({ mode: m })}
              className={`flex-1 px-3 py-1.5 text-xs rounded-md border capitalize ${
                (typed.mode ?? 'paired') === m
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">
          Paired = Account first, then Contact (with a fallback to contact-only).
        </p>
      </div>

      <div className="border-t border-gray-100" />

      {/* Placeholder */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Save button label (optional)</label>
        <input
          type="text"
          className={inputCls}
          value={typed.placeholder ?? ''}
          placeholder="Save"
          onChange={e => update({ placeholder: e.target.value })}
        />
      </div>
    </div>
  )
}
