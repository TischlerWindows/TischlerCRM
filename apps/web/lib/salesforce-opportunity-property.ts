type ImportRow = Record<string, string>

type PropertyAddressResult =
  | { status: 'empty' }
  | { status: 'invalid'; error: string }
  | { status: 'ready'; data: Record<string, unknown> }

export const GENERATED_PROPERTY_FIELD_MAPPINGS = [
  { source: 'Project_Addresses__City__s', target: 'Property City' },
  { source: 'Project_Addresses__PostalCode__s', target: 'Property Zip/Postal Code' },
  { source: 'Project_Addresses__StateCode__s', target: 'Property State/Province' },
  { source: 'Project_Addresses__CountryCode__s', target: 'Address Country' },
  { source: 'Project_Addresses__Latitude__s', target: 'Address Latitude' },
  { source: 'Project_Addresses__Longitude__s', target: 'Address Longitude' },
  { source: 'Project_Addresses__GeocodeAccuracy__s', target: 'Address Geocode Accuracy' },
]

const SALESFORCE_ADDRESS_FIELDS = {
  city: 'projectaddresses__city__s',
  postalCode: 'projectaddresses__postalcode__s',
  stateCode: 'projectaddresses__statecode__s',
  countryCode: 'projectaddresses__countrycode__s',
  latitude: 'projectaddresses__latitude__s',
  longitude: 'projectaddresses__longitude__s',
  geocodeAccuracy: 'projectaddresses__geocodeaccuracy__s',
} as const

export function isSalesforceProjectAddressColumn(header: string): boolean {
  const normalized = normalizeHeader(header)
  return Object.values(SALESFORCE_ADDRESS_FIELDS).some((field) => normalized.endsWith(normalizeHeader(field)))
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function readAddressPart(row: ImportRow, fieldSuffix: string): string {
  const suffix = normalizeHeader(fieldSuffix)
  const header = Object.keys(row).find((key) => normalizeHeader(key) === suffix)
    ?? Object.keys(row).find((key) => normalizeHeader(key).endsWith(suffix))
  return header ? row[header]?.trim() ?? '' : ''
}

function parseCoordinate(value: string): number | undefined {
  if (!value) return undefined
  const coordinate = Number(value)
  return Number.isFinite(coordinate) ? coordinate : undefined
}

export function buildPropertyImportDataFromOpportunity(row: ImportRow): PropertyAddressResult {
  const city = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.city)
  const postalCode = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.postalCode)
  const state = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.stateCode)
  const country = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.countryCode)
  const latitude = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.latitude)
  const longitude = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.longitude)
  const geocodeAccuracy = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.geocodeAccuracy)

  if (![city, postalCode, state, country, latitude, longitude, geocodeAccuracy].some(Boolean)) {
    return { status: 'empty' }
  }

  const missing = [
    !city ? 'City' : null,
    !state ? 'State' : null,
    !postalCode ? 'Postal Code' : null,
  ].filter((part): part is string => part !== null)
  if (missing.length) {
    return { status: 'invalid', error: `Missing required Property address fields: ${missing.join(', ')}` }
  }

  const address: Record<string, unknown> = {
    street: '',
    city,
    state,
    postalCode,
    country,
  }
  const parsedLatitude = parseCoordinate(latitude)
  const parsedLongitude = parseCoordinate(longitude)
  if (parsedLatitude !== undefined) address.lat = parsedLatitude
  if (parsedLongitude !== undefined) address.lng = parsedLongitude
  if (geocodeAccuracy) address.geocodeAccuracy = geocodeAccuracy

  return {
    status: 'ready',
    data: {
      Property__address: address,
      Property__city: city,
      Property__state: state,
      Property__zipCode: postalCode,
    },
  }
}