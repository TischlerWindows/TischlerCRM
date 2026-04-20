import type { TriggerRegistration } from '../lib/triggers/types.js'
import { config as createInstCostsConfig } from './create-installation-costs/trigger.config.js'
import { handler as createInstCostsHandler } from './create-installation-costs/index.js'
import { config as rateChangeHistoryConfig } from './rate-change-history/trigger.config.js'
import { handler as rateChangeHistoryHandler } from './rate-change-history/index.js'
import { config as snapshotRateConfig } from './snapshot-rate-on-time-entry/trigger.config.js'
import { handler as snapshotRateHandler } from './snapshot-rate-on-time-entry/index.js'
import { config as woLifecycleConfig } from './work-order-lifecycle/trigger.config.js'
import { handler as woLifecycleHandler } from './work-order-lifecycle/index.js'
import { config as rollupConfig } from './work-order-rollup/trigger.config.js'
import { handler as rollupHandler } from './work-order-rollup/index.js'

// Second manifest entry for WorkOrderExpense — same handler, different object + ID
const rollupConfigExpense = {
  ...rollupConfig,
  id: 'work-order-rollup-expense',
  objectApiName: 'WorkOrderExpense',
}

export const triggerRegistrations: TriggerRegistration[] = [
  { manifest: createInstCostsConfig, handler: createInstCostsHandler },
  { manifest: rateChangeHistoryConfig, handler: rateChangeHistoryHandler },
  { manifest: snapshotRateConfig, handler: snapshotRateHandler },
  { manifest: woLifecycleConfig, handler: woLifecycleHandler },
  { manifest: rollupConfig, handler: rollupHandler },
  { manifest: rollupConfigExpense, handler: rollupHandler },
]

export const triggers = triggerRegistrations.map(r => r.manifest)
