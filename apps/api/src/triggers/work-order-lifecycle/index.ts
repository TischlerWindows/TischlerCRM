/**
 * work-order-lifecycle trigger
 *
 * Fires beforeUpdate on WorkOrder. Enforces the 7-state machine defined in
 * VALID_TRANSITIONS below and auto-stamps completedDate/closedDate + user
 * fields when entering terminal states. Invalid transitions are silently
 * reverted by returning the old status in the update payload (the before-phase
 * trigger infra in records.ts merges trigger output into the write payload
 * before prisma.record.update is called).
 *
 * State diagram:
 *   Open → Scheduled → In Progress → Completed → Closed
 *                 ↓           ↓
 *              On Hold     On Hold  (both bidirectional)
 *   Open/Scheduled/In Progress/On Hold → Cancelled
 *   Cancelled → Open  (manager recovery; reason fields preserved per spec §2)
 */
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Open':        ['Scheduled', 'Cancelled'],
  'Scheduled':   ['Open', 'In Progress', 'On Hold', 'Cancelled'],
  'In Progress': ['Completed', 'On Hold', 'Cancelled'],
  'On Hold':     ['Scheduled', 'In Progress', 'Cancelled'],
  'Completed':   ['Closed', 'In Progress'],
  'Closed':      [],
  'Cancelled':   ['Open'],
}

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordData, beforeData, userId } = ctx
    if (!beforeData) return null

    const oldStatus = (beforeData.workOrderStatus as string) || 'Open'
    const newStatus = recordData.workOrderStatus as string | undefined

    if (!newStatus || newStatus === oldStatus) return null

    const allowed = VALID_TRANSITIONS[oldStatus] || []
    if (!allowed.includes(newStatus)) {
      console.warn(`[work-order-lifecycle] Invalid transition: ${oldStatus} → ${newStatus} — reverting`)
      return { workOrderStatus: oldStatus }
    }

    const now = new Date().toISOString()
    const updates: Record<string, any> = {}

    if (newStatus === 'Completed') {
      updates.completedDate = now
      updates.completedBy = userId
    }

    if (newStatus === 'Closed') {
      updates.closedDate = now
      updates.closedBy = userId
    }

    // Re-open: clear completion stamps so the 24-hr window resets on re-completion
    if (oldStatus === 'Completed' && newStatus === 'In Progress') {
      updates.completedDate = null
      updates.completedBy = null
    }

    return Object.keys(updates).length > 0 ? updates : null
  } catch (err) {
    console.error('[work-order-lifecycle] Trigger failed:', err)
    return null
  }
}
