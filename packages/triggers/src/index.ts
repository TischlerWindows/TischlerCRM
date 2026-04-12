/**
 * Single source of truth for trigger IDs.
 * Each ID must match the corresponding `TriggerManifest.id` in the API registry
 * (`apps/api/src/triggers/registry.ts`).
 */
export const TRIGGER_IDS = [] as const
export type TriggerId = (typeof TRIGGER_IDS)[number]
