'use client'
import type { ConfigPanelProps } from '@/lib/widgets/types'

export default function TeamMemberAssociationsConfigPanel({ config, onChange }: ConfigPanelProps) {
  const label = (config.label as string) ?? ''

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Widget Label</label>
        <input
          type="text"
          className={inputCls}
          value={label}
          placeholder="Team Member Associations"
          onChange={e =>
            onChange({ ...config, type: 'TeamMemberAssociations', label: e.target.value })
          }
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Override the header title shown on the widget</p>
      </div>
    </div>
  )
}
