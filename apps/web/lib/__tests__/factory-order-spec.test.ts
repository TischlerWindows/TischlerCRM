import { HARDWARE_ITEMS, SPEC_ITEMS, applyFactoryOrderDefaults, factoryOrderDefaultsFromProject, hardwareKey, parseFactoryOrderSpec, readLookupId, refreshFactoryOrderDefaults } from '../factory-order-spec'

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

  it('applies Project defaults only until the value is manually overridden', () => {
    const initial = applyFactoryOrderDefaults(parseFactoryOrderSpec(null), {
      from: 'Jane Manager', products: ['Dade County'], rollScreen: 'Yes',
    })
    expect(initial.from).toBe('Jane Manager')
    expect(initial.products).toEqual(['Dade County'])
    expect(initial.specifications['19'].specification).toBe('Yes')

    const manuallyCleared = applyFactoryOrderDefaults({
      ...initial,
      from: '',
      products: [],
      specifications: { ...initial.specifications, '19': { specification: '', remarks: '' } },
      manualOverrides: ['from', 'products', 'rollScreen'],
    }, { from: 'Jane Manager', products: ['Dade County'], rollScreen: 'Yes' })
    expect(manuallyCleared.from).toBe('')
    expect(manuallyCleared.products).toEqual([])
    expect(manuallyCleared.specifications['19'].specification).toBe('')
  })

  it('derives products and Roll screen from imported Project field aliases', () => {
    expect(factoryOrderDefaultsFromProject({
      Project__product_specification: 'Dade County(HVHZ); FPA Certified',
      Insect_Roll_Screens__c: true,
    }, 'Jane Manager')).toEqual({
      from: 'Jane Manager', products: ['Dade County', 'FPA-Certified'], rollScreen: 'Yes',
    })
    expect(readLookupId({ lookup: 'user-123' })).toBe('user-123')
  })

  it('refreshes only automatic targets and clears their manual overrides', () => {
    const spec = parseFactoryOrderSpec(null)
    spec.from = 'Manual Manager'
    spec.products = ['Standard']
    spec.specifications['1'].specification = 'Oak'
    spec.specifications['19'].specification = 'No'
    spec.manualOverrides = ['from', 'products', 'rollScreen', 'other']
    const refreshed = refreshFactoryOrderDefaults(spec, {
      from: 'Current Manager', products: ['Coastal'], rollScreen: 'Yes',
    })
    expect(refreshed.from).toBe('Current Manager')
    expect(refreshed.products).toEqual(['Coastal'])
    expect(refreshed.specifications['19'].specification).toBe('Yes')
    expect(refreshed.specifications['1'].specification).toBe('Oak')
    expect(refreshed.manualOverrides).toEqual(['other'])
  })
})