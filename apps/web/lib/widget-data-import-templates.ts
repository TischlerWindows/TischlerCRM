import { apiClient } from './api-client'
import type { WidgetImportObject } from './widget-data-import'

export const WIDGET_DATA_IMPORT_TEMPLATES_KEY = 'widgetDataImportTemplates'

export interface WidgetDataImportTemplateConfig {
  workOrderColumn: string
  fieldMapping: Record<string, string>
}

export interface WidgetDataImportTemplate {
  id: string
  name: string
  objectApiName: WidgetImportObject
  config: WidgetDataImportTemplateConfig
  updatedAt: string
}

type StoredTemplates = Record<string, WidgetDataImportTemplate[]>

function getStoredTemplates(value: unknown): StoredTemplates {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as StoredTemplates
    : {}
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entry]) => [key, normalize(entry)]))
    }
    return value
  }
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

export async function loadWidgetDataImportTemplates(
  objectApiName: WidgetImportObject,
): Promise<WidgetDataImportTemplate[]> {
  const preferences = await apiClient.getPreferences()
  const templates = getStoredTemplates(preferences[WIDGET_DATA_IMPORT_TEMPLATES_KEY])[objectApiName]
  return Array.isArray(templates) ? templates : []
}

export async function saveWidgetDataImportTemplate(
  objectApiName: WidgetImportObject,
  name: string,
  config: WidgetDataImportTemplateConfig,
  templateId?: string,
): Promise<WidgetDataImportTemplate[]> {
  const preferences = await apiClient.getPreferences()
  const stored = getStoredTemplates(preferences[WIDGET_DATA_IMPORT_TEMPLATES_KEY])
  const current = stored[objectApiName] ?? []
  const normalizedName = name.trim().toLowerCase()
  const existing = current.find((template) => template.id === templateId)
    ?? current.find((template) => template.name.trim().toLowerCase() === normalizedName)
  const template: WidgetDataImportTemplate = {
    id: existing?.id ?? crypto.randomUUID(),
    name: name.trim(),
    objectApiName,
    config: structuredClone(config),
    updatedAt: new Date().toISOString(),
  }
  const nextForObject = [...current]
  const existingIndex = nextForObject.findIndex((candidate) => candidate.id === template.id)
  if (existingIndex >= 0) nextForObject[existingIndex] = template
  else nextForObject.push(template)

  await apiClient.setPreference(WIDGET_DATA_IMPORT_TEMPLATES_KEY, {
    ...stored,
    [objectApiName]: nextForObject,
  })
  const persisted = await loadWidgetDataImportTemplates(objectApiName)
  const confirmed = persisted.find((candidate) => candidate.id === template.id)
  if (!confirmed || !structurallyEqual(confirmed.config, template.config)) {
    throw new Error('The widget import template could not be verified after saving.')
  }
  return persisted
}

export async function deleteWidgetDataImportTemplate(
  objectApiName: WidgetImportObject,
  templateId: string,
): Promise<WidgetDataImportTemplate[]> {
  const preferences = await apiClient.getPreferences()
  const stored = getStoredTemplates(preferences[WIDGET_DATA_IMPORT_TEMPLATES_KEY])
  const nextForObject = (stored[objectApiName] ?? []).filter((template) => template.id !== templateId)
  await apiClient.setPreference(WIDGET_DATA_IMPORT_TEMPLATES_KEY, {
    ...stored,
    [objectApiName]: nextForObject,
  })
  const persisted = await loadWidgetDataImportTemplates(objectApiName)
  if (persisted.some((template) => template.id === templateId)) {
    throw new Error('The widget import template could not be deleted.')
  }
  return persisted
}