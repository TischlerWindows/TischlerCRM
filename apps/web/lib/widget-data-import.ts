import { resolveUserLookupImportValue, type ImportUserLookupRecord } from './salesforce-import-values'

export type WidgetImportObject = 'PunchList' | 'PerDiem'
export type WidgetImportFieldType = 'text' | 'number' | 'currency' | 'checkbox' | 'date' | 'multi-user'

export interface WidgetImportField {
  apiName: string
  label: string
  type: WidgetImportFieldType
}

export interface WorkOrderImportRecord {
  id: string
  workOrderNumber?: unknown
}

export const WIDGET_IMPORT_FIELDS: Record<WidgetImportObject, WidgetImportField[]> = {
  PunchList: [
    { apiName: 'itemNumber', label: 'Item #', type: 'text' },
    { apiName: 'techName', label: 'Tech Name', type: 'text' },
    { apiName: 'elevationPageNumber', label: 'Elevation Page #', type: 'text' },
    { apiName: 'location', label: 'Location', type: 'text' },
    { apiName: 'unit', label: 'Unit', type: 'text' },
    { apiName: 'clientApproved', label: 'Client Approved', type: 'checkbox' },
    { apiName: 'serviceDate', label: 'Service Date', type: 'date' },
    { apiName: 'estimateOfMen', label: 'Estimate of Men', type: 'number' },
    { apiName: 'estimateOfIndividualHours', label: 'Estimate of Individual Hours', type: 'number' },
    { apiName: 'descriptionOfWork', label: 'Description of Work', type: 'text' },
    { apiName: 'materialInWH', label: 'Material in WH', type: 'text' },
    { apiName: 'materialToOrder', label: 'Material to Order', type: 'text' },
    { apiName: 'specialEquipmentNeeded', label: 'Special Equipment Needed/Comments', type: 'text' },
  ],
  PerDiem: [
    { apiName: 'serviceTechPerDiem', label: 'Service Tech Per Diem', type: 'multi-user' },
    { apiName: 'perDiemAmount', label: 'Per Diem Amount', type: 'currency' },
    { apiName: 'perDiemNotes', label: 'Per Diem Notes', type: 'text' },
    { apiName: 'perDiemStartDate', label: 'Per Diem Start Date', type: 'date' },
    { apiName: 'perDiemEndDate', label: 'Per Diem End Date', type: 'date' },
  ],
}

export function normalizeWidgetImportHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function getDefaultWorkOrderColumn(headers: string[]): string {
  const candidates = new Set(['workorderid', 'workorder', 'workordernumber', 'woid', 'wonumber'])
  return headers.find((header) => candidates.has(normalizeWidgetImportHeader(header))) ?? ''
}

export function getDefaultWidgetFieldMapping(
  headers: string[],
  objectApiName: WidgetImportObject,
): Record<string, string> {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeWidgetImportHeader(header), header]))
  return Object.fromEntries(WIDGET_IMPORT_FIELDS[objectApiName].flatMap((field) => {
    const source = normalizedHeaders.get(normalizeWidgetImportHeader(field.apiName))
      ?? normalizedHeaders.get(normalizeWidgetImportHeader(field.label))
    return source ? [[field.apiName, source]] : []
  }))
}

function lookupKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

export function buildWorkOrderImportIndex(
  workOrders: WorkOrderImportRecord[],
): Map<string, string | null> {
  const index = new Map<string, string | null>()
  for (const workOrder of workOrders) {
    for (const candidate of [workOrder.id, workOrder.workOrderNumber]) {
      const key = lookupKey(candidate)
      if (!key) continue
      const existing = index.get(key)
      index.set(key, existing === undefined || existing === workOrder.id ? workOrder.id : null)
    }
  }
  return index
}

export function resolveWorkOrderImportId(
  sourceValue: string,
  index: Map<string, string | null>,
): { workOrderId: string | null; error?: string } {
  const key = lookupKey(sourceValue)
  if (!key) return { workOrderId: null, error: 'Workorder ID is blank.' }
  const workOrderId = index.get(key)
  if (!workOrderId) {
    return {
      workOrderId: null,
      error: workOrderId === null
        ? `Workorder ID "${sourceValue}" matches more than one Work Order.`
        : `Workorder ID "${sourceValue}" was not found.`,
    }
  }
  return { workOrderId }
}

function parseDate(value: string): string | null {
  const source = value.trim().replace(
    /(?:\s+|T)\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s?(?:AM|PM))?(?:Z|[+-]\d{2}:?\d{2})?$/i,
    '',
  )
  const iso = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`
  const us = source.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!us) return null
  return `${us[3]}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}`
}

function parseBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  return null
}

export function buildWidgetImportPayload({
  objectApiName,
  row,
  workOrderId,
  fieldMapping,
  users = [],
}: {
  objectApiName: WidgetImportObject
  row: Record<string, string>
  workOrderId: string
  fieldMapping: Record<string, string>
  users?: ImportUserLookupRecord[]
}): { data: Record<string, unknown> | null; errors: string[] } {
  const data: Record<string, unknown> = { workOrder: workOrderId }
  const errors: string[] = []
  const salesforceIdColumn = Object.keys(row).find((header) => normalizeWidgetImportHeader(header) === 'id')
  const salesforceId = salesforceIdColumn ? row[salesforceIdColumn]?.trim() : ''

  for (const field of WIDGET_IMPORT_FIELDS[objectApiName]) {
    const sourceColumn = fieldMapping[field.apiName]
    if (!sourceColumn) continue
    const rawValue = row[sourceColumn] ?? ''
    if (!rawValue.trim()) continue

    if (field.type === 'multi-user') {
      const resolved = resolveUserLookupImportValue(rawValue, users, true)
      if (resolved.value) data[field.apiName] = resolved.value
      if (resolved.unmatched.length > 0) {
        errors.push(`${field.label} did not match: ${resolved.unmatched.join(', ')}`)
      }
      continue
    }

    if (field.type === 'number' || field.type === 'currency') {
      const normalized = rawValue.replace(/[$,\s]/g, '')
      const value = Number(normalized)
      if (!normalized || !Number.isFinite(value)) {
        errors.push(`${field.label} is not a valid number: ${rawValue}`)
        continue
      }
      data[field.apiName] = value
      continue
    }

    if (field.type === 'checkbox') {
      const value = parseBoolean(rawValue)
      if (value === null) errors.push(`${field.label} must be Yes/No or True/False: ${rawValue}`)
      else data[field.apiName] = value
      continue
    }

    if (field.type === 'date') {
      const value = parseDate(rawValue)
      if (!value) errors.push(`${field.label} must use YYYY-MM-DD or MM/DD/YYYY: ${rawValue}`)
      else data[field.apiName] = value
      continue
    }

    data[field.apiName] = rawValue.trim()
  }

  if (objectApiName === 'PunchList'
    && ('estimateOfMen' in data || 'estimateOfIndividualHours' in data)) {
    data.totalEstimateOfHours = Number(data.estimateOfMen ?? 0) * Number(data.estimateOfIndividualHours ?? 0)
  }

  if (Object.keys(data).length === 1) errors.push('No widget fields were mapped for this row.')
  if (!salesforceId) errors.push('Id column is blank or missing.')
  if (errors.some((error) => !error.includes('did not match:'))) return { data: null, errors }
  return { data: { ...data, Id: salesforceId }, errors }
}