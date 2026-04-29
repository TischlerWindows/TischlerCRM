/**
 * Best-effort display name resolution for any CRM record.
 *
 * Used by the Connections widgets (Rollup + Associations) AND the inline-add
 * components to derive a friendly label from a flattened or wrapped record.
 *
 * The resolver walks a priority order tuned for the metadata-driven schema:
 *
 *   0. Composite `name` object (Contact's CompositeText name field) — but
 *      filtered for placeholder tokens like "N/A" so degenerate composites
 *      fall through to the flat firstName/lastName.
 *   1. Flat firstName + lastName (Contact-style, prefixed or plain)
 *   2. Prefixed name fields (e.g. Account__accountName, opportunityName)
 *   3. Auto-number fields (propertyNumber, opportunityNumber, projectNumber,
 *      workOrderNumber, installationNumber, leadNumber, quoteNumber). These
 *      are the primary identifier for parent-record types like Property that
 *      have no separate "name" field. Excludes phone/mobile fields.
 *   4. Plain name/title/label fields
 *   5. Address fallback (street + city) for records with none of the above
 *   6. "Unnamed"
 */

/** Treat these tokens as "no value" — legacy records have name fields
 *  pre-filled with the literal "N/A" and we want to fall through to other
 *  fields when that happens. */
export const PLACEHOLDER_NAME_TOKENS: ReadonlySet<string> = new Set([
  'n/a',
  'na',
  '-',
  '—',
])

export function isMeaningfulNamePart(v: unknown): v is string {
  if (typeof v !== 'string') return false
  const t = v.trim()
  if (!t) return false
  return !PLACEHOLDER_NAME_TOKENS.has(t.toLowerCase())
}

export function getRecordName(raw: Record<string, unknown>): string {
  const d =
    raw.data && typeof raw.data === 'object'
      ? (raw.data as Record<string, unknown>)
      : raw

  // 0. Composite `name` object (Contact's CompositeText name field).
  for (const key of Object.keys(d)) {
    const lower = key.toLowerCase()
    const isNameKey = lower === 'name' || lower.endsWith('__name')
    if (
      isNameKey &&
      d[key] &&
      typeof d[key] === 'object' &&
      !Array.isArray(d[key])
    ) {
      const nameObj = d[key] as Record<string, unknown>
      const findVal = (suffix: string) => {
        const k = Object.keys(nameObj).find(kk =>
          kk.toLowerCase().endsWith(suffix),
        )
        return k ? nameObj[k] : undefined
      }
      const sal = nameObj.salutation ?? findVal('salutation')
      const fn = nameObj.firstName ?? findVal('firstname')
      const ln = nameObj.lastName ?? findVal('lastname')
      const parts = [sal, fn, ln].filter(isMeaningfulNamePart).map(v => v.trim())
      if (parts.length > 0) return parts.join(' ')
    }
  }

  // 1. Contact-style first+last name fields (prefixed or plain).
  for (const key of Object.keys(d)) {
    if (key.endsWith('__firstName') || key === 'firstName') {
      const val = d[key]
      if (isMeaningfulNamePart(val)) {
        const prefix = key.replace(/__firstName$/, '')
        const lastName = d[`${prefix}__lastName`] ?? d.lastName
        if (isMeaningfulNamePart(lastName)) return `${val} ${lastName}`
        return val
      }
    }
  }

  // 2. Prefixed name fields (e.g. Account__accountName, Contact__name).
  for (const key of Object.keys(d)) {
    const lower = key.toLowerCase()
    if (
      (lower.endsWith('name') || lower.endsWith('__name')) &&
      !lower.includes('firstname') &&
      !lower.includes('lastname')
    ) {
      const val = d[key]
      if (isMeaningfulNamePart(val)) return val
    }
  }

  // 3. Auto-number fields (propertyNumber, opportunityNumber, etc.).
  for (const key of Object.keys(d)) {
    const bare = key.replace(/^[A-Za-z]+__/, '').toLowerCase()
    if (
      bare.endsWith('number') &&
      !bare.includes('phone') &&
      !bare.includes('mobile')
    ) {
      const val = d[key]
      if (isMeaningfulNamePart(val)) return val
    }
  }

  // 4. Plain fields.
  if (
    isMeaningfulNamePart(d.firstName) &&
    isMeaningfulNamePart(d.lastName)
  ) {
    return `${(d.firstName as string).trim()} ${(d.lastName as string).trim()}`
  }
  if (isMeaningfulNamePart(d.name)) return (d.name as string).trim()
  if (isMeaningfulNamePart(d.title)) return (d.title as string).trim()
  if (isMeaningfulNamePart(d.label)) return (d.label as string).trim()

  // 5. Address fallback for Property records with no number — render street + city.
  const addr = d.address
  if (addr && typeof addr === 'object') {
    const a = addr as Record<string, unknown>
    const street = isMeaningfulNamePart(a.street) ? a.street : ''
    const city = isMeaningfulNamePart(a.city) ? a.city : ''
    const joined = [street, city].filter(Boolean).join(', ')
    if (joined) return joined
  }
  if (typeof addr === 'string' && addr.trim()) return addr.trim()

  return 'Unnamed'
}
