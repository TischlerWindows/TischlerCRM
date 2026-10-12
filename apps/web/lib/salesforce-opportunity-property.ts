type ImportRow = Record<string, string>

type PropertyAddressResult =
  | { status: 'empty' }
  | { status: 'invalid'; error: string }
  | { status: 'ready'; data: Record<string, unknown>; geocodingWarning?: string }

export const GENERATED_PROPERTY_FIELD_MAPPINGS = [
  { source: 'Project_Addresses__Street__s', target: 'Address Street' },
  { source: 'Project_Addresses__City__s', target: 'Property City' },
  { source: 'Project_Addresses__PostalCode__s', target: 'Property Zip/Postal Code' },
  { source: 'Project_Addresses__StateCode__s', target: 'Property State/Province' },
  { source: 'Project_Addresses__CountryCode__s', target: 'Address Country' },
  { source: 'Project_Addresses__Latitude__s', target: 'Address Latitude' },
  { source: 'Project_Addresses__Longitude__s', target: 'Address Longitude' },
  { source: 'Project_Addresses__GeocodeAccuracy__s', target: 'Address Geocode Accuracy' },
]

const SALESFORCE_ADDRESS_FIELDS = {
  street: 'projectaddresses__street__s',
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

function readNumericCoordinate(value: unknown, minimum: number, maximum: number): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !value.trim()) return undefined
  const coordinate = Number(value)
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : undefined
}

export async function geocodeMissingPropertyCoordinates(
  result: PropertyAddressResult,
  geocodeAddress: (query: string, sessionToken: string) => Promise<{ lat: number | null; lng: number | null } | null>,
): Promise<PropertyAddressResult> {
  if (result.status !== 'ready') return result

  const address = result.data.Property__address as Record<string, unknown>
  const latitude = readNumericCoordinate(address.lat ?? result.data.Property__latitude, -90, 90)
  const longitude = readNumericCoordinate(address.lng ?? result.data.Property__longitude, -180, 180)
  if (latitude !== undefined && longitude !== undefined) return result

  const query = [address.street, address.city, address.state, address.postalCode, address.country]
    .filter((part): part is string => typeof part === 'string' && !!part.trim())
    .join(', ')
  if (!query) return { ...result, geocodingWarning: 'No address was available for map geocoding.' }

  const sessionToken = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    const coordinates = await geocodeAddress(query, sessionToken)
    const geocodedLatitude = readNumericCoordinate(coordinates?.lat, -90, 90)
    const geocodedLongitude = readNumericCoordinate(coordinates?.lng, -180, 180)
    if (geocodedLatitude === undefined || geocodedLongitude === undefined) {
      return { ...result, geocodingWarning: 'Google Maps could not find coordinates for this address.' }
    }

    const mergedAddress = {
      ...address,
      lat: latitude ?? geocodedLatitude,
      lng: longitude ?? geocodedLongitude,
    }
    return {
      ...result,
      data: {
        ...result.data,
        Property__address: mergedAddress,
        Property__address_search: mergedAddress,
        Property__latitude: mergedAddress.lat,
        Property__longitude: mergedAddress.lng,
      },
    }
  } catch {
    return { ...result, geocodingWarning: 'Google Maps could not geocode this address.' }
  }
}

export function buildPropertyImportDataFromOpportunity(row: ImportRow): PropertyAddressResult {
  const street = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.street)
  const city = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.city)
  const postalCode = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.postalCode)
  const state = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.stateCode)
  const country = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.countryCode)
  const latitude = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.latitude)
  const longitude = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.longitude)
  const geocodeAccuracy = readAddressPart(row, SALESFORCE_ADDRESS_FIELDS.geocodeAccuracy)

  if (![street, city, postalCode, state, country, latitude, longitude, geocodeAccuracy].some(Boolean)) {
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
    street,
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
      Property__address_search: address,
      Property__city: city,
      Property__state: state,
      Property__zipCode: postalCode,
      ...(parsedLatitude !== undefined ? { Property__latitude: parsedLatitude } : {}),
      ...(parsedLongitude !== undefined ? { Property__longitude: parsedLongitude } : {}),
    },
  }
}