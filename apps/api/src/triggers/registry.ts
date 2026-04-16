import type { TriggerRegistration } from '../lib/triggers/types.js'
import { config as createInstCostsConfig } from './create-installation-costs/trigger.config.js'
import { handler as createInstCostsHandler } from './create-installation-costs/index.js'
import { config as rateChangeHistoryConfig } from './rate-change-history/trigger.config.js'
import { handler as rateChangeHistoryHandler } from './rate-change-history/index.js'
import { config as snapshotRateConfig } from './snapshot-rate-on-time-entry/trigger.config.js'
import { handler as snapshotRateHandler } from './snapshot-rate-on-time-entry/index.js'

export const triggerRegistrations: TriggerRegistration[] = [
  { manifest: createInstCostsConfig, handler: createInstCostsHandler },
  { manifest: rateChangeHistoryConfig, handler: rateChangeHistoryHandler },
  { manifest: snapshotRateConfig, handler: snapshotRateHandler },
]

export const triggers = triggerRegistrations.map(r => r.manifest)
