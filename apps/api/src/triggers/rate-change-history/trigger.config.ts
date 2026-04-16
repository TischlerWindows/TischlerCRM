import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'rate-change-history',
  name: 'Record Technician Rate Changes',
  description: 'Auto-creates a TechnicianRateHistory record when hourlyRate or overtimeRate changes',
  icon: 'History',
  objectApiName: 'Technician',
  events: ['afterUpdate'],
}
