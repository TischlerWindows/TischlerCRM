import {
  getDefaultPicklistTarget,
  getDistinctPicklistSourceValues,
  loadSalesforceImportTemplates,
  PICKLIST_LEAVE_BLANK,
  resolvePicklistImportValue,
  SALESFORCE_IMPORT_TEMPLATES_KEY,
  saveSalesforceImportTemplate,
} from '../salesforce-import-templates'
import { apiClient } from '../api-client'

jest.mock('../api-client', () => ({
  apiClient: {
    getPreferences: jest.fn(),
    setPreference: jest.fn(),
    deletePreference: jest.fn(),
  },
}))

let persistedPreferences: Record<string, unknown>

describe('Salesforce import picklist mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    persistedPreferences = {}
    jest.mocked(apiClient.getPreferences).mockImplementation(async () => ({ ...persistedPreferences }))
    jest.mocked(apiClient.setPreference).mockImplementation(async (key, value) => {
      const persisted = JSON.parse(JSON.stringify(value)) as unknown
      if (key === SALESFORCE_IMPORT_TEMPLATES_KEY && persisted && typeof persisted === 'object') {
        for (const templates of Object.values(persisted as Record<string, unknown>)) {
          if (!Array.isArray(templates)) continue
          for (const template of templates as SalesforceImportTemplate[]) {
            if (!template.config.checkboxRules) continue
            template.config.checkboxRules = template.config.checkboxRules.map((rule) => ({
              condition: rule.condition,
              sourceColumn: rule.sourceColumn,
              targetField: rule.targetField,
              id: rule.id,
            }))
          }
        }
      }
      persistedPreferences[key] = persisted
      return { key, value: persisted }
    })
    jest.mocked(apiClient.deletePreference).mockImplementation(async (key) => {
      delete persistedPreferences[key]
    })
  })

  it('collects distinct nonblank and blank source values', () => {
    expect(getDistinctPicklistSourceValues([
      { Type: 'Architect Account' },
      { Type: 'Architect Account' },
      { Type: '' },
      { Type: 'Supplier' },
    ], 'Type')).toEqual(['', 'Architect Account', 'Supplier'])
  })

  it('defaults blank values to Leave blank and exact matches case-insensitively', () => {
    expect(getDefaultPicklistTarget('', ['Customer'])).toBe(PICKLIST_LEAVE_BLANK)
    expect(getDefaultPicklistTarget(' property MANAGEMENT ', ['Property Management'])).toBe('Property Management')
    expect(getDefaultPicklistTarget('Architect Account', ['Property Management'])).toBe('')
  })

  it('translates source strings to selected CRM options and resolves Leave blank', () => {
    expect(resolvePicklistImportValue('Architect Account', { 'Architect Account': 'Property Management' }, ['Property Management']))
      .toEqual({ resolved: true, value: 'Property Management' })
    expect(resolvePicklistImportValue('', { '': PICKLIST_LEAVE_BLANK }, ['Property Management']))
      .toEqual({ resolved: true, value: '' })
    expect(resolvePicklistImportValue('Architect Account', {}, ['Property Management']))
      .toEqual({ resolved: false, value: '' })
  })

  it('persists and reloads checkbox rules in object import templates', async () => {
    const checkboxRules = [{
      id: 'rule-contact-homeowner',
      targetField: 'homeownerAccount',
      sourceColumn: 'Account Name',
      condition: 'has-value' as const,
    }]
    const config = {
      columnMapping: { AccountId: 'account' },
      picklistValueMappings: {},
      phonePrefixMappings: { Phone: 'Home' },
      checkboxRules,
    }

    const saved = await saveSalesforceImportTemplate('Contact', 'Contact import', config)
    expect(saved[0]?.config.checkboxRules).toEqual(checkboxRules)
    expect(saved[0]?.config.phonePrefixMappings).toEqual({ Phone: 'Home' })
    expect(apiClient.setPreference).toHaveBeenCalledWith(
      SALESFORCE_IMPORT_TEMPLATES_KEY,
      expect.objectContaining({
        Contact: expect.arrayContaining([
          expect.objectContaining({ config: expect.objectContaining({ checkboxRules }) }),
        ]),
      }),
    )
    expect(persistedPreferences[SALESFORCE_IMPORT_TEMPLATES_KEY]).toMatchObject({
      Contact: [{ config: { checkboxRules } }],
    })

    await expect(loadSalesforceImportTemplates('Contact')).resolves.toEqual(saved)
    expect(saved[0]?.config.checkboxRules).toEqual(checkboxRules)
    expect(saved[0]?.config.phonePrefixMappings).toEqual({ Phone: 'Home' })
  })

  it('waits for the preferences write before reporting a template save as complete', async () => {
    let finishWrite: (() => void) | undefined
    let markWriteStarted: (() => void) | undefined
    const writeStarted = new Promise<void>((resolve) => { markWriteStarted = resolve })
    jest.mocked(apiClient.setPreference).mockImplementationOnce(async (key, value) => {
      markWriteStarted?.()
      await new Promise<void>((resolve) => { finishWrite = resolve })
      persistedPreferences[key] = value
      return { key, value }
    })

    let completed = false
    const savePromise = saveSalesforceImportTemplate('Contact', 'Contact import', {
      columnMapping: {},
      picklistValueMappings: {},
      checkboxRules: [{
        id: 'rule-1',
        targetField: 'homeownerAccount',
        sourceColumn: 'Account Name',
        condition: 'has-value',
      }],
    }).then((templates) => {
      completed = true
      return templates
    })

    await writeStarted
    expect(apiClient.setPreference).toHaveBeenCalledTimes(1)
    expect(completed).toBe(false)
    finishWrite?.()
    await savePromise
    expect(completed).toBe(true)
  })

  it('keeps Contact and Project templates separate under the canonical preference key', async () => {
    const contact = await saveSalesforceImportTemplate('Contact', 'Contact Rules', {
      columnMapping: {},
      picklistValueMappings: {},
      checkboxRules: [{ id: 'contact-rule', targetField: 'homeownerAccount', sourceColumn: 'Account Name', condition: 'has-value' }],
    })
    const project = await saveSalesforceImportTemplate('Project', 'Project Rules', {
      columnMapping: {},
      picklistValueMappings: {},
      checkboxRules: [{ id: 'project-rule', targetField: 'hasScreen', sourceColumn: 'Screen', condition: 'has-value' }],
    })

    expect(await loadSalesforceImportTemplates('Contact')).toEqual(contact)
    expect(await loadSalesforceImportTemplates('Project')).toEqual(project)
    expect(Object.keys(persistedPreferences)).toEqual([SALESFORCE_IMPORT_TEMPLATES_KEY])
    const persistedTemplates = persistedPreferences[SALESFORCE_IMPORT_TEMPLATES_KEY] as Record<string, SalesforceImportTemplate[]>
    expect(persistedTemplates.Contact?.[0]?.config.checkboxRules?.[0]?.targetField).toBe('homeownerAccount')
    expect(persistedTemplates.Project?.[0]?.config.checkboxRules?.[0]?.targetField).toBe('hasScreen')
  })

  it('merges and migrates Contact templates stored under the previous per-object key', async () => {
    const checkboxRules = [{
      id: 'legacy-rule',
      targetField: 'homeownerAccount',
      sourceColumn: 'Account Name',
      condition: 'has-value' as const,
    }]
    const makeTemplate = (id: string, name: string, updatedAt: string) => ({
      id,
      name,
      objectApiName: 'Contact',
      config: { columnMapping: {}, picklistValueMappings: {}, checkboxRules },
      updatedAt,
    })
    persistedPreferences[`${SALESFORCE_IMPORT_TEMPLATES_KEY}:Contact`] = [
      makeTemplate('legacy-id', 'Contact1', '2026-10-13T10:00:00.000Z'),
    ]
    persistedPreferences[SALESFORCE_IMPORT_TEMPLATES_KEY] = {
      Contact: [makeTemplate('canonical-id', 'Contact2', '2026-10-14T10:00:00.000Z')],
      Project: [],
    }

    const loaded = await loadSalesforceImportTemplates('Contact')

    expect(loaded.map((template) => template.name)).toEqual(['Contact1', 'Contact2'])
    expect(loaded[0]?.config.checkboxRules).toEqual(checkboxRules)
    expect(apiClient.setPreference).toHaveBeenCalledWith(
      SALESFORCE_IMPORT_TEMPLATES_KEY,
      expect.objectContaining({ Contact: expect.arrayContaining(loaded) }),
    )
    expect(apiClient.deletePreference).toHaveBeenCalledWith(`${SALESFORCE_IMPORT_TEMPLATES_KEY}:Contact`)
    expect(persistedPreferences[`${SALESFORCE_IMPORT_TEMPLATES_KEY}:Contact`]).toBeUndefined()
  })
})