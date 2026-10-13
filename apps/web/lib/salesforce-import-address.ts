type ImportRecord = Record<string, unknown>

export interface AddressImportField {
  apiName: string
  type: string
  targetFields?: { lat?: string; lng?: string }
}

export interface AddressImportTarget {
  apiName: string
  label: string
  type?: string
  picklistValues?: string[]
  required?: boolean
  isAutoNumber?: boolean
}

const ADDRESS_PARTS = [
  { apiName: 'street', label: 'Street', type: 'Text', suffixes: ['street'] },
  { apiName: 'city', label: 'City', type: 'Text', suffixes: ['city'] },
  { apiName: 'state', label: 'State / Province', type: 'Text', suffixes: ['statecode', 'state'] },
  { apiName: 'postalCode', label: 'Postal / ZIP Code', type: 'Text', suffixes: ['postalcode', 'zipcode', 'zip'] },
  { apiName: 'country', label: 'Country', type: 'Text', suffixes: ['countrycode', 'country'] },
  { apiName: 'lat', label: 'Latitude', type: 'Number', suffixes: ['latitude', 'lat'] },
  { apiName: 'lng', label: 'Longitude', type: 'Number', suffixes: ['longitude', 'lng'] },
] as const

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getParentApiName(targetApiName: string): string | null {
  const separator = targetApiName.indexOf('::address:')
  return separator < 0 ? null : targetApiName.slice(0, separator)
}

export function getAddressImportSubfieldTargets(parentApiName: string, label: string): AddressImportTarget[] {
  return ADDRESS_PARTS.map((part) => ({
    apiName: `${parentApiName}::address:${part.apiName}`,
    label: `${label} › ${part.label}`,
    type: part.type,
    picklistValues: [],
    required: false,
    isAutoNumber: false,
  }))
}

export function findAddressImportSubfieldTarget(
  header: string,
  objectApiName: string,
  targets: AddressImportTarget[],
): string | undefined {
  let normalizedHeader = normalize(header)
  const normalizedObject = normalize(objectApiName)
  if (normalizedHeader.startsWith(normalizedObject)) {
    normalizedHeader = normalizedHeader.slice(normalizedObject.length)
  }

  for (const part of ADDRESS_PARTS) {
    const suffix = part.suffixes.find((candidate) => normalizedHeader.endsWith(candidate))
    if (!suffix) continue
    const sourcePrefix = normalizedHeader.slice(0, -suffix.length).replace(/address$/, '')
    const candidates = targets.filter((target) => target.apiName.endsWith(`::address:${part.apiName}`))
    const parentNames = Array.from(new Set(candidates.map((target) => getParentApiName(target.apiName) ?? '')))
    const match = candidates.find((target) => {
      const parent = getParentApiName(target.apiName)
      if (!parent) return false
      const parentPrefix = normalize(parent).replace(/address$/, '')
      if (!sourcePrefix) return parentNames.length === 1
      if (parentNames.length === 1 && ['billing', 'shipping', 'mailing', 'other'].includes(sourcePrefix)) return true
      if (sourcePrefix === parentPrefix) return true
      if (sourcePrefix === 'mailing' && ['primary', 'mailing'].includes(parentPrefix)) return true
      if (sourcePrefix === 'other' && ['secondary', 'other'].includes(parentPrefix)) return true
      return false
    })
    if (match) return match.apiName
  }
  return undefined
}

export function mergeAddressImportSubField(
  record: ImportRecord,
  objectApiName: string,
  targetApiName: string,
  value: string,
): boolean {
  const parentApiName = getParentApiName(targetApiName)
  if (!parentApiName) return false
  const partApiName = targetApiName.slice(targetApiName.indexOf('::address:') + '::address:'.length)
  const part = ADDRESS_PARTS.find((candidate) => candidate.apiName === partApiName)
  if (!part || !value.trim()) return false

  const numericValue = part.type === 'Number' ? Number(value) : value
  if (part.type === 'Number' && !Number.isFinite(numericValue)) return false
  const parentKey = `${objectApiName}__${parentApiName}`
  const existing = record[parentKey] ?? record[parentApiName]
  const address = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing as Record<string, unknown>
    : {}
  const nextAddress = { ...address, [part.apiName]: numericValue }
  record[parentKey] = nextAddress
  record[parentApiName] = nextAddress
  return true
}

function readCoordinate(value: unknown, minimum: number, maximum: number): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  if (typeof value === 'string' && !value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : undefined
}

function toAddressObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) }
      }
    } catch {
      return { street: value.trim() }
    }
  }
  return null
}

export async function geocodeImportedAddressRecords(
  records: ImportRecord[],
  objectApiName: string,
  fields: AddressImportField[],
  geocodeAddress: (query: string, sessionToken: string) => Promise<{ lat: number | null; lng: number | null } | null>,
): Promise<void> {
  const addressFields = fields.filter((field) => field.type === 'Address' || field.type === 'LocationSearch')
  if (addressFields.length === 0) return

  let mapsUnavailable = false
  const geocodeRecord = async (record: ImportRecord) => {
    for (const field of addressFields) {
      const parentApiName = field.apiName.replace(`${objectApiName}__`, '')
      const parentKey = `${objectApiName}__${parentApiName}`
      const address = toAddressObject(record[parentKey] ?? record[parentApiName])
      if (!address) continue

      const latitude = readCoordinate(address.lat ?? address.latitude, -90, 90)
      const longitude = readCoordinate(address.lng ?? address.longitude, -180, 180)
      if (latitude !== undefined && longitude !== undefined) continue

      const query = [address.street, address.city, address.state, address.postalCode ?? address.zipCode, address.country]
        .filter((part): part is string => typeof part === 'string' && !!part.trim())
        .join(', ')
      if (!query || mapsUnavailable) continue

      const sessionToken = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      try {
        const coordinates = await geocodeAddress(query, sessionToken)
        const geocodedLatitude = readCoordinate(coordinates?.lat, -90, 90)
        const geocodedLongitude = readCoordinate(coordinates?.lng, -180, 180)
        if (geocodedLatitude === undefined || geocodedLongitude === undefined) continue

        const nextAddress = {
          ...address,
          lat: latitude ?? geocodedLatitude,
          lng: longitude ?? geocodedLongitude,
        }
        record[parentKey] = nextAddress
        record[parentApiName] = nextAddress
        if (field.targetFields?.lat) {
          record[field.targetFields.lat] = nextAddress.lat
          record[field.targetFields.lat.replace(/^[A-Za-z]+__/, '')] = nextAddress.lat
        }
        if (field.targetFields?.lng) {
          record[field.targetFields.lng] = nextAddress.lng
          record[field.targetFields.lng.replace(/^[A-Za-z]+__/, '')] = nextAddress.lng
        }
      } catch {
        mapsUnavailable = true
      }
    }
  }

  const concurrency = 8
  for (let offset = 0; offset < records.length; offset += concurrency) {
    await Promise.all(records.slice(offset, offset + concurrency).map(geocodeRecord))
  }
}