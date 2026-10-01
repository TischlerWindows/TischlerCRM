import {
  calculateMaterialTotal,
  INSTALLATION_MATERIAL_ROW_COUNT,
  parseInstallationMaterial,
} from '../installation-material'

describe('installation material form', () => {
  it('creates the ACQ structure with editable blank rows', () => {
    const material = parseInstallationMaterial(null, 'Sample Project')
    expect(material.template).toBe('ACQ')
    expect(material.project).toBe('Sample Project')
    expect(material.rows).toHaveLength(INSTALLATION_MATERIAL_ROW_COUNT)
  })

  it('round-trips template choices and computes line totals', () => {
    const material = parseInstallationMaterial(JSON.stringify({
      template: 'US Supplied Inst.',
      installationBy: ['Installation by TuS'],
      orderedFrom: ['Korn', 'FL Warehouse'],
      rows: [{ qty: '3', units: 'box', description: 'Fasteners', screwSize: '#10', unitPrice: '2.50' }],
    }))
    expect(material.template).toBe('US Supplied Inst.')
    expect(material.orderedFrom).toEqual(['Korn', 'FL Warehouse'])
    expect(calculateMaterialTotal(material.rows[0]!)).toBe(7.5)
  })
})