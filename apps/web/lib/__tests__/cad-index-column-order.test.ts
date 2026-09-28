import { orderedColumns } from '../cad-index-column-order'

const columns = [
  { key: 'unit', label: 'Unit', type: 'text' as const },
  { key: 'qty', label: 'Qty', type: 'number' as const },
  { key: 'remarks', label: 'Remarks', type: 'text' as const },
]

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

  it('resets only the selected report when its saved order is removed', () => {
    const saved = JSON.stringify({ Progress: ['remarks', 'unit', 'qty'] })
    expect(orderedColumns('Survey', columns, saved)).toEqual(columns)
    expect(orderedColumns('Progress', columns, saved).map((column) => column.key)).toEqual(['remarks', 'unit', 'qty'])
  })

  it('restores custom definitions and their position without changing other reports', () => {
    const saved = JSON.stringify({
      Survey: {
        order: ['qty', 'cadCustom_siteCheck', 'unit', 'remarks'],
        custom: [{ key: 'cadCustom_siteCheck', label: 'Site Check', type: 'checkbox' }],
      },
      Progress: ['qty', 'unit', 'remarks'],
    })
    expect(orderedColumns('Survey', columns, saved).map((column) => column.key)).toEqual([
      'qty', 'cadCustom_siteCheck', 'unit', 'remarks',
    ])
    expect(orderedColumns('Progress', columns, saved).map((column) => column.key)).toEqual([
      'qty', 'unit', 'remarks',
    ])
  })

  it('restores edited labels and types while rejecting invalid or duplicate definitions', () => {
    const saved = JSON.stringify({
      Survey: {
        order: ['cadCustom_measurement', 'cadCustom_siteCheck', 'unit'],
        custom: [
          { key: 'cadCustom_measurement', label: 'Opening Width', type: 'number' },
          { key: 'cadCustom_siteCheck', label: 'Checked', type: 'checkbox' },
          { key: 'cadCustom_measurement', label: 'Duplicate', type: 'text' },
          { key: 'unit', label: 'Overwritten', type: 'text' },
          { key: 'cadCustom_bad', label: '', type: 'text' },
        ],
      },
    })
    const resolved = orderedColumns('Survey', columns, saved)
    expect(resolved.map((column) => column.key)).toEqual([
      'cadCustom_measurement', 'cadCustom_siteCheck', 'unit', 'qty', 'remarks',
    ])
    expect(resolved[0]).toMatchObject({ label: 'Opening Width', type: 'number' })
    expect(resolved[2]).toEqual(columns[0])
  })
})