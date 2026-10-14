import {
  evaluateSalesforceCheckboxRule,
  getDefaultSalesforcePhonePrefix,
  mapSalesforcePhoneWithPrefix,
  parseSalesforceCheckbox,
  resolveUserLookupImportValue,
} from '../salesforce-import-values'

describe('Salesforce import values', () => {
  it('maps blank checkbox cells to unchecked', () => {
    expect(parseSalesforceCheckbox('')).toBe(false)
    expect(parseSalesforceCheckbox('   ')).toBe(false)
    expect(parseSalesforceCheckbox(null)).toBe(false)
    expect(parseSalesforceCheckbox(undefined)).toBe(false)
  })

  it('parses Salesforce true and false encodings', () => {
    expect(parseSalesforceCheckbox('true')).toBe(true)
    expect(parseSalesforceCheckbox('1')).toBe(true)
    expect(parseSalesforceCheckbox('Yes')).toBe(true)
    expect(parseSalesforceCheckbox('false')).toBe(false)
    expect(parseSalesforceCheckbox('0')).toBe(false)
    expect(parseSalesforceCheckbox('No')).toBe(false)
  })

  it('treats any other nonblank checkbox value as checked', () => {
    expect(parseSalesforceCheckbox('Included')).toBe(true)
    expect(parseSalesforceCheckbox(true)).toBe(true)
    expect(parseSalesforceCheckbox(false)).toBe(false)
  })

  it('imports PhoneWithPrefix strings in Mobile mode and skips blanks', () => {
    expect(getDefaultSalesforcePhonePrefix(['Home', 'Mobile', 'Work'])).toBe('Mobile')
    expect(getDefaultSalesforcePhonePrefix(['Work', 'Office'])).toBe('Work')
    expect(mapSalesforcePhoneWithPrefix('  917-597-2421  ')).toEqual({
      prefix: 'Mobile',
      phone: '917-597-2421',
    })
    expect(mapSalesforcePhoneWithPrefix('917-597-2421', 'Home')).toEqual({
      prefix: 'Home',
      phone: '917-597-2421',
    })
    expect(mapSalesforcePhoneWithPrefix('')).toBeNull()
    expect(mapSalesforcePhoneWithPrefix(undefined)).toBeNull()
  })

  it('evaluates checkbox rules from source-column presence', () => {
    const populatedRule = {
      id: 'rule-1',
      targetField: 'homeownerAccount',
      sourceColumn: 'Account Name',
      condition: 'has-value' as const,
    }
    const blankRule = { ...populatedRule, condition: 'is-blank' as const }

    expect(evaluateSalesforceCheckboxRule(populatedRule, { 'Account Name': 'Silkworth Interiors' })).toBe(true)
    expect(evaluateSalesforceCheckboxRule(populatedRule, { 'Account Name': '  ' })).toBe(false)
    expect(evaluateSalesforceCheckboxRule(blankRule, { 'Account Name': '' })).toBe(true)
    expect(evaluateSalesforceCheckboxRule(blankRule, { 'Account Name': 'Silkworth Interiors' })).toBe(false)
  })

  it('resolves user lookup names, emails, and unique username prefixes to IDs', () => {
    const users = [
      { id: 'user-1', name: 'Matthias Mildner', email: 'mildner@example.com', isActive: true },
      { id: 'user-2', name: 'Carlos Martinez', email: 'carlos@example.com', isActive: true },
      { id: 'user-3', name: 'Carlos Moore', email: 'cmoore@example.com', isActive: true },
      { id: 'user-4', name: 'Jose Garcia', email: 'jgarcia@example.com', isActive: true },
      { id: 'user-5', name: 'Inactive Tech', email: 'inactive@example.com', isActive: false },
    ]

    expect(resolveUserLookupImportValue('MATTHIAS_MILDNER', users)).toEqual({
      value: 'user-1',
      unmatched: [],
    })
    expect(resolveUserLookupImportValue('mildner@example.com', users)).toEqual({
      value: 'user-1',
      unmatched: [],
    })
    expect(resolveUserLookupImportValue('Jose_Gar', users)).toEqual({
      value: 'user-4',
      unmatched: [],
    })
    expect(resolveUserLookupImportValue('Inactive Tech', users)).toEqual({
      value: 'user-5',
      unmatched: [],
    })
    expect(resolveUserLookupImportValue('Carlos_M', users)).toEqual({
      value: '',
      unmatched: ['Carlos_M'],
    })
    expect(resolveUserLookupImportValue('Matthias; Carlos Martinez; Missing User', users, true)).toEqual({
      value: 'user-1;user-2',
      unmatched: ['Missing User'],
    })
  })
})
