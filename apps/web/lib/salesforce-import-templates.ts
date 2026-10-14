import { apiClient } from './api-client'

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
  phonePrefixMappings?: Record<string, string>
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

function asStoredTemplates(value: unknown): StoredTemplates {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as StoredTemplates
    : {}
}

function getObjectTemplates(preferences: Record<string, unknown>, objectApiName: string): SalesforceImportTemplate[] {
  const aggregateValue = asStoredTemplates(preferences[SALESFORCE_IMPORT_TEMPLATES_KEY])[objectApiName] ?? []
  const previousPerObjectValue = preferences[`${SALESFORCE_IMPORT_TEMPLATES_KEY}:${objectApiName}`]
  const previousTemplates = Array.isArray(previousPerObjectValue)
    ? previousPerObjectValue as SalesforceImportTemplate[]
    : []
  const merged = new Map<string, SalesforceImportTemplate>()
  for (const template of [...previousTemplates, ...aggregateValue]) {
    const key = template.name.trim().toLowerCase() || template.id
    const existing = merged.get(key)
    if (!existing || Date.parse(template.updatedAt) >= Date.parse(existing.updatedAt)) {
      merged.set(key, template)
    }
  }
  return [...merged.values()]
}

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
  const preferences = await apiClient.getPreferences()
  const templates = getObjectTemplates(preferences, objectApiName)
  const legacyKey = `${SALESFORCE_IMPORT_TEMPLATES_KEY}:${objectApiName}`
  if (!Array.isArray(preferences[legacyKey])) return templates

  const aggregate = {
    ...asStoredTemplates(preferences[SALESFORCE_IMPORT_TEMPLATES_KEY]),
    [objectApiName]: templates,
  }
  const response = await apiClient.setPreference(SALESFORCE_IMPORT_TEMPLATES_KEY, aggregate)
  const persisted = asStoredTemplates(response?.value)[objectApiName]
  if (!persisted || !structurallyEqual(templates, persisted)) {
    throw new Error('Could not migrate existing import templates.')
  }
  await apiClient.deletePreference(legacyKey).catch(() => {})
  return persisted
}

export async function saveSalesforceImportTemplate(
  objectApiName: string,
  name: string,
  config: SalesforceImportTemplateConfig,
): Promise<SalesforceImportTemplate[]> {
  await loadSalesforceImportTemplates(objectApiName)
  const preferences = await apiClient.getPreferences()
  const stored = asStoredTemplates(preferences[SALESFORCE_IMPORT_TEMPLATES_KEY])
  const current = getObjectTemplates(preferences, objectApiName)
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
  const nextStored = { ...stored, [objectApiName]: nextForObject }
  await apiClient.setPreference(SALESFORCE_IMPORT_TEMPLATES_KEY, nextStored)
  const persistedPreferences = await apiClient.getPreferences()
  const savedForObject = asStoredTemplates(persistedPreferences[SALESFORCE_IMPORT_TEMPLATES_KEY])[objectApiName]
  const confirmedTemplate = savedForObject?.find((candidate) => candidate.id === template.id)
  if (!confirmedTemplate) throw new Error('The import template was not returned by the preferences API.')
  if (!structurallyEqual(template.config, confirmedTemplate.config)) {
    throw new Error('The saved import mappings did not match the preferences API response.')
  }
  return savedForObject
}

export async function deleteSalesforceImportTemplate(
  objectApiName: string,
  templateId: string,
): Promise<SalesforceImportTemplate[]> {
  const current = await loadSalesforceImportTemplates(objectApiName)
  const preferences = await apiClient.getPreferences()
  const stored = asStoredTemplates(preferences[SALESFORCE_IMPORT_TEMPLATES_KEY])
  const nextForObject = current.filter((template) => template.id !== templateId)
  await apiClient.setPreference(SALESFORCE_IMPORT_TEMPLATES_KEY, { ...stored, [objectApiName]: nextForObject })
  const persistedPreferences = await apiClient.getPreferences()
  const savedForObject = asStoredTemplates(persistedPreferences[SALESFORCE_IMPORT_TEMPLATES_KEY])[objectApiName]
  if (!savedForObject || savedForObject.some((template) => template.id === templateId)) {
    throw new Error('The import template was not removed by the preferences API.')
  }
  return savedForObject
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, entry]) => [key, normalize(entry)]),
      )
    }
    return value
  }
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}