export function orderedColumns<Column extends { key: string; label: string; type: 'text' | 'number' | 'checkbox'; multiline?: boolean }>(
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
  const savedOrder = Array.isArray(saved) ? saved : (saved as { order?: unknown } | undefined)?.order
  if (!Array.isArray(savedOrder)) return defaults
  const custom: Column[] = []
  const rawCustom = !Array.isArray(saved) && saved && typeof saved === 'object'
    ? (saved as { custom?: unknown }).custom
    : undefined
  if (Array.isArray(rawCustom)) {
    for (const entry of rawCustom) {
      if (!entry || typeof entry !== 'object') continue
      const column = entry as Record<string, unknown>
      if (typeof column.key !== 'string' || !/^cadCustom_[A-Za-z0-9_]+$/.test(column.key) ||
          typeof column.label !== 'string' || !column.label.trim() ||
          (column.type !== 'text' && column.type !== 'number' && column.type !== 'checkbox') ||
          defaults.some((item) => item.key === column.key) || custom.some((item) => item.key === column.key)) continue
      custom.push({ key: column.key, label: column.label, type: column.type, multiline: column.multiline === true } as Column)
    }
  }
  const available = [...defaults, ...custom]
  const keys = [...new Set(savedOrder.filter((key): key is string => typeof key === 'string'))]
  return [
    ...keys.map((key) => available.find((column) => column.key === key)).filter((column): column is Column => !!column),
    ...available.filter((column) => !keys.includes(column.key)),
  ]
}