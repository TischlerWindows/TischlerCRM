import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'work-order-rollup',
  name: 'Work Order Cost Roll-ups',
  description: 'Recalculates totalActualHours, totalLaborCost, totalExpenses, totalJobCost on parent WO',
  icon: 'Calculator',
  objectApiName: 'TimeEntry',
  events: ['afterCreate', 'afterUpdate', 'afterDelete'],
}
