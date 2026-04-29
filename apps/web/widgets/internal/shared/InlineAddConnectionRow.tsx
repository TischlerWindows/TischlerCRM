'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Plus, X, UserCircle, Building2, ChevronDown } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useSchemaStore } from '@/lib/schema-store'
import {
  getRecentContactIds,
  getRecentAccountIds,
  rememberContact,
  rememberAccount,
  getLastRoleForObject,
  rememberRoleForObject,
} from '@/lib/connection-recents'

// ── Types ──────────────────────────────────────────────────────────────

type EntityKind = 'contact' | 'account'

export interface InlineAddConnectionPayload {
  contactId?: string | null
  accountId?: string | null
  /** Display label for the contact (denormalized for fast tile rendering). */
  contactName?: string
  /** Display label for the account. */
  accountName?: string
  role: string
  primaryContact: boolean
  contractHolder: boolean
  quoteRecipient: boolean
}

interface InlineAddConnectionRowProps {
  /** Object type of the parent record (e.g. "Project"). */
  parentObjectApiName: string
  /** Friendly name shown in the implicit-parent chip — e.g. "PRJ-1234". */
  parentRecordName?: string
  /** Friendly object label — e.g. "Project". Falls back to parentObjectApiName. */
  parentObjectLabel?: string
  /**
   * Called when the user submits a new connection. Implementer routes to API
   * or to a pending-pool depending on create-mode. Should resolve when the
   * record is durably written (or queued); the row then collapses.
   */
  onAdd: (payload: InlineAddConnectionPayload) => Promise<void>
  /**
   * Optional: an "Advanced…" link in the expanded row opens this callback.
   * Wire it to the existing AddTeamMemberModal so users keep access to the
   * bulk-from-account and create-new-contact flows.
   */
  onAdvanced?: () => void
  /** Disabled when the parent record isn't ready yet (e.g. mid-form-submit). */
  disabled?: boolean
  /** When true, render the parent chip as "Pending" instead of a record name. */
  pendingMode?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────

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

const SEARCH_LIMIT = 200
const RESULTS_LIMIT = 30

// ── Helpers ────────────────────────────────────────────────────────────

/** Flatten a /records response from { id, data: {...} } to { id, ...data } so
 *  helpers like searchText can scan flat key/values. */
function flatten(arr: Record<string, unknown>[]): Record<string, unknown>[] {
  return arr.map(r => {
    const inner = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {}
    return { id: r.id, ...inner }
  })
}

/** Fields the user-facing search should match against. Audit metadata
 *  (createdBy, modifiedBy, etc.) is intentionally excluded so typing the
 *  current user's name doesn't surface every record they touched. The
 *  composite Contact `name` object is matched recursively because its inner
 *  fields (firstName/lastName) are the actual display tokens. */
const SEARCHABLE_KEYS = new Set([
  'firstName', 'lastName', 'name', 'email', 'phone', 'mobile',
  'accountName', 'accountNumber', 'contactName', 'title',
])

/** Composite-name-aware lowercased searchable string for a flattened record.
 *  The /records/search endpoint stringifies CompositeText (Contact name) as
 *  "[object Object]" and misses matches; doing this client-side fixes that. */
function searchText(r: Record<string, unknown>): string {
  const parts: string[] = []
  const collect = (v: unknown) => {
    if (v == null) return
    if (typeof v === 'string') parts.push(v.toLowerCase())
    else if (typeof v === 'object' && !Array.isArray(v)) {
      for (const inner of Object.values(v as Record<string, unknown>)) collect(inner)
    }
  }
  for (const k of Object.keys(r)) {
    const bare = k.replace(/^[A-Za-z]+__/, '')
    if (SEARCHABLE_KEYS.has(bare)) collect(r[k])
  }
  return parts.join(' ')
}

/** Treat these tokens as "no value" — legacy contacts have composite-name fields
 *  pre-filled with the literal "N/A" and we want to fall through to the flat
 *  firstName/lastName fields when that happens. */
const PLACEHOLDER_NAME_TOKENS = new Set(['n/a', 'na', '-', '—'])

function isMeaningfulNamePart(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const t = v.trim()
  if (!t) return false
  return !PLACEHOLDER_NAME_TOKENS.has(t.toLowerCase())
}

function getDisplayName(r: Record<string, unknown>, kind: EntityKind): string {
  if (kind === 'account') {
    const candidates = ['accountName', 'name', 'accountNumber']
    for (const k of candidates) {
      if (isMeaningfulNamePart(r[k])) return (r[k] as string).trim()
    }
    return 'Unnamed Account'
  }
  // Contact: composite name first (filtering placeholder tokens), then
  // flat first/last, then email.
  const nameObj = r.name
  if (nameObj && typeof nameObj === 'object') {
    const obj = nameObj as Record<string, unknown>
    const parts = [obj.salutation, obj.firstName, obj.lastName]
      .filter(isMeaningfulNamePart)
      .map(v => v.trim())
    if (parts.length > 0) return parts.join(' ')
  }
  const fn = isMeaningfulNamePart(r.firstName) ? r.firstName.trim() : ''
  const ln = isMeaningfulNamePart(r.lastName) ? r.lastName.trim() : ''
  const composed = [fn, ln].filter(Boolean).join(' ').trim()
  if (composed) return composed
  if (typeof r.email === 'string' && r.email) return r.email
  return 'Unnamed Contact'
}

function getSubtext(r: Record<string, unknown>, kind: EntityKind): string {
  if (kind === 'contact') {
    if (typeof r.email === 'string' && r.email) return r.email
    if (typeof r.phone === 'string' && r.phone) return r.phone
    return ''
  }
  if (typeof r.accountNumber === 'string' && r.accountNumber) return r.accountNumber
  return ''
}

function getLinkedAccountId(contact: Record<string, unknown>): string | null {
  const v = contact.account ?? contact.AccountId ?? contact.Contact__account
  if (!v) return null
  if (typeof v === 'string' && v) return v
  if (typeof v === 'object' && v !== null && 'id' in v) {
    const id = (v as { id: unknown }).id
    if (typeof id === 'string') return id
  }
  return null
}

// ── Public component ───────────────────────────────────────────────────

/**
 * Inline-add row for the Connections widgets.
 *
 * Three states:
 *   1. Collapsed — a dashed-bordered "+ Add a connection…" affordance
 *   2. Expanded  — autofocused search + role select + flag toggles
 *   3. Saving    — buttons disabled with inline spinner
 *
 * Persistence is owned by the parent via `onAdd`; this component is purely
 * presentational state + form orchestration. Reuses the same composite-name-
 * aware search pattern used by the Slot widget.
 */
export function InlineAddConnectionRow({
  parentObjectApiName,
  parentRecordName,
  parentObjectLabel,
  onAdd,
  onAdvanced,
  disabled,
  pendingMode,
}: InlineAddConnectionRowProps) {
  const schema = useSchemaStore(s => s.schema)
  const schemaObjects = schema?.objects

  const roleValues: string[] = useMemo(() => {
    const tmObj = schemaObjects?.find(o => o.apiName === 'TeamMember')
    const roleField = tmObj?.fields.find(f => f.apiName === 'role')
    if (roleField?.picklistValues && roleField.picklistValues.length > 0) {
      return roleField.picklistValues
    }
    return [...ROLE_FALLBACK]
  }, [schemaObjects])

  // ── UI state ──────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selected, setSelected] = useState<{
    kind: EntityKind
    id: string
    name: string
    /** For Contact picks: the linked Account id, surfaced as an auto-link suggestion. */
    linkedAccountId?: string | null
    linkedAccountName?: string
  } | null>(null)
  const [autoLinkAccept, setAutoLinkAccept] = useState(true)
  const [role, setRole] = useState('')
  const [primary, setPrimary] = useState(false)
  const [contractHolder, setContractHolder] = useState(false)
  const [quoteRecipient, setQuoteRecipient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyboardIndex, setKeyboardIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const collapsedButtonRef = useRef<HTMLButtonElement | null>(null)
  // Set when we transition expanded → collapsed via cancel/save so the next
  // render restores focus to the dashed-chip trigger (rapid-add ergonomics).
  const restoreFocusOnCollapseRef = useRef(false)

  // ── Cached lookup lists ───────────────────────────────────────────────
  // Refs persist across renders; the `listsTick` state forces a re-render
  // (and re-evaluates the results useMemo) when the lists finish loading.
  const contactsRef = useRef<Record<string, unknown>[] | null>(null)
  const accountsRef = useRef<Record<string, unknown>[] | null>(null)
  const [listsTick, setListsTick] = useState(0)

  const ensureLists = useCallback(async () => {
    let touched = false
    if (!contactsRef.current) {
      try {
        const data = await apiClient.get<Record<string, unknown>[]>(
          `/objects/Contact/records?limit=${SEARCH_LIMIT}`,
        )
        contactsRef.current = Array.isArray(data) ? flatten(data) : []
        touched = true
      } catch {
        contactsRef.current = []
      }
    }
    if (!accountsRef.current) {
      try {
        const data = await apiClient.get<Record<string, unknown>[]>(
          `/objects/Account/records?limit=${SEARCH_LIMIT}`,
        )
        accountsRef.current = Array.isArray(data) ? flatten(data) : []
        touched = true
      } catch {
        accountsRef.current = []
      }
    }
    if (touched) setListsTick(t => t + 1)
  }, [])

  // Load on first expand.
  useEffect(() => {
    if (!expanded) return
    void ensureLists()
  }, [expanded, ensureLists])

  // Pre-fill role from last-used preference.
  useEffect(() => {
    if (!expanded) return
    if (role) return
    const last = getLastRoleForObject(parentObjectApiName)
    if (last && roleValues.includes(last)) setRole(last)
  }, [expanded, role, parentObjectApiName, roleValues])

  // Focus the input when we expand. Also scroll the row into the middle of
  // the viewport so the dropdown (which opens BELOW the input) doesn't render
  // off-screen when the dashed chip happens to sit at the bottom of the
  // visible area (common case: empty list + click chip).
  //
  // Nest the focus call in a second rAF so the smooth-scroll has at least one
  // committed paint before we move keyboard focus — otherwise some browsers
  // visually jump focus before the scroll animation starts.
  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        requestAnimationFrame(() => searchInputRef.current?.focus())
      })
    }
  }, [expanded])

  // Click-outside collapse (only when nothing is selected and no query — avoid
  // accidental data loss).
  useEffect(() => {
    if (!expanded) return
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return
      if (rootRef.current.contains(e.target as Node)) return
      const dirty = !!selected || !!query.trim() || primary || contractHolder || quoteRecipient
      if (dirty) return
      setExpanded(false)
      setDropdownOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [expanded, selected, query, primary, contractHolder, quoteRecipient])

  // ── Derived results ──────────────────────────────────────────────────
  type ResultRow = { kind: EntityKind; id: string; record: Record<string, unknown>; isRecent: boolean }

  const results = useMemo<{
    recents: ResultRow[]
    contacts: ResultRow[]
    accounts: ResultRow[]
    flat: ResultRow[]
  }>(() => {
    const allContacts = contactsRef.current ?? []
    const allAccounts = accountsRef.current ?? []
    const q = query.trim().toLowerCase()
    const matches = (r: Record<string, unknown>) => (q ? searchText(r).includes(q) : true)

    const recentContactIds = new Set(getRecentContactIds())
    const recentAccountIds = new Set(getRecentAccountIds())

    const filteredContacts = allContacts.filter(matches)
    const filteredAccounts = allAccounts.filter(matches)

    const recentContacts: ResultRow[] = filteredContacts
      .filter(r => recentContactIds.has(String(r.id)))
      .map(r => ({ kind: 'contact', id: String(r.id), record: r, isRecent: true }))

    const recentAccounts: ResultRow[] = filteredAccounts
      .filter(r => recentAccountIds.has(String(r.id)))
      .map(r => ({ kind: 'account', id: String(r.id), record: r, isRecent: true }))

    // Order recents by recency: get the array, sort by index in recent list
    const recentContactIdList = getRecentContactIds()
    recentContacts.sort(
      (a, b) => recentContactIdList.indexOf(a.id) - recentContactIdList.indexOf(b.id),
    )
    const recentAccountIdList = getRecentAccountIds()
    recentAccounts.sort(
      (a, b) => recentAccountIdList.indexOf(a.id) - recentAccountIdList.indexOf(b.id),
    )

    const recents = [...recentContacts, ...recentAccounts].slice(0, 5)

    const recentIdsByKind = {
      contact: new Set(recentContacts.map(r => r.id)),
      account: new Set(recentAccounts.map(r => r.id)),
    }

    const contacts: ResultRow[] = filteredContacts
      .filter(r => !recentIdsByKind.contact.has(String(r.id)))
      .slice(0, RESULTS_LIMIT)
      .map(r => ({ kind: 'contact' as const, id: String(r.id), record: r, isRecent: false }))

    const accounts: ResultRow[] = filteredAccounts
      .filter(r => !recentIdsByKind.account.has(String(r.id)))
      .slice(0, RESULTS_LIMIT)
      .map(r => ({ kind: 'account' as const, id: String(r.id), record: r, isRecent: false }))

    const flat = [...recents, ...contacts, ...accounts]
    return { recents, contacts, accounts, flat }
    // listsTick re-runs the memo when the lists finish loading (refs alone
    // wouldn't trigger this; see ensureLists above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, listsTick])

  // Reset keyboard index when results shift.
  useEffect(() => {
    setKeyboardIndex(0)
  }, [query, dropdownOpen])

  // ── Selection ────────────────────────────────────────────────────────
  function pickResult(row: ResultRow) {
    const name = getDisplayName(row.record, row.kind)
    if (row.kind === 'contact') {
      const linkedAccountId = getLinkedAccountId(row.record)
      let linkedAccountName: string | undefined
      if (linkedAccountId) {
        const acct = (accountsRef.current ?? []).find(a => String(a.id) === linkedAccountId)
        if (acct) linkedAccountName = getDisplayName(acct, 'account')
      }
      setSelected({
        kind: 'contact',
        id: row.id,
        name,
        linkedAccountId,
        linkedAccountName,
      })
      setAutoLinkAccept(true)
    } else {
      setSelected({ kind: 'account', id: row.id, name })
    }
    setQuery('')
    setDropdownOpen(false)
  }

  function clearSelection() {
    setSelected(null)
    setAutoLinkAccept(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  // ── Save ─────────────────────────────────────────────────────────────
  const canSave = !!selected && !!role && !saving

  async function handleSave() {
    if (!selected || !role) {
      setError(!selected ? 'Pick a person or organization first.' : 'Role is required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const payload: InlineAddConnectionPayload = {
        role,
        primaryContact: primary,
        contractHolder,
        quoteRecipient,
      }
      if (selected.kind === 'contact') {
        payload.contactId = selected.id
        payload.contactName = selected.name
        if (selected.linkedAccountId && autoLinkAccept) {
          payload.accountId = selected.linkedAccountId
          payload.accountName = selected.linkedAccountName
        }
      } else {
        payload.accountId = selected.id
        payload.accountName = selected.name
      }
      await onAdd(payload)
      // Remember choices for future inline-adds
      if (payload.contactId) rememberContact(payload.contactId)
      if (payload.accountId) rememberAccount(payload.accountId)
      rememberRoleForObject(parentObjectApiName, role)
      // Reset for the next add — keep row expanded so user can rapidly add more,
      // but clear the entity selection so they're back at the search step.
      setSelected(null)
      setQuery('')
      setPrimary(false)
      setContractHolder(false)
      setQuoteRecipient(false)
      setAutoLinkAccept(true)
      requestAnimationFrame(() => searchInputRef.current?.focus())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add connection.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    restoreFocusOnCollapseRef.current = true
    setExpanded(false)
    setDropdownOpen(false)
    setSelected(null)
    setQuery('')
    setRole('')
    setPrimary(false)
    setContractHolder(false)
    setQuoteRecipient(false)
    setAutoLinkAccept(true)
    setError(null)
  }

  // Restore focus to the dashed-chip trigger when the row collapses (after
  // Cancel, or after the user is finished adding and closes via Esc twice
  // in the future). Mount-time renders skip this since the ref starts false.
  useEffect(() => {
    if (!expanded && restoreFocusOnCollapseRef.current) {
      restoreFocusOnCollapseRef.current = false
      requestAnimationFrame(() => collapsedButtonRef.current?.focus())
    }
  }, [expanded])

  // Cmd/Ctrl + Enter saves from anywhere inside the expanded row, even when
  // focus is on a flag toggle or the role select.
  function onRootKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSave) {
      e.preventDefault()
      void handleSave()
    }
  }

  // ── Keyboard handling on the search input ─────────────────────────────
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen || results.flat.length === 0) {
      if (e.key === 'Enter' && selected && role && canSave) {
        e.preventDefault()
        void handleSave()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setKeyboardIndex(i => Math.min(i + 1, results.flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setKeyboardIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = results.flat[keyboardIndex]
      if (row) pickResult(row)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDropdownOpen(false)
    }
  }

  // ── Render: collapsed ────────────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        type="button"
        ref={collapsedButtonRef}
        onClick={() => !disabled && setExpanded(true)}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-gray-300 dark:border-gray-700 text-xs text-brand-gray hover:border-brand-navy hover:text-brand-navy dark:hover:border-brand-navy-light dark:hover:text-brand-navy-light focus-visible:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20 focus-visible:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Add a connection"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden />
        Add a connection…
      </button>
    )
  }

  // ── Render: expanded ─────────────────────────────────────────────────
  const parentLabel = parentObjectLabel || parentObjectApiName

  return (
    <div
      ref={rootRef}
      onKeyDown={onRootKeyDown}
      role="group"
      aria-label="Add a connection"
      className="rounded-md border border-brand-navy/30 dark:border-brand-navy-light/40 bg-surface-alt dark:bg-brand-dark p-2.5 space-y-2 animate-in"
    >
      {/* Implicit-parent chip */}
      <div className="flex items-center gap-2 text-[11px] text-brand-gray">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/30 dark:text-blue-200 font-medium">
          {pendingMode ? `On this new ${parentLabel}` : `On this ${parentLabel}${parentRecordName ? `: ${parentRecordName}` : ''}`}
        </span>
        {onAdvanced && (
          <button
            type="button"
            onClick={onAdvanced}
            className="ml-auto text-[11px] text-brand-navy hover:underline"
          >
            More options…
          </button>
        )}
      </div>

      {/* Person/Org search OR selected pill */}
      {!selected ? (
        <div className="relative">
          <input
            ref={searchInputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setDropdownOpen(true)
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={onSearchKeyDown}
            aria-label="Search people or organizations"
            placeholder="Search people or organizations…"
            className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark px-3 text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
            disabled={disabled || saving}
          />
          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-dropdown max-h-72 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-dark shadow-lg">
              {results.flat.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-brand-gray">
                  {query ? 'No matches.' : 'Start typing to search…'}
                </div>
              ) : (
                <>
                  {results.recents.length > 0 && (
                    <ResultGroup
                      label="Recents"
                      rows={results.recents}
                      indexOffset={0}
                      keyboardIndex={keyboardIndex}
                      onPick={pickResult}
                    />
                  )}
                  {results.contacts.length > 0 && (
                    <ResultGroup
                      label="Contacts"
                      rows={results.contacts}
                      indexOffset={results.recents.length}
                      keyboardIndex={keyboardIndex}
                      onPick={pickResult}
                    />
                  )}
                  {results.accounts.length > 0 && (
                    <ResultGroup
                      label="Organizations"
                      rows={results.accounts}
                      indexOffset={results.recents.length + results.contacts.length}
                      keyboardIndex={keyboardIndex}
                      onPick={pickResult}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs">
            {selected.kind === 'contact' ? (
              <UserCircle className="w-3.5 h-3.5 text-brand-gray shrink-0" />
            ) : (
              <Building2 className="w-3.5 h-3.5 text-brand-gray shrink-0" />
            )}
            <span className="font-medium text-brand-dark dark:text-gray-100 truncate flex-1">
              {selected.name}
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-gray-400 hover:text-red-500 shrink-0"
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Auto-link account suggestion */}
          {selected.kind === 'contact' && selected.linkedAccountId && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-dashed border-gray-200 dark:border-gray-700 text-[11px] text-brand-gray">
              <Building2 className="w-3 h-3" />
              <span className="flex-1 truncate">
                Also link {selected.linkedAccountName || 'their organization'}?
              </span>
              <button
                type="button"
                onClick={() => setAutoLinkAccept(true)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${autoLinkAccept ? 'bg-brand-navy text-white' : 'text-brand-gray hover:text-brand-navy'}`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setAutoLinkAccept(false)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${!autoLinkAccept ? 'bg-gray-200 dark:bg-gray-700 text-brand-dark dark:text-gray-200' : 'text-brand-gray hover:text-brand-navy'}`}
              >
                No
              </button>
            </div>
          )}
        </div>
      )}

      {/* Role + flag toggles */}
      <div className="flex items-center flex-wrap gap-2">
        <div className="relative">
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            disabled={disabled || saving}
            className="h-8 pl-2 pr-7 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20 appearance-none"
          >
            <option value="">Role…</option>
            {roleValues.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-brand-gray absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <FlagToggle label="Primary" pressed={primary} onChange={setPrimary} disabled={disabled || saving} />
        <FlagToggle label="Contract" pressed={contractHolder} onChange={setContractHolder} disabled={disabled || saving} />
        <FlagToggle label="Quote" pressed={quoteRecipient} onChange={setQuoteRecipient} disabled={disabled || saving} />

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleCancel}
          title="Esc"
          className="px-2.5 py-1 rounded text-[11px] text-brand-gray hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand-navy/20 focus-visible:outline-none"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          title="Press Cmd/Ctrl + Enter to add"
          className="px-2.5 py-1 rounded bg-brand-navy text-white text-[11px] font-medium hover:bg-brand-navy/90 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

// ── Internal sub-components ────────────────────────────────────────────

function ResultGroup({
  label,
  rows,
  indexOffset,
  keyboardIndex,
  onPick,
}: {
  label: string
  rows: { kind: EntityKind; id: string; record: Record<string, unknown>; isRecent: boolean }[]
  indexOffset: number
  keyboardIndex: number
  onPick: (row: { kind: EntityKind; id: string; record: Record<string, unknown>; isRecent: boolean }) => void
}) {
  return (
    <div>
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-brand-gray uppercase tracking-wide">
        {label}
      </div>
      {rows.map((row, i) => {
        const flatIndex = indexOffset + i
        const isFocused = keyboardIndex === flatIndex
        const name = getDisplayName(row.record, row.kind)
        const sub = getSubtext(row.record, row.kind)
        return (
          <button
            key={`${row.kind}:${row.id}`}
            type="button"
            // mousedown beats blur so the selection actually registers
            onMouseDown={e => {
              e.preventDefault()
              onPick(row)
            }}
            className={`w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors ${isFocused ? 'bg-brand-navy/10 dark:bg-brand-navy/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            {row.kind === 'contact' ? (
              <UserCircle className="w-3.5 h-3.5 text-brand-gray shrink-0 mt-0.5" />
            ) : (
              <Building2 className="w-3.5 h-3.5 text-brand-gray shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-brand-dark dark:text-gray-100 truncate">{name}</div>
              {sub && <div className="text-[10px] text-brand-gray truncate">{sub}</div>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function FlagToggle({
  label,
  pressed,
  onChange,
  disabled,
}: {
  label: string
  pressed: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  // Unpressed state uses a subtle shadow + darker border + brand-dark text so
  // the toggle reads as a clickable affordance against the bg-surface-alt
  // container (white-on-near-white was unreadable in earlier QA).
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      disabled={disabled}
      className={`px-2 h-7 rounded text-[10px] font-medium border transition-colors focus-visible:ring-2 focus-visible:ring-brand-navy/30 focus-visible:outline-none disabled:opacity-50 ${
        pressed
          ? 'bg-brand-navy border-brand-navy text-white shadow-sm'
          : 'bg-white dark:bg-brand-dark border-gray-400 dark:border-gray-600 text-brand-dark dark:text-gray-100 shadow-sm hover:border-brand-navy hover:text-brand-navy'
      }`}
    >
      {label}
    </button>
  )
}
