import type { TriggerManifest } from '../../lib/triggers/types.js'

export const config: TriggerManifest = {
  id: 'create-installation-costs',
  name: 'Create Installation Cost Records',
  description: 'Auto-creates weekly cost records and tech expense records when installation dates and technicians are set',
  icon: 'Calculator',
  objectApiName: 'Installation',
  events: ['afterCreate', 'afterUpdate'],
}
