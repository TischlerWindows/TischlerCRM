import {
  ACCOUNT_TYPE_LEAVE_BLANK,
  getMappedSalesforceAccountTypeValue,
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

  it('exposes a distinct explicit choice to leave Account Type blank', () => {
    expect(ACCOUNT_TYPE_LEAVE_BLANK).toBe('__leave_blank__')
    const record: Record<string, unknown> = {}
    mirrorAccountTypeImportAliases('Account', record)
    expect(record).toEqual({})
  })
})
