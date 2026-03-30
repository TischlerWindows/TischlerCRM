import { resolveString, resolveConfig } from '../merge-resolver'

describe('resolveString', () => {
  const record = { name: 'Acme Corp', id: '123' }

  it('replaces a single token', () => {
    expect(resolveString('/clients/{record.name}', record)).toBe('/clients/Acme Corp')
  })

  it('replaces multiple tokens', () => {
    expect(resolveString('{record.id}/{record.name}', record)).toBe('123/Acme Corp')
  })

  it('returns empty string for missing field', () => {
    expect(resolveString('{record.missing}', record)).toBe('')
  })

  it('leaves nested paths unchanged', () => {
    expect(resolveString('{record.a.b}', record)).toBe('{record.a.b}')
  })

  it('passes through strings with no tokens', () => {
    expect(resolveString('no tokens here', record)).toBe('no tokens here')
  })
})

describe('resolveConfig', () => {
  it('resolves string values, leaves non-strings unchanged', () => {
    const result = resolveConfig(
      { path: '/c/{record.name}', count: 10, flag: true },
      { name: 'X' }
    )
    expect(result).toEqual({ path: '/c/X', count: 10, flag: true })
  })
})
