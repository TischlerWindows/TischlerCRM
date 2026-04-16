import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'
import { recalculateWorkOrderTotals } from '../_shared/recalculate-work-order-totals.js'

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordData } = ctx
    const workOrderId = recordData.workOrder as string | undefined
    if (!workOrderId) return null

    await recalculateWorkOrderTotals(workOrderId)
    return null
  } catch (err) {
    console.error('[work-order-rollup-time] Trigger failed:', err)
    return null
  }
}
