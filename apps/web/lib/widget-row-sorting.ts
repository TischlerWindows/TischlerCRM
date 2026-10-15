export type RowSortDirection = 'asc' | 'desc'

export function sortRowsByValue<T>(
  rows: T[],
  getValue: (row: T) => unknown,
  direction: RowSortDirection,
): T[] {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => {
    const leftValue = String(getValue(left) ?? '').trim()
    const rightValue = String(getValue(right) ?? '').trim()
    return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' }) * multiplier
  })
}