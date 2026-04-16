import { prisma } from '@crm/db/client'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { event, recordData } = ctx

    const techId = recordData.technician
    if (!techId) return null

    // Look up the technician's current hourly rate
    const techRecord = await prisma.record.findUnique({ where: { id: techId } })
    if (!techRecord) return null

    const techData = techRecord.data as Record<string, any>
    const currentRate = Number(techData.hourlyRate) || 0

    // Compute totals
    const workHours = Number(recordData.workHours) || 0
    const travelHours = Number(recordData.travelHours) || 0
    const prepHours = Number(recordData.prepHours) || 0
    const miscHours = Number(recordData.miscHours) || 0
    const totalHours = workHours + travelHours + prepHours + miscHours

    // On create: always snapshot the rate
    // On update: only re-snapshot if rateAtEntry is not yet set (preserve original snapshot)
    const rateAtEntry = event === 'beforeCreate'
      ? currentRate
      : (Number(recordData.rateAtEntry) || currentRate)

    const totalCost = totalHours * rateAtEntry

    // Return field updates (beforeCreate/beforeUpdate triggers can mutate the record)
    return {
      rateAtEntry,
      totalHours,
      totalCost,
    }
  } catch (err) {
    console.error('[snapshot-rate-on-time-entry] Trigger failed:', err)
    return null
  }
}
