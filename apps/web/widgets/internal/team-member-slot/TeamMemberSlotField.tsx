'use client'

import React, { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { preloadLookupRecords } from '@/lib/utils'
import type { PanelField, TeamMemberSlotConfig } from '@/lib/schema'
import { SlotInput } from './SlotInput'
import { useTeamMemberSlot } from './useTeamMemberSlot'

interface TeamMemberSlotFieldProps {
  /** Parent record's object api name (e.g. 'Opportunity'). */
  parentObjectApiName: string
  /** Parent record id, or null in create mode. */
  parentRecordId: string | null
  /** The TeamMemberSlot config (criterion, mode, cardinality, etc.) inlined on the panel field. */
  slotConfig: TeamMemberSlotConfig
  /** The panel field's label/style overrides — same shape used by regular fields. */
  panelField?: Pick<PanelField, 'labelOverride' | 'labelStyle' | 'valueStyle' | 'behavior'>
}

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

/**
 * Renders a TeamMemberSlot inside a field section so it visually matches the
 * surrounding form fields. The label respects the panel field's labelOverride
 * and labelStyle so admins can tune it via the same properties sidebar that
 * styles other fields.
 */
export function TeamMemberSlotField({
  parentObjectApiName,
  parentRecordId,
  slotConfig,
  panelField,
}: TeamMemberSlotFieldProps) {
  const { rows, loading, fillSlot, clearRow, error } = useTeamMemberSlot({
    parentObjectApiName,
    parentRecordId,
    criterion: slotConfig.criterion,
  })
  const [showAdder, setShowAdder] = useState(false)

  // Preload Contact + Account lookup caches so the bound row's resolveLookupDisplayName
  // has data on first render rather than briefly showing the raw id.
  useEffect(() => {
    void preloadLookupRecords('Contact')
    void preloadLookupRecords('Account')
  }, [])

  const cardinality = slotConfig.cardinality ?? 'single'
  const mode = slotConfig.mode ?? 'paired'
  const labelText = panelField?.labelOverride || defaultLabel(slotConfig)
  const isRequired = panelField?.behavior === 'required'

  const labelStyle: React.CSSProperties = {
    ...(panelField?.labelStyle?.color ? { color: panelField.labelStyle.color } : {}),
    fontWeight: panelField?.labelStyle?.bold ? 700 : undefined,
    fontStyle: panelField?.labelStyle?.italic ? 'italic' : undefined,
    textTransform: panelField?.labelStyle?.uppercase ? 'uppercase' : undefined,
  }

  const renderBody = () => {
    if (loading && rows.length === 0) {
      return <div className="h-9 rounded-md bg-gray-100 animate-pulse" />
    }
    if (cardinality === 'single') {
      const bound = rows[0]
      return bound ? (
        <SlotInput
          mode={mode}
          criterion={slotConfig.criterion}
          boundRow={bound}
          onFill={async () => { /* clear first to replace */ }}
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
      )
    }

    // Multi
    return (
      <div className="space-y-1.5">
        {rows.map(row => (
          <SlotInput
            key={row.id}
            mode={mode}
            criterion={slotConfig.criterion}
            boundRow={row}
            onFill={async () => { /* no-op while bound */ }}
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
    )
  }

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-0.5" style={labelStyle}>
        {labelText}
        {isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      {renderBody()}
    </div>
  )
}
