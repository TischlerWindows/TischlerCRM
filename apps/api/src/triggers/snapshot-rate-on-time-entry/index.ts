/**
 * snapshot-rate-on-time-entry trigger
 *
 * Fires beforeCreate / beforeUpdate on TimeEntry records. Freezes the
 * technician's hourlyRate at the moment the entry is first created and
 * computes derived totals (totalHours, totalCost) so that downstream
 * reporting (Cost Dashboard, payroll exports) shows historically accurate
 * labor cost even after a technician's rate changes.
 *
 * Create path:
 *   rateAtEntry = Technician.hourlyRate (current)
 *
 * Update path:
 *   rateAtEntry = beforeData.rateAtEntry (persisted pre-update value)
 *   Falls back to currentRate ONLY if persistedRate is missing/zero, which
 *   preserves immutability for partial PATCHes that omit rateAtEntry from
 *   the payload. See spec §1.5 — "rate at entry is immutable after save".
 *
 * Totals:
 *   totalHours = workHours + travelHours + prepHours + miscHours
 *   totalCost  = totalHours * rateAtEntry
 *
 * The return value is merged into the write payload by the before-phase
 * trigger infrastructure in records.ts before prisma.record.update is called.
 */
import { prisma } from '@crm/db/client'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { event, recordData, beforeData } = ctx
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

    // On create: snapshot current rate. On update: use the persisted rateAtEntry
    // from beforeData (the pre-update record), not from recordData (the incoming
    // payload). Partial PATCHes must never re-snapshot the rate.
    let rateAtEntry: number
    if (event === 'beforeCreate') {
      rateAtEntry = currentRate
    } else {
      const persistedRate = Number((beforeData as Record<string, any> | undefined)?.rateAtEntry)
      rateAtEntry = persistedRate > 0 ? persistedRate : currentRate
    }

    const totalCost = totalHours * rateAtEntry

    return { rateAtEntry, totalHours, totalCost }
  } catch (err) {
    console.error('[snapshot-rate-on-time-entry] Trigger failed:', err)
    return null
  }
}
