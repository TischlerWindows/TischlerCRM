import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'work-order-lifecycle',
  name: 'Work Order Lifecycle',
  description: 'Auto-stamps date/user fields on status transitions and enforces lifecycle rules',
  icon: 'GitBranch',
  objectApiName: 'WorkOrder',
  events: ['beforeUpdate'],
}
