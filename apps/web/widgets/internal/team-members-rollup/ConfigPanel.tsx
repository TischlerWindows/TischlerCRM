'use client'
import type { ConfigPanelProps } from '@/lib/widgets/types'

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

export default function TeamMembersRollupConfigPanel({ config, onChange }: ConfigPanelProps) {
  const rollupFromProperty = !!config.rollupFromProperty
  const label = (config.label as string) ?? ''

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <div className="space-y-4">
      {/* ── Data Source ── */}
      <div className="space-y-3">
        <Toggle
          label="Show all team members from Property tree"
          checked={rollupFromProperty}
          onChange={v => onChange({ ...config, type: 'TeamMembersRollup', rollupFromProperty: v })}
        />
        <p className="text-[10px] text-gray-400 mt-0.5">
          {rollupFromProperty
            ? 'Fetches team members from the current record and the full Property hierarchy'
            : 'Fetches only the current record\u2019s team members'}
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* ── Widget Label ── */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Widget Label</label>
        <input
          type="text"
          className={inputCls}
          value={label}
          placeholder="Team Members"
          onChange={e => onChange({ ...config, type: 'TeamMembersRollup', label: e.target.value })}
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Override the header title shown on the widget</p>
      </div>
    </div>
  )
}
