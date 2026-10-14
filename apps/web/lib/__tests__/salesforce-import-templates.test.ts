import {
  getDefaultPicklistTarget,
  getDistinctPicklistSourceValues,
  getSalesforceImportTemplatesPreferenceKey,
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
  },
}))

let persistedPreferences: Record<string, unknown>

describe('Salesforce import picklist mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    persistedPreferences = {}
    jest.mocked(apiClient.getPreferences).mockImplementation(async () => ({ ...persistedPreferences }))
    jest.mocked(apiClient.setPreference).mockImplementation(async (key, value) => {
      persistedPreferences[key] = value
      return { key, value }
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
      checkboxRules,
    }

    const saved = await saveSalesforceImportTemplate('Contact', 'Contact import', config)
    expect(saved[0]?.config.checkboxRules).toEqual(checkboxRules)
    const contactKey = getSalesforceImportTemplatesPreferenceKey('Contact')
    expect(apiClient.setPreference).toHaveBeenCalledWith(contactKey, expect.arrayContaining([
      expect.objectContaining({ config: expect.objectContaining({ checkboxRules }) }),
    ]))
    expect(persistedPreferences[contactKey]).toEqual(saved)

    await expect(loadSalesforceImportTemplates('Contact')).resolves.toEqual(saved)
    expect(saved[0]?.config.checkboxRules).toEqual(checkboxRules)
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

  it('keeps Contact and Project templates in separate preference keys', async () => {
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
    expect(Object.keys(persistedPreferences)).toEqual([
      getSalesforceImportTemplatesPreferenceKey('Contact'),
      getSalesforceImportTemplatesPreferenceKey('Project'),
    ])
    expect(persistedPreferences[SALESFORCE_IMPORT_TEMPLATES_KEY]).toBeUndefined()
  })
})