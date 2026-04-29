'use client'

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  X, ChevronDown, UserCircle, Building2,
  Home, Target, Briefcase, Wrench, Truck, Megaphone,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useSchemaStore } from '@/lib/schema-store'
import {
  rememberRoleForObject,
  getLastRoleForObject,
} from '@/lib/connection-recents'

// ── Types ──────────────────────────────────────────────────────────────

/** TM-supported parent types — matches OBJECT_TO_FIELD in the rollup widget. */
type ParentObjectApiName =
  | 'Property'
  | 'Opportunity'
  | 'Project'
  | 'WorkOrder'
  | 'Installation'
  | 'Lead'

interface InlineConnectToRecordRowProps {
  /** "Contact" or "Account" — the profile this widget lives on. */
  personObjectApiName: 'Contact' | 'Account'
  /** Id of the current Contact/Account record. */
  personRecordId: string
  /** Friendly label of the person/org (for the implicit chip). */
  personName: string
  /** Called after a successful save so the parent can refetch. */
  onAdded: () => Promise<void> | void
  /** Called when the user dismisses the row without saving. */
  onCancel: () => void
}

// ── Constants ──────────────────────────────────────────────────────────

const PARENT_TYPES: ParentObjectApiName[] = [
  'Property',
  'Opportunity',
  'Project',
  'WorkOrder',
  'Installation',
  'Lead',
]

const PARENT_LABELS: Record<ParentObjectApiName, string> = {
  Property: 'Property',
  Opportunity: 'Opportunity',
  Project: 'Project',
  WorkOrder: 'Work Order',
  Installation: 'Installation',
  Lead: 'Lead',
}

const PARENT_ICONS: Record<ParentObjectApiName, LucideIcon> = {
  Property: Home,
  Opportunity: Target,
  Project: Briefcase,
  WorkOrder: Wrench,
  Installation: Truck,
  Lead: Megaphone,
}

/** TM field name on the parent side, matching the rollup widget's OBJECT_TO_FIELD. */
const PARENT_FIELD: Record<ParentObjectApiName, string> = {
  Property: 'property',
  Opportunity: 'opportunity',
  Project: 'project',
  WorkOrder: 'workOrder',
  Installation: 'installation',
  Lead: 'lead',
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

const SEARCH_LIMIT = 200
const RESULTS_LIMIT = 30

// ── Helpers ────────────────────────────────────────────────────────────

function flatten(arr: Record<string, unknown>[]): Record<string, unknown>[] {
  return arr.map(r => {
    const inner = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {}
    return { id: r.id, ...inner }
  })
}

/** Fields the user-facing record search should match against. Each parent
 *  object type contributes its primary identifier (number) plus optional
 *  human-readable fields. Audit metadata is intentionally excluded so typing
 *  a user's name doesn't surface every record they touched. */
const SEARCHABLE_KEYS = new Set([
  'name', 'title', 'label',
  'propertyNumber', 'opportunityNumber', 'projectNumber',
  'workOrderNumber', 'installationNumber', 'leadNumber', 'quoteNumber',
  'opportunityName', 'projectName',
  'contactName', 'firstName', 'lastName',
  'address',
])

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

/** Best-effort label for a record of any of the supported parent types. */
function getRecordLabel(r: Record<string, unknown>, type: ParentObjectApiName): string {
  switch (type) {
    case 'Property': {
      const num = r.propertyNumber
      if (typeof num === 'string' && num) return num
      const addr = r.address
      if (typeof addr === 'object' && addr) {
        const a = addr as Record<string, unknown>
        const street = typeof a.street === 'string' ? a.street : ''
        const city = typeof a.city === 'string' ? a.city : ''
        return [street, city].filter(Boolean).join(', ') || 'Property'
      }
      if (typeof addr === 'string' && addr) return addr
      return typeof r.name === 'string' ? r.name : 'Property'
    }
    case 'Opportunity': {
      const num = r.opportunityNumber
      if (typeof num === 'string' && num) return num
      return typeof r.opportunityName === 'string' ? r.opportunityName : 'Opportunity'
    }
    case 'Project':
      return typeof r.projectNumber === 'string' && r.projectNumber
        ? r.projectNumber
        : (typeof r.name === 'string' && r.name ? r.name : 'Project')
    case 'WorkOrder':
      return typeof r.workOrderNumber === 'string' && r.workOrderNumber
        ? r.workOrderNumber
        : 'Work Order'
    case 'Installation':
      return typeof r.installationNumber === 'string' && r.installationNumber
        ? r.installationNumber
        : 'Installation'
    case 'Lead':
      return typeof r.leadNumber === 'string' && r.leadNumber
        ? r.leadNumber
        : (typeof r.contactName === 'string' && r.contactName ? r.contactName : 'Lead')
  }
}

function getRecordSubtext(r: Record<string, unknown>, type: ParentObjectApiName): string {
  if (type === 'Property') {
    const addr = r.address
    if (typeof addr === 'object' && addr) {
      const a = addr as Record<string, unknown>
      const parts = [a.street, a.city, a.state].filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      )
      if (parts.length) return parts.join(', ')
    }
  }
  if (type === 'Opportunity' && typeof r.opportunityName === 'string') return r.opportunityName
  if (type === 'Lead' && typeof r.contactName === 'string') return r.contactName
  return ''
}

// ── Public component ───────────────────────────────────────────────────

/**
 * "Connect this Person/Org to a record" — the inverse-direction inline-add row
 * for the Associations widget. The Person is implicit (we're on their profile);
 * the user picks a record-type tab, searches for the target record, sets
 * role + flags, and submits.
 */
export function InlineConnectToRecordRow({
  personObjectApiName,
  personRecordId,
  personName,
  onAdded,
  onCancel,
}: InlineConnectToRecordRowProps) {
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

  const [parentType, setParentType] = useState<ParentObjectApiName>('Property')
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<string>('')
  const [role, setRole] = useState('')
  const [primary, setPrimary] = useState(false)
  const [contractHolder, setContractHolder] = useState(false)
  const [quoteRecipient, setQuoteRecipient] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyboardIndex, setKeyboardIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // ── Per-type record lists (cached on first activation) ───────────────
  const listsRef = useRef<Partial<Record<ParentObjectApiName, Record<string, unknown>[]>>>({})
  const [listsTick, setListsTick] = useState(0)
  const [loadingType, setLoadingType] = useState<ParentObjectApiName | null>(null)

  const ensureList = useCallback(async (type: ParentObjectApiName) => {
    if (listsRef.current[type]) return
    setLoadingType(type)
    try {
      const data = await apiClient.get<Record<string, unknown>[]>(
        `/objects/${type}/records?limit=${SEARCH_LIMIT}`,
      )
      listsRef.current[type] = Array.isArray(data) ? flatten(data) : []
    } catch {
      listsRef.current[type] = []
    } finally {
      setLoadingType(prev => (prev === type ? null : prev))
      setListsTick(t => t + 1)
    }
  }, [])

  // Load the current type's records on mount and whenever the type changes.
  useEffect(() => {
    void ensureList(parentType)
  }, [parentType, ensureList])

  // Pre-fill role from per-type memory.
  useEffect(() => {
    if (role) return
    const last = getLastRoleForObject(parentType)
    if (last && roleValues.includes(last)) setRole(last)
  }, [parentType, role, roleValues])

  // Autofocus the search input on mount, and scroll the row into the middle
  // of the viewport so the dropdown (which opens below the input) doesn't
  // render off-screen on a long page.
  //
  // Nested rAF: the smooth-scroll needs at least one committed paint before
  // we shift keyboard focus, otherwise focus visually jumps in some browsers.
  useEffect(() => {
    requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      requestAnimationFrame(() => searchInputRef.current?.focus())
    })
  }, [])

  // Reset selection when the user changes the parent type tab. Don't yank
  // focus here — keyboard users navigating tabs with arrow keys would lose
  // their place. Mount-time autofocus already handles initial entry.
  useEffect(() => {
    setSelectedId(null)
    setSelectedLabel('')
    setQuery('')
    setDropdownOpen(true)
    setKeyboardIndex(0)
  }, [parentType])

  // ── Filtered results for the active type ─────────────────────────────
  type ResultRow = { id: string; record: Record<string, unknown> }

  const results = useMemo<ResultRow[]>(() => {
    const all = listsRef.current[parentType] ?? []
    const q = query.trim().toLowerCase()
    const matches = q ? all.filter(r => searchText(r).includes(q)) : all
    return matches.slice(0, RESULTS_LIMIT).map(r => ({ id: String(r.id), record: r }))
    // listsTick re-runs the memo when fetches resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentType, query, listsTick])

  useEffect(() => {
    setKeyboardIndex(0)
  }, [parentType, query])

  // ── Selection ────────────────────────────────────────────────────────
  function pickResult(row: ResultRow) {
    setSelectedId(row.id)
    setSelectedLabel(getRecordLabel(row.record, parentType))
    setQuery('')
    setDropdownOpen(false)
  }

  function clearSelection() {
    setSelectedId(null)
    setSelectedLabel('')
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  // ── Save ─────────────────────────────────────────────────────────────
  const canSave = !!selectedId && !!role && !saving

  async function handleSave() {
    if (!selectedId || !role) {
      setError(!selectedId ? 'Pick a record to connect to.' : 'Role is required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const personField = personObjectApiName === 'Contact' ? 'contact' : 'account'
      const data: Record<string, unknown> = {
        [personField]: personRecordId,
        [PARENT_FIELD[parentType]]: selectedId,
        role,
        primaryContact: primary,
        contractHolder,
        quoteRecipient,
      }
      await apiClient.post('/objects/TeamMember/records', { data })
      rememberRoleForObject(parentType, role)
      await onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect.')
    } finally {
      setSaving(false)
    }
  }

  // Cmd/Ctrl + Enter saves from anywhere inside the row, even when focus is
  // on a tab, flag toggle, or the role select.
  function onRootKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSave) {
      e.preventDefault()
      void handleSave()
    }
  }

  // ── Keyboard nav on the search input ─────────────────────────────────
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    if (!dropdownOpen || results.length === 0) {
      if (e.key === 'Enter' && canSave) {
        e.preventDefault()
        void handleSave()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setKeyboardIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setKeyboardIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = results[keyboardIndex]
      if (row) pickResult(row)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  const PersonIcon = personObjectApiName === 'Contact' ? UserCircle : Building2

  return (
    <div
      ref={rootRef}
      onKeyDown={onRootKeyDown}
      role="group"
      aria-label="Connect to a record"
      className="rounded-md border border-brand-navy/30 dark:border-brand-navy-light/40 bg-white dark:bg-brand-dark p-2.5 space-y-2 animate-in"
    >
      {/* Implicit-person chip */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/30 dark:text-blue-200 text-[11px] font-medium">
          <PersonIcon className="w-3 h-3" aria-hidden />
          {personName || personObjectApiName}
        </span>
        <span className="text-[11px] text-brand-gray">→ connect to</span>
      </div>

      {/* Parent-type tab strip */}
      <div className="flex flex-wrap gap-1">
        {PARENT_TYPES.map(t => {
          const Icon = PARENT_ICONS[t]
          const active = parentType === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setParentType(t)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1 h-7 px-2 rounded text-[10px] font-medium border transition-colors ${
                active
                  ? 'bg-brand-navy border-brand-navy text-white'
                  : 'bg-white dark:bg-brand-dark border-gray-300 dark:border-gray-700 text-brand-gray hover:border-brand-navy hover:text-brand-navy'
              }`}
            >
              <Icon className="w-3 h-3" aria-hidden />
              {PARENT_LABELS[t]}
            </button>
          )
        })}
      </div>

      {/* Record search OR selected pill */}
      {!selectedId ? (
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
            aria-label={`Search ${PARENT_LABELS[parentType].toLowerCase()} records`}
            placeholder={`Search ${PARENT_LABELS[parentType].toLowerCase()}…`}
            className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark px-3 text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
            disabled={saving}
          />
          {dropdownOpen && (
            // In-flow positioning: the dropdown pushes the role/flags/buttons
            // row down instead of overlaying it.
            <div className="mt-1 max-h-72 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-dark shadow-sm">
              {results.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-brand-gray">
                  {loadingType === parentType
                    ? `Loading ${PARENT_LABELS[parentType].toLowerCase()} records…`
                    : query
                      ? 'No matches.'
                      : 'Start typing to search…'}
                </div>
              ) : (
                results.map((row, i) => {
                  const Icon = PARENT_ICONS[parentType]
                  const focused = keyboardIndex === i
                  const label = getRecordLabel(row.record, parentType)
                  const sub = getRecordSubtext(row.record, parentType)
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault()
                        pickResult(row)
                      }}
                      className={`w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors ${focused ? 'bg-brand-navy/10 dark:bg-brand-navy/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      <Icon className="w-3.5 h-3.5 text-brand-gray shrink-0 mt-0.5" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-brand-dark dark:text-gray-100 truncate">{label}</div>
                        {sub && <div className="text-[10px] text-brand-gray truncate">{sub}</div>}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs">
          {(() => {
            const Icon = PARENT_ICONS[parentType]
            return <Icon className="w-3.5 h-3.5 text-brand-gray shrink-0" aria-hidden />
          })()}
          <span className="font-medium text-brand-dark dark:text-gray-100 truncate flex-1">
            {selectedLabel}
          </span>
          <span className="text-[10px] text-brand-gray">{PARENT_LABELS[parentType]}</span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-gray-400 hover:text-red-500 shrink-0"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Role + flag toggles */}
      <div className="flex items-center flex-wrap gap-2">
        <div className="relative">
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            disabled={saving}
            className="h-8 pl-2 pr-7 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20 appearance-none"
          >
            <option value="">Role…</option>
            {roleValues.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-brand-gray absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <FlagToggle label="Primary" pressed={primary} onChange={setPrimary} disabled={saving} />
        <FlagToggle label="Contract" pressed={contractHolder} onChange={setContractHolder} disabled={saving} />
        <FlagToggle label="Quote" pressed={quoteRecipient} onChange={setQuoteRecipient} disabled={saving} />

        <div className="flex-1" />

        <button
          type="button"
          onClick={onCancel}
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
          title="Press Cmd/Ctrl + Enter to connect"
          className="px-2.5 py-1 rounded bg-brand-navy text-white text-[11px] font-medium hover:bg-brand-navy/90 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Connecting…' : 'Connect'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

// ── Internal atoms ─────────────────────────────────────────────────────

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
  // Mirrors InlineAddConnectionRow's FlagToggle — darker border + brand-dark
  // text + subtle shadow so unpressed state reads as a button.
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
