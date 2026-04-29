'use client'

/**
 * Per-user, browser-local memory for the inline-add connection flow.
 *
 *   - "Recents" = the last N persons (Contacts) and orgs (Accounts) the user
 *     attached. Used to seed the lookup dropdown so the common "I just added
 *     them on a different record an hour ago" case is one keystroke.
 *   - "Last role" = the last role the user picked for a given parent object
 *     type, used to pre-fill the role select on subsequent inline-adds.
 *
 * All state lives in localStorage. We cap entry counts so the keys can't grow
 * unbounded across users sharing a device. Reads silently degrade to empty
 * results when localStorage is unavailable (SSR, private mode, quota errors).
 */

const RECENT_CONTACTS_KEY = 'tischler.connections.recents.contacts'
const RECENT_ACCOUNTS_KEY = 'tischler.connections.recents.accounts'
const LAST_ROLE_PREFIX = 'tischler.connections.lastRole.'

const MAX_RECENTS = 5

function safeRead(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function readIdList(key: string): string[] {
  const raw = safeRead(key)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, MAX_RECENTS)
  } catch {
    return []
  }
}

function writeIdList(key: string, ids: string[]): void {
  safeWrite(key, JSON.stringify(ids.slice(0, MAX_RECENTS)))
}

function pushRecent(key: string, id: string): void {
  if (!id) return
  const current = readIdList(key)
  const next = [id, ...current.filter(existing => existing !== id)].slice(0, MAX_RECENTS)
  writeIdList(key, next)
}

// ── Public API ─────────────────────────────────────────────────────────

export function getRecentContactIds(): string[] {
  return readIdList(RECENT_CONTACTS_KEY)
}

export function rememberContact(contactId: string): void {
  pushRecent(RECENT_CONTACTS_KEY, contactId)
}

export function getRecentAccountIds(): string[] {
  return readIdList(RECENT_ACCOUNTS_KEY)
}

export function rememberAccount(accountId: string): void {
  pushRecent(RECENT_ACCOUNTS_KEY, accountId)
}

/**
 * Returns the last role the user picked when adding a connection on a record
 * of the given object type, or empty string if no preference is stored.
 */
export function getLastRoleForObject(parentObjectApiName: string): string {
  return safeRead(LAST_ROLE_PREFIX + parentObjectApiName) ?? ''
}

export function rememberRoleForObject(parentObjectApiName: string, role: string): void {
  if (!role) return
  safeWrite(LAST_ROLE_PREFIX + parentObjectApiName, role)
}
