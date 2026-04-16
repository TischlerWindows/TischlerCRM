import { prisma } from '@crm/db/client'
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordId, recordData, beforeData, userId } = ctx
    if (!beforeData) return null

    const rateHistoryObjectId = await getObjectId('TechnicianRateHistory')
    if (!rateHistoryObjectId) {
      console.error('[rate-change-history] TechnicianRateHistory object not found')
      return null
    }

    registerRecordIdPrefix('TechnicianRateHistory')
    const today = new Date().toISOString().split('T')[0]
    const recordsToCreate: any[] = []

    // Check hourly rate change
    const oldHourly = Number(beforeData.hourlyRate) || 0
    const newHourly = Number(recordData.hourlyRate) || 0
    if (oldHourly !== newHourly && newHourly > 0) {
      recordsToCreate.push({
        id: generateRecordId('TechnicianRateHistory'),
        objectId: rateHistoryObjectId,
        data: {
          technician: recordId,
          effectiveDate: today,
          previousRate: oldHourly,
          newRate: newHourly,
          rateType: 'Hourly',
        },
        createdById: userId,
        modifiedById: userId,
      })
    }

    // Check overtime rate change
    const oldOvertime = Number(beforeData.overtimeRate) || 0
    const newOvertime = Number(recordData.overtimeRate) || 0
    if (oldOvertime !== newOvertime && newOvertime > 0) {
      recordsToCreate.push({
        id: generateRecordId('TechnicianRateHistory'),
        objectId: rateHistoryObjectId,
        data: {
          technician: recordId,
          effectiveDate: today,
          previousRate: oldOvertime,
          newRate: newOvertime,
          rateType: 'Overtime',
        },
        createdById: userId,
        modifiedById: userId,
      })
    }

    if (recordsToCreate.length > 0) {
      await prisma.record.createMany({ data: recordsToCreate })
      console.log(`[rate-change-history] Created ${recordsToCreate.length} rate history record(s) for tech ${recordId}`)
    }

    return null
  } catch (err) {
    console.error('[rate-change-history] Trigger failed:', err)
    return null
  }
}

async function getObjectId(apiName: string): Promise<string | null> {
  const obj = await prisma.customObject.findFirst({
    where: { apiName: { equals: apiName, mode: 'insensitive' } },
  })
  return obj?.id ?? null
}
