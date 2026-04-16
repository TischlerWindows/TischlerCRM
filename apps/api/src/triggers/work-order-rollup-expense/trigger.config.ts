import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'work-order-rollup-expense',
  name: 'Work Order Cost Roll-ups (Expenses)',
  description: 'Recalculates totalActualHours, totalLaborCost, totalExpenses, totalJobCost on the parent WorkOrder when WorkOrderExpense records change',
  icon: 'Calculator',
  objectApiName: 'WorkOrderExpense',
  events: ['afterCreate', 'afterUpdate', 'afterDelete'],
}
