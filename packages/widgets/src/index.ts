/**
 * Single source of truth for widget IDs.
 * Each ID must match the corresponding `WidgetManifest.id` in the frontend
 * registries (`apps/web/widgets/external/registry.ts`,
 * `apps/web/widgets/internal/registry.ts`) and the API registry
 * (`apps/api/src/widgets/external/registry.ts`).
 */
export const EXTERNAL_WIDGET_IDS = ['demo-widget', 'dropbox-browser'] as const
export type ExternalWidgetId = (typeof EXTERNAL_WIDGET_IDS)[number]

export const INTERNAL_WIDGET_IDS = [
  'spacer',
  'activity-feed',
  'header-highlights',
  'file-folder',
  'related-list',
  'team-members-rollup',
  'team-member-associations',
  'team-member-slot',
  'path',
  'installation-cost-grid',
  'summary',
  'dropbox-files',
] as const
export type InternalWidgetId = (typeof INTERNAL_WIDGET_IDS)[number]

export type WidgetKind = 'external' | 'internal'
export type WidgetId = ExternalWidgetId | InternalWidgetId

export function widgetKind(id: string): WidgetKind | null {
  if ((EXTERNAL_WIDGET_IDS as readonly string[]).includes(id)) return 'external'
  if ((INTERNAL_WIDGET_IDS as readonly string[]).includes(id)) return 'internal'
  return null
}
