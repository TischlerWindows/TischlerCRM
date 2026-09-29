export interface LookupUserIdentity {
  id: string
  name?: string | null
  email?: string | null
}

export function userLookupIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((id) => id.trim()).filter(Boolean)
  if (value && typeof value === 'object') {
    const lookup = value as Record<string, unknown>
    const id = lookup.lookup ?? lookup.id ?? lookup.value
    return typeof id === 'string' && id.trim() ? [id.trim()] : []
  }
  if (typeof value !== 'string') return []
  return value.split(';').map((id) => id.trim()).filter(Boolean)
}

export function activeLookupUsers(value: unknown, users: LookupUserIdentity[]): LookupUserIdentity[] {
  const byId = new Map(users.map((user) => [String(user.id), user]))
  return userLookupIds(value).map((id) => byId.get(id)).filter((user): user is LookupUserIdentity => !!user)
}

export function normalizeSingleLookupUserValue(value: unknown, users: LookupUserIdentity[]): string {
  const active = activeLookupUsers(value, users)
  return active[active.length - 1]?.id ?? ''
}