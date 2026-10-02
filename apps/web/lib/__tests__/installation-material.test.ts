import {
  calculateMaterialTotal,
  ACQ_FIXED_ROWS,
  INSTALLATION_MATERIAL_ROW_COUNT,
  parseInstallationMaterial,
  parseInstallationMaterialWorkbook,
} from '../installation-material'

describe('installation material form', () => {
  it('creates the ACQ structure with editable blank rows', () => {
    const material = parseInstallationMaterial(null, 'Sample Project')
    expect(material.template).toBe('ACQ')
    expect(material.project).toBe('Sample Project')
    expect(material.rows).toHaveLength(INSTALLATION_MATERIAL_ROW_COUNT)
    expect(material.rows[0]).toMatchObject(ACQ_FIXED_ROWS[0])
    expect(material.rows[0]?.qty).toBe('')
  })

  it('round-trips template choices and computes line totals', () => {
    const material = parseInstallationMaterial(JSON.stringify({
      template: 'US Supplied Inst.',
      installationBy: ['Installation by TuS'],
      orderedFrom: ['Tischler Fensterwerk', 'FL Warehouse'],
      rows: [{ qty: '3', units: 'box', description: 'Fasteners', screwSize: '#10', unitPrice: '2.50' }],
    }))
    expect(material.template).toBe('US Supplied Inst.')
    expect(material.orderedFrom).toEqual(['Tischler Fensterwerk', 'FL Warehouse'])
    expect(calculateMaterialTotal(material.rows[0]!)).toBe(7.5)
  })

  it('keeps three worksheet forms independent and migrates a legacy single form', () => {
    const workbook = parseInstallationMaterialWorkbook({
      version: 1,
      activeTemplate: 'US Supplied Inst.',
      sheets: {
        ACQ: { template: 'ACQ', rows: [{ qty: '1', units: 'box', description: 'ACQ item' }] },
        'Non-ACQ': { template: 'Non-ACQ', rows: [{ qty: '2', units: 'box', description: 'Non-ACQ item' }] },
        'US Supplied Inst.': { template: 'US Supplied Inst.', rows: [{ qty: '3', units: 'box', description: 'US item' }] },
      },
    })
    expect(workbook.activeTemplate).toBe('US Supplied Inst.')
    expect(workbook.sheets.ACQ.rows[0]?.description).toBe(ACQ_FIXED_ROWS[0]?.description)
    expect(workbook.sheets.ACQ.rows[0]?.qty).toBe('1')
    expect(workbook.sheets['Non-ACQ'].rows[0]?.description).toBe('Non-ACQ item')
    expect(workbook.sheets['US Supplied Inst.'].rows[0]?.description).toBe('US item')

    const migrated = parseInstallationMaterialWorkbook({ template: 'Non-ACQ', rows: [{ description: 'Old entry' }] })
    expect(migrated.activeTemplate).toBe('Non-ACQ')
    expect(migrated.sheets['Non-ACQ'].rows[0]?.description).toBe('Old entry')
    expect(migrated.sheets.ACQ.rows[0]?.description).toBe(ACQ_FIXED_ROWS[0]?.description)
  })

  it('migrates the former Korn source selection to Tischler Fensterwerk', () => {
    expect(parseInstallationMaterial({ orderedFrom: ['Korn'] }).orderedFrom).toEqual(['Tischler Fensterwerk'])
  })
})