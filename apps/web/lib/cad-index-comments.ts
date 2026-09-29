export function parseCadIndexComments(raw: unknown): Record<string, string> {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] =>
      typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}