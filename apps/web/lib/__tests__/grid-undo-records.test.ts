import { recordsService, type RecordData } from '../records-service'
import { buildGridRestorePatch, restoreGridRows } from '../grid-undo-records'

jest.mock('../records-service', () => ({
  recordsService: {
    updateRecord: jest.fn(),
    deleteRecord: jest.fn(),
  },
}))

describe('grid undo row restoration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('restores changed values and clears fields that were previously absent', () => {
    expect(buildGridRestorePatch(
      { data: { qty: '4', approved: false, width: 0, addedField: 'new' } },
      { data: { qty: '2', approved: true, width: 0 } },
    )).toEqual({ qty: '2', approved: true, addedField: '' })
  })

  it('restores existing records and removes rows created by the undone action', async () => {
    const current = { id: 'existing', data: { qty: '4' } } as RecordData
    const previous = { id: 'existing', data: { qty: '2' } } as RecordData
    const added = { id: 'added', data: { qty: '1' } } as RecordData
    jest.mocked(recordsService.updateRecord).mockResolvedValue({ ...previous, data: { qty: '2' } })
    jest.mocked(recordsService.deleteRecord).mockResolvedValue(true)

    await expect(restoreGridRows('CadIndexItem', [current, added], [previous])).resolves.toEqual([
      { ...previous, data: { qty: '2' } },
    ])
    expect(recordsService.updateRecord).toHaveBeenCalledWith('CadIndexItem', 'existing', { data: { qty: '2' } })
    expect(recordsService.deleteRecord).toHaveBeenCalledWith('CadIndexItem', 'added')
  })
})
