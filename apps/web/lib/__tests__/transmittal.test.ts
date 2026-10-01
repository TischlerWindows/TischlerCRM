import { DEFAULT_APPROVAL_INSTRUCTIONS, parseTransmittal } from '../transmittal'

describe('transmittal form', () => {
  it('starts with the paint template defaults', () => {
    const form = parseTransmittal(null)
    expect(form.submittedFor).toBe('Approval')
    expect(form.deliveryVia).toEqual([])
    expect(form.submittedBy).toBe('')
    expect(form.rows).toHaveLength(3)
    expect(form.approvalInstructions).toBe(DEFAULT_APPROVAL_INSTRUCTIONS)
  })

  it('round-trips saved rows and handles invalid saved data', () => {
    const form = parseTransmittal(JSON.stringify({
      to: 'Mouw Associates\n\n601 N. Congress Ave, Suite 109\n\nDelray Beach, FL 33445',
      rows: [{ qty: '2', description: 'Paint samples', code: 'P-1' }],
      remarks: 'Please review',
    }))
    expect(form.to).toBe('Mouw Associates\n\n601 N. Congress Ave, Suite 109\n\nDelray Beach, FL 33445')
    expect(form.rows).toEqual([{ qty: '2', description: 'Paint samples', code: 'P-1' }])
    expect(parseTransmittal('{invalid').rows).toHaveLength(3)
  })

  it('preserves multiple delivery methods and migrates an existing single choice', () => {
    expect(parseTransmittal({ deliveryVia: ['Messenger', 'UPS Ground'] }).deliveryVia)
      .toEqual(['Messenger', 'UPS Ground'])
    expect(parseTransmittal({ deliveryVia: 'UPS Ground' }).deliveryVia).toEqual(['UPS Ground'])
  })
})