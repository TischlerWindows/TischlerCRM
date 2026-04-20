import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'snapshot-rate-on-time-entry',
  name: 'Snapshot Rate on Time Entry',
  description: 'Captures the technician hourly rate at entry creation and computes totals',
  icon: 'Clock',
  objectApiName: 'TimeEntry',
  events: ['beforeCreate', 'beforeUpdate'],
}
