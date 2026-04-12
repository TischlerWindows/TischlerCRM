/**
 * Single source of truth for controller IDs.
 * Each ID must match the corresponding `ControllerManifest.id` in the API registry
 * (`apps/api/src/controllers/registry.ts`).
 */
export const CONTROLLER_IDS = [] as const
export type ControllerId = (typeof CONTROLLER_IDS)[number]
