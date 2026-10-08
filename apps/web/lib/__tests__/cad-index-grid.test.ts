import {
  getGridSelectionBounds,
  getGridSelectionOrigin,
  isCaretAtHorizontalEdge,
  getGridFillRangeCellClasses,
  getGridFillRangeBounds,
  getGridFillTargets,
  isInGridSelection,
  parseGridCellValue,
  parseGridClipboard,
  spreadsheetColumnLabel,
  serializeGridClipboard,
  tileGridClipboardToSelection,
} from '../cad-index-grid'

describe('CAD Index List spreadsheet grid helpers', () => {
  it('detects horizontal caret boundaries in text and textarea editors', () => {
    expect(isCaretAtHorizontalEdge('55', 2, 2, 'right')).toBe(true)
    expect(isCaretAtHorizontalEdge('55', 2, 2, 'left')).toBe(false)
    expect(isCaretAtHorizontalEdge('notes', 0, 0, 'left')).toBe(true)
    expect(isCaretAtHorizontalEdge('notes', 0, 0, 'right')).toBe(false)
    expect(isCaretAtHorizontalEdge('55', null, null, 'right')).toBe(false)
  })

  it('normalizes a rectangular selection regardless of drag direction', () => {
    const selection = { anchor: { row: 3, column: 4 }, focus: { row: 1, column: 2 } }
    expect(getGridSelectionBounds(selection)).toEqual({ top: 1, bottom: 3, left: 2, right: 4 })
    expect(getGridSelectionOrigin(selection)).toEqual({ row: 1, column: 2 })
    expect(isInGridSelection(2, 3, selection)).toBe(true)
    expect(isInGridSelection(0, 3, selection)).toBe(false)
  })

  it('converts zero-based grid columns to spreadsheet labels', () => {
    expect([0, 25, 26, 27, 701].map(spreadsheetColumnLabel)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ'])
  })

  it('repeats a selected block into the cells covered by the fill handle', () => {
    const selection = { anchor: { row: 1, column: 1 }, focus: { row: 2, column: 2 } }
    expect(getGridFillTargets(selection, { row: 4, column: 4 })).toEqual([
      { row: 1, column: 3, sourceRow: 1, sourceColumn: 1 },
      { row: 1, column: 4, sourceRow: 1, sourceColumn: 2 },
      { row: 2, column: 3, sourceRow: 2, sourceColumn: 1 },
      { row: 2, column: 4, sourceRow: 2, sourceColumn: 2 },
      { row: 3, column: 1, sourceRow: 1, sourceColumn: 1 },
      { row: 3, column: 2, sourceRow: 1, sourceColumn: 2 },
      { row: 3, column: 3, sourceRow: 1, sourceColumn: 1 },
      { row: 3, column: 4, sourceRow: 1, sourceColumn: 2 },
      { row: 4, column: 1, sourceRow: 2, sourceColumn: 1 },
      { row: 4, column: 2, sourceRow: 2, sourceColumn: 2 },
      { row: 4, column: 3, sourceRow: 2, sourceColumn: 1 },
      { row: 4, column: 4, sourceRow: 2, sourceColumn: 2 },
    ])
  })

  it('uses one outer perimeter and a shaded destination for the fill preview', () => {
    const selection = { anchor: { row: 1, column: 1 }, focus: { row: 1, column: 1 } }
    const target = { row: 3, column: 2 }
    expect(getGridFillRangeBounds(selection, target)).toEqual({ top: 1, bottom: 3, left: 1, right: 2 })
    expect(getGridFillRangeCellClasses(2, 1, selection, target)).toBe('!bg-gray-300 border-l-2 border-l-[#217346]')
    expect(getGridFillRangeCellClasses(3, 2, selection, target)).toBe('!bg-gray-300 border-b-2 border-b-[#217346] border-r-2 border-r-[#217346]')
    expect(getGridFillRangeCellClasses(0, 0, selection, target)).toBe('')
  })

  it('repeats a copied value across a larger selected paste range', () => {
    const selection = { anchor: { row: 4, column: 1 }, focus: { row: 1, column: 3 } }
    expect(tileGridClipboardToSelection([['55']], selection)).toEqual([
      ['55', '55', '55'],
      ['55', '55', '55'],
      ['55', '55', '55'],
      ['55', '55', '55'],
    ])
  })

  it('preserves a clipboard matrix that is larger than the selected range', () => {
    const selection = { anchor: { row: 0, column: 0 }, focus: { row: 0, column: 0 } }
    const matrix = [['A', 'B'], ['C', 'D']]
    expect(tileGridClipboardToSelection(matrix, selection)).toBe(matrix)
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