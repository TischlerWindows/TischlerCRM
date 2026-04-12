import type { TriggerRegistration } from '../lib/triggers/types.js'
import { config as createInstCostsConfig } from './create-installation-costs/trigger.config.js'
import { handler as createInstCostsHandler } from './create-installation-costs/index.js'

export const triggerRegistrations: TriggerRegistration[] = [
  { manifest: createInstCostsConfig, handler: createInstCostsHandler },
]

export const triggers = triggerRegistrations.map(r => r.manifest)
