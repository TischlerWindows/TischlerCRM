'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { LookupSearch } from '@/components/form/lookup-search'
import { useSchemaStore } from '@/lib/schema-store'
import type { FieldDef, TeamMemberSlotCriterion } from '@/lib/schema'
import type { TeamMemberRow } from './useTeamMemberSlot'

type Mode = 'contact' | 'account' | 'paired'

interface SlotInputProps {
  mode: Mode
  criterion: TeamMemberSlotCriterion
  /** When set, the input is bound to this row (edit existing slot). */
  boundRow?: TeamMemberRow
  /** Called to fill/replace the slot — implementer is responsible for routing flag vs role logic. */
  onFill: (input: { contactId?: string | null; accountId?: string | null; role?: string }) => Promise<void>
  /** Called to clear the bound row. */
  onClear?: () => Promise<void>
  /** Optional placeholder copy for the lookup. */
  placeholder?: string
  disabled?: boolean
}

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
] as const

/**
 * Compact paired Account→Contact input. In `paired` mode:
 *   - Account picker first (the slot accepts no account when explicitly cleared).
 *   - Contact picker filtered to the selected account once chosen.
 *   - Falls back to global contact picker when the user opts out of account.
 *
 * In `account`/`contact` modes only the relevant lookup is shown.
 *
 * For flag-bound slots that bind to a *new* person (no existing TM row), an
 * inline role picklist is revealed before save — TM.role is required by schema.
 */
export function SlotInput({
  mode,
  criterion,
  boundRow,
  onFill,
  onClear,
  placeholder,
  disabled,
}: SlotInputProps) {
  const schema = useSchemaStore(s => s.schema)
  const schemaObjects = schema?.objects

  const roleValues: string[] = useMemo(() => {
    const tmObj = schemaObjects?.find(o => o.apiName === 'TeamMember')
    const roleField = tmObj?.fields.find(f => f.apiName === 'role')
    return roleField?.picklistValues && roleField.picklistValues.length > 0
      ? roleField.picklistValues
      : [...ROLE_FALLBACK]
  }, [schemaObjects])

  // ── Local picker state ──────────────────────────────────────────────
  const [accountId, setAccountId] = useState<string | null>(
    (boundRow?.data.account as string | undefined) ?? null,
  )
  const [contactId, setContactId] = useState<string | null>(
    (boundRow?.data.contact as string | undefined) ?? null,
  )
  const [accountQuery, setAccountQuery] = useState('')
  const [contactQuery, setContactQuery] = useState('')
  const [accountActive, setAccountActive] = useState(false)
  const [contactActive, setContactActive] = useState(false)
  const [accountResults, setAccountResults] = useState<Record<string, unknown>[]>([])
  const [contactResults, setContactResults] = useState<Record<string, unknown>[]>([])
  const [skipAccount, setSkipAccount] = useState(
    // Skip account picker in contact-only mode, or when editing a paired row that has a contact but no account.
    // Account-only mode must NEVER skip — the account picker is its only input.
    mode === 'contact' || (mode === 'paired' && !!boundRow?.data.contact && !boundRow?.data.account)
  )
  const [pendingRole, setPendingRole] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced account search
  useEffect(() => {
    if (!accountActive) return
    if (mode === 'contact') return
    if (accountQuery.trim().length < 2) {
      setAccountResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const data = await apiClient.get<Record<string, unknown>[]>(
          `/objects/Account/records/search?q=${encodeURIComponent(accountQuery.trim())}`,
        )
        setAccountResults(Array.isArray(data) ? data : [])
      } catch {
        setAccountResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [accountQuery, accountActive, mode])

  // Contact search — global, OR filtered to current account.
  useEffect(() => {
    if (!contactActive) return
    if (mode === 'account') return
    const t = setTimeout(async () => {
      try {
        if (mode === 'paired' && accountId && !skipAccount) {
          // Filter to account's contacts; let local query trim within
          const data = await apiClient.get<Record<string, unknown>[]>(
            `/objects/Contact/records?filter[account]=${encodeURIComponent(accountId)}&limit=200`,
          )
          const arr = Array.isArray(data) ? data : []
          if (!contactQuery.trim()) {
            setContactResults(arr)
          } else {
            const q = contactQuery.trim().toLowerCase()
            setContactResults(
              arr.filter(r => {
                const name = `${r.firstName ?? ''} ${r.lastName ?? r.name ?? ''}`.toLowerCase()
                const email = String(r.email ?? '').toLowerCase()
                return name.includes(q) || email.includes(q)
              }),
            )
          }
        } else {
          if (contactQuery.trim().length < 2) {
            setContactResults([])
            return
          }
          const data = await apiClient.get<Record<string, unknown>[]>(
            `/objects/Contact/records/search?q=${encodeURIComponent(contactQuery.trim())}`,
          )
          setContactResults(Array.isArray(data) ? data : [])
        }
      } catch {
        setContactResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [contactQuery, contactActive, mode, accountId, skipAccount])

  const hasSelection = (mode === 'contact' && !!contactId) ||
    (mode === 'account' && !!accountId) ||
    (mode === 'paired' && (!!contactId || !!accountId))

  const isFlagNetNew = criterion.kind === 'flag' && !boundRow

  const canSave = hasSelection && !saving && (!isFlagNetNew || !!pendingRole)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await onFill({
        contactId: mode === 'account' ? null : contactId,
        accountId: mode === 'contact' ? null : accountId,
        role: isFlagNetNew ? pendingRole : undefined,
      })
      // Reset inline state after successful save (slot re-binds via boundRow update)
      setPendingRole('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // FieldDef shapes for LookupSearch — minimal, just enough to drive the picker.
  const accountFieldDef: FieldDef = {
    apiName: 'account',
    label: 'Account',
    type: 'Lookup',
    lookupObject: 'Account',
    relationshipName: 'Account',
  } as FieldDef

  const contactFieldDef: FieldDef = {
    apiName: 'contact',
    label: 'Contact',
    type: 'Lookup',
    lookupObject: 'Contact',
    relationshipName: 'Contact',
  } as FieldDef

  // ── Render bound row (already filled) ───────────────────────────────
  if (boundRow) {
    const cName =
      (boundRow.data.contactName as string | undefined) ||
      (boundRow.data.TeamMember__contactName as string | undefined) ||
      ''
    const aName =
      (boundRow.data.accountName as string | undefined) ||
      (boundRow.data.TeamMember__accountName as string | undefined) ||
      ''
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm">
        <div className="flex-1 min-w-0 truncate">
          {cName && <span className="font-medium text-gray-900">{cName}</span>}
          {cName && aName && <span className="text-gray-400 mx-1">·</span>}
          {aName && <span className="text-gray-700">{aName}</span>}
          {!cName && !aName && (
            <span className="text-gray-500 italic">
              {boundRow.data.contact as string | undefined ?? boundRow.data.account as string | undefined ?? '—'}
            </span>
          )}
        </div>
        {onClear && !disabled && (
          <button
            type="button"
            onClick={() => void onClear()}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // ── Render empty slot inputs ───────────────────────────────────────
  return (
    <div className="space-y-2">
      {(mode === 'account' || mode === 'paired') && !skipAccount && (
        <LookupSearch
          fieldDef={accountFieldDef}
          value={accountId ?? ''}
          onChange={(val) => {
            setAccountId(val ? String(val) : null)
            // Reset contact when account changes in paired mode
            if (mode === 'paired') setContactId(null)
          }}
          records={accountResults}
          lookupQuery={accountQuery}
          isActive={accountActive}
          onQueryChange={setAccountQuery}
          onFocus={() => setAccountActive(true)}
          onBlur={() => setTimeout(() => setAccountActive(false), 150)}
          schemaObjects={schemaObjects}
          disabled={disabled}
        />
      )}
      {(mode === 'contact' || mode === 'paired') &&
        (mode === 'contact' || skipAccount || accountId) && (
          <LookupSearch
            fieldDef={contactFieldDef}
            value={contactId ?? ''}
            onChange={(val) => setContactId(val ? String(val) : null)}
            records={contactResults}
            lookupQuery={contactQuery}
            isActive={contactActive}
            onQueryChange={setContactQuery}
            onFocus={() => setContactActive(true)}
            onBlur={() => setTimeout(() => setContactActive(false), 150)}
            schemaObjects={schemaObjects}
            disabled={disabled}
          />
        )}
      {mode === 'paired' && !skipAccount && (
        <button
          type="button"
          onClick={() => {
            setSkipAccount(true)
            setAccountId(null)
          }}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Pick contact without account
        </button>
      )}
      {mode === 'paired' && skipAccount && (
        <button
          type="button"
          onClick={() => setSkipAccount(false)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Pick an account too
        </button>
      )}

      {isFlagNetNew && hasSelection && (
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            value={pendingRole}
            onChange={(e) => setPendingRole(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select role…</option>
            {roleValues.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            This person isn&apos;t on this record yet — pick their role.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {hasSelection && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : placeholder ? placeholder : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountId(null)
              setContactId(null)
              setAccountQuery('')
              setContactQuery('')
              setPendingRole('')
              setError(null)
            }}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
