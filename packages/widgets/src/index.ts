/**
 * Single source of truth for external widget IDs.
 * Each ID must match the corresponding `WidgetManifest.id` in the frontend registry
 * (`apps/web/widgets/external/registry.ts`) and the API registry
 * (`apps/api/src/widgets/external/registry.ts`).
 */
export const EXTERNAL_WIDGET_IDS = ['demo-widget'] as const
export type ExternalWidgetId = (typeof EXTERNAL_WIDGET_IDS)[number]
