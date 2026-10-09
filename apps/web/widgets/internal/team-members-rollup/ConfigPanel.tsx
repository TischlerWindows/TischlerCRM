'use client'
import { useState, useEffect } from 'react'
import type { ConfigPanelProps } from '@/lib/widgets/types'
import type { TeamMembersRollupConfig } from '@/lib/schema'
import { apiClient } from '@/lib/api-client'
import { ObjectFieldSection, type FieldOption } from '../shared/ConfigFieldSection'

// ── Config Panel ─────────────────────────────────────────────────────────

export default function TeamMembersRollupConfigPanel({ config, onChange }: ConfigPanelProps) {
  const typed = config as TeamMembersRollupConfig
  const label = typed.label ?? ''
  const displayFields = typed.displayFields ?? {}

  const [contactFields, setContactFields] = useState<FieldOption[]>([])
  const [accountFields, setAccountFields] = useState<FieldOption[]>([])
  const [loadingContact, setLoadingContact] = useState(true)
  const [loadingAccount, setLoadingAccount] = useState(true)

  useEffect(() => {
    apiClient.getFields('Contact')
      .then((fields: Array<{ apiName: string; label: string }>) =>
        setContactFields(fields.map(f => ({ apiName: f.apiName, label: f.label })))
      )
      .catch(() => setContactFields([]))
      .finally(() => setLoadingContact(false))

    apiClient.getFields('Account')
      .then((fields: Array<{ apiName: string; label: string }>) =>
        setAccountFields(fields.map(f => ({ apiName: f.apiName, label: f.label })))
      )
      .catch(() => setAccountFields([]))
      .finally(() => setLoadingAccount(false))
  }, [])

  const update = (patch: Partial<TeamMembersRollupConfig>) =>
    onChange({ ...typed, type: 'TeamMembersRollup', ...patch })

  const setDisplayFieldValues = (key: 'Contact' | 'Account', values: string[]) =>
    update({ displayFields: { ...displayFields, [key]: values } })

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <div className="space-y-5">
      {/* ── Widget Label ── */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Widget Label</label>
        <input
          type="text"
          className={inputCls}
          value={label}
          placeholder="Connections"
          onChange={e => update({ label: e.target.value })}
        />
        <p className="text-[10px] text-gray-400 mt-0.5">Override the header title shown on the widget</p>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Display Fields ── */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-brand-dark">Display Fields</p>
        <p className="text-[10px] text-gray-400">
          Choose up to 3 fields to display on each tile type. Field 1 is the primary sub-label shown below the record name.
        </p>
      </div>

      <ObjectFieldSection
        label="Contact Tile"
        fields={contactFields}
        loading={loadingContact}
        values={displayFields.Contact ?? []}
        onChange={values => setDisplayFieldValues('Contact', values)}
      />

      <ObjectFieldSection
        label="Account Tile"
        fields={accountFields}
        loading={loadingAccount}
        values={displayFields.Account ?? []}
        onChange={values => setDisplayFieldValues('Account', values)}
      />
    </div>
  )
}
