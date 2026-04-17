'use client'
import { useState, useEffect } from 'react'
import type { ConfigPanelProps } from '@/lib/widgets/types'
import type { TeamMembersRollupConfig } from '@/lib/schema'
import { apiClient } from '@/lib/api-client'
import { ObjectFieldSection, type FieldOption } from '../shared/ConfigFieldSection'

// ── Toggle ──────────────────────────────────────────────────────────────

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

// ── Config Panel ─────────────────────────────────────────────────────────

const CONTACT_OBJECTS = [
  { key: 'Contact' as const, apiName: 'Contact', label: 'Contact' },
]

const ACCOUNT_OBJECTS = [
  { key: 'Account' as const, apiName: 'Account', label: 'Account' },
]

export default function TeamMembersRollupConfigPanel({ config, onChange }: ConfigPanelProps) {
  const typed = config as TeamMembersRollupConfig
  const rollupFromProperty = !!typed.rollupFromProperty
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
      {/* ── Data Source ── */}
      <div className="space-y-3">
        <Toggle
          label="Show all team members from Property tree"
          checked={rollupFromProperty}
          onChange={v => update({ rollupFromProperty: v })}
        />
        <p className="text-[10px] text-gray-400 mt-0.5">
          {rollupFromProperty
            ? 'Fetches team members from the current record and the full Property hierarchy'
            : 'Fetches only the current record\u2019s team members'}
        </p>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Widget Label ── */}
      <div>
        <label className="block text-[11px] font-semibold text-brand-dark mb-1">Widget Label</label>
        <input
          type="text"
          className={inputCls}
          value={label}
          placeholder="Team Members"
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
