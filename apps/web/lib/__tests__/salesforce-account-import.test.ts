import {
  ACCOUNT_TYPE_LEAVE_BLANK,
  getDefaultAccountTypeMapping,
  getMappedSalesforceAccountTypeValue,
  getSalesforceAccountTypeValues,
  getSalesforceAccountTypeTarget,
  mirrorAccountTypeImportAliases,
} from '../salesforce-account-import'

describe('Salesforce Account type mapping', () => {
  it('maps Salesforce Type to CRM Account Type when that field exists', () => {
    expect(getSalesforceAccountTypeTarget('Account', 'Type', [
      { apiName: 'type', label: 'Type' },
      { apiName: 'accountType', label: 'Account Type' },
    ])).toBe('accountType')
  })

  it('does not override Type mapping for other objects', () => {
    expect(getSalesforceAccountTypeTarget('Opportunity', 'Type', [
      { apiName: 'type', label: 'Type' },
    ])).toBeNull()
  })

  it('prefers a nonblank Account Type value over the generic Type value', () => {
    expect(getMappedSalesforceAccountTypeValue(
      { Type: 'Prospect', Category: 'General Contractor' },
      { Type: 'type', Category: 'accountType' },
    )).toBe('General Contractor')
  })

  it('lists distinct Salesforce types including blank values', () => {
    expect(getSalesforceAccountTypeValues([
      { Type: 'Architect Account' },
      { Type: 'Architect Account' },
      { Type: '' },
    ], { Type: 'accountType' })).toEqual(['', 'Architect Account'])
  })

  it('defaults blank values to Leave blank and exact CRM matches automatically', () => {
    expect(getDefaultAccountTypeMapping('', ['Customer'])).toBe(ACCOUNT_TYPE_LEAVE_BLANK)
    expect(getDefaultAccountTypeMapping(' property MANAGEMENT ', ['Property Management'])).toBe('Property Management')
    expect(getDefaultAccountTypeMapping('Architect Account', ['Property Management'])).toBe('')
  })

  it('mirrors a supplied Account Type value to required aliases', () => {
    const record: Record<string, unknown> = { Account__accountType: 'Customer' }
    mirrorAccountTypeImportAliases('Account', record)
    expect(record).toEqual({
      Account__accountType: 'Customer',
      accountType: 'Customer',
      Account__type: 'Customer',
      type: 'Customer',
    })
  })

  it('does not invent a type value for blank source data', () => {
    const record: Record<string, unknown> = {}
    mirrorAccountTypeImportAliases('Account', record)
    expect(record).toEqual({})
  })

  it('clears mapped Salesforce values when the user explicitly chooses Leave blank', () => {
    const record: Record<string, unknown> = {
      Account__accountType: 'Architect Account',
      accountType: 'Architect Account',
      type: 'Architect Account',
      __allowBlankAccountType: true,
    }
    mirrorAccountTypeImportAliases('Account', record)
    expect(record).toEqual({ __allowBlankAccountType: true })
  })

  it('exposes a distinct explicit choice to leave Account Type blank', () => {
    expect(ACCOUNT_TYPE_LEAVE_BLANK).toBe('__leave_blank__')
    const record: Record<string, unknown> = {}
    mirrorAccountTypeImportAliases('Account', record)
    expect(record).toEqual({})
  })
})
