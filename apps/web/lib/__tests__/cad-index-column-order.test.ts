import { orderedColumns } from '../cad-index-column-order'

const columns = [{ key: 'unit' }, { key: 'qty' }, { key: 'remarks' }]

describe('CAD Index List column order', () => {
  it('uses saved order for the selected report only', () => {
    const saved = JSON.stringify({ Survey: ['remarks', 'unit', 'qty'], Progress: ['qty', 'unit', 'remarks'] })
    expect(orderedColumns('Survey', columns, saved).map((column) => column.key)).toEqual(['remarks', 'unit', 'qty'])
    expect(orderedColumns('Progress', columns, saved).map((column) => column.key)).toEqual(['qty', 'unit', 'remarks'])
  })

  it('ignores removed and repeated keys, appending new columns', () => {
    const saved = JSON.stringify({ Survey: ['remarks', 'removed', 'remarks', 'unit'] })
    expect(orderedColumns('Survey', columns, saved).map((column) => column.key)).toEqual(['remarks', 'unit', 'qty'])
  })

  it('falls back to default order for missing or malformed settings', () => {
    expect(orderedColumns('Survey', columns, '{invalid')).toEqual(columns)
    expect(orderedColumns('Survey', columns, '{}')).toEqual(columns)
  })
})