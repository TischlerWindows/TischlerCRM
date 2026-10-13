import { evaluateVisibility } from '../field-visibility'

describe('checkbox visibility comparisons', () => {
  it('matches imported boolean false against a legacy string false rule', () => {
    expect(evaluateVisibility(
      [{ left: 'Contact__homeownerAccount', op: '==', right: 'false' }],
      { homeownerAccount: false },
    )).toBe(true)
  })

  it('matches imported booleans against string and numeric checkbox values', () => {
    expect(evaluateVisibility(
      [{ left: 'Contact__homeownerAccount', op: '==', right: false }],
      { Contact__homeownerAccount: '0' },
    )).toBe(true)
    expect(evaluateVisibility(
      [{ left: 'Contact__homeownerAccount', op: '==', right: 'true' }],
      { homeownerAccount: true },
    )).toBe(true)
  })

  it('keeps not-equals behavior consistent for checkbox encodings', () => {
    expect(evaluateVisibility(
      [{ left: 'Contact__homeownerAccount', op: '!=', right: 'false' }],
      { homeownerAccount: true },
    )).toBe(true)
    expect(evaluateVisibility(
      [{ left: 'Contact__homeownerAccount', op: '!=', right: 'false' }],
      { homeownerAccount: false },
    )).toBe(false)
  })
})
