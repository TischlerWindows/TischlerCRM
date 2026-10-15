import { sortRowsByValue } from '../widget-row-sorting'

describe('widget row sorting', () => {
  const rows = [{ itemNumber: '2' }, { itemNumber: '10' }, { itemNumber: '1' }]

  it('sorts numeric-looking first-column values in either direction', () => {
    expect(sortRowsByValue(rows, (row) => row.itemNumber, 'desc').map((row) => row.itemNumber))
      .toEqual(['10', '2', '1'])
    expect(sortRowsByValue(rows, (row) => row.itemNumber, 'asc').map((row) => row.itemNumber))
      .toEqual(['1', '2', '10'])
  })
})