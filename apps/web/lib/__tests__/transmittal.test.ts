import { DEFAULT_APPROVAL_INSTRUCTIONS, parseTransmittal } from '../transmittal'

describe('transmittal form', () => {
  it('starts with the paint template defaults', () => {
    const form = parseTransmittal(null)
    expect(form.submittedFor).toBe('Approval')
    expect(form.deliveryVia).toBe('UPS Ground')
    expect(form.submittedBy).toBe('Michel Marclay')
    expect(form.rows).toHaveLength(3)
    expect(form.approvalInstructions).toBe(DEFAULT_APPROVAL_INSTRUCTIONS)
  })

  it('round-trips saved rows and handles invalid saved data', () => {
    const form = parseTransmittal(JSON.stringify({
      to: 'Paint shop', rows: [{ qty: '2', description: 'Paint samples', code: 'P-1' }],
      remarks: 'Please review',
    }))
    expect(form.to).toBe('Paint shop')
    expect(form.rows).toEqual([{ qty: '2', description: 'Paint samples', code: 'P-1' }])
    expect(parseTransmittal('{invalid').rows).toHaveLength(3)
  })
})