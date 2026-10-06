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