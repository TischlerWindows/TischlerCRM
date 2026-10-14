import {
  buildWidgetImportPayload,
  buildWorkOrderImportIndex,
  getDefaultWidgetFieldMapping,
  getDefaultWorkOrderColumn,
  resolveWorkOrderImportId,
} from '../widget-data-import'

describe('widget data imports', () => {
  const workOrderIndex = buildWorkOrderImportIndex([
    { id: 'wo-1', workOrderNumber: 'WO-001' },
    { id: 'wo-2', workOrderNumber: 'WO-002' },
    { id: 'wo-3', workOrderNumber: 'WO-002' },
  ])

  it('detects the Workorder ID column and maps widget field headers', () => {
    expect(getDefaultWorkOrderColumn(['Punch Item', 'Work Order Number'])).toBe('Work Order Number')
    expect(getDefaultWidgetFieldMapping(['Item #', 'Location'], 'PunchList')).toEqual({
      itemNumber: 'Item #',
      location: 'Location',
    })
  })

  it('resolves CRM record IDs and Work Order Numbers while rejecting ambiguous identifiers', () => {
    expect(resolveWorkOrderImportId(' WO-001 ', workOrderIndex)).toEqual({ workOrderId: 'wo-1' })
    expect(resolveWorkOrderImportId('WO-002', workOrderIndex).error).toContain('more than one')
    expect(resolveWorkOrderImportId('missing', workOrderIndex).error).toContain('not found')
    expect(resolveWorkOrderImportId('', workOrderIndex).error).toContain('blank')
  })

  it('parses punch list fields and computes total estimated hours', () => {
    expect(buildWidgetImportPayload({
      objectApiName: 'PunchList',
      row: {
        'Item #': ' 4 ',
        Men: '2',
        'Hours Each': '1.5',
        Approved: 'Yes',
        'Service Date': '4/6/2026',
      },
      workOrderId: 'wo-1',
      fieldMapping: {
        itemNumber: 'Item #',
        estimateOfMen: 'Men',
        estimateOfIndividualHours: 'Hours Each',
        clientApproved: 'Approved',
        serviceDate: 'Service Date',
      },
    })).toEqual({
      data: {
        workOrder: 'wo-1',
        itemNumber: '4',
        estimateOfMen: 2,
        estimateOfIndividualHours: 1.5,
        clientApproved: true,
        serviceDate: '2026-04-06',
        totalEstimateOfHours: 3,
      },
      errors: [],
    })
  })

  it('retains matched per diem users and reports unknown users without blocking other fields', () => {
    expect(buildWidgetImportPayload({
      objectApiName: 'PerDiem',
      row: { Techs: 'Matthias Mildner; Unknown Tech', Amount: '$120.50' },
      workOrderId: 'wo-1',
      fieldMapping: { serviceTechPerDiem: 'Techs', perDiemAmount: 'Amount' },
      users: [{ id: 'user-1', name: 'Matthias Mildner', email: 'matthias@example.com', isActive: false }],
    })).toEqual({
      data: { workOrder: 'wo-1', serviceTechPerDiem: 'user-1', perDiemAmount: 120.5 },
      errors: ['Service Tech Per Diem did not match: Unknown Tech'],
    })
  })
})