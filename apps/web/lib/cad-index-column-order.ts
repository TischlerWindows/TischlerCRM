export function orderedColumns<Column extends { key: string }>(
  reportType: string,
  defaults: Column[],
  rawOrder: unknown,
): Column[] {
  let saved: unknown
  try {
    const parsed = typeof rawOrder === 'string' ? JSON.parse(rawOrder) : rawOrder
    saved = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[reportType] : undefined
  } catch {
    saved = undefined
  }
  if (!Array.isArray(saved)) return defaults
  const keys = [...new Set(saved.filter((key): key is string => typeof key === 'string'))]
  return [
    ...keys.map((key) => defaults.find((column) => column.key === key)).filter((column): column is Column => !!column),
    ...defaults.filter((column) => !keys.includes(column.key)),
  ]
}