import {
  findAddressImportSubfieldTarget,
  geocodeImportedAddressRecords,
  getAddressImportSubfieldTargets,
  mergeAddressImportSubField,
} from '../salesforce-import-address'

describe('Salesforce address import fallback', () => {
  it('maps Salesforce Account and Contact address columns to matching CRM address fields', () => {
    const accountTargets = [
      ...getAddressImportSubfieldTargets('billingAddress', 'Billing Address'),
      ...getAddressImportSubfieldTargets('shippingAddress', 'Shipping Address'),
    ]
    const contactTargets = [
      ...getAddressImportSubfieldTargets('primaryAddress', 'Primary Address'),
      ...getAddressImportSubfieldTargets('secondaryAddress', 'Secondary Address'),
    ]

    expect(findAddressImportSubfieldTarget('BillingStreet', 'Account', accountTargets))
      .toBe('billingAddress::address:street')
    expect(findAddressImportSubfieldTarget('ShippingPostalCode', 'Account', accountTargets))
      .toBe('shippingAddress::address:postalCode')
    expect(findAddressImportSubfieldTarget('MailingCity', 'Contact', contactTargets))
      .toBe('primaryAddress::address:city')
    expect(findAddressImportSubfieldTarget('OtherCountry', 'Contact', contactTargets))
      .toBe('secondaryAddress::address:country')
  })

  it('merges imported address components and geocodes missing coordinates for any object', async () => {
    const record: Record<string, unknown> = {}
    mergeAddressImportSubField(record, 'Account', 'billingAddress::address:street', '123 Main St')
    mergeAddressImportSubField(record, 'Account', 'billingAddress::address:city', 'Brooklyn')
    mergeAddressImportSubField(record, 'Account', 'billingAddress::address:state', 'NY')
    mergeAddressImportSubField(record, 'Account', 'billingAddress::address:postalCode', '11231')
    const geocodeAddress = jest.fn().mockResolvedValue({ lat: 40.6764, lng: -73.9992 })

    await geocodeImportedAddressRecords(
      [record],
      'Account',
      [{ apiName: 'Account__billingAddress', type: 'Address' }],
      geocodeAddress,
    )

    expect(geocodeAddress).toHaveBeenCalledWith('123 Main St, Brooklyn, NY, 11231', expect.any(String))
    expect(record.Account__billingAddress).toMatchObject({ lat: 40.6764, lng: -73.9992 })
    expect(record.billingAddress).toBe(record.Account__billingAddress)
  })

  it('preserves provided coordinates and continues importing if Maps is unavailable', async () => {
    const recordWithCoordinates: Record<string, unknown> = {
      Contact__mailingAddress: {
        street: '1 Main St',
        city: 'Miami',
        state: 'FL',
        postalCode: '33101',
        lat: 25.77,
        lng: -80.19,
      },
    }
    const geocodeAddress = jest.fn().mockRejectedValue(new Error('Maps integration unavailable'))
    const recordWithoutCoordinates: Record<string, unknown> = {
      Contact__mailingAddress: { street: '2 Main St', city: 'Miami', state: 'FL' },
    }

    await geocodeImportedAddressRecords(
      [recordWithCoordinates],
      'Contact',
      [{ apiName: 'Contact__mailingAddress', type: 'Address' }],
      geocodeAddress,
    )
    await geocodeImportedAddressRecords(
      [recordWithoutCoordinates],
      'Contact',
      [{ apiName: 'Contact__mailingAddress', type: 'Address' }],
      geocodeAddress,
    )

    expect(geocodeAddress).toHaveBeenCalledTimes(1)
    expect(recordWithCoordinates.Contact__mailingAddress).toMatchObject({ lat: 25.77, lng: -80.19 })
    expect(recordWithoutCoordinates.Contact__mailingAddress).toEqual({ street: '2 Main St', city: 'Miami', state: 'FL' })
  })
})