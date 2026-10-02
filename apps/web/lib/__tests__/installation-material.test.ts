import {
  ACQ_FIXED_ROWS,
  calculateMaterialTotal,
  generateInstallationMaterialQuantities,
  generateInstallationMaterialWorkbookQuantities,
  INSTALLATION_MATERIAL_ROW_COUNT,
  NON_ACQ_FIXED_ROWS,
  parseInstallationMaterial,
  parseInstallationMaterialWorkbook,
  US_SUPPLIED_FIXED_ROWS,
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

  it('matches the corrected ACQ screw and installation clip source rows', () => {
    expect(ACQ_FIXED_ROWS.find(row => row.description.includes('4x35 mm'))).toMatchObject({
      description: 'Qty. 500 - 4x35 mm Wood Screws SS Frames Torx 20 (NOT DC APPROVED)',
      screwSize: '#8 x 1-3/8"',
      unitPrice: '33.98',
    })
    expect(ACQ_FIXED_ROWS.find(row => row.description.includes('PZ2 (Pan Head)'))?.description)
      .toBe('Qty. 200 - 4x40 mm Wood Screws SS, PZ2 (Pan Head) (Phillips)')
    expect(ACQ_FIXED_ROWS.find(row => row.description.includes('Standard (Meesenburg)'))).toMatchObject({
      description: 'Qty. 100 - Installation Clips (140x2x25) - Standard (Meesenburg)',
      screwSize: '5-1/2" x 1/16" x 1"',
    })
    expect(ACQ_FIXED_ROWS.find(row => row.description.includes('Dade County (Meesenburg)'))).toMatchObject({
      description: 'Qty. 100 - Installation Clips (140x2x20) - Dade County (Meesenburg)',
      screwSize: '5-1/2" x 1/16" x 13/16"',
    })
  })

  it('loads the Non-ACQ catalog values from the supplied table', () => {
    const nonAcq = parseInstallationMaterial({ template: 'Non-ACQ' })
    expect(nonAcq.rows).toHaveLength(NON_ACQ_FIXED_ROWS.length)
    expect(nonAcq.rows[0]).toMatchObject({
      units: 'Box',
      description: 'Qty. 200 - 6/10 x 80 mm Zink Toptec Standard',
      screwSize: '1/4" x 3-1/8"',
      unitPrice: '58.40',
      qty: '',
    })
    expect(nonAcq.rows[18]).toMatchObject({
      description: 'Qty. 500 - 4x35 mm Screws SPAX DH Frames (NOT DC APPROVED)',
      screwSize: '#8 x 1-3/8"',
      unitPrice: '13.69',
    })
    expect(nonAcq.rows[6]?.description).toBe('Qty. 100 - Toptec Nylon dowels (shields)')
    expect(nonAcq.rows[20]).toMatchObject({
      description: 'Qty. 200 - 6x40 mm Screws SPAX Substrate (Flat Head) (Phillips)',
      screwSize: '#14 x 1-9/16"',
    })
    expect(nonAcq.rows[21]?.description).toBe('Qty. 200 - 6x70 mm Screws SPAX Substrate (Flat Head) (Phillips)')
    expect(nonAcq.rows[31]).toMatchObject({
      description: 'Qty. 100 - Installation Clips (140x2x25) - Standard',
      screwSize: '5-1/2" x 1/16" x 1"',
      unitPrice: '29.70',
    })
    expect(nonAcq.rows[32]).toMatchObject({
      description: 'Qty. 100 - Installation Clips (140x2x20) - Dade County',
      screwSize: '5-1/2" x 1/16" x 13/16"',
      unitPrice: '18.73',
    })
    expect(nonAcq.rows[40]?.description).toBe('Metal Counter Sink Drill Bit (Hexagonal Shaft)')
  })

  it('restores locked ACQ and Non-ACQ columns while preserving quantities', () => {
    const attemptedEdits = {
      qty: '7', units: 'Custom', description: 'Edited text', screwSize: 'Custom size', unitPrice: '0.01',
    }
    const acq = parseInstallationMaterial({ template: 'ACQ', rows: [attemptedEdits] })
    const nonAcq = parseInstallationMaterial({ template: 'Non-ACQ', rows: [attemptedEdits] })
    const usSupplied = parseInstallationMaterial({ template: 'US Supplied Inst.', rows: [attemptedEdits] })

    expect(acq.rows[0]).toEqual({ ...ACQ_FIXED_ROWS[0], qty: '7', unitPrice: '0.01' })
    expect(nonAcq.rows[0]).toEqual({ ...NON_ACQ_FIXED_ROWS[0], qty: '7', unitPrice: '0.01' })
    expect(usSupplied.rows[0]).toEqual({ ...US_SUPPLIED_FIXED_ROWS[0], qty: '7', unitPrice: '0.01' })
  })

  it('round-trips template choices and computes line totals', () => {
    const material = parseInstallationMaterial(JSON.stringify({
      template: 'US Supplied Inst.',
      installationBy: ['Installation by TuS'],
      orderedFrom: ['Tischler Fensterwerk', 'FL Warehouse'],
      rows: [{ qty: '3', units: 'Box (100)', description: 'Edited', screwSize: 'Edited', unitPrice: '2.50' }],
    }))
    expect(material.template).toBe('US Supplied Inst.')
    expect(material.orderedFrom).toEqual(['Tischler Fensterwerk', 'FL Warehouse'])
    expect(US_SUPPLIED_FIXED_ROWS).toHaveLength(44)
    expect(material.rows).toHaveLength(US_SUPPLIED_FIXED_ROWS.length)
    expect(material.rows[0]).toMatchObject({ ...US_SUPPLIED_FIXED_ROWS[0], qty: '3', unitPrice: '2.50' })
    expect(calculateMaterialTotal(material.rows[0]!)).toBe(7.5)
    expect(material.rows[34]?.description).toContain('4W Vario Foam')
    expect(material.rows[43]?.description).toBe('Metal Counter Sink Drill')
    expect(material.rows[43]?.unitPrice).toBe('')
    expect(calculateMaterialTotal({ qty: '10', units: 'Box', description: 'Free item', screwSize: '', unitPrice: '0.00' })).toBe(0)
  })

  it('keeps three worksheet forms independent and migrates a legacy single form', () => {
    const workbook = parseInstallationMaterialWorkbook({
      version: 1,
      activeTemplate: 'US Supplied Inst.',
      sheets: {
        ACQ: { template: 'ACQ', rows: [{ qty: '1', units: 'box', description: 'ACQ item' }] },
        'Non-ACQ': { template: 'Non-ACQ', rows: [{ qty: '2', units: 'box', description: 'Non-ACQ item' }] },
        'US Supplied Inst.': { template: 'US Supplied Inst.', rows: [{ qty: '3', units: 'Box (100)', description: 'US item' }] },
      },
    })
    expect(workbook.activeTemplate).toBe('ACQ')
    expect(workbook.sheets.ACQ.rows[0]?.description).toBe(ACQ_FIXED_ROWS[0]?.description)
    expect(workbook.sheets.ACQ.rows[0]?.qty).toBe('1')
    expect(workbook.sheets['Non-ACQ'].rows[0]?.description).toBe(NON_ACQ_FIXED_ROWS[0]?.description)
    expect(workbook.sheets['Non-ACQ'].rows[0]?.qty).toBe('2')
    expect(workbook.sheets['US Supplied Inst.'].rows[0]?.description).toBe(US_SUPPLIED_FIXED_ROWS[0]?.description)
    expect(workbook.sheets['US Supplied Inst.'].rows[0]?.qty).toBe('3')

    const migrated = parseInstallationMaterialWorkbook({ template: 'Non-ACQ', rows: [{ description: 'Old entry' }] })
    expect(migrated.activeTemplate).toBe('ACQ')
    expect(migrated.sheets['Non-ACQ'].rows[0]?.description).toBe(NON_ACQ_FIXED_ROWS[0]?.description)
    expect(migrated.sheets.ACQ.rows[0]?.description).toBe(ACQ_FIXED_ROWS[0]?.description)
  })

  it('migrates the former Korn source selection to Tischler Fensterwerk', () => {
    expect(parseInstallationMaterial({ orderedFrom: ['Korn'] }).orderedFrom).toEqual(['Tischler Fensterwerk'])
  })

  it('matches AutoCad fasteners to material sizes, aggregates repeats, and reports ambiguous items', () => {
    const rows = parseInstallationMaterial({ template: 'Non-ACQ' }).rows
    const result = generateInstallationMaterialQuantities(rows, [
      { fastener: '4 x 35mm FH Phil Wood Screws', totalQty: 4 },
      { fastener: '4 x 35mm FH Phil Wood Screws', totalQty: 6 },
      { fastener: 'BTI Brackets', totalQty: 2 },
      { fastener: 'Installation Clips', totalQty: 10 },
      { fastener: 'Unknown fastener', totalQty: 3 },
    ])

    expect(result.rows[18]?.qty).toBe('10')
    expect(result.rows[30]?.qty).toBe('2')
    expect(result.ambiguousFasteners).toEqual(['Installation Clips'])
    expect(result.unmatchedFasteners).toEqual(['Unknown fastener'])
    expect(result.matchedFasteners).toBe(3)
  })

  it('generates matching AutoCad quantities on the US Supplied sheet', () => {
    const usSupplied = parseInstallationMaterial({ template: 'US Supplied Inst.' })
    const result = generateInstallationMaterialQuantities(usSupplied.rows, [
      { fastener: '1/4" FH Tapcon Screws x 1-3/4"', totalQty: 12 },
    ])

    expect(result.rows[1]?.qty).toBe('12')
    expect(result.matchedFasteners).toBe(1)
  })

  it('matches one AutoCad fastener to every applicable worksheet', () => {
    const workbook = parseInstallationMaterialWorkbook(null)
    const result = generateInstallationMaterialWorkbookQuantities(workbook.sheets, [
      { fastener: '6/10 x 80 mm Toptec', totalQty: 200 },
    ])

    expect(result.sheets.ACQ.rows[0]).toMatchObject({
      description: 'Qty. 200 - 6/10 x 80 mm Toptec (Ruspert Finish)',
      qty: '200',
    })
    expect(result.sheets['Non-ACQ'].rows[0]).toMatchObject({
      description: 'Qty. 200 - 6/10 x 80 mm Zink Toptec Standard',
      qty: '200',
    })
    expect(result.sheets['US Supplied Inst.'].rows.every(row => row.qty === '')).toBe(true)
    expect(result.matchedFasteners).toBe(2)
    expect(result.unmatchedFasteners).toEqual([])
    expect(result.ambiguousFasteners).toEqual([])
  })
})