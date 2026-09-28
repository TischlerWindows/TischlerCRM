import { HARDWARE_ITEMS, SPEC_ITEMS, hardwareKey, parseFactoryOrderSpec } from '../factory-order-spec'

describe('Factory Order Spec', () => {
  it('initializes every row from the template', () => {
    const spec = parseFactoryOrderSpec(null)
    expect(Object.keys(spec.specifications)).toHaveLength(22)
    expect(Object.keys(spec.hardware)).toHaveLength(29)
    expect(SPEC_ITEMS[21]).toBe('Steel reinforcement approved')
    expect(HARDWARE_ITEMS[28]).toEqual({ group: 'Sliding Screens', item: 'Pull grip' })
  })

  it('round trips entered data and tolerates malformed saved values', () => {
    const saved = parseFactoryOrderSpec(null)
    saved.specifications['1'].specification = 'Oak'
    saved.hardware[hardwareKey('Swing Doors', 'Butt hinges')].finishType = 'Bronze'
    saved.products = ['Standard', 'Coastal']
    saved.signatureName = ''
    const restored = parseFactoryOrderSpec(JSON.stringify(saved))
    expect(restored.specifications['1'].specification).toBe('Oak')
    expect(restored.hardware[hardwareKey('Swing Doors', 'Butt hinges')].finishType).toBe('Bronze')
    expect(restored.products).toEqual(['Standard', 'Coastal'])
    expect(restored.signatureName).toBe('')
    expect(parseFactoryOrderSpec('{broken').specifications['22'].remarks).toBe('')
  })
})