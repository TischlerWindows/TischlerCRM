import {
  buildPropertyImportDataFromOpportunity,
  isSalesforceProjectAddressColumn,
} from '../salesforce-opportunity-property'

describe('Salesforce Opportunity Property address mapping', () => {
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

  it('recognizes Project Address columns for exclusion from generic Opportunity mapping', () => {
    expect(isSalesforceProjectAddressColumn('Project_Addresses__City__s')).toBe(true)
    expect(isSalesforceProjectAddressColumn('Project_Addresses__Street__s')).toBe(true)
    expect(isSalesforceProjectAddressColumn('Opportunity.Project_Addresses__Latitude__s')).toBe(true)
    expect(isSalesforceProjectAddressColumn('Name')).toBe(false)
  })

  it('does not create a Property when the Opportunity has no project address', () => {
    expect(buildPropertyImportDataFromOpportunity({ Name: 'No address' })).toEqual({ status: 'empty' })
  })

  it('reports incomplete project addresses that cannot satisfy required Property fields', () => {
    expect(buildPropertyImportDataFromOpportunity({
      Project_Addresses__City__s: 'Miami',
      Project_Addresses__StateCode__s: 'FL',
    })).toEqual({
      status: 'invalid',
      error: 'Missing required Property address fields: Postal Code',
    })
  })
})