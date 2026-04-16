import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Scheduled': ['In Progress'],
  'In Progress': ['Completed', 'Scheduled'],
  'Completed': ['Closed', 'In Progress'],
  'Closed': [],
}

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  try {
    const { recordData, beforeData, userId } = ctx
    if (!beforeData) return null

    const oldStatus = beforeData.workOrderStatus as string | undefined
    const newStatus = recordData.workOrderStatus as string | undefined

    // No status change — nothing to do
    if (!newStatus || newStatus === oldStatus) return null

    // Validate transition
    const allowed = VALID_TRANSITIONS[oldStatus || 'Scheduled'] || []
    if (!allowed.includes(newStatus)) {
      console.warn(`[work-order-lifecycle] Invalid transition: ${oldStatus} → ${newStatus}`)
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

    // If moving back from Completed to In Progress, clear completion fields
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
