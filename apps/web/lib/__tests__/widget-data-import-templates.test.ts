import { apiClient } from '../api-client'
import {
  deleteWidgetDataImportTemplate,
  loadWidgetDataImportTemplates,
  saveWidgetDataImportTemplate,
  WIDGET_DATA_IMPORT_TEMPLATES_KEY,
} from '../widget-data-import-templates'

jest.mock('../api-client', () => ({
  apiClient: {
    getPreferences: jest.fn(),
    setPreference: jest.fn(),
  },
}))

let preferences: Record<string, unknown>

describe('widget data import templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    preferences = {}
    jest.mocked(apiClient.getPreferences).mockImplementation(async () => ({ ...preferences }))
    jest.mocked(apiClient.setPreference).mockImplementation(async (key, value) => {
      preferences[key] = JSON.parse(JSON.stringify(value)) as unknown
      return { key, value: preferences[key] }
    })
  })

  it('keeps templates scoped by widget object', async () => {
    const punchList = await saveWidgetDataImportTemplate('PunchList', 'Punch export', {
      workOrderColumn: 'Workorder ID',
      fieldMapping: { itemNumber: 'Item #' },
    })
    await saveWidgetDataImportTemplate('PerDiem', 'Per diem export', {
      workOrderColumn: 'WO Number',
      fieldMapping: { perDiemAmount: 'Amount' },
    })

    expect(await loadWidgetDataImportTemplates('PunchList')).toEqual(punchList)
    expect((preferences[WIDGET_DATA_IMPORT_TEMPLATES_KEY] as Record<string, unknown>).PunchList).toEqual(punchList)
    expect((preferences[WIDGET_DATA_IMPORT_TEMPLATES_KEY] as Record<string, unknown>).PerDiem).toHaveLength(1)
  })

  it('updates the selected template and deletes it', async () => {
    const initial = await saveWidgetDataImportTemplate('PunchList', 'Legacy punch', {
      workOrderColumn: 'WO',
      fieldMapping: {},
    })
    const updated = await saveWidgetDataImportTemplate('PunchList', 'Legacy punch', {
      workOrderColumn: 'Workorder ID',
      fieldMapping: { location: 'Location' },
    }, initial[0]?.id)

    expect(updated).toHaveLength(1)
    expect(updated[0]?.id).toBe(initial[0]?.id)
    expect(updated[0]?.config.fieldMapping).toEqual({ location: 'Location' })
    await expect(deleteWidgetDataImportTemplate('PunchList', updated[0]!.id)).resolves.toEqual([])
  })
})