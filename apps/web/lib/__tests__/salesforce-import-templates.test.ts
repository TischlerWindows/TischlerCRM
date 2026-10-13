import {
  getDefaultPicklistTarget,
  getDistinctPicklistSourceValues,
  PICKLIST_LEAVE_BLANK,
  resolvePicklistImportValue,
} from '../salesforce-import-templates'

describe('Salesforce import picklist mappings', () => {
  it('collects distinct nonblank and blank source values', () => {
    expect(getDistinctPicklistSourceValues([
      { Type: 'Architect Account' },
      { Type: 'Architect Account' },
      { Type: '' },
      { Type: 'Supplier' },
    ], 'Type')).toEqual(['', 'Architect Account', 'Supplier'])
  })

  it('defaults blank values to Leave blank and exact matches case-insensitively', () => {
    expect(getDefaultPicklistTarget('', ['Customer'])).toBe(PICKLIST_LEAVE_BLANK)
    expect(getDefaultPicklistTarget(' property MANAGEMENT ', ['Property Management'])).toBe('Property Management')
    expect(getDefaultPicklistTarget('Architect Account', ['Property Management'])).toBe('')
  })

  it('translates source strings to selected CRM options and resolves Leave blank', () => {
    expect(resolvePicklistImportValue('Architect Account', { 'Architect Account': 'Property Management' }, ['Property Management']))
      .toEqual({ resolved: true, value: 'Property Management' })
    expect(resolvePicklistImportValue('', { '': PICKLIST_LEAVE_BLANK }, ['Property Management']))
      .toEqual({ resolved: true, value: '' })
    expect(resolvePicklistImportValue('Architect Account', {}, ['Property Management']))
      .toEqual({ resolved: false, value: '' })
  })
})