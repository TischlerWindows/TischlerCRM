import {
  getDefaultPicklistTarget,
  getDistinctPicklistSourceValues,
  loadSalesforceImportTemplates,
  PICKLIST_LEAVE_BLANK,
  resolvePicklistImportValue,
  SALESFORCE_IMPORT_TEMPLATES_KEY,
  saveSalesforceImportTemplate,
} from '../salesforce-import-templates'
import { getPreference, setPreferenceAndWait } from '../preferences'

jest.mock('../preferences', () => ({
  getPreference: jest.fn(),
  setPreferenceAndWait: jest.fn(),
}))

describe('Salesforce import picklist mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getPreference).mockResolvedValue({})
    jest.mocked(setPreferenceAndWait).mockImplementation(async (_key, value) => value as never)
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
    expect(setPreferenceAndWait).toHaveBeenCalledWith(
      SALESFORCE_IMPORT_TEMPLATES_KEY,
      expect.objectContaining({
        Contact: [expect.objectContaining({ config: expect.objectContaining({ checkboxRules }) })],
      }),
    )

    jest.mocked(getPreference).mockResolvedValueOnce({ Contact: saved })
    await expect(loadSalesforceImportTemplates('Contact')).resolves.toEqual(saved)
    expect(saved[0]?.config.checkboxRules).toEqual(checkboxRules)
  })

  it('waits for the preferences write before reporting a template save as complete', async () => {
    let finishWrite: (() => void) | undefined
    jest.mocked(setPreferenceAndWait).mockImplementationOnce(async (_key, value) => {
      await new Promise<void>((resolve) => { finishWrite = resolve })
      return value as never
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

    await Promise.resolve()
    expect(setPreferenceAndWait).toHaveBeenCalledTimes(1)
    expect(completed).toBe(false)
    finishWrite?.()
    await savePromise
    expect(completed).toBe(true)
  })
})