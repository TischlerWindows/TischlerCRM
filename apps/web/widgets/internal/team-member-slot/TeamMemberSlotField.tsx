'use client'

import React, { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { preloadLookupRecords, resolveLookupDisplayName } from '@/lib/utils'
import type { PanelField, TeamMemberSlotConfig } from '@/lib/schema'
import { recordUrl } from '@/lib/record-url'
import { useSchemaStore } from '@/lib/schema-store'
import { SlotInput } from './SlotInput'
import { useTeamMemberSlot, type TeamMemberRow } from './useTeamMemberSlot'
import { useDisplayFields } from './useDisplayFields'

function resolveRowDisplay(row: TeamMemberRow): {
  contact: string
  account: string
  contactId: string | null
  accountId: string | null
} {
  const contactId = (row.data.contact as string | undefined)
    ?? (row.data.ContactId as string | undefined)
    ?? (row.data.TeamMember__contact as string | undefined)
    ?? null
  const accountId = (row.data.account as string | undefined)
    ?? (row.data.AccountId as string | undefined)
    ?? (row.data.TeamMember__account as string | undefined)
    ?? null
  const denormContact =
    (row.data.contactName as string | undefined) ||
    (row.data.TeamMember__contactName as string | undefined) ||
    ''
  const denormAccount =
    (row.data.accountName as string | undefined) ||
    (row.data.TeamMember__accountName as string | undefined) ||
    ''
  const contact =
    denormContact || (contactId ? resolveLookupDisplayName(contactId, 'Contact') : '')
  const account =
    denormAccount || (accountId ? resolveLookupDisplayName(accountId, 'Account') : '')
  return {
    contact: contact && contact !== '-' ? contact : '',
    account: account && account !== '-' ? account : '',
    contactId,
    accountId,
  }
}

function DisplayFieldRows({
  fields,
  record,
  objectApiName,
}: {
  fields: string[]
  record: Record<string, unknown> | undefined
  objectApiName: string
}) {
  const schema = useSchemaStore((s) => s.schema)
  if (!record || fields.length === 0) return null

  const objectDef = schema?.objects.find((o) => o.apiName === objectApiName)

  return (
    <div className="mt-1 grid gap-x-2 gap-y-0.5 text-xs text-gray-500" style={{ gridTemplateColumns: 'auto 1fr' }}>
      {fields.map((apiName) => {
        const fieldDef = objectDef?.fields.find((f) => f.apiName === apiName)
        const label = fieldDef?.label ?? apiName
        const value = record[apiName]
        const display = value == null || value === '' ? '—' : String(value)
        return (
          <React.Fragment key={apiName}>
            <span className="text-gray-400 font-medium truncate">{label}</span>
            <span className="truncate">{display}</span>
          </React.Fragment>
        )
      })}
    </div>
  )
}

interface TeamMemberSlotFieldProps {
  /** Parent record's object api name (e.g. 'Opportunity'). */
  parentObjectApiName: string
  /** Parent record id, or null in create mode. */
  parentRecordId: string | null
  /** The TeamMemberSlot config (criterion, mode, cardinality, etc.) inlined on the panel field. */
  slotConfig: TeamMemberSlotConfig
  /** The panel field's label/style overrides — same shape used by regular fields. */
  panelField?: Pick<PanelField, 'labelOverride' | 'labelStyle' | 'valueStyle' | 'behavior'>
  /**
   * When true, render the slot value(s) as plain read-only text — no inputs,
   * no clear buttons, no add buttons. Used in view mode (record detail page)
   * so accidental clicks can't delete linked TeamMember rows. Edits go through
   * Edit mode like regular fields.
   */
  readOnly?: boolean
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
  readOnly,
}: TeamMemberSlotFieldProps) {
  const { rows, loading, fillSlot, clearRow, error } = useTeamMemberSlot({
    parentObjectApiName,
    parentRecordId,
    criterion: slotConfig.criterion,
  })
  const { fieldMap } = useDisplayFields({
    rows,
    displayFields: slotConfig.displayFields,
    enabled: !!readOnly,
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
    if (readOnly) {
      if (rows.length === 0) {
        return <div className="text-sm text-gray-400">—</div>
      }

      const contactDisplayFields = slotConfig.displayFields?.Contact ?? []
      const accountDisplayFields = slotConfig.displayFields?.Account ?? []

      return (
        <div className="text-sm text-gray-900 space-y-2">
          {rows.map((row) => {
            const { contact, account, contactId, accountId } = resolveRowDisplay(row)
            if (!contact && !account) {
              return <div key={row.id} className="text-gray-400 italic">—</div>
            }
            const rowFields = fieldMap[row.id]
            return (
              <div key={row.id}>
                <div>
                  {contact && contactId ? (
                    <Link href={recordUrl('Contact', contactId)} className="font-medium text-blue-600 underline hover:text-blue-800">
                      {contact}
                    </Link>
                  ) : contact ? (
                    <span className="font-medium">{contact}</span>
                  ) : null}
                  {contact && account && <span className="text-gray-400 mx-1">&middot;</span>}
                  {account && accountId ? (
                    <Link href={recordUrl('Account', accountId)} className="text-blue-600 underline hover:text-blue-800">
                      {account}
                    </Link>
                  ) : account ? (
                    <span className="text-gray-700">{account}</span>
                  ) : null}
                </div>
                {contactDisplayFields.length > 0 && (
                  <DisplayFieldRows
                    fields={contactDisplayFields}
                    record={rowFields?.Contact}
                    objectApiName="Contact"
                  />
                )}
                {accountDisplayFields.length > 0 && (
                  <DisplayFieldRows
                    fields={accountDisplayFields}
                    record={rowFields?.Account}
                    objectApiName="Account"
                  />
                )}
              </div>
            )
          })}
        </div>
      )
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
