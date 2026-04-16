import { prisma } from '@crm/db/client'

/**
 * Recalculates totalActualHours, totalLaborCost, totalExpenses, and
 * totalJobCost on a parent WorkOrder record.
 *
 * Called by both the work-order-rollup-time and work-order-rollup-expense
 * triggers so changes to either TimeEntry or WorkOrderExpense records
 * keep the parent WorkOrder totals in sync.
 */
export async function recalculateWorkOrderTotals(
  workOrderRecordId: string,
): Promise<void> {
  // 1. Find the object IDs for TimeEntry and WorkOrderExpense
  const [timeEntryObj, expenseObj] = await Promise.all([
    prisma.customObject.findFirst({ where: { apiName: 'TimeEntry' } }),
    prisma.customObject.findFirst({ where: { apiName: 'WorkOrderExpense' } }),
  ])

  // 2. Fetch all TimeEntry records for this work order
  let totalActualHours = 0
  let totalLaborCost = 0

  if (timeEntryObj) {
    const timeEntries = await prisma.record.findMany({
      where: { objectId: timeEntryObj.id },
    })
    for (const te of timeEntries) {
      const data = te.data as Record<string, any>
      if (data.workOrder !== workOrderRecordId) continue
      totalActualHours += Number(data.totalHours) || 0
      totalLaborCost += Number(data.totalCost) || 0
    }
  }

  // 3. Fetch all WorkOrderExpense records for this work order
  let totalExpenses = 0

  if (expenseObj) {
    const expenses = await prisma.record.findMany({
      where: { objectId: expenseObj.id },
    })
    for (const exp of expenses) {
      const data = exp.data as Record<string, any>
      if (data.workOrder !== workOrderRecordId) continue
      totalExpenses += Number(data.amount) || 0
    }
  }

  // 4. Compute total job cost
  const totalJobCost = totalLaborCost + totalExpenses

  // 5. Update the work order record
  const woRecord = await prisma.record.findUnique({
    where: { id: workOrderRecordId },
  })
  if (!woRecord) {
    console.warn('[work-order-rollup] WorkOrder record not found:', workOrderRecordId)
    return
  }

  const existingData = (woRecord.data ?? {}) as Record<string, any>

  await prisma.record.update({
    where: { id: workOrderRecordId },
    data: {
      data: {
        ...existingData,
        totalActualHours,
        totalLaborCost,
        totalExpenses,
        totalJobCost,
      },
    },
  })
}
