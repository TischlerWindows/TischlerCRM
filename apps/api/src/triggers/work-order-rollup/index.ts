/**
 * work-order-rollup trigger
 *
 * Fires afterCreate / afterUpdate / afterDelete on TimeEntry and WorkOrderExpense
 * records. Re-queries ALL TimeEntry + WorkOrderExpense records for the parent
 * WorkOrder and writes 4 computed totals back to the WO:
 *
 *   totalActualHours  = sum of TimeEntry.totalHours
 *   totalLaborCost    = sum of TimeEntry.totalCost
 *   totalExpenses     = sum of WorkOrderExpense.amount
 *   totalJobCost      = totalLaborCost + totalExpenses
 *
 * Registry: this single handler is registered TWICE in triggers/registry.ts —
 * once against TimeEntry (id: 'work-order-rollup') and once against
 * WorkOrderExpense (id: 'work-order-rollup-expense'). Each registration is
 * independently disable-able from Settings > Automations without affecting
 * the other.
 *
 * Delete semantics:
 *   For afterDelete, the deleted record is already soft-deleted (deletedAt
 *   is non-null) by the time this trigger fires — the Prisma query
 *   `where: { deletedAt: null }` naturally excludes it. The parent workOrder
 *   ID is recovered from `recordData?.workOrder || beforeData?.workOrder`
 *   (records.ts passes the pre-delete snapshot as both for compatibility).
 *
 * Concurrency:
 *   Two concurrent writes can race on the parent WO. Last writer wins.
 *   Acceptable for a cost rollup — the next write will recompute from
 *   fresh sums. Not used for ordering-sensitive state.
 */
import { prisma } from '@crm/db/client'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordData, beforeData } = ctx

    // Extract the workOrder ID — present in recordData for create/update,
    // in beforeData for delete (snapshot of the record before deletion).
    const woId = (recordData?.workOrder || beforeData?.workOrder) as string | undefined
    if (!woId) return null

    // Resolve object IDs for TimeEntry and WorkOrderExpense once
    const [timeEntryObj, expenseObj] = await Promise.all([
      prisma.customObject.findFirst({ where: { apiName: 'TimeEntry' } }),
      prisma.customObject.findFirst({ where: { apiName: 'WorkOrderExpense' } }),
    ])
    if (!timeEntryObj || !expenseObj) {
      console.warn('[work-order-rollup] Could not find TimeEntry or WorkOrderExpense object definitions')
      return null
    }

    // Query all non-deleted TimeEntry records for this WO
    const timeEntries = await prisma.record.findMany({
      where: {
        objectId: timeEntryObj.id,
        deletedAt: null,
        data: { path: ['workOrder'], equals: woId },
      },
    })

    // Query all non-deleted WorkOrderExpense records for this WO
    const expenseRecords = await prisma.record.findMany({
      where: {
        objectId: expenseObj.id,
        deletedAt: null,
        data: { path: ['workOrder'], equals: woId },
      },
    })

    // Sum time-entry fields
    let totalActualHours = 0
    let totalLaborCost = 0
    for (const r of timeEntries) {
      const d = r.data as Record<string, any>
      totalActualHours += Number(d.totalHours) || 0
      totalLaborCost += Number(d.totalCost) || 0
    }

    // Sum expense fields
    let totalExpenses = 0
    for (const r of expenseRecords) {
      const d = r.data as Record<string, any>
      totalExpenses += Number(d.amount) || 0
    }

    const totalJobCost = totalLaborCost + totalExpenses

    // Fetch current WO data so we can merge (prisma requires full data object)
    const woRecord = await prisma.record.findUnique({ where: { id: woId } })
    if (!woRecord) {
      console.warn(`[work-order-rollup] WorkOrder ${woId} not found — skipping rollup write`)
      return null
    }

    await prisma.record.update({
      where: { id: woId },
      data: {
        data: {
          ...(woRecord.data as object),
          totalActualHours,
          totalLaborCost,
          totalExpenses,
          totalJobCost,
        },
      },
    })

    return null
  } catch (err) {
    console.error('[work-order-rollup] Trigger failed:', err)
    return null
  }
}
