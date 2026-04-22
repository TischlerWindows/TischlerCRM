import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'work-order-lifecycle',
  name: 'Work Order Lifecycle',
  description: 'Validates status transitions and auto-stamps completedDate/closedDate + user fields',
  icon: 'GitBranch',
  objectApiName: 'WorkOrder',
  events: ['beforeUpdate'],
}
