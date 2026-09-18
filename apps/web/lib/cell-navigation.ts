// Shared Excel-like keyboard navigation helper for click-to-edit grid widgets
// (Punch List, Per Diem). Mirrors the cell-navigation logic already used in
// apps/web/app/summary/page.tsx and apps/web/app/arcadia-summary/page.tsx.

export type NavDirection = 'left' | 'right' | 'up' | 'down'

/**
 * Finds the `data-cell-id` of the table cell adjacent to `td` in the given
 * direction. 'right' wraps to the first cell of the next row when at the
 * end of a row; cells without a `data-cell-id` descendant (disabled/computed
 * columns) are skipped over.
 */
export function findAdjacentCellId(td: Element, direction: NavDirection): string | null {
  const tr = td.closest('tr')
  const tbody = tr?.closest('tbody')
  if (!tr || !tbody) return null
  const rows = Array.from(tbody.querySelectorAll(':scope > tr'))
  const cells = Array.from(tr.querySelectorAll(':scope > td'))
  const rowIdx = rows.indexOf(tr as HTMLTableRowElement)
  const colIdx = cells.indexOf(td as HTMLTableCellElement)
  const cellIdOf = (el: Element | undefined) =>
    el?.querySelector('[data-cell-id]')?.getAttribute('data-cell-id') ?? null

  if (direction === 'right') {
    for (let c = colIdx + 1; c < cells.length; c++) {
      const id = cellIdOf(cells[c])
      if (id) return id
    }
    if (rowIdx + 1 < rows.length) {
      const nextCells = Array.from((rows[rowIdx + 1] as Element).querySelectorAll(':scope > td'))
      for (const tc of nextCells) {
        const id = cellIdOf(tc)
        if (id) return id
      }
    }
    return null
  }
  if (direction === 'left') {
    for (let c = colIdx - 1; c >= 0; c--) {
      const id = cellIdOf(cells[c])
      if (id) return id
    }
    return null
  }
  if (direction === 'down') {
    for (let r = rowIdx + 1; r < rows.length; r++) {
      const targetCells = Array.from((rows[r] as Element).querySelectorAll(':scope > td'))
      if (colIdx < targetCells.length) {
        const id = cellIdOf(targetCells[colIdx])
        if (id) return id
      }
    }
    return null
  }
  // up
  for (let r = rowIdx - 1; r >= 0; r--) {
    const targetCells = Array.from((rows[r] as Element).querySelectorAll(':scope > td'))
    if (colIdx < targetCells.length) {
      const id = cellIdOf(targetCells[colIdx])
      if (id) return id
    }
  }
  return null
}
