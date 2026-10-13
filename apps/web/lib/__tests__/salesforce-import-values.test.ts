import { evaluateSalesforceCheckboxRule, parseSalesforceCheckbox } from '../salesforce-import-values'

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
})
