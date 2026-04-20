/**
 * snapshot-rate-on-time-entry trigger
 * Fires beforeCreate/beforeUpdate on TimeEntry records.
 * On create: snapshots the technician's current hourlyRate into rateAtEntry.
 * On update: preserves existing rateAtEntry (immutable after initial save).
 * Computes totalHours = workHours + travelHours + prepHours + miscHours
 * Computes totalCost = totalHours * rateAtEntry
 */
import { prisma } from '@crm/db/client'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { event, recordData } = ctx
    const techId = recordData.technician
    if (!techId) return null

    const techRecord = await prisma.record.findUnique({ where: { id: techId } })
    if (!techRecord) return null

    const techData = techRecord.data as Record<string, any>
    const currentRate = Number(techData.hourlyRate) || 0

    const workHours = Number(recordData.workHours) || 0
    const travelHours = Number(recordData.travelHours) || 0
    const prepHours = Number(recordData.prepHours) || 0
    const miscHours = Number(recordData.miscHours) || 0
    const totalHours = workHours + travelHours + prepHours + miscHours

    // On create: snapshot current rate. On update: preserve existing rateAtEntry (immutable after save).
    const rateAtEntry = event === 'beforeCreate'
      ? currentRate
      : (Number(recordData.rateAtEntry) || currentRate)

    const totalCost = totalHours * rateAtEntry

    return { rateAtEntry, totalHours, totalCost }
  } catch (err) {
    console.error('[snapshot-rate-on-time-entry] Trigger failed:', err)
    return null
  }
}
