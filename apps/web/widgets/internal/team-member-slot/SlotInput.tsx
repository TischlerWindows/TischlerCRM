'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { X, UserCircle, Mail, Phone, Building2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { LookupSearch } from '@/components/form/lookup-search'
import { useSchemaStore } from '@/lib/schema-store'
import { resolveLookupDisplayName } from '@/lib/utils'
import type { FieldDef, TeamMemberSlotCriterion } from '@/lib/schema'
import type { TeamMemberRow } from './useTeamMemberSlot'
import { getRecordName } from '../shared/recordName'
import { InlineCreateContact, InlineCreateAccount } from '../shared/InlineCreate'

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
  const [pendingRole, setPendingRole] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Paired-mode: user explicitly opts out of an Account so the Contact picker
  // searches all contacts globally. Stays false otherwise so the Account picker
  // is the only entry point and the Contact picker is gated behind a selection.
  const [noAccountMode, setNoAccountMode] = useState(false)

  // The /records and /records/search API endpoints return raw rows of shape
  // { id, data: {...}, createdBy: {...} } — but LookupSearch (and the lookup
  // cache pattern in lib/utils.ts:getLookupRecords) expects flattened records
  // of shape { id, ...data }. Without flattening, getRecordLabel(record) reads
  // record.accountName / record.name from the wrong place and returns empty.
  function flatten(arr: Record<string, unknown>[]): Record<string, unknown>[] {
    return arr.map(r => {
      const inner = (r.data && typeof r.data === 'object') ? (r.data as Record<string, unknown>) : {}
      return { id: r.id, ...inner }
    })
  }

  // Build a lowercased searchable string from a flattened record. Handles the
  // Contact CompositeText `name` object — the server-side `/records/search`
  // endpoint can't find composite-name contacts because Object.values stringifies
  // a nested object as "[object Object]". Doing this client-side fixes that.
  function searchText(r: Record<string, unknown>): string {
    const parts: string[] = []
    const collect = (v: unknown) => {
      if (v == null) return
      if (typeof v === 'string') parts.push(v.toLowerCase())
      else if (typeof v === 'object' && !Array.isArray(v)) {
        for (const inner of Object.values(v as Record<string, unknown>)) collect(inner)
      }
    }
    for (const v of Object.values(r)) collect(v)
    return parts.join(' ')
  }

  // Account list — fetched once on first activation and filtered client-side.
  // This avoids the server's /records/search endpoint missing matches when
  // names are stored as composite objects, and shows results on focus.
  const accountListRef = React.useRef<Record<string, unknown>[] | null>(null)
  useEffect(() => {
    if (!accountActive) return
    if (mode === 'contact') return
    let cancelled = false
    const run = async () => {
      try {
        if (!accountListRef.current) {
          const data = await apiClient.get<Record<string, unknown>[]>(
            `/objects/Account/records?limit=200`,
          )
          accountListRef.current = Array.isArray(data) ? flatten(data) : []
        }
        if (cancelled) return
        const all = accountListRef.current
        const q = accountQuery.trim().toLowerCase()
        const filtered = q ? all.filter(r => searchText(r).includes(q)) : all
        setAccountResults(filtered.slice(0, 50))
      } catch {
        if (!cancelled) setAccountResults([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [accountQuery, accountActive, mode])

  // Global contact list — fetched once on first activation when no account
  // filter is active. Client-side filtering using a composite-name-aware
  // comparator finds Contacts whose name is stored as a CompositeText object
  // (the server's /records/search misses those because it stringifies nested
  // objects as "[object Object]").
  const contactListRef = React.useRef<Record<string, unknown>[] | null>(null)
  useEffect(() => {
    if (mode === 'account') return
    // Paired + account-picked path renders a static list (ContactPickList) and
    // must fetch eagerly when accountId changes, NOT when the input is active
    // (there's no input — the list shows directly). Other paths (global
    // contact search via LookupSearch) still gate on contactActive so we
    // don't load the global list until the user opens the dropdown.
    const isPairedAccountList = mode === 'paired' && !!accountId
    if (!isPairedAccountList && !contactActive) return
    let cancelled = false
    const run = async () => {
      try {
        // Paired + account selected: filter to that account's contacts (handles
        // both `account` plain and auto-generated `AccountId` field names).
        if (isPairedAccountList) {
          const [byAccount, byAccountId] = await Promise.all([
            apiClient
              .get<Record<string, unknown>[]>(
                `/objects/Contact/records?filter[account]=${encodeURIComponent(accountId!)}&limit=200`,
              )
              .catch(() => [] as Record<string, unknown>[]),
            apiClient
              .get<Record<string, unknown>[]>(
                `/objects/Contact/records?filter[AccountId]=${encodeURIComponent(accountId!)}&limit=200`,
              )
              .catch(() => [] as Record<string, unknown>[]),
          ])
          const merged = [
            ...(Array.isArray(byAccount) ? byAccount : []),
            ...(Array.isArray(byAccountId) ? byAccountId : []),
          ]
          const deduped = Array.from(
            new Map(merged.map(r => [String((r as { id?: unknown }).id ?? ''), r])).values(),
          )
          const arr = flatten(deduped)
          if (cancelled) return
          const q = contactQuery.trim().toLowerCase()
          const filtered = q ? arr.filter(r => searchText(r).includes(q)) : arr
          setContactResults(filtered.slice(0, 50))
          return
        }

        // Global contact list (contact-only mode, or paired with no account).
        if (!contactListRef.current) {
          const data = await apiClient.get<Record<string, unknown>[]>(
            `/objects/Contact/records?limit=200`,
          )
          contactListRef.current = Array.isArray(data) ? flatten(data) : []
        }
        if (cancelled) return
        const all = contactListRef.current
        const q = contactQuery.trim().toLowerCase()
        const filtered = q ? all.filter(r => searchText(r).includes(q)) : all
        setContactResults(filtered.slice(0, 50))
      } catch {
        if (!cancelled) setContactResults([])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [contactQuery, contactActive, mode, accountId])

  // In paired mode, require BOTH a Contact and an Account before save can fire,
  // unless the user has opted out of the Account by clicking "Skip account &
  // search all contacts" — in that case Contact alone is sufficient. This
  // prevents the half-saved state where only a contact was attached.
  const hasSelection = (mode === 'contact' && !!contactId) ||
    (mode === 'account' && !!accountId) ||
    (mode === 'paired' && (
      noAccountMode
        ? !!contactId
        : (!!contactId && !!accountId)
    ))

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
    // Resolve names from the global lookup cache. If a denormalized contactName /
    // accountName field is on the row use it; otherwise resolve the id via the
    // standard helper (which handles the Contact composite-name field).
    const contactIdValue = (boundRow.data.contact as string | undefined) ?? null
    const accountIdValue = (boundRow.data.account as string | undefined) ?? null
    const denormContact =
      (boundRow.data.contactName as string | undefined) ||
      (boundRow.data.TeamMember__contactName as string | undefined) ||
      ''
    const denormAccount =
      (boundRow.data.accountName as string | undefined) ||
      (boundRow.data.TeamMember__accountName as string | undefined) ||
      ''
    const cName = denormContact || (contactIdValue ? resolveLookupDisplayName(contactIdValue, 'Contact') : '')
    const aName = denormAccount || (accountIdValue ? resolveLookupDisplayName(accountIdValue, 'Account') : '')
    // resolveLookupDisplayName returns '-' when the value is empty; treat that as no value.
    const cDisplay = cName && cName !== '-' ? cName : ''
    const aDisplay = aName && aName !== '-' ? aName : ''
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm">
        <div className="flex-1 min-w-0">
          {cDisplay && <div className="font-medium text-gray-900 truncate">{cDisplay}</div>}
          {aDisplay && (
            <div className={cDisplay ? 'text-xs text-gray-500 truncate' : 'font-medium text-gray-900 truncate'}>
              {aDisplay}
            </div>
          )}
          {!cDisplay && !aDisplay && (
            <span className="text-gray-500 italic">—</span>
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
  // Paired-mode flow: Account first, then Contact. The Contact picker is
  // hidden until an Account is picked (or the user explicitly opts out via
  // the "Skip account & search all contacts" link). This prevents the
  // half-saved state where a Contact is attached without its Organization.
  const showContactPicker =
    mode === 'contact' || (mode === 'paired' && (!!accountId || noAccountMode))
  return (
    <div className="space-y-2">
      {(mode === 'account' || mode === 'paired') && !accountId && (
        <>
          <LookupSearch
            fieldDef={accountFieldDef}
            value={accountId ?? ''}
            onChange={(val) => {
              setAccountId(val ? String(val) : null)
              // Reset contact when account changes in paired mode so the next
              // pick comes from the new account's filtered list. Also clear the
              // "skip account" opt-out — the user just chose an account, so
              // they're back on the primary path.
              if (mode === 'paired') {
                setContactId(null)
                setNoAccountMode(false)
              }
            }}
            records={accountResults}
            lookupQuery={accountQuery}
            isActive={accountActive}
            onQueryChange={setAccountQuery}
            onFocus={() => setAccountActive(true)}
            onBlur={() => setTimeout(() => setAccountActive(false), 150)}
            schemaObjects={schemaObjects}
            disabled={disabled}
            hideNoneOption
          />
          <InlineCreateAccount
            disabled={disabled}
            onCreated={(id) => {
              setAccountId(id)
              if (mode === 'paired') {
                setContactId(null)
                setNoAccountMode(false)
              }
            }}
          />
        </>
      )}

      {/* Show the picked Account as a confirm-pill so the user knows what they
       *  chose. X clears just the account so the user can re-pick without
       *  abandoning the whole flow. */}
      {(mode === 'account' || mode === 'paired') && accountId && (
        <SelectedAccountPill
          accountId={accountId}
          onClear={() => {
            setAccountId(null)
            if (mode === 'paired') setContactId(null)
          }}
          disabled={disabled}
        />
      )}

      {/* Opt-out link: lets the user skip Account and search Contacts globally. */}
      {mode === 'paired' && !accountId && !noAccountMode && (
        <button
          type="button"
          onClick={() => setNoAccountMode(true)}
          disabled={disabled}
          className="text-[11px] text-brand-navy hover:text-brand-navy/80 underline-offset-2 hover:underline"
        >
          Skip organization &amp; search all contacts
        </button>
      )}

      {/* "Reset" link: when in opt-out mode, let the user restore the Account picker flow. */}
      {mode === 'paired' && noAccountMode && !accountId && (
        <button
          type="button"
          onClick={() => {
            setNoAccountMode(false)
            setContactId(null)
          }}
          disabled={disabled}
          className="text-[11px] text-brand-gray hover:text-brand-dark underline-offset-2 hover:underline"
        >
          ← Pick an organization first instead
        </button>
      )}

      {/* Paired mode + Account picked: render the account's contacts as a
       *  clickable list (not a search). The account narrows the choices to a
       *  small set; an additional autocomplete is friction. */}
      {showContactPicker && mode === 'paired' && accountId && !contactId && (
        <>
          <ContactPickList
            contacts={contactResults}
            onPick={(id) => setContactId(id)}
            disabled={disabled}
          />
          {/* Inline-create: new contact is auto-linked to the picked Account. */}
          <InlineCreateContact
            accountId={accountId}
            triggerLabel="New contact for this organization"
            disabled={disabled}
            onCreated={(id) => setContactId(id)}
          />
        </>
      )}

      {/* Paired-mode contact selected: show a confirm-pill with X to clear. */}
      {showContactPicker && mode === 'paired' && accountId && contactId && (
        <SelectedContactPill
          contactId={contactId}
          onClear={() => setContactId(null)}
          disabled={disabled}
        />
      )}

      {/* Contact-only mode OR paired+noAccountMode: search globally. */}
      {showContactPicker && (mode === 'contact' || (mode === 'paired' && noAccountMode)) && !contactId && (
        <>
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
            hideNoneOption
          />
          <InlineCreateContact
            disabled={disabled}
            onCreated={(id) => setContactId(id)}
          />
        </>
      )}

      {/* Contact-only mode (no paired list path) confirm-pill once selected. */}
      {showContactPicker && (mode === 'contact' || (mode === 'paired' && noAccountMode)) && contactId && (
        <SelectedContactPill
          contactId={contactId}
          onClear={() => setContactId(null)}
          disabled={disabled}
        />
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
              setNoAccountMode(false)
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

// ── Contact-list helpers (paired-mode after-account-picked) ───────────

function getContactSubtext(r: Record<string, unknown>): { email?: string; phone?: string } {
  const findStr = (suffix: string) => {
    for (const k of Object.keys(r)) {
      if (k.toLowerCase().endsWith(suffix.toLowerCase())) {
        const v = r[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
    }
    return undefined
  }
  return {
    email: findStr('email'),
    phone: findStr('primaryPhone') ?? findStr('phone'),
  }
}

/** Renders the account's contacts as a clickable list. After the user picks
 *  an Account in paired mode, additional autocomplete is friction — the set
 *  is small and known; just show the rows and let the user click. */
function ContactPickList({
  contacts,
  onPick,
  disabled,
}: {
  contacts: Record<string, unknown>[]
  onPick: (id: string) => void
  disabled?: boolean
}) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        This organization has no contacts yet.
      </div>
    )
  }
  return (
    <div className="rounded-md border border-gray-200 bg-white max-h-56 overflow-y-auto divide-y divide-gray-100">
      {contacts.map(c => {
        const id = String(c.id)
        const name = getRecordName(c) || 'Unnamed Contact'
        const { email, phone } = getContactSubtext(c)
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(id)}
            className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-brand-navy/5 focus-visible:bg-brand-navy/10 focus-visible:outline-none disabled:opacity-50"
          >
            <UserCircle className="w-3.5 h-3.5 text-brand-gray shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-brand-dark truncate">{name}</div>
              {(email || phone) && (
                <div className="flex items-center gap-2 text-[10px] text-brand-gray mt-0.5">
                  {email && (
                    <span className="inline-flex items-center gap-0.5 truncate">
                      <Mail className="w-2.5 h-2.5 shrink-0" aria-hidden />
                      <span className="truncate">{email}</span>
                    </span>
                  )}
                  {phone && (
                    <span className="inline-flex items-center gap-0.5 truncate">
                      <Phone className="w-2.5 h-2.5 shrink-0" aria-hidden />
                      <span className="truncate">{phone}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** Pill rendered after the user picks a contact from ContactPickList. The X
 *  button clears the selection so the user can pick a different one without
 *  cancelling the whole flow. */
function SelectedContactPill({
  contactId,
  onClear,
  disabled,
}: {
  contactId: string
  onClear: () => void
  disabled?: boolean
}) {
  // Resolve the display name via the global lookup cache; if the cache hasn't
  // loaded yet, render the raw id for a beat — better than empty.
  const name = resolveLookupDisplayName(contactId, 'Contact')
  const display = name && name !== '-' ? name : contactId
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm">
      <UserCircle className="w-4 h-4 text-brand-gray shrink-0" aria-hidden />
      <div className="flex-1 min-w-0 font-medium text-gray-900 truncate">{display}</div>
      {!disabled && (
        <button
          type="button"
          onClick={onClear}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Clear contact"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/** Sibling of SelectedContactPill for the Account picker — mirrors the
 *  visual treatment so the user sees a consistent "you picked: …" state. */
function SelectedAccountPill({
  accountId,
  onClear,
  disabled,
}: {
  accountId: string
  onClear: () => void
  disabled?: boolean
}) {
  const name = resolveLookupDisplayName(accountId, 'Account')
  const display = name && name !== '-' ? name : accountId
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm">
      <Building2 className="w-4 h-4 text-brand-gray shrink-0" aria-hidden />
      <div className="flex-1 min-w-0 font-medium text-gray-900 truncate">{display}</div>
      {!disabled && (
        <button
          type="button"
          onClick={onClear}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Clear organization"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
