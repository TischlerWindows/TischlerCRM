'use client'

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import type { TeamMemberSlotConfig } from '@/lib/schema'
import { SlotInput } from './SlotInput'
import { useTeamMemberSlot } from './useTeamMemberSlot'

function defaultLabel(config: TeamMemberSlotConfig): string {
  if (config.label) return config.label
  if (config.criterion.kind === 'flag') {
    switch (config.criterion.flag) {
      case 'primaryContact': return 'Primary Contact'
      case 'contractHolder': return 'Contract Holder'
      case 'quoteRecipient': return 'Quote Recipient'
    }
  }
  return config.criterion.role
}

export default function TeamMemberSlotWidget({ config, record, object }: WidgetProps) {
  const slotConfig = config as unknown as TeamMemberSlotConfig
  const recordId = (record.id as string | undefined) ?? null

  const { rows, loading, error, fillSlot, clearRow } = useTeamMemberSlot({
    parentObjectApiName: object.apiName,
    parentRecordId: recordId,
    criterion: slotConfig.criterion,
  })

  const [showAdder, setShowAdder] = useState(false)

  const cardinality = slotConfig.cardinality ?? 'single'
  const mode = slotConfig.mode ?? 'paired'
  const label = defaultLabel(slotConfig)

  // Single mode: show the bound row (if any), else show the inline input.
  if (cardinality === 'single') {
    const bound = rows[0]
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-gray-500 uppercase">
          {label}
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {loading && rows.length === 0 ? (
          <div className="h-9 rounded-md bg-gray-100 animate-pulse" />
        ) : bound ? (
          <SlotInput
            mode={mode}
            criterion={slotConfig.criterion}
            boundRow={bound}
            onFill={async () => { /* no-op while bound; clear first to replace */ }}
            onClear={async () => { await clearRow(bound.id) }}
            placeholder={slotConfig.placeholder}
          />
        ) : (
          <SlotInput
            mode={mode}
            criterion={slotConfig.criterion}
            onFill={async (input) => { await fillSlot(input) }}
            placeholder={slotConfig.placeholder}
          />
        )}
      </div>
    )
  }

  // Multi mode: show all rows as a chip strip + an "Add another" inline adder.
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 uppercase">{label}</label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="space-y-1.5">
        {rows.map(row => (
          <SlotInput
            key={row.id}
            mode={mode}
            criterion={slotConfig.criterion}
            boundRow={row}
            onFill={async () => { /* no-op while bound; clear and re-add to replace */ }}
            onClear={async () => { await clearRow(row.id) }}
          />
        ))}
        {showAdder ? (
          <div className="rounded-md border border-dashed border-gray-300 p-2">
            <SlotInput
              mode={mode}
              criterion={slotConfig.criterion}
              onFill={async (input) => {
                await fillSlot(input)
                setShowAdder(false)
              }}
              placeholder={slotConfig.placeholder ?? 'Add'}
            />
            <button
              type="button"
              onClick={() => setShowAdder(false)}
              className="mt-1 text-[11px] text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdder(true)}
            className="inline-flex items-center gap-1 text-xs text-brand-navy hover:text-brand-navy/80 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            {rows.length === 0 ? 'Add' : 'Add another'}
          </button>
        )}
      </div>
    </div>
  )
}
