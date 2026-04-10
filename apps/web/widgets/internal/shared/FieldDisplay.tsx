'use client'

// ── Field extraction helper ────────────────────────────────────────────

/** Extract a field from any record shape (plain or with .data blob), tolerating prefixed keys */
export function getFieldValue(raw: Record<string, unknown>, field: string): unknown {
  const d = (raw.data && typeof raw.data === 'object')
    ? raw.data as Record<string, unknown>
    : raw
  if (d[field] !== undefined) return d[field]
  for (const key of Object.keys(d)) {
    if (key.replace(/^[A-Za-z]+__/, '') === field) return d[key]
  }
  return undefined
}

// ── FieldDisplay component ─────────────────────────────────────────────

/**
 * Renders a set of configured field values from a record as small inline badges.
 * Fields with empty/null values are silently skipped.
 */
export function FieldDisplay({ data, fields }: { data: Record<string, unknown>; fields: string[] }) {
  if (!fields.length) return null
  const items = fields
    .map(f => ({ field: f, value: getFieldValue(data, f) }))
    .filter(({ value }) => value != null && String(value).trim() !== '')
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
      {items.map(({ field, value }) => (
        <span key={field} className="text-[10px] text-brand-gray">
          {String(value)}
        </span>
      ))}
    </div>
  )
}
