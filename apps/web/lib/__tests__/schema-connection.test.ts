import {
  getConnectionRoleFieldApiName,
  getConnectionRoleFieldBareName,
  getConnectionTargetObject,
  isConnectionFieldType,
  isLookupFieldType,
  normalizeFieldType,
} from '../schema'

describe('explicit Connection field types', () => {
  it('normalizes and resolves fixed Contact and Account targets', () => {
    expect(normalizeFieldType('connectioncontact')).toBe('ConnectionContact')
    expect(normalizeFieldType('connectionaccount')).toBe('ConnectionAccount')
    expect(getConnectionTargetObject('ConnectionContact')).toBe('Contact')
    expect(getConnectionTargetObject('ConnectionAccount')).toBe('Account')
  })

  it('treats explicit Connection types as lookups and keeps role keys beside their source field', () => {
    expect(isConnectionFieldType('ConnectionContact')).toBe(true)
    expect(isConnectionFieldType('ConnectionAccount')).toBe(true)
    expect(isLookupFieldType('ConnectionContact')).toBe(true)
    expect(isLookupFieldType('ConnectionAccount')).toBe(true)
    expect(getConnectionRoleFieldApiName('Project__primaryContact')).toBe('Project__primaryContact__role')
    expect(getConnectionRoleFieldBareName('Project__primaryContact')).toBe('primaryContact__role')
    expect(getConnectionRoleFieldBareName('primaryContact')).toBe('primaryContact__role')
  })
})