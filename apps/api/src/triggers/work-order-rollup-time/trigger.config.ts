import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'work-order-rollup-time',
  name: 'Work Order Cost Roll-ups (Time)',
  description: 'Recalculates totalActualHours, totalLaborCost, totalExpenses, totalJobCost on the parent WorkOrder when TimeEntry records change',
  icon: 'Calculator',
  objectApiName: 'TimeEntry',
  events: ['afterCreate', 'afterUpdate', 'afterDelete'],
}
