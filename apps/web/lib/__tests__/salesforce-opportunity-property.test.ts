import {
  buildPropertyImportDataFromOpportunity,
  getGeneratedPropertySalesforceId,
  geocodeMissingPropertyCoordinates,
  isSalesforceProjectAddressColumn,
} from '../salesforce-opportunity-property'

describe('Salesforce Opportunity Property address mapping', () => {
  it('creates a stable unique import ID from the source Opportunity Salesforce ID', () => {
    expect(getGeneratedPropertySalesforceId(' 001000000000000  ')).toBe('generated-property-001000000000000AAA')
    expect(getGeneratedPropertySalesforceId('001000000000000')).toBe('generated-property-001000000000000AAA')
    expect(getGeneratedPropertySalesforceId('001000000000001')).not.toBe('generated-property-001000000000000AAA')
    expect(getGeneratedPropertySalesforceId('001000000000000'))
      .toBe(getGeneratedPropertySalesforceId('001000000000000AAA'))
    expect(getGeneratedPropertySalesforceId('  ')).toBeNull()
  })

  it('builds required Property fields and preserves Salesforce geocoding data', () => {
    expect(buildPropertyImportDataFromOpportunity({
      Project_Addresses__Street__s: '123 Main Street',
      Project_Addresses__City__s: 'Delray Beach',
      Project_Addresses__PostalCode__s: '33444',
      Project_Addresses__StateCode__s: 'FL',
      Project_Addresses__CountryCode__s: 'US',
      Project_Addresses__Latitude__s: '26.4615',
      Project_Addresses__Longitude__s: '-80.0728',
      Project_Addresses__GeocodeAccuracy__s: 'Rooftop',
    })).toEqual({
      status: 'ready',
      data: {
        Property__address: {
          street: '123 Main Street',
          city: 'Delray Beach',
          state: 'FL',
          postalCode: '33444',
          country: 'US',
          lat: 26.4615,
          lng: -80.0728,
          geocodeAccuracy: 'Rooftop',
        },
        Property__address_search: {
          street: '123 Main Street',
          city: 'Delray Beach',
          state: 'FL',
          postalCode: '33444',
          country: 'US',
          lat: 26.4615,
          lng: -80.0728,
          geocodeAccuracy: 'Rooftop',
        },
        Property__city: 'Delray Beach',
        Property__state: 'FL',
        Property__zipCode: '33444',
        Property__latitude: 26.4615,
        Property__longitude: -80.0728,
      },
    })
  })

  it('accepts object-prefixed Salesforce export headers', () => {
    expect(buildPropertyImportDataFromOpportunity({
      Opportunity_Project_Addresses__City__s: 'Miami',
      Opportunity_Project_Addresses__PostalCode__s: '33101',
      Opportunity_Project_Addresses__StateCode__s: 'FL',
    }).status).toBe('ready')
  })

  it('does not copy the Opportunity number into its generated Property row', () => {
    const result = buildPropertyImportDataFromOpportunity({
      Opportunity_Number__c: 'OPP-26540',
      CreatedDate: '2027-04-14T00:00:00.000Z',
      Project_Addresses__City__s: 'Miami',
      Project_Addresses__PostalCode__s: '33101',
      Project_Addresses__StateCode__s: 'FL',
    })

    expect(result).toMatchObject({
      status: 'ready',
      data: { Property__city: 'Miami' },
    })
    if (result.status === 'ready') {
      expect(result.data).not.toHaveProperty('__propertyOpportunityNumber')
    }
  })

  it('recognizes Project Address columns for exclusion from generic Opportunity mapping', () => {
    expect(isSalesforceProjectAddressColumn('Project_Addresses__City__s')).toBe(true)
    expect(isSalesforceProjectAddressColumn('Project_Addresses__Street__s')).toBe(true)
    expect(isSalesforceProjectAddressColumn('Opportunity.Project_Addresses__Latitude__s')).toBe(true)
    expect(isSalesforceProjectAddressColumn('Name')).toBe(false)
  })

  it('creates an empty-address Property when the Opportunity has no project address', () => {
    expect(buildPropertyImportDataFromOpportunity({ Name: 'No address' })).toMatchObject({
      status: 'ready',
      data: {
        Property__address: { street: '', city: '', state: '', postalCode: '', country: '' },
        Property__city: '',
        Property__state: '',
        Property__zipCode: '',
      },
    })
  })

  it('keeps partial project addresses and leaves missing Property address fields blank', () => {
    expect(buildPropertyImportDataFromOpportunity({
      Project_Addresses__City__s: 'Miami',
      Project_Addresses__StateCode__s: 'FL',
    })).toEqual({
      status: 'ready',
      data: {
        Property__address: { street: '', city: 'Miami', state: 'FL', postalCode: '', country: '' },
        Property__address_search: { street: '', city: 'Miami', state: 'FL', postalCode: '', country: '' },
        Property__city: 'Miami',
        Property__state: 'FL',
        Property__zipCode: '',
      },
    })
  })

  it('geocodes a complete address when Salesforce coordinates are absent', async () => {
    const property = buildPropertyImportDataFromOpportunity({
      Project_Addresses__Street__s: '581 Henry Street',
      Project_Addresses__City__s: 'Brooklyn',
      Project_Addresses__PostalCode__s: '11231',
      Project_Addresses__StateCode__s: 'NY',
      Project_Addresses__CountryCode__s: 'US',
    })
    const geocode = jest.fn().mockResolvedValue({ lat: 40.6764, lng: -73.9992 })
    if (property.status !== 'ready') throw new Error('Expected complete Property address')

    const resolved = await geocodeMissingPropertyCoordinates(property, geocode)

    expect(geocode).toHaveBeenCalledWith('581 Henry Street, Brooklyn, NY, 11231, US', expect.any(String))
    expect(resolved).toMatchObject({
      status: 'ready',
      data: {
        Property__address: { lat: 40.6764, lng: -73.9992 },
        Property__address_search: { lat: 40.6764, lng: -73.9992 },
        Property__latitude: 40.6764,
        Property__longitude: -73.9992,
      },
    })
  })

  it('keeps the Property import usable and reports a warning when geocoding fails', async () => {
    const property = buildPropertyImportDataFromOpportunity({
      Project_Addresses__Street__s: '581 Henry Street',
      Project_Addresses__City__s: 'Brooklyn',
      Project_Addresses__PostalCode__s: '11231',
      Project_Addresses__StateCode__s: 'NY',
    })
    if (property.status !== 'ready') throw new Error('Expected complete Property address')

    const resolved = await geocodeMissingPropertyCoordinates(property, async () => {
      throw new Error('Google Maps integration is unavailable')
    })

    expect(resolved).toMatchObject({
      status: 'ready',
      geocodingWarning: 'Google Maps could not geocode this address.',
      data: { Property__address: { street: '581 Henry Street' } },
    })
  })
})