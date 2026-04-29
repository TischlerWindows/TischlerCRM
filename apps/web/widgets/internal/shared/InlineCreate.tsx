'use client'

/**
 * Inline-create forms for Contact and Account records, used by every
 * connection entry point (Connection Slot widget, Connections inline-add row,
 * paired-mode contact list). The goal: a closed-loop UX where the user never
 * has to leave the connection flow to create a missing person or organization.
 *
 * Each form is a controlled, collapsible component. Click the trigger ("+ New
 * contact" / "+ New organization") to expand a small set of inputs; on save
 * the new record is POSTed and the consumer's `onCreated(id, name)` callback
 * fires so the surrounding picker can auto-select it.
 */

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { apiClient } from '@/lib/api-client'

interface InlineCreateContactProps {
  /** Called with the new Contact's id and resolved display name on success.
   *  The parent typically sets its `contactId` state to this id. */
  onCreated: (id: string, name: string) => void
  /** Optional: when set, the new contact is created with this account already
   *  linked (so paired-mode "+ Add new contact for this organization" works). */
  accountId?: string | null
  /** Optional label override for the trigger button. */
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
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setError(null)
  }

  function handleCancel() {
    reset()
    setOpen(false)
  }

  async function handleSave() {
    const fn = firstName.trim()
    const ln = lastName.trim()
    if (!fn && !ln && !email.trim()) {
      setError('First name, last name, or email is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}
      if (fn) payload.firstName = fn
      if (ln) payload.lastName = ln
      if (email.trim()) payload.email = email.trim()
      if (phone.trim()) payload.primaryPhone = phone.trim()
      if (accountId) payload.account = accountId
      const created = await apiClient.post<Record<string, unknown>>(
        '/objects/Contact/records',
        { data: payload },
      )
      const data = (created.data && typeof created.data === 'object'
        ? (created.data as Record<string, unknown>)
        : created) as Record<string, unknown>
      const id = String((created as { id?: unknown }).id ?? data.id ?? '')
      if (!id) throw new Error('Server did not return a contact id.')
      const display = [fn, ln].filter(Boolean).join(' ').trim() || email.trim() || 'New Contact'
      onCreated(id, display)
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
    <div className="rounded-md border border-brand-navy/30 bg-white dark:bg-brand-dark p-2 space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <input
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          placeholder="First name"
          aria-label="First name"
          disabled={disabled || saving}
          className="h-8 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
        />
        <input
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          placeholder="Last name"
          aria-label="Last name"
          disabled={disabled || saving}
          className="h-8 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
        />
      </div>
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        type="email"
        placeholder="Email (optional)"
        aria-label="Email"
        disabled={disabled || saving}
        className="w-full h-8 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
      />
      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        type="tel"
        placeholder="Phone (optional)"
        aria-label="Phone"
        disabled={disabled || saving}
        className="w-full h-8 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
      />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={disabled || saving}
          className="px-2.5 py-1 rounded bg-brand-navy text-white text-[11px] font-medium hover:bg-brand-navy/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          {saving ? 'Creating…' : 'Create contact'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="px-2.5 py-1 rounded text-[11px] text-brand-gray hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand-navy/20 focus-visible:outline-none"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

interface InlineCreateAccountProps {
  /** Called with the new Account's id and resolved display name on success. */
  onCreated: (id: string, name: string) => void
  /** Optional label override for the trigger button. */
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
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setAccountName('')
    setPhone('')
    setWebsite('')
    setError(null)
  }

  function handleCancel() {
    reset()
    setOpen(false)
  }

  async function handleSave() {
    const name = accountName.trim()
    if (!name) {
      setError('Organization name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = { accountName: name }
      if (phone.trim()) payload.primaryPhone = phone.trim()
      if (website.trim()) payload.website = website.trim()
      const created = await apiClient.post<Record<string, unknown>>(
        '/objects/Account/records',
        { data: payload },
      )
      const id = String((created as { id?: unknown }).id ?? '')
      if (!id) throw new Error('Server did not return an account id.')
      onCreated(id, name)
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
    <div className="rounded-md border border-brand-navy/30 bg-white dark:bg-brand-dark p-2 space-y-1.5">
      <input
        value={accountName}
        onChange={e => setAccountName(e.target.value)}
        placeholder="Organization name *"
        aria-label="Organization name"
        disabled={disabled || saving}
        className="w-full h-8 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
        autoFocus
      />
      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        type="tel"
        placeholder="Phone (optional)"
        aria-label="Phone"
        disabled={disabled || saving}
        className="w-full h-8 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
      />
      <input
        value={website}
        onChange={e => setWebsite(e.target.value)}
        type="url"
        placeholder="Website (optional)"
        aria-label="Website"
        disabled={disabled || saving}
        className="w-full h-8 px-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy focus-visible:ring-2 focus-visible:ring-brand-navy/20"
      />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={disabled || saving}
          className="px-2.5 py-1 rounded bg-brand-navy text-white text-[11px] font-medium hover:bg-brand-navy/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
        >
          {saving ? 'Creating…' : 'Create organization'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="px-2.5 py-1 rounded text-[11px] text-brand-gray hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand-navy/20 focus-visible:outline-none"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
