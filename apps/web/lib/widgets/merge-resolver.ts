// Resolves {record.fieldApiName} tokens in a string.
// Rules:
//   - Single-level only: {record.fieldApiName} → record[fieldApiName]
//   - Missing field → empty string (no error)
//   - Nested paths ({record.a.b}) are NOT supported in v1; left as-is
//   - Non-string config values pass through unchanged

const TOKEN_RE = /\{record\.([a-zA-Z0-9_]+)\}/g

export function resolveString(
  value: string,
  record: Record<string, unknown>
): string {
  return value.replace(TOKEN_RE, (_, field) => {
    const v = record[field]
    return v !== undefined && v !== null ? String(v) : ''
  })
}

export function resolveConfig(
  config: Record<string, unknown>,
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).map(([k, v]) => [
      k,
      typeof v === 'string' ? resolveString(v, record) : v,
    ])
  )
}
