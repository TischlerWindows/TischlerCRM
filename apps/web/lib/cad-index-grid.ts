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

export function tileGridClipboardToSelection(matrix: string[][], selection: GridSelection): string[][] {
  if (!matrix.length) return matrix
  const bounds = getGridSelectionBounds(selection)
  const height = bounds.bottom - bounds.top + 1
  const width = bounds.right - bounds.left + 1
  const sourceWidth = Math.max(...matrix.map(row => row.length))
  if (matrix.length > height || sourceWidth > width || (matrix.length === height && sourceWidth === width)) return matrix

  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, column) => matrix[row % matrix.length]?.[column % sourceWidth] ?? ''),
  )
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
  const fillBounds = getGridFillRangeBounds(selection, target)
  const height = bounds.bottom - bounds.top + 1
  const width = bounds.right - bounds.left + 1
  const targets: Array<{ row: number; column: number; sourceRow: number; sourceColumn: number }> = []

  for (let row = fillBounds.top; row <= fillBounds.bottom; row++) {
    for (let column = fillBounds.left; column <= fillBounds.right; column++) {
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

export function getGridFillRangeBounds(selection: GridSelection, target: GridCoordinate) {
  const bounds = getGridSelectionBounds(selection)
  return {
    top: Math.min(bounds.top, target.row),
    bottom: Math.max(bounds.bottom, target.row),
    left: Math.min(bounds.left, target.column),
    right: Math.max(bounds.right, target.column),
  }
}

export function getGridFillRangeCellClasses(
  row: number,
  column: number,
  selection: GridSelection,
  target: GridCoordinate,
): string {
  const bounds = getGridFillRangeBounds(selection, target)
  const isTarget = !isInGridSelection(row, column, selection)
  if (row < bounds.top || row > bounds.bottom || column < bounds.left || column > bounds.right) return ''

  return [
    isTarget ? '!bg-gray-300' : '',
    row === bounds.top ? 'border-t-2 border-t-[#217346]' : '',
    row === bounds.bottom ? 'border-b-2 border-b-[#217346]' : '',
    column === bounds.left ? 'border-l-2 border-l-[#217346]' : '',
    column === bounds.right ? 'border-r-2 border-r-[#217346]' : '',
  ].filter(Boolean).join(' ')
}

export function isCaretAtHorizontalEdge(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  direction: 'left' | 'right',
): boolean {
  if (selectionStart === null || selectionEnd === null) return false
  return direction === 'left'
    ? selectionStart === 0 && selectionEnd === 0
    : selectionStart === value.length && selectionEnd === value.length
}