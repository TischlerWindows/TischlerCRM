import { parseSalesforceCheckbox } from '../salesforce-import-values'

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
})
