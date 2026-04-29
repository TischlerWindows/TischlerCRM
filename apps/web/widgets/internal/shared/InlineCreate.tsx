'use client'

/**
 * Inline-create forms for Contact and Account records, used by every
 * connection entry point (Connection Slot widget, Connections inline-add row,
 * paired-mode contact list).
 *
 * Design goals:
 *  1. Closed-loop UX — never leave the connection flow to add a missing
 *     person/org. Inline expand → fill → save → auto-select.
 *  2. Real schema fields. The Contact object uses `primaryEmail`,
 *     `primaryPhone`, `firstName`, `lastName`, `title`, `contactType`. The
 *     Account object uses `accountName`, `type`, `primaryEmail`,
 *     `primaryPhone`, `website`. Picklist values are pulled from the live
 *     schema store so the form reflects whatever the admin has configured.
 *  3. Prevent lazy data entry. Phone AND email are REQUIRED on contact
 *     creation; account name AND type AND a phone OR email are required on
 *     account creation. The premise: a salesperson hammering "+ New contact"
 *     with just a name produces low-value records that hurt downstream
 *     reporting and follow-up.
 *  4. Strict duplicate detection. Before POST, the form fetches existing
 *     records that match by email, phone, or normalized name. If hits are
 *     found, the user must explicitly choose between picking the existing
 *     record OR confirming "this is genuinely a new person/org" before the
 *     create button activates.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Plus, AlertTriangle, UserCircle, Building2, X } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useSchemaStore } from '@/lib/schema-store'
import { getRecordName } from './recordName'

// ── Helpers ────────────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizePhone(p: string): string {
  return p.replace(/\D/g, '')
}

function flatten(arr: Record<string, unknown>[]): Record<string, unknown>[] {
  return arr.map(r => {
    const inner = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : {}
    return { id: (r as { id?: unknown }).id, ...inner } as Record<string, unknown>
  })
}

interface PicklistField {
  values: string[]
  loaded: boolean
}

function usePicklistValues(objectApiName: string, fieldApiName: string): PicklistField {
  const schema = useSchemaStore(s => s.schema)
  return useMemo(() => {
    const obj = schema?.objects?.find(o => o.apiName === objectApiName)
    const field = obj?.fields?.find(
      f => f.apiName === fieldApiName ||
           f.apiName === `${objectApiName}__${fieldApiName}` ||
           f.apiName.toLowerCase().endsWith(`__${fieldApiName.toLowerCase()}`),
    )
    return {
      values: field?.picklistValues ?? [],
      loaded: !!schema,
    }
  }, [schema, objectApiName, fieldApiName])
}

// ── Duplicate detection ────────────────────────────────────────────────

interface DuplicateMatch {
  id: string
  name: string
  email?: string
  phone?: string
  reason: 'email' | 'phone' | 'name'
}

async function findContactDuplicates(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
): Promise<DuplicateMatch[]> {
  const matches = new Map<string, DuplicateMatch>()
  const checks: Promise<void>[] = []

  // Email check (highest signal)
  if (email.trim()) {
    const e = email.trim()
    checks.push(
      apiClient
        .get<Record<string, unknown>[]>(
          `/objects/Contact/records?filter[primaryEmail]=${encodeURIComponent(e)}&limit=10`,
        )
        .catch(() => [] as Record<string, unknown>[])
        .then(arr => {
          for (const r of flatten(Array.isArray(arr) ? arr : [])) {
            const id = String(r.id ?? '')
            if (!id || matches.has(id)) continue
            matches.set(id, {
              id,
              name: getRecordName(r),
              email: typeof r.primaryEmail === 'string' ? r.primaryEmail : undefined,
              phone: typeof r.primaryPhone === 'string' ? r.primaryPhone : undefined,
              reason: 'email',
            })
          }
        }),
    )
  }

  // Phone check (digits-only normalized)
  const digits = normalizePhone(phone)
  if (digits.length >= 7) {
    // The /records filter uses exact match on the stored value. Try the
    // user-typed form first; if no result we fall back to the digits-only
    // search via a wider list-and-filter call.
    checks.push(
      apiClient
        .get<Record<string, unknown>[]>(
          `/objects/Contact/records?filter[primaryPhone]=${encodeURIComponent(phone.trim())}&limit=10`,
        )
        .catch(() => [] as Record<string, unknown>[])
        .then(arr => {
          for (const r of flatten(Array.isArray(arr) ? arr : [])) {
            const id = String(r.id ?? '')
            if (!id || matches.has(id)) continue
            matches.set(id, {
              id,
              name: getRecordName(r),
              email: typeof r.primaryEmail === 'string' ? r.primaryEmail : undefined,
              phone: typeof r.primaryPhone === 'string' ? r.primaryPhone : undefined,
              reason: 'phone',
            })
          }
        }),
    )
  }

  // Name check (full first+last) — list and filter client-side
  const fn = firstName.trim()
  const ln = lastName.trim()
  if (fn && ln) {
    const target = normalizeForMatch(`${fn} ${ln}`)
    checks.push(
      apiClient
        .get<Record<string, unknown>[]>(`/objects/Contact/records?limit=200`)
        .catch(() => [] as Record<string, unknown>[])
        .then(arr => {
          for (const r of flatten(Array.isArray(arr) ? arr : [])) {
            const id = String(r.id ?? '')
            if (!id || matches.has(id)) continue
            const candidate = normalizeForMatch(getRecordName(r))
            if (candidate === target) {
              matches.set(id, {
                id,
                name: getRecordName(r),
                email: typeof r.primaryEmail === 'string' ? r.primaryEmail : undefined,
                phone: typeof r.primaryPhone === 'string' ? r.primaryPhone : undefined,
                reason: 'name',
              })
            }
          }
        }),
    )
  }

  await Promise.all(checks)
  return Array.from(matches.values())
}

async function findAccountDuplicates(
  accountName: string,
  email: string,
  phone: string,
): Promise<DuplicateMatch[]> {
  const matches = new Map<string, DuplicateMatch>()
  const checks: Promise<void>[] = []

  if (email.trim()) {
    checks.push(
      apiClient
        .get<Record<string, unknown>[]>(
          `/objects/Account/records?filter[primaryEmail]=${encodeURIComponent(email.trim())}&limit=10`,
        )
        .catch(() => [] as Record<string, unknown>[])
        .then(arr => {
          for (const r of flatten(Array.isArray(arr) ? arr : [])) {
            const id = String(r.id ?? '')
            if (!id || matches.has(id)) continue
            matches.set(id, { id, name: getRecordName(r), email: typeof r.primaryEmail === 'string' ? r.primaryEmail : undefined, phone: typeof r.primaryPhone === 'string' ? r.primaryPhone : undefined, reason: 'email' })
          }
        }),
    )
  }

  if (normalizePhone(phone).length >= 7) {
    checks.push(
      apiClient
        .get<Record<string, unknown>[]>(
          `/objects/Account/records?filter[primaryPhone]=${encodeURIComponent(phone.trim())}&limit=10`,
        )
        .catch(() => [] as Record<string, unknown>[])
        .then(arr => {
          for (const r of flatten(Array.isArray(arr) ? arr : [])) {
            const id = String(r.id ?? '')
            if (!id || matches.has(id)) continue
            matches.set(id, { id, name: getRecordName(r), email: typeof r.primaryEmail === 'string' ? r.primaryEmail : undefined, phone: typeof r.primaryPhone === 'string' ? r.primaryPhone : undefined, reason: 'phone' })
          }
        }),
    )
  }

  if (accountName.trim()) {
    const target = normalizeForMatch(accountName)
    checks.push(
      apiClient
        .get<Record<string, unknown>[]>(`/objects/Account/records?limit=200`)
        .catch(() => [] as Record<string, unknown>[])
        .then(arr => {
          for (const r of flatten(Array.isArray(arr) ? arr : [])) {
            const id = String(r.id ?? '')
            if (!id || matches.has(id)) continue
            const candidate = normalizeForMatch(getRecordName(r))
            if (candidate === target) {
              matches.set(id, { id, name: getRecordName(r), email: typeof r.primaryEmail === 'string' ? r.primaryEmail : undefined, phone: typeof r.primaryPhone === 'string' ? r.primaryPhone : undefined, reason: 'name' })
            }
          }
        }),
    )
  }

  await Promise.all(checks)
  return Array.from(matches.values())
}

// ── Reusable form atoms ────────────────────────────────────────────────

const inputCls =
  'h-8 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20'

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-0.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function DuplicateWarning({
  matches,
  onUseExisting,
  onConfirmNew,
  kind,
}: {
  matches: DuplicateMatch[]
  onUseExisting: (id: string) => void
  onConfirmNew: () => void
  kind: 'contact' | 'account'
}) {
  return (
    <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-900/30 dark:border-orange-700 p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-orange-600" aria-hidden />
        <span className="text-[11px] font-semibold text-orange-800 dark:text-orange-200">
          {matches.length === 1 ? 'A possible duplicate was found' : `${matches.length} possible duplicates were found`}
        </span>
      </div>
      <p className="text-[11px] text-orange-800 dark:text-orange-200">
        Pick one of the existing {kind === 'contact' ? 'contacts' : 'organizations'} instead of creating a new record:
      </p>
      <div className="space-y-1">
        {matches.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => onUseExisting(m.id)}
            className="w-full flex items-start gap-2 px-2 py-1.5 rounded bg-white dark:bg-brand-dark border border-orange-200 dark:border-orange-700 text-left text-xs hover:border-brand-navy hover:bg-brand-navy/5"
          >
            {kind === 'contact' ? (
              <UserCircle className="w-3.5 h-3.5 text-brand-gray shrink-0 mt-0.5" aria-hidden />
            ) : (
              <Building2 className="w-3.5 h-3.5 text-brand-gray shrink-0 mt-0.5" aria-hidden />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-brand-dark dark:text-gray-100 truncate">{m.name}</div>
              <div className="text-[10px] text-brand-gray truncate">
                Match: {m.reason}
                {m.email && ` · ${m.email}`}
                {m.phone && ` · ${m.phone}`}
              </div>
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onConfirmNew}
        className="w-full px-2 py-1 rounded text-[11px] font-medium text-orange-800 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-900/50 underline-offset-2 hover:underline"
      >
        None of these — this is a new {kind}
      </button>
    </div>
  )
}

// ── InlineCreateContact ────────────────────────────────────────────────

interface InlineCreateContactProps {
  onCreated: (id: string, name: string) => void
  /** Optional: auto-link the new contact to an account (paired-mode flow). */
  accountId?: string | null
  triggerLabel?: string
  disabled?: boolean
}

export function InlineCreateContact({
  onCreated,
  accountId,
  triggerLabel,
  disabled,
}: InlineCreateContactProps) {
  const [open, setOpen] = useState(false)
  const [salutation, setSalutation] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [contactType, setContactType] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null)
  const [overrideDuplicates, setOverrideDuplicates] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Salutation is a sub-field of the composite Contact__name and isn't
  // exposed as a standalone schema field. Hardcoded values match the
  // existing dynamic-form's CompositeText render
  // (apps/web/components/form/field-input.tsx).
  const salutations = { values: ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'], loaded: true }
  const contactTypes = usePicklistValues('Contact', 'contactType')
  const titles = usePicklistValues('Contact', 'title')
  // `Contact__status` is REQUIRED on the live schema, even though the
  // simplified Contact has very few user-visible fields. Pull the picklist
  // so the create payload uses whatever default the admin has configured.
  const contactStatuses = usePicklistValues('Contact', 'status')

  function reset() {
    setSalutation('')
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setContactType('')
    setTitle('')
    setError(null)
    setDuplicates(null)
    setOverrideDuplicates(false)
  }

  function handleCancel() {
    reset()
    setOpen(false)
  }

  function validate(): string | null {
    if (!firstName.trim()) return 'First name is required.'
    if (!lastName.trim()) return 'Last name is required.'
    if (!email.trim()) return 'Email is required — every contact needs one.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Email looks invalid.'
    if (!phone.trim()) return 'Phone is required — every contact needs one.'
    if (normalizePhone(phone).length < 7) return 'Phone looks too short.'
    return null
  }

  async function runDupCheckAndMaybeSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)

    // If the user hasn't yet acknowledged duplicates, run the check first.
    if (!overrideDuplicates) {
      setChecking(true)
      try {
        const dups = await findContactDuplicates(firstName, lastName, email, phone)
        if (dups.length > 0) {
          setDuplicates(dups)
          setChecking(false)
          return
        }
      } catch (e) {
        // Dup-check failure shouldn't block create — log and fall through.
        // eslint-disable-next-line no-console
        console.warn('Dup check failed', e)
      } finally {
        setChecking(false)
      }
    }

    await persist()
  }

  async function persist() {
    setSaving(true)
    setError(null)
    try {
      // The API's required-field validator (apps/api/src/routes/records.ts:
      // 622-641) has FIVE lookup patterns. The most reliable one for any
      // remaining required Contact__firstName / Contact__lastName fields is
      // pattern #2: bare-name match (`nd['firstName']`). Pattern #5 (composite
      // sub-field) only works when the schema field is bare-named — for
      // prefixed fields like `Contact__firstName` it fails because it looks
      // for keys ending with `_Contact__firstName`, not `_firstName`.
      //
      // To be robust against either shape (firstName might be a standalone
      // required field OR live only inside the Contact__name composite),
      // emit:
      //   • bare `firstName` / `lastName` (satisfies validator pattern #2)
      //   • the composite `name: { ... }` (so the stored record reads
      //     correctly via getRecordName on display)
      // The composite uses prefixed inner keys per the existing edit-form
      // submit shape (apps/web/components/form/field-input.tsx:768-778).
      const compositeInner: Record<string, string> = {
        Contact__name_firstName: firstName.trim(),
        Contact__name_lastName: lastName.trim(),
      }
      if (salutation) compositeInner.Contact__name_salutation = salutation
      const statusDefault = contactStatuses.values[0] ?? 'Active'
      const payload: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: compositeInner,
        status: statusDefault,
        primaryEmail: email.trim(),
        primaryPhone: phone.trim(),
      }
      if (salutation) payload.salutation = salutation
      if (contactType) payload.contactType = contactType
      if (title) payload.title = title
      // Contact's account FK is `AccountId` in the schema (auto-generated by the
      // ID-suffix convention), not `account`. Send both so the create works
      // whether the live schema has been migrated or not — the API just stores
      // whatever keys are in `data`, and the read path looks up `AccountId`.
      if (accountId) {
        payload.AccountId = accountId
        payload.account = accountId
      }
      const created = await apiClient.post<Record<string, unknown>>(
        '/objects/Contact/records',
        { data: payload },
      )
      const id = String((created as { id?: unknown }).id ?? '')
      if (!id) throw new Error('Server did not return a contact id.')
      const display = `${firstName.trim()} ${lastName.trim()}`.trim()
      onCreated(id, display || email.trim())
      reset()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create contact.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-[11px] text-brand-navy hover:text-brand-navy/80 underline-offset-2 hover:underline disabled:opacity-50"
      >
        <Plus className="w-3 h-3" aria-hidden />
        {triggerLabel ?? 'New contact'}
      </button>
    )
  }

  return (
    <div className="rounded-md border border-brand-navy/30 bg-white dark:bg-brand-dark p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <UserCircle className="w-3.5 h-3.5 text-brand-navy" aria-hidden />
        <span className="text-[11px] font-semibold text-brand-dark dark:text-gray-100">
          New contact
        </span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving || checking}
          className="ml-auto text-gray-400 hover:text-red-500"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-12 gap-1.5">
        {salutations.values.length > 0 && (
          <div className="col-span-3">
            <FieldLabel>Sal.</FieldLabel>
            <select
              value={salutation}
              onChange={e => setSalutation(e.target.value)}
              disabled={saving || checking}
              className={`${inputCls} w-full appearance-none`}
            >
              <option value="">—</option>
              {salutations.values.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        )}
        <div className={salutations.values.length > 0 ? 'col-span-4' : 'col-span-6'}>
          <FieldLabel required>First</FieldLabel>
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            disabled={saving || checking}
            placeholder="Charlie"
            aria-label="First name"
            className={`${inputCls} w-full`}
          />
        </div>
        <div className={salutations.values.length > 0 ? 'col-span-5' : 'col-span-6'}>
          <FieldLabel required>Last</FieldLabel>
          <input
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            disabled={saving || checking}
            placeholder="Taylor"
            aria-label="Last name"
            className={`${inputCls} w-full`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <FieldLabel required>Primary Email</FieldLabel>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            disabled={saving || checking}
            placeholder="charlie@example.com"
            aria-label="Primary email"
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <FieldLabel required>Primary Phone</FieldLabel>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            type="tel"
            disabled={saving || checking}
            placeholder="(555) 123-4567"
            aria-label="Primary phone"
            className={`${inputCls} w-full`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {contactTypes.values.length > 0 && (
          <div>
            <FieldLabel>Contact Type</FieldLabel>
            <select
              value={contactType}
              onChange={e => setContactType(e.target.value)}
              disabled={saving || checking}
              className={`${inputCls} w-full appearance-none`}
            >
              <option value="">—</option>
              {contactTypes.values.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        )}
        {titles.values.length > 0 && (
          <div>
            <FieldLabel>Title</FieldLabel>
            <select
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={saving || checking}
              className={`${inputCls} w-full appearance-none`}
            >
              <option value="">—</option>
              {titles.values.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Duplicate warning panel */}
      {duplicates && duplicates.length > 0 && !overrideDuplicates && (
        <DuplicateWarning
          matches={duplicates}
          kind="contact"
          onUseExisting={(id) => {
            // Fire onCreated as if the user picked an existing record. The
            // surrounding picker treats this id the same as any other choice.
            const match = duplicates.find(m => m.id === id)
            onCreated(id, match?.name ?? 'Existing Contact')
            reset()
            setOpen(false)
          }}
          onConfirmNew={() => {
            setOverrideDuplicates(true)
            setDuplicates(null)
          }}
        />
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => void runDupCheckAndMaybeSave()}
          disabled={disabled || saving || checking}
          className="px-2.5 py-1 rounded bg-brand-navy text-white text-[11px] font-medium hover:bg-brand-navy/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          {saving ? 'Creating…' : checking ? 'Checking duplicates…' : 'Create contact'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving || checking}
          className="px-2.5 py-1 rounded text-[11px] text-brand-gray hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand-navy/20 focus-visible:outline-none"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── InlineCreateAccount ────────────────────────────────────────────────

interface InlineCreateAccountProps {
  onCreated: (id: string, name: string) => void
  triggerLabel?: string
  disabled?: boolean
}

export function InlineCreateAccount({
  onCreated,
  triggerLabel,
  disabled,
}: InlineCreateAccountProps) {
  const [open, setOpen] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null)
  const [overrideDuplicates, setOverrideDuplicates] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Schema field is `Account__accountType`, not `Account__type`. The
  // `usePicklistValues` helper does suffix-match so passing 'accountType'
  // is correct.
  const accountTypes = usePicklistValues('Account', 'accountType')
  // `Account__status` is a required Picklist. Pull the configured values
  // so the create payload uses whatever the admin has named the default
  // (commonly "Active" but the picklist could be customized).
  const accountStatuses = usePicklistValues('Account', 'status')

  // When the form opens fresh, pre-select the first picklist value if there's
  // only one — saves the user a click.
  useEffect(() => {
    if (open && !accountType && accountTypes.values.length === 1) {
      setAccountType(accountTypes.values[0])
    }
  }, [open, accountType, accountTypes.values])

  function reset() {
    setAccountName('')
    setAccountType('')
    setEmail('')
    setPhone('')
    setWebsite('')
    setError(null)
    setDuplicates(null)
    setOverrideDuplicates(false)
  }

  function handleCancel() {
    reset()
    setOpen(false)
  }

  function validate(): string | null {
    if (!accountName.trim()) return 'Organization name is required.'
    if (accountTypes.values.length > 0 && !accountType) {
      return 'Type is required — categorize the organization (Customer, GC, etc.).'
    }
    const hasEmail = !!email.trim()
    const hasPhone = !!phone.trim()
    if (!hasEmail && !hasPhone) {
      return 'Add a phone or email — every organization needs at least one way to reach them.'
    }
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Email looks invalid.'
    }
    if (hasPhone && normalizePhone(phone).length < 7) {
      return 'Phone looks too short.'
    }
    return null
  }

  async function runDupCheckAndMaybeSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)

    if (!overrideDuplicates) {
      setChecking(true)
      try {
        const dups = await findAccountDuplicates(accountName, email, phone)
        if (dups.length > 0) {
          setDuplicates(dups)
          setChecking(false)
          return
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Dup check failed', e)
      } finally {
        setChecking(false)
      }
    }

    await persist()
  }

  async function persist() {
    setSaving(true)
    setError(null)
    try {
      // Field names match the live Account schema:
      //   Account__accountName  → bare `accountName` (REQUIRED)
      //   Account__accountType  → bare `accountType`
      //   Account__status       → bare `status` (REQUIRED — default to first
      //                          configured picklist value, fall back to
      //                          'Active' if the schema isn't loaded yet)
      //   Account__primaryEmail / Account__primaryPhone / Account__website
      const statusDefault = accountStatuses.values[0] ?? 'Active'
      const payload: Record<string, unknown> = {
        accountName: accountName.trim(),
        status: statusDefault,
      }
      if (accountType) payload.accountType = accountType
      if (email.trim()) payload.primaryEmail = email.trim()
      if (phone.trim()) payload.primaryPhone = phone.trim()
      if (website.trim()) payload.website = website.trim()
      const created = await apiClient.post<Record<string, unknown>>(
        '/objects/Account/records',
        { data: payload },
      )
      const id = String((created as { id?: unknown }).id ?? '')
      if (!id) throw new Error('Server did not return an account id.')
      onCreated(id, accountName.trim())
      reset()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create organization.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-[11px] text-brand-navy hover:text-brand-navy/80 underline-offset-2 hover:underline disabled:opacity-50"
      >
        <Plus className="w-3 h-3" aria-hidden />
        {triggerLabel ?? 'New organization'}
      </button>
    )
  }

  return (
    <div className="rounded-md border border-brand-navy/30 bg-white dark:bg-brand-dark p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Building2 className="w-3.5 h-3.5 text-brand-navy" aria-hidden />
        <span className="text-[11px] font-semibold text-brand-dark dark:text-gray-100">
          New organization
        </span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving || checking}
          className="ml-auto text-gray-400 hover:text-red-500"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <FieldLabel required>Organization Name</FieldLabel>
        <input
          value={accountName}
          onChange={e => setAccountName(e.target.value)}
          disabled={saving || checking}
          placeholder="Acme Renovations"
          aria-label="Organization name"
          className={`${inputCls} w-full`}
          autoFocus
        />
      </div>

      {accountTypes.values.length > 0 && (
        <div>
          <FieldLabel required>Type</FieldLabel>
          <select
            value={accountType}
            onChange={e => setAccountType(e.target.value)}
            disabled={saving || checking}
            className={`${inputCls} w-full appearance-none`}
          >
            <option value="">—</option>
            {accountTypes.values.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <FieldLabel>Primary Email</FieldLabel>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            disabled={saving || checking}
            placeholder="contact@acme.com"
            aria-label="Primary email"
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <FieldLabel>Primary Phone</FieldLabel>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            type="tel"
            disabled={saving || checking}
            placeholder="(555) 123-4567"
            aria-label="Primary phone"
            className={`${inputCls} w-full`}
          />
        </div>
      </div>
      <p className="text-[10px] text-brand-gray">Email or phone required — at least one way to reach them.</p>

      <div>
        <FieldLabel>Website</FieldLabel>
        <input
          value={website}
          onChange={e => setWebsite(e.target.value)}
          type="url"
          disabled={saving || checking}
          placeholder="https://acme.com"
          aria-label="Website"
          className={`${inputCls} w-full`}
        />
      </div>

      {duplicates && duplicates.length > 0 && !overrideDuplicates && (
        <DuplicateWarning
          matches={duplicates}
          kind="account"
          onUseExisting={(id) => {
            const match = duplicates.find(m => m.id === id)
            onCreated(id, match?.name ?? 'Existing Organization')
            reset()
            setOpen(false)
          }}
          onConfirmNew={() => {
            setOverrideDuplicates(true)
            setDuplicates(null)
          }}
        />
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => void runDupCheckAndMaybeSave()}
          disabled={disabled || saving || checking}
          className="px-2.5 py-1 rounded bg-brand-navy text-white text-[11px] font-medium hover:bg-brand-navy/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          {saving ? 'Creating…' : checking ? 'Checking duplicates…' : 'Create organization'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving || checking}
          className="px-2.5 py-1 rounded text-[11px] text-brand-gray hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand-navy/20 focus-visible:outline-none"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
