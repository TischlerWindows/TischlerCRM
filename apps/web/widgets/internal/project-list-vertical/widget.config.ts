import type { WidgetManifest } from '@/lib/widgets/types'

// Manifest id must match the 'project-list-vertical' entry in
// packages/widgets/src/index.ts (INTERNAL_WIDGET_IDS) so the backend creates
// a WidgetSetting row for it and it shows up (enabled by default) in the
// page-editor palette.
export const config: WidgetManifest = {
  id: 'project-list-vertical',
  name: 'Project List Vertical Page',
  description: 'Same Tischler project-tracking fields as Project List, laid out as a fill-out page instead of a single row',
  icon: 'LayoutList',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
