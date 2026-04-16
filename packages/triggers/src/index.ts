/**
 * Single source of truth for trigger IDs.
 * Each ID must match the corresponding `TriggerManifest.id` in the API registry
 * (`apps/api/src/triggers/registry.ts`).
 */
export const TRIGGER_IDS = [
  'create-installation-costs',
  'rate-change-history',
  'snapshot-rate-on-time-entry',
  'work-order-lifecycle',
  'work-order-rollup-time',
  'work-order-rollup-expense',
] as const
export type TriggerId = (typeof TRIGGER_IDS)[number]
