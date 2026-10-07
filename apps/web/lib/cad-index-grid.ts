import Papa from 'papaparse'

export type GridColumnType = 'text' | 'number' | 'checkbox'

export interface GridCoordinate {
  row: number
  column: number
}

export interface GridSelection {
  anchor: GridCoordinate
  focus: GridCoordinate
}

export function spreadsheetColumnLabel(index: number): string {
  let value = index + 1
  let label = ''
  while (value > 0) {
    value -= 1
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26)
  }
  return label
}

export function getGridSelectionBounds(selection: GridSelection) {
  return {
    top: Math.min(selection.anchor.row, selection.focus.row),
    bottom: Math.max(selection.anchor.row, selection.focus.row),
    left: Math.min(selection.anchor.column, selection.focus.column),
    right: Math.max(selection.anchor.column, selection.focus.column),
  }
}

export function getGridSelectionOrigin(selection: GridSelection): GridCoordinate {
  const bounds = getGridSelectionBounds(selection)
  return { row: bounds.top, column: bounds.left }
}

export function isInGridSelection(row: number, column: number, selection: GridSelection): boolean {
  const bounds = getGridSelectionBounds(selection)
  return row >= bounds.top && row <= bounds.bottom
    && column >= bounds.left && column <= bounds.right
}

export function parseGridClipboard(text: string): string[][] {
  if (!text) return [['']]
  const parsed = Papa.parse<string[]>(text, { delimiter: '\t', skipEmptyLines: false })
  const rows = parsed.data
  if (/\r?\n$/.test(text) && rows.length > 1 && rows[rows.length - 1]?.every((cell) => cell === '')) rows.pop()
  return rows.length ? rows : [['']]
}

export function serializeGridClipboard(rows: unknown[][]): string {
  return Papa.unparse(rows.map((row) => row.map((value) => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    return String(value)
  })), { delimiter: '\t', newline: '\r\n', quotes: true })
}

export function parseGridCellValue(value: string, type: GridColumnType): { valid: boolean; value: unknown } {
  if (type === 'text') return { valid: true, value }
  if (type === 'number') {
    if (!value.trim()) return { valid: true, value: '' }
    const number = Number(value)
    return Number.isFinite(number) ? { valid: true, value: number } : { valid: false, value: '' }
  }

  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return { valid: true, value: true }
  if (['false', '0', 'no', 'n', ''].includes(normalized)) return { valid: true, value: false }
  return { valid: false, value: false }
}

export function getGridFillTargets(
  selection: GridSelection,
  target: GridCoordinate,
): Array<{ row: number; column: number; sourceRow: number; sourceColumn: number }> {
  const bounds = getGridSelectionBounds(selection)
  const height = bounds.bottom - bounds.top + 1
  const width = bounds.right - bounds.left + 1
  const top = Math.min(bounds.top, target.row)
  const bottom = Math.max(bounds.bottom, target.row)
  const left = Math.min(bounds.left, target.column)
  const right = Math.max(bounds.right, target.column)
  const targets: Array<{ row: number; column: number; sourceRow: number; sourceColumn: number }> = []

  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) {
      if (isInGridSelection(row, column, selection)) continue
      const rowOffset = ((row - bounds.top) % height + height) % height
      const columnOffset = ((column - bounds.left) % width + width) % width
      targets.push({
        row,
        column,
        sourceRow: bounds.top + rowOffset,
        sourceColumn: bounds.left + columnOffset,
      })
    }
  }
  return targets
}