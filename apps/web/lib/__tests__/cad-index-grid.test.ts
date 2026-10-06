import {
  getGridSelectionBounds,
  isInGridSelection,
  parseGridCellValue,
  parseGridClipboard,
  spreadsheetColumnLabel,
  serializeGridClipboard,
} from '../cad-index-grid'

describe('CAD Index List spreadsheet grid helpers', () => {
  it('normalizes a rectangular selection regardless of drag direction', () => {
    const selection = { anchor: { row: 3, column: 4 }, focus: { row: 1, column: 2 } }
    expect(getGridSelectionBounds(selection)).toEqual({ top: 1, bottom: 3, left: 2, right: 4 })
    expect(isInGridSelection(2, 3, selection)).toBe(true)
    expect(isInGridSelection(0, 3, selection)).toBe(false)
  })

  it('converts zero-based grid columns to spreadsheet labels', () => {
    expect([0, 25, 26, 27, 701].map(spreadsheetColumnLabel)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ'])
  })

  it('round-trips tabular clipboard data including tabs, quotes, and line breaks', () => {
    const grid = [['Unit', 'Remarks'], ['A-1', 'Said "ready"\nsecond line']]
    expect(parseGridClipboard(serializeGridClipboard(grid))).toEqual(grid)
    expect(parseGridClipboard('A-1\t2\r\nB-2\t3')).toEqual([['A-1', '2'], ['B-2', '3']])
    expect(parseGridClipboard(serializeGridClipboard([['A-1'], ['']]))).toEqual([['A-1'], ['']])
  })

  it('converts spreadsheet values according to the destination column type', () => {
    expect(parseGridCellValue('12.5', 'number')).toEqual({ valid: true, value: 12.5 })
    expect(parseGridCellValue('', 'number')).toEqual({ valid: true, value: '' })
    expect(parseGridCellValue('not a number', 'number').valid).toBe(false)
    expect(parseGridCellValue('Yes', 'checkbox')).toEqual({ valid: true, value: true })
    expect(parseGridCellValue('FALSE', 'checkbox')).toEqual({ valid: true, value: false })
    expect(parseGridCellValue('maybe', 'checkbox').valid).toBe(false)
  })
})