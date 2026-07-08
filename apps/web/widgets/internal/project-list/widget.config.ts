import type { WidgetManifest } from '@/lib/widgets/types'

// Manifest id must match the 'project-list' entry in packages/widgets/src/index.ts
// (INTERNAL_WIDGET_IDS) so the backend creates a WidgetSetting row for it and
// it shows up (enabled by default) in the page-editor palette.
export const config: WidgetManifest = {
  id: 'project-list',
  name: 'Project List',
  description: 'Hard-coded Tischler project-tracking row — shop drawings, loading list, and completion sign-off for this Project',
  icon: 'Table',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
