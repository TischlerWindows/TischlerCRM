/**
 * rate-change-history trigger
 *
 * Fires afterUpdate on Technician records. Auto-creates a
 * TechnicianRateHistory audit record whenever hourlyRate changes to a new
 * non-zero value.
 *
 * Design notes:
 * - Hourly rate only. v2 dropped overtime tracking (spec §1.1).
 * - No-ops when rate is unchanged or the new rate is 0 (guards against
 *   spurious history on partial PATCHes that don't touch hourlyRate).
 * - TechnicianRateHistory has a static prefix `047` registered in
 *   packages/db/src/record-id.ts. The registerRecordIdPrefix call below is
 *   idempotent — it short-circuits when the prefix is already registered.
 */
import { prisma } from '@crm/db/client'
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordId, recordData, beforeData, userId } = ctx
    if (!beforeData) return null

    const oldHourly = Number(beforeData.hourlyRate) || 0
    const newHourly = Number(recordData.hourlyRate) || 0
    if (oldHourly === newHourly || newHourly <= 0) return null

    const rateHistoryObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'TechnicianRateHistory', mode: 'insensitive' } },
    })
    if (!rateHistoryObj) {
      console.error('[rate-change-history] TechnicianRateHistory object not found')
      return null
    }

    registerRecordIdPrefix('TechnicianRateHistory')
    const today = new Date().toISOString().split('T')[0]

    await prisma.record.create({
      data: {
        id: generateRecordId('TechnicianRateHistory'),
        objectId: rateHistoryObj.id,
        data: {
          technician: recordId,
          effectiveDate: today,
          previousRate: oldHourly,
          newRate: newHourly,
        },
        createdById: userId,
        modifiedById: userId,
      },
    })
    console.log(`[rate-change-history] Logged rate change for tech ${recordId}: $${oldHourly} → $${newHourly}`)

    return null
  } catch (err) {
    console.error('[rate-change-history] Trigger failed:', err)
    return null
  }
}
