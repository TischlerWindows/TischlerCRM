import { getPreference, setPreferenceAndWait } from './preferences'

export const SALESFORCE_IMPORT_TEMPLATES_KEY = 'salesforceImportTemplates'
export const PICKLIST_LEAVE_BLANK = '__leave_blank__'

export type SalesforceCheckboxRuleCondition = 'has-value' | 'is-blank'

export interface SalesforceCheckboxImportRule {
  id: string
  targetField: string
  sourceColumn: string
  condition: SalesforceCheckboxRuleCondition
}

export interface SalesforceImportTemplateConfig {
  columnMapping: Record<string, string>
  picklistValueMappings: Record<string, Record<string, string>>
  checkboxRules?: SalesforceCheckboxImportRule[]
  sfIdColumn?: string | null
  propertyLookupField?: string
}

export interface SalesforceImportTemplate {
  id: string
  name: string
  objectApiName: string
  config: SalesforceImportTemplateConfig
  updatedAt: string
}

type StoredTemplates = Record<string, SalesforceImportTemplate[]>

export function getDistinctPicklistSourceValues(rows: Record<string, string>[], column: string): string[] {
  return Array.from(new Set(rows.map((row) => row[column]?.trim() ?? '')))
    .sort((left, right) => left === '' ? -1 : right === '' ? 1 : left.localeCompare(right))
}

export function getDefaultPicklistTarget(sourceValue: string, options: string[]): string {
  if (!sourceValue) return PICKLIST_LEAVE_BLANK
  const normalized = sourceValue.trim().toLowerCase()
  return options.find((option) => option.trim().toLowerCase() === normalized) ?? ''
}

export function resolvePicklistImportValue(
  sourceValue: string,
  valueMappings: Record<string, string>,
  options: string[],
): { resolved: boolean; value: string } {
  const source = sourceValue.trim()
  const mapped = Object.prototype.hasOwnProperty.call(valueMappings, source)
    ? valueMappings[source]
    : getDefaultPicklistTarget(source, options)
  if (mapped === PICKLIST_LEAVE_BLANK) return { resolved: true, value: '' }
  if (!mapped) return { resolved: false, value: '' }
  return { resolved: true, value: mapped }
}

export async function loadSalesforceImportTemplates(objectApiName: string): Promise<SalesforceImportTemplate[]> {
  const templates = await getPreference<StoredTemplates>(SALESFORCE_IMPORT_TEMPLATES_KEY, {})
  return templates?.[objectApiName] ?? []
}

export async function saveSalesforceImportTemplate(
  objectApiName: string,
  name: string,
  config: SalesforceImportTemplateConfig,
): Promise<SalesforceImportTemplate[]> {
  const stored = await getPreference<StoredTemplates>(SALESFORCE_IMPORT_TEMPLATES_KEY, {}) ?? {}
  const current = stored[objectApiName] ?? []
  const normalizedName = name.trim().toLowerCase()
  const existingIndex = current.findIndex((template) => template.name.trim().toLowerCase() === normalizedName)
  const template: SalesforceImportTemplate = {
    id: existingIndex >= 0 ? current[existingIndex]!.id : crypto.randomUUID(),
    name: name.trim(),
    objectApiName,
    config: structuredClone(config),
    updatedAt: new Date().toISOString(),
  }
  const nextForObject = [...current]
  if (existingIndex >= 0) nextForObject[existingIndex] = template
  else nextForObject.push(template)
  await setPreferenceAndWait(SALESFORCE_IMPORT_TEMPLATES_KEY, { ...stored, [objectApiName]: nextForObject })
  return nextForObject
}

export async function deleteSalesforceImportTemplate(
  objectApiName: string,
  templateId: string,
): Promise<SalesforceImportTemplate[]> {
  const stored = await getPreference<StoredTemplates>(SALESFORCE_IMPORT_TEMPLATES_KEY, {}) ?? {}
  const nextForObject = (stored[objectApiName] ?? []).filter((template) => template.id !== templateId)
  await setPreferenceAndWait(SALESFORCE_IMPORT_TEMPLATES_KEY, { ...stored, [objectApiName]: nextForObject })
  return nextForObject
}