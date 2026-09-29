import { activeLookupUsers, normalizeSingleLookupUserValue, userLookupIds } from '../user-lookup'

const users = [
  { id: 'active-1', name: 'Active One', email: 'one@example.com' },
  { id: 'active-2', name: 'Active Two', email: 'two@example.com' },
]

describe('LookupUser normalization', () => {
  it('parses legacy semicolon and array values', () => {
    expect(userLookupIds('orphan;active-1')).toEqual(['orphan', 'active-1'])
    expect(userLookupIds(['active-1', 'active-2'])).toEqual(['active-1', 'active-2'])
    expect(userLookupIds({ lookup: 'active-1' })).toEqual(['active-1'])
  })

  it('omits orphaned IDs from display identities', () => {
    expect(activeLookupUsers('orphan;active-1', users)).toEqual([users[0]])
    expect(activeLookupUsers('orphan', users)).toEqual([])
  })

  it('normalizes a single-select lookup to the last active user', () => {
    expect(normalizeSingleLookupUserValue('orphan;active-1', users)).toBe('active-1')
    expect(normalizeSingleLookupUserValue('active-1;active-2', users)).toBe('active-2')
    expect(normalizeSingleLookupUserValue('orphan', users)).toBe('')
  })
})